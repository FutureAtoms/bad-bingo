import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import SwipeFeed from './components/SwipeFeed';
import Clash from './components/Clash';
import StealMinigame from './components/StealMinigame';
import CameraProof from './components/CameraProof';
import AddFriend from './components/AddFriend';
import ChallengeFriend from './components/ChallengeFriend';
import Profile from './components/Profile';
import Rules from './components/Rules';
import WalkthroughTutorial from './components/WalkthroughTutorial';
import NotificationCenter from './components/NotificationCenter';
import ProofVault from './components/ProofVault';
import DefenseMinigame from './components/DefenseMinigame';
import BegScreen from './components/BegScreen';
import BorrowScreen from './components/BorrowScreen';
import Wallet from './components/Wallet';
import Settings from './components/Settings';
import AgeVerification from './components/AgeVerification';
import ReportModal, { ReportType } from './components/ReportModal';
import { AppView, UserProfile, Friend, ActiveBet, RelationshipLevel, InGameNotification, StealAttempt, Debt, BegRequest } from './types';
import { triggerChallengeEffect } from './services/effects';
import { initializePushNotifications, setupPushListeners, isPushAvailable, showLocalNotification } from './services/pushNotifications';
import { savePushToken } from './services/pushTokenService';
import { onAuthStateChange, signOut, updateProfile as updateUserProfile, getOrCreateProfileFromSession } from './services/auth';
import { useUser, useFriends, useActiveBets, useNotifications } from './hooks/useSupabaseData';
import { supabase, db, isSupabaseConfigured } from './services/supabase';
import type { DBUser } from './types/database';
import { logDebug } from './utils/logger';

// Type-safe workaround for Supabase operations where inference fails
// The Database types are correct but Supabase's TypeScript bindings don't infer them


