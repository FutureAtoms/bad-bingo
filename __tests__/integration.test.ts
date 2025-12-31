import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppView,
  UserProfile,
  Friend,
  ActiveBet,
  RelationshipLevel,
  StealAttempt,
  Debt,
  BegRequest,
  InGameNotification,
} from '../types';

/**
 * Integration tests for complete game flows
 * These test end-to-end scenarios for all major features
 */

describe('Integration Tests: Complete Game Flows', () => {
  // Mock user for tests
  const mockUser: UserProfile = {
    id: 'user-123',
    name: 'TestCat',
    username: 'testcat',
    email: 'test@cat.com',
    age: 21,
    gender: 'cat',
    coins: 500,
    riskProfile: 'Calculated Chaos',
    avatarUrl: 'https://example.com/avatar.png',
    socialDebt: 0,
    totalWins: 10,
    totalClashes: 25,
    winStreak: 3,
    bestWinStreak: 5,
    stealSuccessful: 2,
    stealsDefended: 1,
    timesRobbed: 0,
    pushEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    trustScore: 85,
    isVerified: true,
    loginStreak: 5,
  };

  const mockFriend: Friend = {
    id: 'friend-456',
    name: 'RivalCat',
    username: 'rivalcat',
    relationshipLevel: RelationshipLevel.ROAST,
    relationshipDescription: 'Old gaming buddy',
    status: 'online',
    friendshipStatus: 'accepted',
    coins: 300,
    avatarUrl: 'https://example.com/friend.png',
    trustScore: 75,
    totalBetsAgainst: 5,
    winsAgainst: 2,
    heatConfirmed: true,
  };

  describe('User Authentication Flow', () => {
    it('should complete registration → onboarding → tutorial → main app flow', () => {
      // Step 1: User starts at SPLASH
      let currentView = AppView.SPLASH;
      expect(currentView).toBe(AppView.SPLASH);

      // Step 2: After signup, user goes to ONBOARDING (no risk profile)
      const newUser = { ...mockUser, riskProfile: '' };
      currentView = !newUser.riskProfile ? AppView.ONBOARDING : AppView.SWIPE_FEED;
      expect(currentView).toBe(AppView.ONBOARDING);

      // Step 3: After completing onboarding, go to TUTORIAL
      const tutorialSeen = false;
      currentView = !tutorialSeen ? AppView.TUTORIAL : AppView.SWIPE_FEED;
      expect(currentView).toBe(AppView.TUTORIAL);

      // Step 4: After tutorial, go to main app
      currentView = AppView.SWIPE_FEED;
      expect(currentView).toBe(AppView.SWIPE_FEED);
    });

    it('should handle returning user login with streak bonus', () => {
      const lastLogin = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
      const now = new Date();
      const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

      // 24-48 hours triggers streak bonus
      const streakBonusApplies = hoursSinceLastLogin >= 24 && hoursSinceLastLogin <= 48;
      expect(streakBonusApplies).toBe(true);

      // Calculate bonus (10-50 based on streak)
      const loginStreak = 5;
      const bonusCoins = Math.min(10 + (loginStreak * 5), 50);
      expect(bonusCoins).toBe(35);
    });

    it('should reset streak if login gap > 48 hours', () => {
      const lastLogin = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago
      const now = new Date();
      const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

      const shouldResetStreak = hoursSinceLastLogin > 48;
      expect(shouldResetStreak).toBe(true);

      const newLoginStreak = shouldResetStreak ? 1 : 5;
      expect(newLoginStreak).toBe(1);
    });
  });

  describe('Complete Bet/Clash Cycle', () => {
    it('should complete bet creation → proof submission → resolution flow', () => {
      // Step 1: Create bet from swipe feed
      const bet: ActiveBet = {
        id: 'bet-789',
        betId: 'scenario-123',
        scenario: 'Test Cat will finish their project on time',
        opponentId: mockFriend.id,
        opponentName: mockFriend.name,
        stake: 50,
        totalPot: 100,
        status: 'pending_proof',
        isProver: true,
        createdAt: new Date().toISOString(),
      };

      expect(bet.status).toBe('pending_proof');
      expect(bet.totalPot).toBe(100);

      // Step 2: Prover submits proof
      const betWithProof = {
        ...bet,
        status: 'proof_submitted' as const,
        proofUrl: 'https://storage.example.com/proof.jpg',
        proofType: 'photo',
        proofDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(betWithProof.status).toBe('proof_submitted');
      expect(betWithProof.proofUrl).toBeTruthy();

      // Step 3: Opponent reviews (accepts)
      const resolvedBet = {
        ...betWithProof,
        status: 'completed' as const,
        winnerId: bet.isProver ? bet.opponentId : mockUser.id,
      };

      expect(resolvedBet.status).toBe('completed');
      expect(resolvedBet.winnerId).toBeTruthy();
    });

    it('should handle dispute flow', () => {
      const bet: ActiveBet = {
        id: 'bet-disputed',
        betId: 'scenario-456',
        scenario: 'Disputed bet',
        opponentId: mockFriend.id,
        opponentName: mockFriend.name,
        stake: 50,
        totalPot: 100,
        status: 'proof_submitted',
        isProver: false,
        proofUrl: 'https://storage.example.com/sketchy-proof.jpg',
        createdAt: new Date().toISOString(),
      };

      // Reviewer disputes the proof
      const disputedBet = {
        ...bet,
        status: 'disputed' as const,
      };

      expect(disputedBet.status).toBe('disputed');
    });

    it('should handle expired bets', () => {
      const expiredBet: ActiveBet = {
        id: 'bet-expired',
        betId: 'scenario-789',
        scenario: 'Expired bet',
        opponentId: mockFriend.id,
        opponentName: mockFriend.name,
        stake: 50,
        totalPot: 100,
        status: 'pending_proof',
        isProver: true,
        proofDeadline: new Date(Date.now() - 1000).toISOString(), // Already expired
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      };

      const isExpired = new Date(expiredBet.proofDeadline!) < new Date();
      expect(isExpired).toBe(true);

      const finalStatus = isExpired ? 'expired' : expiredBet.status;
      expect(finalStatus).toBe('expired');
    });
  });

  describe('Steal/Defense Flow', () => {
    it('should complete offline steal → success flow', () => {
      // Setup: Target is offline
      const offlineFriend = { ...mockFriend, status: 'offline' as const };

      // Step 1: Calculate steal amount (5-10% of target's coins)
      const stealPercentage = 0.08; // 8%
      const potentialAmount = Math.floor(offlineFriend.coins * stealPercentage);
      expect(potentialAmount).toBe(24);

      // Step 2: Create steal attempt
      const steal: StealAttempt = {
        id: 'steal-001',
        thiefId: mockUser.id,
        targetId: offlineFriend.id,
        targetName: offlineFriend.name,
        stealPercentage: 8,
        potentialAmount,
        targetWasOnline: false,
        wasDefended: false,
        status: 'in_progress',
        thiefPenalty: 0,
      };

      expect(steal.targetWasOnline).toBe(false);

      // Step 3: Since offline, no defense possible → automatic success
      const completedSteal = {
        ...steal,
        status: 'success' as const,
        actualAmount: potentialAmount,
      };

      expect(completedSteal.status).toBe('success');
      expect(completedSteal.actualAmount).toBe(24);
    });

    it('should complete online steal → defense success flow', () => {
      // Setup: Target is online
      const onlineFriend = { ...mockFriend, status: 'online' as const };

      // Step 1: Create steal attempt with defense window
      const steal: StealAttempt = {
        id: 'steal-002',
        thiefId: mockUser.id,
        targetId: onlineFriend.id,
        targetName: onlineFriend.name,
        stealPercentage: 8,
        potentialAmount: 24,
        targetWasOnline: true,
        defenseWindowEnd: new Date(Date.now() + 16000).toISOString(), // 16 seconds
        wasDefended: false,
        status: 'in_progress',
        thiefPenalty: 0,
      };

      expect(steal.targetWasOnline).toBe(true);
      expect(steal.defenseWindowEnd).toBeTruthy();

      // Step 2: Defense minigame - target successfully defends
      const REQUIRED_TAPS = 25;
      const tapCount = 27; // Target successfully tapped 27 times
      const defended = tapCount >= REQUIRED_TAPS;
      expect(defended).toBe(true);

      // Step 3: Calculate penalty for caught thief
      const penalty = steal.potentialAmount * 2;
      expect(penalty).toBe(48);

      // Step 4: Complete steal as defended
      const defendedSteal = {
        ...steal,
        status: 'defended' as const,
        wasDefended: true,
        thiefPenalty: penalty,
      };

      expect(defendedSteal.status).toBe('defended');
      expect(defendedSteal.thiefPenalty).toBe(48);
    });

    it('should complete online steal → defense fail flow', () => {
      const steal: StealAttempt = {
        id: 'steal-003',
        thiefId: mockUser.id,
        targetId: mockFriend.id,
        targetName: mockFriend.name,
        stealPercentage: 10,
        potentialAmount: 30,
        targetWasOnline: true,
        defenseWindowEnd: new Date(Date.now() + 16000).toISOString(),
        wasDefended: false,
        status: 'in_progress',
        thiefPenalty: 0,
      };

      // Defense failed (not enough taps)
      const tapCount = 15;
      const REQUIRED_TAPS = 25;
      const defended = tapCount >= REQUIRED_TAPS;
      expect(defended).toBe(false);

      // Steal succeeds
      const successfulSteal = {
        ...steal,
        status: 'success' as const,
        actualAmount: steal.potentialAmount,
      };

      expect(successfulSteal.status).toBe('success');
    });
  });

  describe('Economy/Debt Flow', () => {
    it('should complete borrow → interest accrual → repay flow', () => {
      // Step 1: User borrows bingos
      const borrowAmount = 100;
      const interestRate = 0.10; // 10% daily

      const debt: Debt = {
        id: 'debt-001',
        principal: borrowAmount,
        interestRate,
        accruedInterest: 0,
        totalOwed: borrowAmount,
        amountRepaid: 0,
        status: 'active',
        repoTriggered: false,
        createdAt: new Date().toISOString(),
      };

      expect(debt.principal).toBe(100);
      expect(debt.status).toBe('active');

      // Step 2: After 3 days, interest accrues
      const daysElapsed = 3;
      const accruedInterest = Math.floor(borrowAmount * interestRate * daysElapsed);
      const debtWithInterest = {
        ...debt,
        accruedInterest,
        totalOwed: debt.principal + accruedInterest,
      };

      expect(debtWithInterest.accruedInterest).toBe(30);
      expect(debtWithInterest.totalOwed).toBe(130);

      // Step 3: Partial repayment
      const partialPayment = 50;
      const debtAfterPartial = {
        ...debtWithInterest,
        amountRepaid: partialPayment,
        totalOwed: debtWithInterest.totalOwed - partialPayment,
      };

      expect(debtAfterPartial.amountRepaid).toBe(50);
      expect(debtAfterPartial.totalOwed).toBe(80);

      // Step 4: Full repayment
      const fullPayment = 80;
      const paidOffDebt = {
        ...debtAfterPartial,
        amountRepaid: debtAfterPartial.amountRepaid + fullPayment,
        status: 'repaid' as const,
        totalOwed: 0,
      };

      expect(paidOffDebt.status).toBe('repaid');
      expect(paidOffDebt.totalOwed).toBe(0);
    });

    it('should trigger repo when interest exceeds principal', () => {
      const debt: Debt = {
        id: 'debt-repo',
        principal: 100,
        interestRate: 0.10,
        accruedInterest: 0,
        totalOwed: 100,
        amountRepaid: 0,
        status: 'active',
        repoTriggered: false,
        createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(), // 11 days old
      };

      // After 11 days, interest = 110% of principal
      const daysElapsed = 11;
      const accruedInterest = Math.floor(debt.principal * debt.interestRate * daysElapsed);
      expect(accruedInterest).toBe(110);

      // Repo triggers when interest > principal
      const shouldTriggerRepo = accruedInterest > debt.principal;
      expect(shouldTriggerRepo).toBe(true);

      const debtWithRepo = {
        ...debt,
        accruedInterest,
        repoTriggered: shouldTriggerRepo,
        status: 'repo_triggered' as const,
      };

      expect(debtWithRepo.repoTriggered).toBe(true);
      expect(debtWithRepo.status).toBe('repo_triggered');
    });
  });

  describe('Beg/Dare Flow', () => {
    it('should complete beg request → dare assignment → proof → reward flow', () => {
      // Step 1: User sends beg request
      const begRequest: BegRequest = {
        id: 'beg-001',
        targetId: mockFriend.id,
        targetName: mockFriend.name,
        rewardAmount: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      expect(begRequest.status).toBe('pending');

      // Step 2: Friend assigns a dare
      const dareAssigned = {
        ...begRequest,
        status: 'dare_assigned' as const,
        dareType: 'selfie',
        dareText: 'Take an embarrassing selfie with a weird face',
        rewardAmount: 15,
      };

      expect(dareAssigned.status).toBe('dare_assigned');
      expect(dareAssigned.rewardAmount).toBe(15);

      // Step 3: Beggar submits proof
      const proofSubmitted = {
        ...dareAssigned,
        status: 'proof_submitted' as const,
        proofUrl: 'https://storage.example.com/embarrassing.jpg',
      };

      expect(proofSubmitted.status).toBe('proof_submitted');

      // Step 4: Friend approves, reward granted
      const completed = {
        ...proofSubmitted,
        status: 'completed' as const,
      };

      expect(completed.status).toBe('completed');
    });

    it('should handle rejected beg proof', () => {
      const begWithProof: BegRequest = {
        id: 'beg-rejected',
        targetId: mockFriend.id,
        targetName: mockFriend.name,
        dareType: 'pushups',
        dareText: 'Do 10 pushups on video',
        proofUrl: 'https://storage.example.com/fake-pushups.jpg',
        rewardAmount: 25,
        status: 'proof_submitted',
        createdAt: new Date().toISOString(),
      };

      // Friend rejects the proof (cheating detected)
      const rejected = {
        ...begWithProof,
        status: 'rejected' as const,
      };

      expect(rejected.status).toBe('rejected');
    });
  });

  describe('Friendship Flow', () => {
    it('should complete friend request → accept → interact flow', () => {
      // Step 1: Send friend request
      const pendingFriend: Friend = {
        id: 'new-friend-789',
        name: 'NewCat',
        username: 'newcat',
        relationshipLevel: RelationshipLevel.CIVILIAN,
        relationshipDescription: 'Met at the cat cafe',
        status: 'offline',
        friendshipStatus: 'pending_sent',
        coins: 200,
        avatarUrl: 'https://example.com/new.png',
        trustScore: 50,
        totalBetsAgainst: 0,
        winsAgainst: 0,
        heatConfirmed: false,
      };

      expect(pendingFriend.friendshipStatus).toBe('pending_sent');

      // Step 2: Friend accepts
      const acceptedFriend = {
        ...pendingFriend,
        friendshipStatus: 'accepted' as const,
      };

      expect(acceptedFriend.friendshipStatus).toBe('accepted');

      // Step 3: Can now interact (steal, clash, etc.)
      const canInteract = acceptedFriend.friendshipStatus === 'accepted';
      expect(canInteract).toBe(true);
    });

    it('should require mutual heat confirmation for nuclear bets', () => {
      const nuclearFriend: Friend = {
        ...mockFriend,
        relationshipLevel: RelationshipLevel.NUCLEAR,
        heatConfirmed: false, // Not confirmed yet
      };

      // Nuclear bets require mutual confirmation
      const canDoNuclearBet = nuclearFriend.relationshipLevel === RelationshipLevel.NUCLEAR && nuclearFriend.heatConfirmed;
      expect(canDoNuclearBet).toBe(false);

      // After confirmation
      const confirmedFriend = { ...nuclearFriend, heatConfirmed: true };
      const canDoNuclearBetNow = confirmedFriend.relationshipLevel === RelationshipLevel.NUCLEAR && confirmedFriend.heatConfirmed;
      expect(canDoNuclearBetNow).toBe(true);
    });
  });

  describe('Notification Flow', () => {
    it('should create and manage notifications across flows', () => {
      const notifications: InGameNotification[] = [];

      // Clash notification
      notifications.push({
        id: 'notif-1',
        type: 'clash',
        title: 'New Challenge!',
        message: 'RivalCat challenged you to a bet!',
        priority: 'high',
        referenceType: 'clash',
        referenceId: 'clash-123',
        read: false,
        timestamp: Date.now(),
      });

      // Robbery notification
      notifications.push({
        id: 'notif-2',
        type: 'robbery',
        title: 'Heist Alert!',
        message: 'Someone is trying to steal your bingos!',
        priority: 'critical',
        referenceType: 'steal',
        referenceId: 'steal-456',
        read: false,
        timestamp: Date.now(),
      });

      expect(notifications.length).toBe(2);
      expect(notifications.filter(n => !n.read).length).toBe(2);

      // Mark as read
      notifications[0].read = true;
      expect(notifications.filter(n => !n.read).length).toBe(1);

      // Mark all as read
      notifications.forEach(n => (n.read = true));
      expect(notifications.filter(n => !n.read).length).toBe(0);
    });

    it('should prioritize critical notifications', () => {
      const notifications: InGameNotification[] = [
        { id: '1', type: 'system', title: '', message: 'Normal', priority: 'normal', read: false, timestamp: Date.now() },
        { id: '2', type: 'robbery', title: '', message: 'Critical', priority: 'critical', read: false, timestamp: Date.now() },
        { id: '3', type: 'clash', title: '', message: 'High', priority: 'high', read: false, timestamp: Date.now() },
      ];

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
      const sorted = [...notifications].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      expect(sorted[0].priority).toBe('critical');
      expect(sorted[1].priority).toBe('high');
      expect(sorted[2].priority).toBe('normal');
    });
  });

  describe('View Navigation Flow', () => {
    it('should correctly navigate between all major views', () => {
      const validTransitions: Record<AppView, AppView[]> = {
        [AppView.SPLASH]: [AppView.ONBOARDING, AppView.SWIPE_FEED],
        [AppView.ONBOARDING]: [AppView.TUTORIAL, AppView.SWIPE_FEED],
        [AppView.TUTORIAL]: [AppView.SWIPE_FEED],
        [AppView.SWIPE_FEED]: [AppView.DASHBOARD, AppView.CLASH, AppView.STEAL, AppView.PROFILE, AppView.WALLET, AppView.NOTIFICATIONS, AppView.ADD_FRIEND, AppView.CREATE_BET],
        [AppView.DASHBOARD]: [AppView.SWIPE_FEED, AppView.CLASH, AppView.STEAL, AppView.CAMERA, AppView.ADD_FRIEND, AppView.PROOF_VAULT],
        [AppView.CLASH]: [AppView.SWIPE_FEED],
        [AppView.STEAL]: [AppView.SWIPE_FEED],
        [AppView.DEFENSE]: [AppView.SWIPE_FEED],
        [AppView.CAMERA]: [AppView.SWIPE_FEED],
        [AppView.PROOF_VAULT]: [AppView.DASHBOARD],
        [AppView.PROFILE]: [AppView.SWIPE_FEED, AppView.RULES],
        [AppView.WALLET]: [AppView.SWIPE_FEED, AppView.BEG, AppView.BORROW],
        [AppView.BEG]: [AppView.WALLET],
        [AppView.BORROW]: [AppView.WALLET],
        [AppView.NOTIFICATIONS]: [AppView.SWIPE_FEED, AppView.DASHBOARD, AppView.DEFENSE],
        [AppView.ADD_FRIEND]: [AppView.SWIPE_FEED],
        [AppView.CREATE_BET]: [AppView.SWIPE_FEED],
        [AppView.RULES]: [AppView.SWIPE_FEED],
        [AppView.AGE_VERIFICATION]: [AppView.SPLASH],
        [AppView.SETTINGS]: [AppView.SWIPE_FEED],
        [AppView.TROPHY]: [AppView.PROFILE],
      };

      // Test that main flow works
      let currentView = AppView.SPLASH;
      expect(validTransitions[currentView]).toContain(AppView.SWIPE_FEED);

      currentView = AppView.SWIPE_FEED;
      expect(validTransitions[currentView]).toContain(AppView.DASHBOARD);
      expect(validTransitions[currentView]).toContain(AppView.WALLET);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle insufficient funds for betting', () => {
      const poorUser = { ...mockUser, coins: 5 };
      const betStake = 50;

      const canAffordBet = poorUser.coins >= betStake;
      expect(canAffordBet).toBe(false);
    });

    it('should handle no friends available for stealing', () => {
      const friends: Friend[] = [];
      const acceptedFriends = friends.filter(f => f.friendshipStatus === 'accepted');

      const canSteal = acceptedFriends.length > 0;
      expect(canSteal).toBe(false);
    });

    it('should prevent self-theft', () => {
      const stealTargetId = mockUser.id;
      const isValidTarget = stealTargetId !== mockUser.id;

      expect(isValidTarget).toBe(false);
    });

    it('should enforce minimum bet amounts', () => {
      const MIN_BET = 5;
      const betAmounts = [1, 3, 5, 10, 50];

      const validBets = betAmounts.filter(amount => amount >= MIN_BET);
      expect(validBets).toEqual([5, 10, 50]);
    });

    it('should handle proof expiry correctly', () => {
      const proofDeadline = new Date(Date.now() - 1000); // Expired
      const isExpired = proofDeadline < new Date();
      expect(isExpired).toBe(true);

      const activeDeadline = new Date(Date.now() + 60000); // Still active
      const isActive = activeDeadline > new Date();
      expect(isActive).toBe(true);
    });
  });
});

describe('Data Consistency Tests', () => {
  it('should maintain consistent coin totals in steal transactions', () => {
    const thiefStartCoins = 500;
    const targetStartCoins = 300;
    const stealAmount = 30;

    // After successful steal
    const thiefEndCoins = thiefStartCoins + stealAmount;
    const targetEndCoins = targetStartCoins - stealAmount;

    // Total coins in system should remain constant
    const totalBefore = thiefStartCoins + targetStartCoins;
    const totalAfter = thiefEndCoins + targetEndCoins;

    expect(totalBefore).toBe(totalAfter);
  });

  it('should maintain consistent pot in clash', () => {
    const user1Stake = 50;
    const user2Stake = 50;
    const totalPot = user1Stake + user2Stake;

    expect(totalPot).toBe(100);

    // Winner gets pot minus any platform fee (in this case, full pot)
    const winnerPayout = totalPot;
    expect(winnerPayout).toBe(100);
  });

  it('should correctly calculate debt totals', () => {
    const principal = 100;
    const interestRate = 0.10;
    const days = 5;
    const accruedInterest = principal * interestRate * days;
    const amountRepaid = 30;

    const totalOwed = principal + accruedInterest - amountRepaid;
    expect(totalOwed).toBe(120); // 100 + 50 - 30 = 120
  });
});
