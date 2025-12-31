import React, { useState, useEffect } from 'react';
import { Debt } from '../types';
import { canBorrow as checkCanBorrow } from '../services/economy';

interface BorrowScreenProps {
  user: { id: string; name: string; coins: number; socialDebt: number };
  activeDebts: Debt[];
  onClose: () => void;
  onBorrow: (amount: number) => Promise<{ success: boolean; error?: string }>;
  onRepay: (debtId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

type Tab = 'borrow' | 'debts';

const BorrowScreen: React.FC<BorrowScreenProps> = ({
  user,
  activeDebts,
  onClose,
  onBorrow,
  onRepay,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('borrow');
  const [borrowAmount, setBorrowAmount] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [repayDebtId, setRepayDebtId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState(0);
  const [borrowEligibility, setBorrowEligibility] = useState<{
    allowed: boolean;
    maxBorrowable: number;
    reason: string | null;
    loading: boolean;
  }>({ allowed: true, maxBorrowable: 500, reason: null, loading: true });

  const MIN_BORROW = 10;
  const MAX_BORROW = 500;
  const INTEREST_RATE = 0.10; // 10% daily

  // Check borrow eligibility on mount and when user/debt changes
  useEffect(() => {
    const checkEligibility = async () => {
      setBorrowEligibility(prev => ({ ...prev, loading: true }));
      try {
        const result = await checkCanBorrow(user.id, borrowAmount);
        setBorrowEligibility({
          allowed: result.allowed,
          maxBorrowable: result.maxBorrowable,
          reason: result.reason,
          loading: false,
        });
        // Cap borrow amount to max borrowable
        if (borrowAmount > result.maxBorrowable && result.maxBorrowable > 0) {
          setBorrowAmount(Math.max(MIN_BORROW, result.maxBorrowable));
        }
      } catch (err) {
        setBorrowEligibility({
          allowed: false,
          maxBorrowable: 0,
          reason: 'Failed to check eligibility',
          loading: false,
        });
      }
    };
    checkEligibility();
  }, [user.id, activeDebts.length]);

  // Re-check eligibility when borrow amount changes
  useEffect(() => {
    const checkAmount = async () => {
      if (borrowEligibility.loading) return;
      try {
        const result = await checkCanBorrow(user.id, borrowAmount);
        setBorrowEligibility(prev => ({
          ...prev,
          allowed: result.allowed,
          reason: result.reason,
        }));
      } catch (err) {
        // Keep previous state on error
      }
    };
    const debounce = setTimeout(checkAmount, 300);
    return () => clearTimeout(debounce);
  }, [borrowAmount, user.id, borrowEligibility.loading]);

  // Calculate projections
  const projectedInterest = Math.floor(borrowAmount * INTEREST_RATE);
  const totalOwed7Days = borrowAmount + Math.floor(borrowAmount * INTEREST_RATE * 7);

  // Get total debt
  const totalDebt = activeDebts.reduce((sum, d) => sum + (d.principal + d.accruedInterest - d.amountRepaid), 0);

  const handleBorrow = async () => {
    if (borrowAmount < MIN_BORROW || borrowAmount > MAX_BORROW) return;

    // Check eligibility before borrowing
    if (!borrowEligibility.allowed) {
      setError(borrowEligibility.reason || 'Cannot borrow at this time');
      return;
    }

    if (borrowAmount > borrowEligibility.maxBorrowable) {
      setError(`Maximum borrowable amount is ${borrowEligibility.maxBorrowable} Bingo`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await onBorrow(borrowAmount);
      if (result.success) {
        setSuccess(`Borrowed ${borrowAmount} Bingo. Debt is now your problem.`);
        setBorrowAmount(50);
        // Re-check eligibility after borrowing
        const newEligibility = await checkCanBorrow(user.id, MIN_BORROW);
        setBorrowEligibility({
          allowed: newEligibility.allowed,
          maxBorrowable: newEligibility.maxBorrowable,
          reason: newEligibility.reason,
          loading: false,
        });
      } else {
        setError(result.error || 'Failed to borrow');
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepay = async (debtId: string, amount: number) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await onRepay(debtId, amount);
      if (result.success) {
        setSuccess(`Repaid ${amount} Bingo. Good kitty.`);
        setRepayDebtId(null);
      } else {
        setError(result.error || 'Failed to repay');
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDebtStatus = (debt: Debt) => {
    const totalOwed = debt.principal + debt.accruedInterest - debt.amountRepaid;
    const daysOld = Math.floor((Date.now() - new Date(debt.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    if (debt.repoTriggered) {
      return { color: 'text-alert-red', status: 'REPO!' };
    }
    if (debt.accruedInterest > debt.principal) {
      return { color: 'text-yellow-500', status: 'HIGH INTEREST' };
    }
    if (daysOld > 5) {
      return { color: 'text-orange-500', status: `${daysOld} days` };
    }
    return { color: 'text-gray-400', status: `${daysOld} days` };
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div>
            <h1 className="text-hot-pink font-bold uppercase tracking-widest">Borrow</h1>
            <p className="text-xs text-gray-500">
              Get Bingo now. Pay more later. 🎰
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('borrow')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'borrow'
                ? 'text-hot-pink border-b-2 border-hot-pink'
                : 'text-gray-500'
            }`}
          >
            Borrow
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'debts'
                ? 'text-hot-pink border-b-2 border-hot-pink'
                : 'text-gray-500'
            }`}
          >
            My Debts {activeDebts.length > 0 && `(${activeDebts.length})`}
          </button>
        </div>
      </div>

      {/* Messages */}
      {(error || success) && (
        <div className={`mx-4 mt-4 p-3 rounded-lg ${error ? 'bg-alert-red/20 border border-alert-red' : 'bg-acid-green/20 border border-acid-green'}`}>
          <p className={error ? 'text-alert-red text-sm' : 'text-acid-green text-sm'}>
            {error || success}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Borrow Tab */}
        {activeTab === 'borrow' && (
          <div>
            {/* Current status */}
            <div className="bg-bingo-dark rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Current Balance</p>
                  <p className="text-2xl font-bold text-acid-green">{user.coins} 😼</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Outstanding Debt</p>
                  <p className={`text-2xl font-bold ${totalDebt > 0 ? 'text-alert-red' : 'text-gray-600'}`}>
                    {totalDebt > 0 ? `-${totalDebt}` : '0'} 😼
                  </p>
                </div>
              </div>
            </div>

            {/* Warning for high debt */}
            {totalDebt > 200 && (
              <div className="bg-alert-red/10 border border-alert-red rounded-lg p-4 mb-6">
                <p className="text-alert-red text-sm">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  High debt detected! Pay it down or risk repo.
                </p>
              </div>
            )}

            {/* Borrow eligibility status */}
            {!borrowEligibility.loading && (
              <div className={`rounded-lg p-4 mb-6 ${
                borrowEligibility.allowed
                  ? 'bg-acid-green/10 border border-acid-green/30'
                  : 'bg-alert-red/10 border border-alert-red/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Max Borrowable</p>
                    <p className={`text-xl font-bold ${
                      borrowEligibility.maxBorrowable > 0 ? 'text-acid-green' : 'text-alert-red'
                    }`}>
                      {borrowEligibility.maxBorrowable} Bingo
                    </p>
                  </div>
                  {!borrowEligibility.allowed && borrowEligibility.reason && (
                    <div className="text-right">
                      <p className="text-alert-red text-sm">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        {borrowEligibility.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {borrowEligibility.loading && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-center">
                <i className="fas fa-spinner fa-spin text-gray-400 mr-2"></i>
                <span className="text-gray-400 text-sm">Checking eligibility...</span>
              </div>
            )}

            {/* Borrow Amount */}
            <div className="mb-6">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-3">
                How much do you need?
              </label>
              <div className={`bg-bingo-dark rounded-lg p-6 border ${
                borrowEligibility.maxBorrowable > 0 ? 'border-gray-800' : 'border-alert-red/30'
              }`}>
                <div className="text-center mb-4">
                  <span className={`text-5xl font-black ${
                    borrowEligibility.allowed ? 'text-hot-pink' : 'text-gray-500'
                  }`}>{borrowAmount}</span>
                  <span className="text-2xl text-gray-400 ml-2">Bingo</span>
                </div>
                <input
                  type="range"
                  min={MIN_BORROW}
                  max={Math.min(MAX_BORROW, Math.max(MIN_BORROW, borrowEligibility.maxBorrowable))}
                  step={10}
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(parseInt(e.target.value))}
                  disabled={borrowEligibility.maxBorrowable < MIN_BORROW || borrowEligibility.loading}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-hot-pink disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{MIN_BORROW}</span>
                  <span>{Math.min(MAX_BORROW, borrowEligibility.maxBorrowable)}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">The Fine Print</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Daily Interest</span>
                  <span className="text-yellow-500 font-bold">{(INTEREST_RATE * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Interest per day</span>
                  <span className="text-yellow-500">+{projectedInterest} Bingo</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-800">
                  <span className="text-gray-400">After 7 days</span>
                  <span className="text-alert-red font-bold">{totalOwed7Days} Bingo owed</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-500 text-xs">
                <i className="fas fa-info-circle mr-2"></i>
                If interest exceeds principal, repo kicks in. Your winnings get seized until debt is paid. 😼
              </p>
            </div>

            {/* Borrow Button */}
            <button
              onClick={handleBorrow}
              disabled={isSubmitting || borrowAmount < MIN_BORROW || !borrowEligibility.allowed || borrowEligibility.loading}
              className="w-full bg-hot-pink text-white font-bold py-4 rounded-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Processing...</span>
              ) : borrowEligibility.loading ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Checking...</span>
              ) : !borrowEligibility.allowed ? (
                <span><i className="fas fa-ban mr-2"></i>Cannot Borrow</span>
              ) : (
                <span><i className="fas fa-hand-holding-usd mr-2"></i>Borrow {borrowAmount} Bingo</span>
              )}
            </button>
          </div>
        )}

        {/* Debts Tab */}
        {activeTab === 'debts' && (
          <div>
            {activeDebts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✨</div>
                <h2 className="text-white text-xl font-bold mb-2">Debt Free!</h2>
                <p className="text-gray-400 text-sm">
                  No outstanding debts. Keep it that way.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDebts.map((debt) => {
                  const totalOwed = debt.principal + debt.accruedInterest - debt.amountRepaid;
                  const { color, status } = formatDebtStatus(debt);

                  return (
                    <div
                      key={debt.id}
                      className={`bg-bingo-dark rounded-lg p-4 border ${
                        debt.repoTriggered ? 'border-alert-red' : 'border-gray-800'
                      }`}
                    >
                      {/* Debt Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Original Amount</p>
                          <p className="text-white font-bold">{debt.principal} Bingo</p>
                        </div>
                        <span className={`text-xs ${color} uppercase tracking-wider`}>
                          {status}
                        </span>
                      </div>

                      {/* Debt Details */}
                      <div className="grid grid-cols-3 gap-2 text-center py-3 border-y border-gray-700 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Interest</p>
                          <p className="text-yellow-500 font-bold">+{debt.accruedInterest}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Repaid</p>
                          <p className="text-acid-green font-bold">-{debt.amountRepaid}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Owed</p>
                          <p className="text-alert-red font-bold">{totalOwed}</p>
                        </div>
                      </div>

                      {/* Repay Section */}
                      {repayDebtId === debt.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500">Repay Amount</label>
                            <input
                              type="number"
                              value={repayAmount}
                              onChange={(e) => setRepayAmount(Math.min(Math.max(0, parseInt(e.target.value) || 0), Math.min(totalOwed, user.coins)))}
                              max={Math.min(totalOwed, user.coins)}
                              className="w-full bg-black border border-gray-700 rounded p-2 text-white mt-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRepayDebtId(null)}
                              className="flex-1 bg-gray-700 py-2 rounded text-white text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRepay(debt.id, repayAmount)}
                              disabled={isSubmitting || repayAmount <= 0}
                              className="flex-1 bg-acid-green py-2 rounded text-black text-sm font-bold disabled:opacity-50"
                            >
                              {isSubmitting ? 'Paying...' : 'Pay'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setRepayDebtId(debt.id);
                            setRepayAmount(Math.min(totalOwed, user.coins));
                          }}
                          disabled={user.coins === 0}
                          className="w-full bg-acid-green/20 border border-acid-green py-2 rounded text-acid-green text-sm font-bold uppercase disabled:opacity-50"
                        >
                          <i className="fas fa-money-bill-wave mr-2"></i>
                          Repay
                        </button>
                      )}

                      {/* Repo Warning */}
                      {debt.repoTriggered && (
                        <div className="mt-3 bg-alert-red/10 p-2 rounded text-alert-red text-xs">
                          <i className="fas fa-gavel mr-1"></i>
                          REPO ACTIVE: Your winnings are being seized!
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BorrowScreen;