// Map DBUser to UserProfile
const mapDBUserToProfile = (dbUser: DBUser): UserProfile => ({
  id: dbUser.id,
  name: dbUser.name,
  username: dbUser.username,
  email: dbUser.email || undefined,
  age: dbUser.age,
  gender: dbUser.gender || '',
  coins: dbUser.coins,
  riskProfile: dbUser.risk_profile || '',
  bio: dbUser.bio || dbUser.risk_profile || '', // Bio is the analysis from onboarding
  avatarUrl: dbUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dbUser.id}`,
  socialDebt: dbUser.social_debt,
  totalWins: dbUser.total_wins,
  totalClashes: dbUser.total_clashes,
  winStreak: dbUser.win_streak,
  bestWinStreak: dbUser.best_win_streak,
  stealSuccessful: dbUser.steals_successful,
  stealsDefended: dbUser.steals_defended,
  timesRobbed: dbUser.times_robbed,
  pushEnabled: dbUser.push_enabled,
  soundEnabled: dbUser.sound_enabled,
  hapticsEnabled: dbUser.haptics_enabled,
  trustScore: dbUser.trust_score,
  isVerified: dbUser.is_verified,
  lastAllowanceClaimed: dbUser.last_allowance_claimed || undefined,
  lastLogin: dbUser.last_login || undefined,
  loginStreak: dbUser.login_streak,
});

const resolvePostAuthView = (profile: UserProfile): AppView => {
  // Check if onboarding was already completed (prevents re-routing on auth events)
  const onboardingComplete = localStorage.getItem('bingo_onboarding_complete');

  if (!onboardingComplete && (!profile.riskProfile || profile.riskProfile === 'Unknown risk profile')) {
    return AppView.ONBOARDING;
  }

  const tutorialSeen = localStorage.getItem('bingo_tutorial_complete');
  return tutorialSeen ? AppView.SWIPE_FEED : AppView.TUTORIAL;
};

const App: React.FC = () => {
  // Auth state
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Age verification state
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => {
    return localStorage.getItem('bingo_age_verified') === 'true';
  });

  // View state
  const [view, setView] = useState<AppView>(AppView.SPLASH);

  // Use Supabase hooks for data
  const { user, loading: userLoading, updateUser } = useUser(authUserId);
  const { friends, loading: friendsLoading, acceptFriend, removeFriend, refetch: refetchFriends } = useFriends(authUserId);
  const { bets: activeBets, loading: betsLoading, refetch: refetchBets } = useActiveBets(authUserId);
  const {
    notifications: persistentNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: refetchNotifications
  } = useNotifications(authUserId);

  // Local UI state
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [stealTarget, setStealTarget] = useState<Friend | null>(null);
  const [currentBetForProof, setCurrentBetForProof] = useState<ActiveBet | null>(null);
  const [toastNotifications, setToastNotifications] = useState<InGameNotification[]>([]);
  const [challengeTarget, setChallengeTarget] = useState<Friend | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Defense state
  const [incomingSteal, setIncomingSteal] = useState<StealAttempt | null>(null);
  const [stealThief, setStealThief] = useState<{ name: string; avatarUrl: string } | null>(null);

  // Proof vault state
  const [proofVaultBet, setProofVaultBet] = useState<ActiveBet | null>(null);

  // Beg state
  const [activeBeg, setActiveBeg] = useState<BegRequest | undefined>(undefined);

  // Borrow state
  const [activeDebts, setActiveDebts] = useState<Debt[]>([]);

  // Interrogation retake mode state
  const [isRetakeMode, setIsRetakeMode] = useState(false);

  // Report modal state (centralized for all views)
  const [reportModalState, setReportModalState] = useState<{
    isOpen: boolean;
    type: ReportType;
    id: string;
    userId?: string;
    context?: string;
  }>({
    isOpen: false,
    type: 'bet',
    id: '',
    userId: undefined,
    context: undefined,
  });

  // Track if initial auth has been resolved to prevent re-routing on subsequent auth events
  const initialAuthResolved = React.useRef(false);

  // 1. Auth state listener - runs once on mount
  useEffect(() => {
    let hasResolved = false;

    logDebug('[App] Setting up auth state listener');

    const unsubscribe = onAuthStateChange(async (dbUser) => {
      logDebug('[App] Auth state changed:', {
        hasUser: !!dbUser,
        userId: dbUser?.id,
        riskProfile: dbUser?.risk_profile,
        hasResolved,
        initialAuthResolved: initialAuthResolved.current
      });

      hasResolved = true;

      if (dbUser) {
        setAuthUserId(dbUser.id);
        const profile = mapDBUserToProfile(dbUser);
        const nextView = resolvePostAuthView(profile);

        // Only route if this is the initial auth resolution OR if user just signed in
        // Don't re-route if already authenticated (prevents unwanted navigation on token refresh)
        if (!initialAuthResolved.current) {
          logDebug('[App] Initial auth - routing to:', nextView);
          setView(nextView);
          initialAuthResolved.current = true;
        } else {
          logDebug('[App] Subsequent auth event - NOT re-routing (already at:', nextView, ')');
        }
      } else {
        // User signed out or no user - reset the flag and go to SPLASH
        initialAuthResolved.current = false;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { user: profileUser, error } = await getOrCreateProfileFromSession();
            if (profileUser) {
              const profile = mapDBUserToProfile(profileUser);
              const nextView = resolvePostAuthView(profile);
              logDebug('[App] Session hydrate routing ->', nextView);
              setAuthUserId(profile.id);
              setView(nextView);
              initialAuthResolved.current = true;
            } else {
              logDebug('[App] Session found but profile unresolved, showing SPLASH', { error });
              setAuthUserId(null);
              setView(AppView.SPLASH);
            }
          } else {
            logDebug('[App] No user, showing SPLASH');
            setAuthUserId(null);
            setView(AppView.SPLASH);
          }
        } catch (err) {
          logDebug('[App] Failed session check, showing SPLASH');
          setAuthUserId(null);
          setView(AppView.SPLASH);
        }
      }
      setIsInitializing(false);
    });

    // Fallback timeout - if auth check takes too long, go to login
    // Increased to 10s to handle slow network/database queries
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        logDebug('[App] Auth check timeout - showing login screen');
        setAuthUserId(null);
        setView(AppView.SPLASH);
        setIsInitializing(false);
      }
    }, 10000);

    return () => {
      logDebug('[App] Cleaning up auth listener');
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // 2. Push Notifications Setup
  useEffect(() => {
    if (!authUserId || !user || !isPushAvailable()) return;

    const initPush = async () => {
      const result = await initializePushNotifications();
      if (result.success) {
        setPushEnabled(true);
      }
    };

    initPush();

    const cleanup = setupPushListeners({
      onRegistration: async (token) => {
        setPushToken(token);
        if (authUserId) {
          await savePushToken(authUserId, token, 'android');
        }
      },
      onRegistrationError: (error) => {
        console.error('Push registration failed:', error);
        addToastNotification({
          id: `push-error-${Date.now()}`,
          type: 'system',
          title: 'Notifications',
          message: 'Could not enable notifications. Check your settings.',
          priority: 'normal',
          read: false,
          timestamp: Date.now()
        });
      },
      onNotificationReceived: (notification) => {
        const notifType = (notification.data?.type as string) || 'system';
        const validTypes: Array<'robbery' | 'clash' | 'proof' | 'system' | 'badge' | 'debt' | 'beg'> = ['robbery', 'clash', 'proof', 'system', 'badge', 'debt', 'beg'];
        addToastNotification({
          id: notification.id || `notif-${Date.now()}`,
          type: validTypes.includes(notifType as any) ? (notifType as 'robbery' | 'clash' | 'proof' | 'system' | 'badge' | 'debt' | 'beg') : 'system',
          title: notification.title,
          message: notification.body,
          priority: (notification.data?.priority as 'critical' | 'high' | 'medium' | 'normal') || 'normal',
          read: false,
          timestamp: Date.now()
        });
        refetchNotifications();
      },
      onNotificationTapped: (notification) => {
        // Handle deep linking from push notifications
        // Map notification types to appropriate screens:
        // - challenge -> SWIPE_FEED (respond to bet challenge)
        // - clash/win/loss -> DASHBOARD (view active clashes and results)
        // - steal/robbery -> DEFENSE (defend against steals)
        // - proof -> PROOF_VAULT (view submitted proofs)
        // - debt -> BORROW (manage debts)
        // - beg -> BEG (handle beg requests)
        // - badge -> PROFILE (view earned badges)
        const type = notification.data?.type as string;
        switch (type) {
          case 'challenge':
            // New bet challenges → go to SwipeFeed to respond
            setView(AppView.SWIPE_FEED);
            break;
          case 'clash':
          case 'win':
          case 'loss':
            // Clash-related notifications → go to Dashboard
            setView(AppView.DASHBOARD);
            break;
          case 'steal':
          case 'robbery':
            setView(AppView.DEFENSE);
            break;
          case 'proof':
          case 'proof_received':
          case 'proof_needed':
            setView(AppView.PROOF_VAULT);
            break;
          case 'debt':
            setView(AppView.BORROW);
            break;
          case 'beg':
            setView(AppView.BEG);
            break;
          case 'badge':
            setView(AppView.PROFILE);
            break;
          case 'system':
            // For system notifications about bets, go to swipe feed
            if (notification.body?.toLowerCase().includes('bet')) {
              setView(AppView.SWIPE_FEED);
            } else {
              setView(AppView.NOTIFICATIONS);
            }
            break;
          default:
            // For unknown types, go to notifications to see what it is
            setView(AppView.NOTIFICATIONS);
            break;
        }
      }
    });

    return cleanup;
  }, [authUserId, user, refetchNotifications]);

  // 3. Realtime subscriptions for steals (defense alerts)
  useEffect(() => {
    if (!authUserId) return;

    const stealSubscription = supabase
      .channel(`steals:${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bb_steals',
          filter: `target_id=eq.${authUserId}`,
        },
        async (payload) => {
          const steal = payload.new as any;
          if (steal.status === 'in_progress' && steal.target_was_online) {
            // Get thief info
            const { data: thiefData } = await supabase
              .from('bb_users')
              .select('name, avatar_url')
              .eq('id', steal.thief_id)
              .single();

            if (thiefData) {
              const thief = thiefData as { name: string; avatar_url: string | null };
              setIncomingSteal({
                id: steal.id,
                thiefId: steal.thief_id,
                targetId: steal.target_id,
                targetName: user?.name || 'You',
                stealPercentage: steal.steal_percentage,
                potentialAmount: steal.potential_amount,
                targetWasOnline: steal.target_was_online,
                defenseWindowEnd: steal.defense_window_end,
                wasDefended: false,
                status: 'in_progress',
                thiefPenalty: steal.thief_penalty || 0,
              });
              setStealThief({
                name: thief.name,
                avatarUrl: thief.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${steal.thief_id}`,
              });
              setView(AppView.DEFENSE);
            }
          }
        }
      )
      .subscribe();

    return () => {
      stealSubscription.unsubscribe();
    };
  }, [authUserId, user]);

  // 4. Realtime subscription for notifications (for cross-device push)
  // This is CRITICAL: when another user creates a bet/notification for you,
  // the notification is inserted into bb_notifications. Your app needs to
  // listen for this and show a local notification in the Android tray.
  useEffect(() => {
    if (!authUserId) return;

    logDebug('[App] Setting up notification subscription for user:', authUserId);

    const notificationSubscription = supabase
      .channel(`notifications:${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bb_notifications',
          filter: `user_id=eq.${authUserId}`,
        },
        async (payload) => {
          const notification = payload.new as any;
          logDebug('[App] New notification received via realtime:', notification);

          // Show local notification in Android system tray
          await showLocalNotification(
            notification.title || 'Bad Bingo',
            notification.message || 'You have a new notification',
            {
              type: notification.type,
              referenceType: notification.reference_type,
              referenceId: notification.reference_id,
              notificationId: notification.id,
            }
          );

          // Also show in-app toast
          const notifType = notification.type || 'system';
          const validTypes: Array<'robbery' | 'clash' | 'proof' | 'system' | 'badge' | 'debt' | 'beg'> = ['robbery', 'clash', 'proof', 'system', 'badge', 'debt', 'beg'];
          addToastNotification({
            id: notification.id || `notif-${Date.now()}`,
            type: validTypes.includes(notifType as any) ? (notifType as 'robbery' | 'clash' | 'proof' | 'system' | 'badge' | 'debt' | 'beg') : 'system',
            title: notification.title || 'Notification',
            message: notification.message || '',
            priority: notification.priority || 'normal',
            read: false,
            timestamp: Date.now()
          });

          // Refresh notifications list
          refetchNotifications();
        }
      )
      .subscribe();

    return () => {
      logDebug('[App] Cleaning up notification subscription');
      notificationSubscription.unsubscribe();
    };
  }, [authUserId, refetchNotifications]);

  // Fetch debts for borrow screen
  useEffect(() => {
    if (!authUserId) return;

    const fetchDebts = async () => {
      const { data } = await supabase
        .from('bb_debts')
        .select('*')
        .eq('borrower_id', authUserId)
        .eq('status', 'active');

      if (data) {
        setActiveDebts(data.map((d: any) => ({
          id: d.id,
          principal: d.principal,
          interestRate: d.interest_rate,
          accruedInterest: d.accrued_interest,
          totalOwed: d.principal + d.accrued_interest - d.amount_repaid,
          amountRepaid: d.amount_repaid,
          status: d.status,
          repoTriggered: d.repo_triggered,
          createdAt: d.created_at,
          dueAt: d.due_at,
        })));
      }
    };

    fetchDebts();
  }, [authUserId]);

  // Toast notification handler
  const addToastNotification = (n: InGameNotification) => {
    setToastNotifications(prev => [n, ...prev]);
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(x => x.id !== n.id));
    }, 4000);
  };

  // Handle successful login
  const handleLoginSuccess = useCallback((profile: UserProfile) => {
    logDebug('[App] handleLoginSuccess called:', {
      userId: profile.id,
      riskProfile: profile.riskProfile,
      name: profile.name
    });

    setAuthUserId(profile.id);
    const nextView = resolvePostAuthView(profile);
    logDebug('[App] handleLoginSuccess ->', nextView);
    setView(nextView);
  }, []);

  const checkSessionAndRoute = useCallback(async () => {
    if (view !== AppView.SPLASH) return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { user: profileUser, error } = await getOrCreateProfileFromSession();
    if (!profileUser) {
      logDebug('[App] Session found but profile missing', { error });
      return false;
    }

    const profile = mapDBUserToProfile(profileUser);
    const nextView = resolvePostAuthView(profile);
    logDebug('[App] Session hydrate routing ->', nextView);
    setAuthUserId(profile.id);
    setView(nextView);
    return true;
  }, [view]);

  // Fallback: if auth is established but we're still on SPLASH, advance to the right screen
  useEffect(() => {
    if (!authUserId || !user || view !== AppView.SPLASH) return;

    const nextView = resolvePostAuthView(user);
    logDebug('[App] Auth fallback routing ->', nextView);
    setView(nextView);
  }, [authUserId, user, view]);

  // Poll for session while on login to catch missed auth events
  useEffect(() => {
    if (view !== AppView.SPLASH || authUserId) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      await checkSessionAndRoute();
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [authUserId, checkSessionAndRoute, view]);

  const handleOnboardingComplete = async (profile: UserProfile) => {
    // Update profile in Supabase with extended profile data
    await updateUserProfile(profile.id, {
      risk_profile: profile.riskProfile,
      bio: profile.bio || profile.riskProfile || null, // Save the analysis as bio
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      // Extended profile fields (Phase 4)
      work: profile.work || null,
      schools: profile.schools || null,
      has_pets: profile.hasPets || false,
      pet_type: profile.petType || null,
      sibling_count: profile.siblingCount || 0,
      city: profile.city || null,
      vices: profile.vices || null,
      triggers: profile.triggers || null,
      common_lies: profile.commonLies || null,
      relationship_status: profile.relationshipStatus || null,
      daily_routine: profile.dailyRoutine || null,
    });

    // Handle retake mode - go back to profile instead of tutorial
    if (isRetakeMode) {
      setIsRetakeMode(false);
      setView(AppView.PROFILE);
      return;
    }

    // Mark onboarding as complete to prevent re-routing on future auth events
    localStorage.setItem('bingo_onboarding_complete', 'true');

    const tutorialSeen = localStorage.getItem('bingo_tutorial_complete');
    if (!tutorialSeen) {
      setView(AppView.TUTORIAL);
    } else {
      setView(AppView.SWIPE_FEED);
    }
  };

  // Handle retake interrogation from profile
  const handleRetakeInterrogation = () => {
    setIsRetakeMode(true);
    setView(AppView.ONBOARDING);
  };

  const handleTutorialComplete = () => {
    localStorage.setItem('bingo_tutorial_complete', 'true');
    setView(AppView.SWIPE_FEED);
  };

  const handleSelectFriend = (friend: Friend) => {
    setSelectedFriend(friend);
    setView(AppView.CLASH);
  };

  const handleSteal = (friend: Friend) => {
    setStealTarget(friend);
    setView(AppView.STEAL);
  };

  const handleStealResult = async (amount: number) => {
    if (user) {
      await updateUser({ coins: user.coins + amount });
      addToastNotification({
        id: `steal-${Date.now()}`,
        type: 'robbery',
        title: 'Heist Success',
        message: `Clean heist! You snatched ${amount} Bingo.`,
        priority: 'high',
        read: false,
        timestamp: Date.now()
      });
    }
    setStealTarget(null);
    setView(AppView.SWIPE_FEED);
  };

  const handleStealFail = async (penalty?: number) => {
    if (user && penalty) {
      await updateUser({ coins: Math.max(0, user.coins - penalty) });
      addToastNotification({
        id: `steal-fail-${Date.now()}`,
        type: 'robbery',
        title: 'Busted!',
        message: `Caught! You lost ${penalty} Bingo as penalty.`,
        priority: 'critical',
        read: false,
        timestamp: Date.now()
      });
    }
    setStealTarget(null);
    setView(AppView.SWIPE_FEED);
  };

  const handleBetCreated = async (bet: ActiveBet) => {
    // CRITICAL FIX (Task 1.3): Don't create clash here!
    // The clash is already created by swipeBet() in services/bets.ts when:
    // 1. User swipes on a bet
    // 2. swipeBet checks if opponent has swiped
    // 3. If opponent has swiped with opposite vote, swipeBet creates the clash
    //
    // This handler is called AFTER the clash is created, just to update local state
    // and show a notification. Creating another clash here would cause duplicates.

    // Refresh bets from database to get the newly created clash
    refetchBets();

    // Show notification about the clash
    addToastNotification({
      id: `bet-${Date.now()}`,
      type: 'clash',
      title: 'CLASH!',
      message: `It's on! You and ${bet.opponentName} disagree. ${bet.stake * 2} bingos in the pot!`,
      priority: 'high',
      read: false,
      timestamp: Date.now()
    });
  };

  const handleOpenProof = (bet: ActiveBet) => {
    setCurrentBetForProof(bet);
    setView(AppView.CAMERA);
  };

  const handleViewProof = (bet: ActiveBet) => {
    setProofVaultBet(bet);
    setView(AppView.PROOF_VAULT);
  };

  const handleProofSent = async (storagePath: string, viewDurationHours: number, isViewOnce: boolean) => {
    if (currentBetForProof) {
      await db
        .from('bb_clashes')
        .update({
          status: 'proof_submitted',
          proof_url: storagePath,
          proof_submitted_at: new Date().toISOString(),
          proof_view_duration: viewDurationHours,
          proof_is_view_once: isViewOnce,
        })
        .eq('id', currentBetForProof.id);

      refetchBets();
    }
    setCurrentBetForProof(null);
    setView(AppView.SWIPE_FEED);
    addToastNotification({
      id: `proof-${Date.now()}`,
      type: 'proof',
      title: 'Proof Sent',
      message: "Proof submitted. Now we wait for the council to judge you.",
      priority: 'normal',
      read: false,
      timestamp: Date.now()
    });
  };

  const handleAddFriend = async (newFriend: Friend) => {
    refetchFriends();
    setView(AppView.SWIPE_FEED);

    addToastNotification({
      id: `friend-${Date.now()}`,
      type: 'system',
      title: 'Invite Sent',
      message: `Invite sent. ${newFriend.name} has no idea what they're getting into.`,
      priority: 'normal',
      read: false,
      timestamp: Date.now()
    });
  };

  const handleAcceptFriend = async (friend: Friend) => {
    // Find friendship ID (would need to track this properly)
    const { data: friendshipData } = await supabase
      .from('bb_friendships')
      .select('id')
      .or(`user_id.eq.${authUserId},friend_id.eq.${authUserId}`)
      .or(`user_id.eq.${friend.id},friend_id.eq.${friend.id}`)
      .single();

    const friendship = friendshipData as { id: string } | null;
    if (friendship) {
      await acceptFriend(friendship.id);
    }
  };

  const handleRejectFriend = async (friend: Friend) => {
    const { data: friendshipData } = await supabase
      .from('bb_friendships')
      .select('id')
      .or(`user_id.eq.${authUserId},friend_id.eq.${authUserId}`)
      .or(`user_id.eq.${friend.id},friend_id.eq.${friend.id}`)
      .single();

    const friendship = friendshipData as { id: string } | null;
    if (friendship) {
      await removeFriend(friendship.id);
    }
  };

  const handleChallengeFriend = (friend: Friend) => {
    setChallengeTarget(friend);
    setView(AppView.CREATE_BET);
  };

  const handleChallengeCreated = async (bet: ActiveBet) => {
    await handleBetCreated(bet);
    triggerChallengeEffect();
    addToastNotification({
      id: `challenge-${Date.now()}`,
      type: 'clash',
      title: 'Challenge Sent!',
      message: `${challengeTarget?.name} has been challenged! They have until the timer runs out to respond.`,
      priority: 'high',
      read: false,
      timestamp: Date.now()
    });
    setChallengeTarget(null);
    setView(AppView.SWIPE_FEED);
  };

  // Defense handlers
  const handleDefendSuccess = async () => {
    if (incomingSteal && user) {
      // Update steal record
      await db
        .from('bb_steals')
        .update({
          status: 'defended',
          was_defended: true,
        })
        .eq('id', incomingSteal.id);

      // Award defense bonus
      const bonus = incomingSteal.potentialAmount * 2;
      await updateUser({
        coins: user.coins + bonus,
        stealsDefended: (user.stealsDefended || 0) + 1
      });

      addToastNotification({
        id: `defend-${Date.now()}`,
        type: 'robbery',
        title: 'Defended!',
        message: `You caught the thief! Earned ${bonus} Bingo bonus.`,
        priority: 'high',
        read: false,
        timestamp: Date.now()
      });
    }
    setIncomingSteal(null);
    setStealThief(null);
    setView(AppView.SWIPE_FEED);
  };

  const handleDefendFail = async () => {
    if (incomingSteal && user) {
      await db
        .from('bb_steals')
        .update({
          status: 'success',
          actual_amount: incomingSteal.potentialAmount,
        })
        .eq('id', incomingSteal.id);

      await updateUser({
        coins: Math.max(0, user.coins - incomingSteal.potentialAmount),
        timesRobbed: (user.timesRobbed || 0) + 1
      });

      addToastNotification({
        id: `robbed-${Date.now()}`,
        type: 'robbery',
        title: 'Robbed!',
        message: `${stealThief?.name} got away with ${incomingSteal.potentialAmount} Bingo!`,
        priority: 'critical',
        read: false,
        timestamp: Date.now()
      });
    }
    setIncomingSteal(null);
    setStealThief(null);
    setView(AppView.SWIPE_FEED);
  };

  // Proof vault handlers
  const handleProofAccept = async () => {
    if (proofVaultBet) {
      await db
        .from('bb_clashes')
        .update({
          status: 'completed',
          winner_id: proofVaultBet.isProver ? proofVaultBet.opponentId : user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', proofVaultBet.id);

      refetchBets();
    }
    setProofVaultBet(null);
    setView(AppView.DASHBOARD);
  };

  const handleProofDispute = async (reason: string) => {
    if (proofVaultBet) {
      await db
        .from('bb_clashes')
        .update({
          status: 'disputed',
          dispute_reason: reason,
          disputed_by: user?.id,
        })
        .eq('id', proofVaultBet.id);

      refetchBets();
      addToastNotification({
        id: `dispute-${Date.now()}`,
        type: 'proof',
        title: 'Dispute Filed',
        message: 'Your dispute has been submitted for review.',
        priority: 'normal',
        read: false,
        timestamp: Date.now()
      });
    }
    setProofVaultBet(null);
    setView(AppView.DASHBOARD);
  };

  // Beg handlers
  const handleSubmitBeg = async (targetId: string) => {
    const { data, error } = await db
      .from('bb_begs')
      .insert({
        beggar_id: authUserId,
        target_id: targetId,
        status: 'pending',
      })
      .select()
      .single();
    if (data) {
      setActiveBeg({
        id: data.id,
        targetId: data.target_id,
        targetName: friends.find(f => f.id === targetId)?.name || 'Friend',
        rewardAmount: 0,
        status: 'pending',
        createdAt: data.created_at,
      });
    }
  };

  const handleSubmitDareProof = async (begId: string, proofUrl: string) => {
    await db
      .from('bb_begs')
      .update({
        proof_url: proofUrl,
        status: 'proof_submitted',
      })
      .eq('id', begId);
  };

  // Borrow handlers
  const handleBorrow = async (amount: number) => {
    if (!authUserId || !user) return { success: false, error: 'Not authenticated' };

    try {
      // Create debt record
      await supabase.from('bb_debts').insert({
        borrower_id: authUserId,
        principal: amount,
        interest_rate: 0.10,
        status: 'active',
      });

      // Add bingos to user
      await updateUser({ coins: user.coins + amount });

      // Refresh debts
      const { data } = await db
        .from('bb_debts')
        .select('*')
        .eq('borrower_id', authUserId)
        .eq('status', 'active');

      if (data) {
        setActiveDebts(data.map((d: any) => ({
          id: d.id,
          principal: d.principal,
          interestRate: d.interest_rate,
          accruedInterest: d.accrued_interest,
          totalOwed: d.principal + d.accrued_interest - d.amount_repaid,
          amountRepaid: d.amount_repaid,
          status: d.status,
          repoTriggered: d.repo_triggered,
          createdAt: d.created_at,
        })));
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to borrow' };
    }
  };

  const handleRepay = async (debtId: string, amount: number) => {
    if (!authUserId || !user) return { success: false, error: 'Not authenticated' };

    try {
      const debt = activeDebts.find(d => d.id === debtId);
      if (!debt) return { success: false, error: 'Debt not found' };

      const newRepaid = debt.amountRepaid + amount;
      const totalOwed = debt.principal + debt.accruedInterest;
      const isFullyRepaid = newRepaid >= totalOwed;

      await db
        .from('bb_debts')
        .update({
          amount_repaid: newRepaid,
          status: isFullyRepaid ? 'repaid' : 'active',
        })
        .eq('id', debtId);

      // Deduct bingos
      await updateUser({ coins: user.coins - amount });

      // Refresh debts
      const { data } = await db
        .from('bb_debts')
        .select('*')
        .eq('borrower_id', authUserId)
        .eq('status', 'active');

      if (data) {
        setActiveDebts(data.map((d: any) => ({
          id: d.id,
          principal: d.principal,
          interestRate: d.interest_rate,
          accruedInterest: d.accrued_interest,
          totalOwed: d.principal + d.accrued_interest - d.amount_repaid,
          amountRepaid: d.amount_repaid,
          status: d.status,
          repoTriggered: d.repo_triggered,
          createdAt: d.created_at,
        })));
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to repay' };
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthUserId(null);
    setView(AppView.SPLASH);
  };

  const handleAgeVerified = () => {
    setIsAgeVerified(true);
  };

  // Report modal handlers
  const openReportModal = (type: ReportType, id: string, userId?: string, context?: string) => {
    setReportModalState({
      isOpen: true,
      type,
      id,
      userId,
      context,
    });
  };

  const closeReportModal = () => {
    setReportModalState(prev => ({
      ...prev,
      isOpen: false,
    }));
  };

  // Show configuration error if Supabase is not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="w-screen h-screen bg-bingo-black flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-hot-pink font-bold text-2xl mb-4 uppercase tracking-wider">
            Configuration Required
          </h1>
          <p className="text-gray-400 mb-6 font-mono text-sm leading-relaxed">
            Supabase credentials are not configured. Create a <code className="text-acid-green">.env</code> file with:
          </p>
          <div className="bg-bingo-dark border border-gray-700 rounded-lg p-4 text-left font-mono text-xs text-gray-300 mb-6">
            <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
          </div>
          <p className="text-gray-500 text-xs">
            Then rebuild and redeploy the app.
          </p>
        </div>
      </div>
    );
  }

  // Show age verification if not verified
  if (!isAgeVerified) {
    return <AgeVerification onVerified={handleAgeVerified} />;
  }

  // Show loading screen while initializing
  if (isInitializing) {
    return (
      <div className="w-screen h-screen bg-bingo-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">😼</div>
          <div className="text-acid-green font-mono text-sm uppercase tracking-widest">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-bingo-black overflow-hidden font-sans select-none relative">

      {/* Notification Toast Layer */}
      <div className="absolute top-0 left-0 right-0 z-[100] p-4 pointer-events-none flex flex-col items-center gap-2">
        {toastNotifications.map(n => (
          <div key={n.id} className={`animate-in slide-in-from-top duration-300 w-full max-w-sm p-4 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] border-l-4 pointer-events-auto flex items-center gap-3 backdrop-blur-md ${
            n.priority === 'critical' ? 'bg-red-900/90 border-alert-red text-white' :
            n.priority === 'high' ? 'bg-gray-900/90 border-hot-pink text-white' :
            'bg-gray-900/90 border-acid-green text-gray-200'
          }`}>
            <div className={`text-2xl ${n.priority === 'critical' ? 'animate-pulse' : ''}`}>
              {n.type === 'clash' && '⚔️'}
              {n.type === 'robbery' && '🚨'}
              {n.type === 'proof' && '📸'}
              {n.type === 'system' && '😼'}
              {n.type === 'badge' && '🏆'}
              {n.type === 'debt' && '💀'}
              {n.type === 'beg' && '🥺'}
            </div>
            <div className="flex-1">
              {n.title && <div className="text-xs text-gray-400 uppercase tracking-wider">{n.title}</div>}
              <div className="text-sm font-bold font-mono leading-tight">
                {n.message}
              </div>
            </div>
          </div>
        ))}
      </div>

      {view === AppView.SPLASH && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}

      {view === AppView.ONBOARDING && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          mode={isRetakeMode ? 'retake' : 'initial'}
          existingProfile={isRetakeMode && user ? user : undefined}
        />
      )}

      {view === AppView.SWIPE_FEED && user && (
        <SwipeFeed
          user={user}
          friends={friends}
          onNavigate={setView}
          onBetCreated={handleBetCreated}
          unreadNotifications={unreadCount}
          onReportBet={(betId, betText, opponentId) => openReportModal('bet', betId, opponentId, betText)}
        />
      )}

      {view === AppView.DASHBOARD && user && (
        <Dashboard
          user={user}
          activeBets={activeBets}
          friends={friends}
          onNavigate={setView}
          onSelectFriend={handleSelectFriend}
          onSteal={handleSteal}
          onChallenge={handleChallengeFriend}
          onOpenProof={handleOpenProof}
          onAddFriend={() => setView(AppView.ADD_FRIEND)}
          onAcceptFriend={handleAcceptFriend}
          onRejectFriend={handleRejectFriend}
        />
      )}

      {view === AppView.ADD_FRIEND && user && (
        <AddFriend
          user={user}
          onClose={() => setView(AppView.SWIPE_FEED)}
          onAdd={handleAddFriend}
        />
      )}

      {view === AppView.CLASH && selectedFriend && user && (
        <Clash
          friend={selectedFriend}
          user={user}
          onClose={() => setView(AppView.SWIPE_FEED)}
          onBetCreated={handleBetCreated}
        />
      )}

      {view === AppView.CAMERA && currentBetForProof && user && (
        <CameraProof
          bet={currentBetForProof}
          userId={user.id}
          clashId={currentBetForProof.id}
          onClose={() => setView(AppView.SWIPE_FEED)}
          onSend={handleProofSent}
        />
      )}

      {view === AppView.STEAL && user && (
        stealTarget ? (
          <StealMinigame
            user={user}
            target={stealTarget}
            onClose={() => { setStealTarget(null); setView(AppView.DASHBOARD); }}
            onSuccess={handleStealResult}
            onFail={handleStealFail}
          />
        ) : (
          <div className="h-full bg-bingo-black flex flex-col">
            <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
              <div className="p-4 flex items-center gap-3 border-b border-gray-800">
                <button
                  onClick={() => setView(AppView.DASHBOARD)}
                  className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
                >
                  <i className="fas fa-arrow-left text-2xl"></i>
                </button>
                <div>
                  <h1 className="text-acid-green font-bold uppercase tracking-widest">Pick Your Victim</h1>
                  <p className="text-xs text-gray-500">Choose wisely. Or don't. I'm not your mom.</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {friends.filter(f => f.friendshipStatus === 'accepted').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <i className="fas fa-user-slash text-5xl text-gray-700 mb-4"></i>
                  <p className="text-gray-500">No victims in your pride yet. Recruit some first.</p>
                  <button
                    onClick={() => setView(AppView.ADD_FRIEND)}
                    className="mt-4 bg-acid-green text-black font-bold py-3 px-6 rounded-lg uppercase"
                  >
                    Add Friends
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.filter(f => f.friendshipStatus === 'accepted').map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => handleSteal(friend)}
                      className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-hot-pink transition-colors flex items-center gap-4"
                    >
                      <img src={friend.avatarUrl} alt={friend.name} className="w-12 h-12 rounded-full border-2 border-gray-700" />
                      <div className="flex-1 text-left">
                        <div className="text-white font-bold">{friend.name}</div>
                        <div className="text-xs text-gray-500">{friend.coins} Bingo in stash</div>
                      </div>
                      <div className="text-hot-pink">
                        <i className="fas fa-mask text-xl"></i>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {view === AppView.DEFENSE && incomingSteal && stealThief && user && (
        <DefenseMinigame
          steal={incomingSteal}
          thief={stealThief}
          userId={user.id}
          onDefendSuccess={handleDefendSuccess}
          onDefendFail={handleDefendFail}
          onClose={() => { setIncomingSteal(null); setStealThief(null); setView(AppView.SWIPE_FEED); }}
        />
      )}

      {view === AppView.PROOF_VAULT && proofVaultBet && (
        <ProofVault
          bet={proofVaultBet}
          userId={user?.id}
          onClose={() => { setProofVaultBet(null); setView(AppView.DASHBOARD); }}
          onAccept={handleProofAccept}
          onDispute={handleProofDispute}
        />
      )}

      {view === AppView.NOTIFICATIONS && (
        <NotificationCenter
          notifications={persistentNotifications}
          unreadCount={unreadCount}
          onClose={() => setView(AppView.SWIPE_FEED)}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onNavigate={setView}
        />
      )}

      {view === AppView.BEG && user && (
        <BegScreen
          user={user}
          friends={friends}
          activeBeg={activeBeg}
          onClose={() => setView(AppView.WALLET)}
          onSubmitBeg={handleSubmitBeg}
          onSubmitDareProof={handleSubmitDareProof}
        />
      )}

      {view === AppView.BORROW && user && (
        <BorrowScreen
          user={user}
          activeDebts={activeDebts}
          onClose={() => setView(AppView.WALLET)}
          onBorrow={handleBorrow}
          onRepay={handleRepay}
        />
      )}

      {view === AppView.PROFILE && user && (
        <Profile
          user={user}
          onBack={() => setView(AppView.SWIPE_FEED)}
          onOpenRules={() => setView(AppView.RULES)}
          onOpenSettings={() => setView(AppView.SETTINGS)}
          onProfileUpdate={(updates) => updateUser(updates)}
          onRetakeInterrogation={handleRetakeInterrogation}
        />
      )}

      {view === AppView.SETTINGS && user && (
        <Settings
          user={user}
          onNavigate={setView}
          onLogout={handleSignOut}
          onUpdateUser={(updates) => updateUser(updates)}
        />
      )}

      {view === AppView.WALLET && user && (
        <Wallet
          user={user}
          onNavigate={setView}
          onBalanceUpdate={(newBalance: number) => updateUser({ coins: newBalance })}
        />
      )}

      {view === AppView.TUTORIAL && (
        <WalkthroughTutorial onComplete={handleTutorialComplete} />
      )}

      {view === AppView.RULES && (
        <Rules onClose={() => setView(AppView.SWIPE_FEED)} />
      )}

      {view === AppView.CREATE_BET && user && (
        <ChallengeFriend
          user={user}
          friend={challengeTarget || undefined}
          friends={friends.filter(f => f.friendshipStatus === 'accepted')}
          onClose={() => { setChallengeTarget(null); setView(AppView.SWIPE_FEED); }}
          onChallenge={handleChallengeCreated}
        />
      )}

      {/* Centralized Report Modal - renders on top of all views */}
      {user && (
        <ReportModal
          isOpen={reportModalState.isOpen}
          onClose={closeReportModal}
          reporterId={user.id}
          reportType={reportModalState.type}
          reportedId={reportModalState.id}
          reportedUserId={reportModalState.userId}
          contextInfo={reportModalState.context}
        />
      )}
    </div>
  );
};

export default App;
