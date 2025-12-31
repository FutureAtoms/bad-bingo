import { supabase } from './supabase';
import type { DBUser, DBUserInsert } from '../types/database';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { logDebug, logError } from '../utils/logger';

const APP_SCHEME = 'com.badbingo.app'; // Deep link scheme

export interface SignUpData {
  email: string;
  password: string;
  username: string;
  name: string;
  age: number;
  gender?: string;
  riskProfile?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Sign up a new user
export const signUp = async (data: SignUpData): Promise<{ user: DBUser | null; error: string | null }> => {
  // First, create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) {
    return { user: null, error: authError.message };
  }

  if (!authData.user) {
    return { user: null, error: 'Failed to create user' };
  }

  // Then create profile in bb_users
  const userInsert: DBUserInsert = {
    id: authData.user.id,
    email: data.email,
    username: data.username,
    name: data.name,
    age: data.age,
    gender: data.gender || null,
    risk_profile: data.riskProfile || null,
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.username}&backgroundColor=b6e3f4`,
    coins: 1000,
  };

  const { data: userData, error: userError } = await supabase
    .from('bb_users')
    .insert(userInsert)
    .select()
    .single();

  if (userError) {
    // Cleanup: delete auth user if profile creation fails
    await supabase.auth.admin?.deleteUser(authData.user.id);
    return { user: null, error: userError.message };
  }

  return { user: userData, error: null };
};

// Sign in existing user
export const signIn = async (data: SignInData): Promise<{ user: DBUser | null; error: string | null }> => {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (authError) {
    return { user: null, error: authError.message };
  }

  if (!authData.user) {
    return { user: null, error: 'Failed to sign in' };
  }

  // Get user profile
  const { data: userData, error: userError } = await supabase
    .from('bb_users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (userError) {
    return { user: null, error: userError.message };
  }

  // Update last login and potentially login streak
  const lastLogin = userData.last_login ? new Date(userData.last_login) : null;
  const now = new Date();
  const hoursSinceLastLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60) : 999;

  let newLoginStreak = userData.login_streak;
  let bonusCoins = 0;

  // If logged in within 24-48 hours, increment streak
  if (hoursSinceLastLogin >= 24 && hoursSinceLastLogin <= 48) {
    newLoginStreak += 1;
    bonusCoins = Math.min(10 + (newLoginStreak * 5), 50); // 10-50 coins based on streak
  } else if (hoursSinceLastLogin > 48) {
    // Reset streak if more than 48 hours
    newLoginStreak = 1;
    bonusCoins = 10;
  }

  // Update user
  const { data: updatedUser } = await supabase
    .from('bb_users')
    .update({
      last_login: now.toISOString(),
      login_streak: newLoginStreak,
      coins: userData.coins + bonusCoins,
    })
    .eq('id', authData.user.id)
    .select()
    .single();

  // Log login bonus transaction if applicable
  if (bonusCoins > 0 && updatedUser) {
    await supabase.from('bb_transactions').insert({
      user_id: authData.user.id,
      amount: bonusCoins,
      balance_after: updatedUser.coins,
      type: 'login_bonus',
      description: `Login streak day ${newLoginStreak}! +${bonusCoins} bingos.`,
    });
  }

  return { user: updatedUser || userData, error: null };
};

// Sign out
export const signOut = async (): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message || null };
};

// Get current session
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error: error?.message || null };
};

// Get current user profile
export const getCurrentUser = async (): Promise<{ user: DBUser | null; error: string | null }> => {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { user: null, error: authError?.message || 'Not authenticated' };
  }

  const { data: userData, error: userError } = await supabase
    .from('bb_users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  return { user: userData, error: userError?.message || null };
};

// Get or create user profile from current session
export const getOrCreateProfileFromSession = async (): Promise<{ user: DBUser | null; error: string | null }> => {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { user: null, error: authError?.message || 'Not authenticated' };
  }

  return getOrCreateUserProfile(authUser.id, authUser.email, authUser.user_metadata);
};

// Update user profile
export const updateProfile = async (
  userId: string,
  updates: Partial<DBUserInsert>
): Promise<{ user: DBUser | null; error: string | null }> => {
  const { data, error } = await supabase
    .from('bb_users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { user: data, error: error?.message || null };
};

// Check if username is available
export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  const { data } = await supabase
    .from('bb_users')
    .select('id')
    .eq('username', username)
    .single();

  return !data;
};

// Verify age (18+)
export const verifyAge = (birthDate: Date): boolean => {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18;
  }

  return age >= 18;
};

// ============================================
// GOOGLE OAUTH
// ============================================

// Sign in with Google
export const signInWithGoogle = async (): Promise<{ success: boolean; error: string | null }> => {
  try {
    // Get the OAuth URL from Supabase
    const redirectUrl = Capacitor.isNativePlatform()
      ? `${APP_SCHEME}://auth/callback`
      : `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Capacitor.isNativePlatform(),
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (Capacitor.isNativePlatform() && data.url) {
      // Open the OAuth URL in the system browser
      await Browser.open({ url: data.url });
      return { success: true, error: null };
    }

    // For web, the redirect happens automatically
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: 'Failed to initiate Google sign in' };
  }
};

// Handle OAuth callback (for native apps)
export const handleOAuthCallback = async (url: string): Promise<{ user: DBUser | null; error: string | null }> => {
  try {
    logDebug('[Auth] Handling OAuth callback');

    // Extract tokens from the URL
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.hash.substring(1)); // Remove #

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    logDebug('[Auth] Tokens found:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

    if (!accessToken) {
      // Try query params (some flows use query instead of hash)
      const code = urlObj.searchParams.get('code');
      if (code) {
        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
          return { user: null, error: error?.message || 'Failed to exchange code' };
        }
        // Get or create user profile
        return await getOrCreateUserProfile(data.user.id, data.user.email, data.user.user_metadata);
      }
      return { user: null, error: 'No access token or code found' };
    }

    // Set the session with the tokens
    logDebug('[Auth] Setting session with tokens');
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    if (error || !data.user) {
      logError('[Auth] Failed to set session');
      return { user: null, error: error?.message || 'Failed to set session' };
    }

    logDebug('[Auth] Session set successfully');

    // Get or create user profile
    return await getOrCreateUserProfile(data.user.id, data.user.email, data.user.user_metadata);
  } catch (err) {
    return { user: null, error: 'Failed to handle OAuth callback' };
  }
};

// Get or create user profile after OAuth
const getOrCreateUserProfile = async (
  userId: string,
  email: string | undefined,
  metadata: Record<string, unknown>
): Promise<{ user: DBUser | null; error: string | null }> => {
  try {
    logDebug('[Auth] getOrCreateUserProfile called');

    // Try to get existing user
    logDebug('[Auth] About to query bb_users...');
    const { data: existingUser, error: fetchError } = await supabase
      .from('bb_users')
      .select('*')
      .eq('id', userId)
      .single();

    logDebug('[Auth] Existing user check:', { hasUser: !!existingUser, hasError: !!fetchError });

  if (existingUser) {
    // Update login streak
    const lastLogin = existingUser.last_login ? new Date(existingUser.last_login) : null;
    const now = new Date();
    const hoursSinceLastLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60) : 999;

    let newLoginStreak = existingUser.login_streak;
    let bonusCoins = 0;

    if (hoursSinceLastLogin >= 24 && hoursSinceLastLogin <= 48) {
      newLoginStreak += 1;
      bonusCoins = Math.min(10 + (newLoginStreak * 5), 50);
    } else if (hoursSinceLastLogin > 48) {
      newLoginStreak = 1;
      bonusCoins = 10;
    }

    const { data: updatedUser } = await supabase
      .from('bb_users')
      .update({
        last_login: now.toISOString(),
        login_streak: newLoginStreak,
        coins: existingUser.coins + bonusCoins,
      })
      .eq('id', userId)
      .select()
      .single();

    if (bonusCoins > 0 && updatedUser) {
      await supabase.from('bb_transactions').insert({
        user_id: userId,
        amount: bonusCoins,
        balance_after: updatedUser.coins,
        type: 'login_bonus',
        description: `Login streak day ${newLoginStreak}! +${bonusCoins} bingos.`,
      });
    }

    return { user: updatedUser || existingUser, error: null };
  }

  // Create new user profile
  const name = (metadata.full_name as string) || (metadata.name as string) || 'Stray Cat';
  const avatarUrl = (metadata.avatar_url as string) || (metadata.picture as string) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;

  // Generate a unique username
  const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
  const username = `${baseUsername}${Math.floor(Math.random() * 1000)}`;

  const newUser: DBUserInsert = {
    id: userId,
    email: email || null,
    username,
    name,
    age: 18, // Default age - user should update in profile
    avatar_url: avatarUrl,
    coins: 1000, // Starting bingos
    login_streak: 1,
    last_login: new Date().toISOString(),
  };

  logDebug('[Auth] Creating new user profile');

  const { data: createdUser, error } = await supabase
    .from('bb_users')
    .insert(newUser)
    .select()
    .single();

  logDebug('[Auth] Insert result:', { hasUser: !!createdUser, hasError: !!error });

  if (error) {
    logError('[Auth] Error creating user profile');
    return { user: null, error: error.message };
  }

  // Record initial login bonus
  await supabase.from('bb_transactions').insert({
    user_id: userId,
    amount: 1000,
    balance_after: 1000,
    type: 'allowance',
    description: 'Welcome bonus! Here\'s your first 1000 bingos.',
  });

  return { user: createdUser, error: null };
  } catch (err) {
    logError('[Auth] EXCEPTION in getOrCreateUserProfile');
    return { user: null, error: 'Exception during profile creation' };
  }
};

// Track if OAuth callback has been handled to prevent duplicate processing
let oauthCallbackHandled = false;

// Reset OAuth callback flag (call this when starting new OAuth flow)
export const resetOAuthCallback = () => {
  oauthCallbackHandled = false;
  logDebug('[Auth] OAuth callback flag reset');
};

// Set up OAuth callback listener for native apps
export const setupOAuthListener = (
  onSuccess: (user: DBUser) => void,
  onError: (error: string) => void
): (() => void) => {
  if (!Capacitor.isNativePlatform()) {
    // For web, check URL on load
    const checkUrl = async () => {
      if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
        const result = await handleOAuthCallback(window.location.href);
        if (result.user) {
          onSuccess(result.user);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (result.error) {
          onError(result.error);
        }
      }
    };
    checkUrl();
    return () => {};
  }

  // For native, listen for app URL events (deep link callback)
  const maybeHandleUrl = async (url?: string | null) => {
    if (!url) return;
    logDebug('[Auth] OAuth url check:', url);
    if (oauthCallbackHandled) {
      logDebug('[Auth] OAuth callback already handled, skipping');
      return;
    }

    if (!url.includes('auth/callback') && !url.includes('access_token') && !url.includes('code=')) {
      return;
    }

    // Close the browser
    try {
      await Browser.close();
    } catch {
      logDebug('[Auth] Browser.close() failed or not needed');
    }

    const result = await handleOAuthCallback(url);
    logDebug('[Auth] OAuth callback result:', { hasUser: !!result.user, error: result.error });
    if (result.user) {
      oauthCallbackHandled = true;
      onSuccess(result.user);
    } else if (result.error) {
      onError(result.error);
    }
  };

  const urlHandle = App.addListener('appUrlOpen', async (data) => {
    logDebug('[Auth] appUrlOpen received:', data.url);
    await maybeHandleUrl(data.url);
  });

  // Handle cold-start deep links that may bypass appUrlOpen
  App.getLaunchUrl()
    .then(({ url }) => maybeHandleUrl(url))
    .catch(() => {});

  // Also listen for app resume - check session when returning from browser
  const resumeHandle = App.addListener('appStateChange', async (state) => {
    logDebug('[Auth] appStateChange:', { isActive: state.isActive, oauthCallbackHandled });

    if (state.isActive) {
      logDebug('[Auth] App resumed, checking for session...');

      if (oauthCallbackHandled) {
        logDebug('[Auth] OAuth already handled, skipping resume check');
        return;
      }

      try {
        const { url } = await App.getLaunchUrl();
        await maybeHandleUrl(url);
        if (oauthCallbackHandled) {
          return;
        }
      } catch {
        // Ignore launch URL failures; we'll still try session checks.
      }

      // Try multiple times with increasing delays to catch the session
      const checkSession = async (attempt: number) => {
        if (oauthCallbackHandled) {
          logDebug('[Auth] OAuth handled during retry, stopping');
          return;
        }

        try {
          logDebug('[Auth] Checking session, attempt', attempt);
          const { data: { session } } = await supabase.auth.getSession();
          logDebug('[Auth] Session on resume:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            attempt
          });

          if (session?.user) {
            logDebug('[Auth] Session found on resume, creating profile...');
            const { user, error } = await getOrCreateUserProfile(
              session.user.id,
              session.user.email,
              session.user.user_metadata
            );
            logDebug('[Auth] Profile result:', { hasUser: !!user, error });
            if (user) {
              oauthCallbackHandled = true;
              onSuccess(user);
            } else if (error) {
              onError(error);
            }
          } else if (attempt < 3) {
            // Retry with longer delay
            setTimeout(() => checkSession(attempt + 1), 1000);
          }
        } catch (err) {
          logError('[Auth] Error checking session on resume:', err);
          if (attempt < 3) {
            setTimeout(() => checkSession(attempt + 1), 1000);
          }
        }
      };

      // Start checking after initial delay
      setTimeout(() => checkSession(1), 500);
    }
  });

  return () => {
    urlHandle.then((h) => h.remove());
    resumeHandle.then((h) => h.remove());
  };
};

// Listen for auth state changes
export const onAuthStateChange = (
  callback: (user: DBUser | null) => void
): (() => void) => {
  logDebug('[Auth] Setting up onAuthStateChange listener');

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    logDebug('[Auth] onAuthStateChange event:', {
      event,
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id
    });

    if (event === 'SIGNED_IN' && session?.user) {
      logDebug('[Auth] SIGNED_IN event, getting profile...');
      const { user, error } = await getOrCreateUserProfile(
        session.user.id,
        session.user.email,
        session.user.user_metadata
      );
      logDebug('[Auth] SIGNED_IN profile result:', { hasUser: !!user, error });
      callback(user);
    } else if (event === 'SIGNED_OUT') {
      logDebug('[Auth] SIGNED_OUT event');
      callback(null);
    } else if (event === 'INITIAL_SESSION') {
      logDebug('[Auth] INITIAL_SESSION event');
      // Handle initial load with or without session
      if (session?.user) {
        logDebug('[Auth] INITIAL_SESSION has user, getting profile...');
        const { user, error } = await getOrCreateUserProfile(
          session.user.id,
          session.user.email,
          session.user.user_metadata
        );
        logDebug('[Auth] INITIAL_SESSION profile result:', { hasUser: !!user, error });
        callback(user);
      } else {
        logDebug('[Auth] INITIAL_SESSION no user');
        callback(null);
      }
    } else if (event === 'TOKEN_REFRESHED') {
      logDebug('[Auth] TOKEN_REFRESHED event, ignoring');
    } else {
      logDebug('[Auth] Other auth event:', event);
    }
  });

  return () => {
    logDebug('[Auth] Unsubscribing from auth state changes');
    subscription.unsubscribe();
  };
};
