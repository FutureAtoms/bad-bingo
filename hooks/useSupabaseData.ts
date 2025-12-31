import { useState, useEffect, useCallback } from 'react';
import { supabase, db } from '../services/supabase';
import { UserProfile, Friend, ActiveBet, InGameNotification, RelationshipLevel } from '../types';
import type { DBUser, DBFriendship, DBBet, DBClash, DBNotification } from '../types/database';

// Type-safe workaround for Supabase operations where inference fails


// User hook - manages user state with Supabase sync
export function useUser(authUserId: string | null) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile from Supabase
  const fetchUser = useCallback(async () => {
    if (!authUserId) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('bb_users')
        .select('*')
        .eq('id', authUserId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        const profile: UserProfile = mapDBUserToProfile(data);
        setUser(profile);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  // Update user in Supabase
  const updateUser = useCallback(async (updates: Partial<UserProfile>) => {
    if (!authUserId) return { success: false, error: 'Not authenticated' };

    try {
      const dbUpdates = mapProfileToDBUser(updates);
      const { error: updateError } = await db
        .from('bb_users')
        .update(dbUpdates)
        .eq('id', authUserId);

      if (updateError) throw updateError;

      // Refresh user data
      await fetchUser();
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [authUserId, fetchUser]);

  // Initial fetch
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!authUserId) return;

    const subscription = supabase
      .channel(`user:${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bb_users',
          filter: `id=eq.${authUserId}`,
        },
        (payload) => {
          if (payload.new) {
            setUser(mapDBUserToProfile(payload.new as DBUser));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [authUserId]);

  return { user, loading, error, refetch: fetchUser, updateUser };
}

// Friends hook - manages friends list with Supabase sync
export function useFriends(userId: string | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setFriends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get friendships where user is either user_id or friend_id
      const { data: friendships, error: fetchError } = await supabase
        .from('bb_friendships')
        .select(`
          *,
          friend:bb_users!bb_friendships_friend_id_fkey(*),
          user:bb_users!bb_friendships_user_id_fkey(*)
        `)
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (fetchError) throw fetchError;

      if (friendships) {
        const mappedFriends = friendships.map((f: any) => {
          // Determine which user is the friend (not the current user)
          const friendData = f.user_id === userId ? f.friend : f.user;
          return mapFriendshipToFriend(f, friendData, userId);
        });
        setFriends(mappedFriends);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Add friend
  const addFriend = useCallback(async (friendId: string, description: string, heatLevel: RelationshipLevel) => {
    if (!userId) return { success: false, error: 'Not authenticated' };

    try {
      const { error: insertError } = await db
        .from('bb_friendships')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'pending',
          initiated_by: userId,
          heat_level: heatLevel,
          relationship_description: description,
        });

      if (insertError) throw insertError;

      await fetchFriends();
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [userId, fetchFriends]);

  // Accept friend request
  const acceptFriend = useCallback(async (friendshipId: string) => {
    try {
      const { error: updateError } = await db
        .from('bb_friendships')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', friendshipId);

      if (updateError) throw updateError;

      await fetchFriends();
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [fetchFriends]);

  // Reject/Remove friend
  const removeFriend = useCallback(async (friendshipId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('bb_friendships')
        .delete()
        .eq('id', friendshipId);

      if (deleteError) throw deleteError;

      await fetchFriends();
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [fetchFriends]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Realtime updates for friend requests and status changes
  useEffect(() => {
    if (!userId) return;

    const outboundSubscription = supabase
      .channel(`friends:outbound:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bb_friendships',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchFriends();
        }
      )
      .subscribe();

    const inboundSubscription = supabase
      .channel(`friends:inbound:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bb_friendships',
          filter: `friend_id=eq.${userId}`,
        },
        () => {
          fetchFriends();
        }
      )
      .subscribe();

    return () => {
      outboundSubscription.unsubscribe();
      inboundSubscription.unsubscribe();
    };
  }, [fetchFriends, userId]);

  return { friends, loading, error, refetch: fetchFriends, addFriend, acceptFriend, removeFriend };
}

// Active bets hook
export function useActiveBets(userId: string | null) {
  const [bets, setBets] = useState<ActiveBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    if (!userId) {
      setBets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get active clashes for this user
      const { data: clashes, error: fetchError } = await supabase
        .from('bb_clashes')
        .select(`
          *,
          bet:bb_bets(*)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .in('status', ['pending_proof', 'proof_submitted', 'reviewing'])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (clashes) {
        const activeBets = clashes.map((clash: any) => mapClashToActiveBet(clash, userId));
        setBets(activeBets);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`clashes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bb_clashes',
        },
        () => {
          fetchBets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchBets]);

  return { bets, loading, error, refetch: fetchBets };
}

// Notifications hook
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<InGameNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('bb_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      if (data) {
        const mapped = data.map(mapDBNotificationToInGame);
        setNotifications(mapped);
        setUnreadCount(mapped.filter(n => !n.read).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await db
        .from('bb_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await db
        .from('bb_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bb_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            const newNotif = mapDBNotificationToInGame(payload.new as DBNotification);
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}

// Helper functions to map between DB and app types
function mapDBUserToProfile(dbUser: DBUser): UserProfile {
  return {
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
  };
}

function mapProfileToDBUser(profile: Partial<UserProfile>): Partial<DBUser> {
  const dbUser: Partial<DBUser> = {};

  if (profile.name !== undefined) dbUser.name = profile.name;
  if (profile.username !== undefined) dbUser.username = profile.username;
  if (profile.coins !== undefined) dbUser.coins = profile.coins;
  if (profile.riskProfile !== undefined) dbUser.risk_profile = profile.riskProfile;
  if (profile.bio !== undefined) dbUser.bio = profile.bio;
  if (profile.avatarUrl !== undefined) dbUser.avatar_url = profile.avatarUrl;
  if (profile.socialDebt !== undefined) dbUser.social_debt = profile.socialDebt;
  if (profile.pushEnabled !== undefined) dbUser.push_enabled = profile.pushEnabled;
  if (profile.soundEnabled !== undefined) dbUser.sound_enabled = profile.soundEnabled;
  if (profile.hapticsEnabled !== undefined) dbUser.haptics_enabled = profile.hapticsEnabled;

  return dbUser;
}

function mapFriendshipToFriend(friendship: any, friendData: DBUser, currentUserId: string): Friend {
  const isInitiator = friendship.initiated_by === currentUserId;
  return {
    id: friendData.id,
    name: friendData.name,
    username: friendData.username,
    relationshipLevel: friendship.heat_level as RelationshipLevel,
    relationshipDescription: friendship.relationship_description || '',
    status: friendData.last_login && (Date.now() - new Date(friendData.last_login).getTime()) < 5 * 60 * 1000 ? 'online' : 'offline',
    friendshipStatus: friendship.status === 'accepted'
      ? 'accepted'
      : isInitiator ? 'pending_sent' : 'pending_received',
    coins: friendData.coins,
    avatarUrl: friendData.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendData.id}`,
    trustScore: friendship.trust_score,
    totalBetsAgainst: friendship.total_bets,
    winsAgainst: friendship.wins_against_friend,
    heatConfirmed: friendship.heat_confirmed,
    locationRelationship: friendship.location_relationship,
  };
}

function mapClashToActiveBet(clash: any, userId: string): ActiveBet {
  const isUser1 = clash.user1_id === userId;
  const opponentId = isUser1 ? clash.user2_id : clash.user1_id;

  return {
    id: clash.id,
    betId: clash.bet_id,
    scenario: clash.bet?.text || 'Unknown bet',
    opponentId,
    opponentName: '', // Would need to join with users table
    stake: isUser1 ? clash.user1_stake : clash.user2_stake,
    totalPot: clash.total_pot,
    status: clash.status,
    isProver: clash.prover_id === userId,
    proofUrl: clash.proof_url || undefined,
    proofType: clash.proof_type || undefined,
    proofDeadline: clash.proof_deadline || undefined,
    proofViewDuration: clash.proof_view_duration || undefined,
    proofIsViewOnce: clash.proof_is_view_once,
    winnerId: clash.winner_id || undefined,
    createdAt: clash.created_at,
  };
}

function mapDBNotificationToInGame(dbNotif: DBNotification): InGameNotification {
  return {
    id: dbNotif.id,
    type: dbNotif.type as any,
    title: dbNotif.title,
    message: dbNotif.message,
    priority: dbNotif.priority as any,
    referenceType: dbNotif.reference_type || undefined,
    referenceId: dbNotif.reference_id || undefined,
    read: dbNotif.read,
    timestamp: new Date(dbNotif.created_at).getTime(),
  };
}
