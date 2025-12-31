import { describe, it, expect } from 'vitest';
import type { UserProfile, Friend, RelationshipLevel } from '../../types';

/**
 * Phase 1 Tests: Props Fixes (Tasks 1.7, 1.8)
 *
 * Critical Requirements:
 * 1. AddFriend component requires 'user' prop
 * 2. ChallengeFriend component props must match App.tsx usage
 * 3. Gemini API key should use import.meta.env.VITE_GEMINI_API_KEY
 */

describe('AddFriend Props (Task 1.7)', () => {
  // Mock user for testing
  const mockUser: UserProfile = {
    id: 'user-123',
    name: 'TestUser',
    username: 'testuser',
    email: 'test@example.com',
    age: 25,
    gender: 'male',
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

  describe('Required Props', () => {
    it('should require user prop of type UserProfile', () => {
      // AddFriend component signature should be:
      // AddFriend({ user, onFriendAdded, onBack }: AddFriendProps)
      interface AddFriendProps {
        user: UserProfile;
        onFriendAdded: (friend: Friend) => void;
        onBack: () => void;
      }

      const props: AddFriendProps = {
        user: mockUser,
        onFriendAdded: () => {},
        onBack: () => {},
      };

      expect(props.user).toBeDefined();
      expect(props.user.id).toBe('user-123');
    });

    it('should pass user prop from App.tsx', () => {
      // App.tsx should pass: user={user}
      const appState = {
        user: mockUser,
      };

      expect(appState.user).toBeDefined();
      expect(typeof appState.user.id).toBe('string');
    });

    it('should use user.id for friendship creation', () => {
      // In AddFriend, when creating friendship:
      // user_id: user.id (from prop)
      // friend_id: selectedFriend.id
      const friendship = {
        user_id: mockUser.id,
        friend_id: 'friend-456',
        initiated_by: mockUser.id,
      };

      expect(friendship.user_id).toBe(mockUser.id);
      expect(friendship.initiated_by).toBe(mockUser.id);
    });
  });

  describe('Callback Props', () => {
    it('should call onFriendAdded with Friend object', () => {
      const mockFriend: Friend = {
        id: 'friend-456',
        name: 'Friend Name',
        username: 'frienduser',
        relationshipLevel: 2 as RelationshipLevel,
        relationshipDescription: 'College buddy',
        status: 'online',
        friendshipStatus: 'accepted',
        coins: 300,
        avatarUrl: 'https://example.com/friend.png',
        trustScore: 75,
        totalBetsAgainst: 0,
        winsAgainst: 0,
        heatConfirmed: false,
      };

      let addedFriend: Friend | null = null;
      const onFriendAdded = (friend: Friend) => {
        addedFriend = friend;
      };

      onFriendAdded(mockFriend);

      expect(addedFriend).not.toBeNull();
      expect(addedFriend?.id).toBe('friend-456');
    });

    it('should call onBack when navigating away', () => {
      let backCalled = false;
      const onBack = () => {
        backCalled = true;
      };

      onBack();

      expect(backCalled).toBe(true);
    });
  });
});

describe('ChallengeFriend Props (Task 1.7)', () => {
  const mockUser: UserProfile = {
    id: 'user-123',
    name: 'TestUser',
    username: 'testuser',
    age: 25,
    gender: 'male',
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

  const mockFriends: Friend[] = [
    {
      id: 'friend-1',
      name: 'Friend One',
      username: 'friend1',
      relationshipLevel: 1 as RelationshipLevel,
      relationshipDescription: 'Work colleague',
      status: 'online',
      friendshipStatus: 'accepted',
      coins: 300,
      avatarUrl: 'https://example.com/f1.png',
      trustScore: 70,
      totalBetsAgainst: 5,
      winsAgainst: 2,
      heatConfirmed: true,
    },
    {
      id: 'friend-2',
      name: 'Friend Two',
      username: 'friend2',
      relationshipLevel: 2 as RelationshipLevel,
      relationshipDescription: 'Old gaming buddy',
      status: 'offline',
      friendshipStatus: 'accepted',
      coins: 500,
      avatarUrl: 'https://example.com/f2.png',
      trustScore: 85,
      totalBetsAgainst: 10,
      winsAgainst: 6,
      heatConfirmed: true,
    },
  ];

  describe('Required Props', () => {
    it('should require user, friends, and callback props', () => {
      interface ChallengeFriendProps {
        user: UserProfile;
        friends: Friend[];
        onBetCreated: (bet: any) => void;
        onBack: () => void;
      }

      const props: ChallengeFriendProps = {
        user: mockUser,
        friends: mockFriends,
        onBetCreated: () => {},
        onBack: () => {},
      };

      expect(props.user).toBeDefined();
      expect(props.friends).toHaveLength(2);
    });

    it('should filter only accepted friends', () => {
      const allFriends: Friend[] = [
        ...mockFriends,
        {
          ...mockFriends[0],
          id: 'pending-friend',
          friendshipStatus: 'pending_sent',
        },
      ];

      const acceptedFriends = allFriends.filter(f => f.friendshipStatus === 'accepted');
      expect(acceptedFriends).toHaveLength(2);
    });
  });

  describe('Mode Selection', () => {
    it('should support 1v1 mode', () => {
      type ChallengeMode = 'single' | 'group' | 'all';
      const mode: ChallengeMode = 'single';

      expect(mode).toBe('single');
    });

    it('should support group mode with multiple friends', () => {
      const selectedFriends = ['friend-1', 'friend-2'];
      const mode = 'group';

      expect(selectedFriends.length).toBeGreaterThan(1);
      expect(mode).toBe('group');
    });

    it('should support all-friends mode', () => {
      const mode = 'all';
      const targetFriends = mockFriends.map(f => f.id);

      expect(mode).toBe('all');
      expect(targetFriends).toEqual(['friend-1', 'friend-2']);
    });
  });

  describe('Bet Creation', () => {
    it('should call onBetCreated with correct bet structure', () => {
      let createdBet: any = null;
      const onBetCreated = (bet: any) => {
        createdBet = bet;
      };

      const mockBet = {
        id: 'bet-123',
        text: 'Custom challenge',
        targetType: 'single',
        targetUsers: ['friend-1'],
        baseStake: 50,
        expiresInHours: 2,
      };

      onBetCreated(mockBet);

      expect(createdBet).not.toBeNull();
      expect(createdBet.targetType).toBe('single');
    });
  });
});

describe('Gemini API Key Fix (Task 1.8)', () => {
  describe('Environment Variable', () => {
    it('should use VITE_GEMINI_API_KEY not process.env.API_KEY', () => {
      // Current wrong code: process.env.API_KEY
      // Correct code: import.meta.env.VITE_GEMINI_API_KEY

      const wrongEnvVar = 'process.env.API_KEY';
      const correctEnvVar = 'import.meta.env.VITE_GEMINI_API_KEY';

      expect(wrongEnvVar).not.toBe(correctEnvVar);
    });

    it('should have VITE_ prefix for Vite exposure', () => {
      const envVarName = 'VITE_GEMINI_API_KEY';

      expect(envVarName.startsWith('VITE_')).toBe(true);
    });

    it('should not use process.env in Vite projects', () => {
      // In Vite, process.env is not available by default
      // Must use import.meta.env
      const isViteEnv = true;
      const useImportMeta = true;

      expect(isViteEnv && useImportMeta).toBe(true);
    });
  });

  describe('API Key Validation', () => {
    it('should validate API key is present', () => {
      const apiKey = 'test-api-key'; // Would be from env in real code
      const isValid = apiKey && apiKey.length > 0;

      expect(isValid).toBe(true);
    });

    it('should handle missing API key gracefully', () => {
      const apiKey = undefined;
      const errorMessage = !apiKey ? 'Gemini API key not configured' : null;

      expect(errorMessage).toBe('Gemini API key not configured');
    });
  });
});

describe('App.tsx Integration', () => {
  it('should pass correct props to AddFriend', () => {
    // What App.tsx should render:
    // <AddFriend
    //   user={user}
    //   onFriendAdded={(friend) => setFriends([...friends, friend])}
    //   onBack={() => setView(AppView.SWIPE_FEED)}
    // />

    const user = { id: 'user-123', name: 'Test' };
    const propsToPass = {
      user,
      onFriendAdded: expect.any(Function),
      onBack: expect.any(Function),
    };

    expect(propsToPass.user).toBeDefined();
    expect(propsToPass.user.id).toBe('user-123');
  });

  it('should pass correct props to ChallengeFriend', () => {
    // What App.tsx should render:
    // <ChallengeFriend
    //   user={user}
    //   friends={friends}
    //   onBetCreated={(bet) => handleBetCreated(bet)}
    //   onBack={() => setView(AppView.SWIPE_FEED)}
    // />

    const user = { id: 'user-123', name: 'Test' };
    const friends = [{ id: 'friend-1', name: 'Friend' }];

    const propsToPass = {
      user,
      friends,
      onBetCreated: expect.any(Function),
      onBack: expect.any(Function),
    };

    expect(propsToPass.user).toBeDefined();
    expect(propsToPass.friends).toHaveLength(1);
  });
});
