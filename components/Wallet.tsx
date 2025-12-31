import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AppView } from '../types';
import type { DBTransaction, DBDebt } from '../types/database';
import { supabase } from '../services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  claimAllowance,
  canClaimAllowance,
  getTimeUntilAllowance,
  getTransactionHistory,
  getActiveDebts
} from '../services/economy';

interface WalletProps {
  user: UserProfile;
  onNavigate: (view: AppView) => void;
  onBalanceUpdate: (newBalance: number) => void;
}

const Wallet: React.FC<WalletProps> = ({ user, onNavigate, onBalanceUpdate }) => {
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [debts, setDebts] = useState<DBDebt[]>([]);
  const [canClaim, setCanClaim] = useState(false);
  const [hoursUntilClaim, setHoursUntilClaim] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Realtime subscription ref
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Load allowance status and transactions
  useEffect(() => {
    const loadData = async () => {
      setLoadingTransactions(true);

      const [canClaimResult, hoursResult, txResult, debtResult] = await Promise.all([
        canClaimAllowance(user.id),
        getTimeUntilAllowance(user.id),
        getTransactionHistory(user.id, 20),
        getActiveDebts(user.id),
      ]);

      setCanClaim(canClaimResult);
      setHoursUntilClaim(hoursResult);
      setTransactions(txResult.transactions);
      setDebts(debtResult.debts);
      setLoadingTransactions(false);
    };

    loadData();
  }, [user.id]);

  // Update countdown timer
  useEffect(() => {
    if (hoursUntilClaim <= 0) return;

    const interval = setInterval(async () => {
      const hours = await getTimeUntilAllowance(user.id);
      setHoursUntilClaim(hours);
      if (hours <= 0) {
        setCanClaim(true);
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user.id, hoursUntilClaim]);

  // Realtime subscription for transaction updates (replaces polling)
  useEffect(() => {
    // Set up realtime subscription for new transactions
    const channel = supabase
      .channel(`wallet-transactions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bb_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newTransaction = payload.new as DBTransaction;

          // Add new transaction to the list (at the beginning)
          setTransactions(prev => [newTransaction, ...prev.slice(0, 19)]);

          // Fetch updated balance from the transaction
          if (newTransaction.balance_after !== undefined) {
            onBalanceUpdate(newTransaction.balance_after);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bb_debts',
          filter: `borrower_id=eq.${user.id}`,
        },
        async () => {
          // Refresh debts when any debt changes
          const debtResult = await getActiveDebts(user.id);
          setDebts(debtResult.debts);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user.id, onBalanceUpdate]);

  const handleClaimAllowance = async () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    setClaimError(null);

    const result = await claimAllowance(user.id);

    if (result.success) {
      onBalanceUpdate(result.newBalance);
      setCanClaim(false);
      setHoursUntilClaim(48);

      // Refresh transactions
      const txResult = await getTransactionHistory(user.id, 20);
      setTransactions(txResult.transactions);
    } else {
      setClaimError(result.error || 'Failed to claim allowance');
    }

    setClaiming(false);
  };

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTransactionIcon = (type: string): { icon: string; color: string } => {
    switch (type) {
      case 'allowance':
        return { icon: 'fa-gift', color: 'text-acid-green' };
      case 'login_bonus':
        return { icon: 'fa-fire', color: 'text-orange-400' };
      case 'clash_win':
        return { icon: 'fa-trophy', color: 'text-acid-green' };
      case 'clash_stake_lock':
        return { icon: 'fa-lock', color: 'text-gray-400' };
      case 'steal_success':
        return { icon: 'fa-mask', color: 'text-acid-green' };
      case 'steal_victim':
        return { icon: 'fa-mask', color: 'text-alert-red' };
      case 'steal_penalty':
        return { icon: 'fa-gavel', color: 'text-alert-red' };
      case 'borrow':
        return { icon: 'fa-hand-holding-dollar', color: 'text-hot-pink' };
      case 'repay':
        return { icon: 'fa-check-circle', color: 'text-acid-green' };
      case 'beg_reward':
        return { icon: 'fa-coins', color: 'text-cyan-glitch' };
      default:
        return { icon: 'fa-circle-dot', color: 'text-gray-400' };
    }
  };

  const totalDebt = debts.reduce((sum, d) =>
    sum + d.principal + d.accrued_interest - d.amount_repaid, 0
  );

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={() => onNavigate(AppView.SWIPE_FEED)}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div>
            <h1 className="text-acid-green font-bold uppercase tracking-widest">Your Stash</h1>
            <p className="text-xs text-gray-500">Every bingo tells a story. Mostly sad ones.</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-gray-900 to-bingo-dark border border-acid-green/30 rounded-xl p-6 mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Current Balance</div>
          <div className="text-5xl font-black text-acid-green mb-1">{user.coins}</div>
          <div className="text-sm text-gray-400">Bingos</div>
          {totalDebt > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-xs text-alert-red">Outstanding Debt</div>
              <div className="text-xl font-bold text-alert-red">-{Math.ceil(totalDebt)} Bingos</div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => onNavigate(AppView.BEG)}
            className="bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-cyan-glitch transition-colors flex flex-col items-center active:scale-[0.98]"
          >
            <i className="fas fa-hand-holding-dollar text-2xl text-cyan-glitch mb-2"></i>
            <span className="text-xs text-white uppercase font-bold">Beg</span>
            <span className="text-[10px] text-gray-500">Do a dare for bingos</span>
          </button>
          <button
            onClick={() => onNavigate(AppView.BORROW)}
            className="bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-hot-pink transition-colors flex flex-col items-center active:scale-[0.98]"
          >
            <i className="fas fa-handshake text-2xl text-hot-pink mb-2"></i>
            <span className="text-xs text-white uppercase font-bold">Borrow</span>
            <span className="text-[10px] text-gray-500">10% daily interest</span>
          </button>
        </div>

        {/* Active Debts Warning */}
        {debts.length > 0 && (
          <div className="bg-alert-red/10 border border-alert-red rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-alert-red font-bold text-sm">Active Debts</div>
                <div className="text-xs text-gray-400">{debts.length} outstanding loan(s)</div>
              </div>
              <button
                onClick={() => onNavigate(AppView.BORROW)}
                className="text-xs text-alert-red uppercase tracking-wider hover:underline"
              >
                View
              </button>
            </div>
          </div>
        )}

        {/* Daily Allowance */}
        <div className="bg-bingo-dark p-4 rounded-lg border border-gray-800 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-bold">Daily Allowance</div>
              <div className="text-xs text-gray-500">
                {canClaim
                  ? 'Free bingos for showing up. How noble.'
                  : `Next claim in ${formatTime(hoursUntilClaim)}`}
              </div>
            </div>
            <button
              onClick={handleClaimAllowance}
              disabled={!canClaim || claiming}
              className={`font-bold py-2 px-4 rounded-lg text-sm uppercase transition-all ${
                canClaim
                  ? 'bg-acid-green text-black hover:bg-acid-green/90 active:scale-95'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {claiming ? (
                <span className="flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                </span>
              ) : canClaim ? (
                'Claim 100'
              ) : (
                'Claimed'
              )}
            </button>
          </div>
          {claimError && (
            <div className="mt-2 text-xs text-alert-red">{claimError}</div>
          )}
        </div>

        {/* Transaction History */}
        <div>
          <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Recent Activity</h3>
          {loadingTransactions ? (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-600"></i>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-inbox text-3xl text-gray-700 mb-2"></i>
              <p className="text-gray-500 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const { icon, color } = getTransactionIcon(tx.type);
                const isPositive = tx.amount > 0;

                return (
                  <div
                    key={tx.id}
                    className="bg-bingo-dark/50 p-3 rounded flex items-center gap-3"
                  >
                    <div className={`w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center ${color}`}>
                      <i className={`fas ${icon} text-sm`}></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-white">{tx.description}</div>
                      <div className="text-[10px] text-gray-500">{formatDate(tx.created_at)}</div>
                    </div>
                    <div className={`font-mono font-bold ${isPositive ? 'text-acid-green' : 'text-alert-red'}`}>
                      {isPositive ? '+' : ''}{tx.amount}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Stats</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bingo-dark/50 p-3 rounded text-center">
              <div className="text-lg font-bold text-acid-green">{user.totalWins}</div>
              <div className="text-[10px] text-gray-500">Wins</div>
            </div>
            <div className="bg-bingo-dark/50 p-3 rounded text-center">
              <div className="text-lg font-bold text-hot-pink">{user.winStreak}</div>
              <div className="text-[10px] text-gray-500">Streak</div>
            </div>
            <div className="bg-bingo-dark/50 p-3 rounded text-center">
              <div className="text-lg font-bold text-cyan-glitch">{user.stealSuccessful}</div>
              <div className="text-[10px] text-gray-500">Heists</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
