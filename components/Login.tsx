import React, { useState, useEffect, useRef } from 'react';
import { signInWithGoogle, setupOAuthListener, onAuthStateChange, signIn, signUp, resetOAuthCallback } from '../services/auth';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { UserProfile } from '../types';
import { logDebug } from '../utils/logger';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

type AuthMode = 'login' | 'signup';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const oauthInProgress = useRef(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  // Listen for app resume to reset loading state if OAuth didn't complete
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = App.addListener('appStateChange', (state) => {
      if (state.isActive && oauthInProgress.current) {
        // App resumed from OAuth flow - give it a moment then reset if still loading
        setTimeout(() => {
          if (oauthInProgress.current) {
            oauthInProgress.current = false;
            setLoading(false);
          }
        }, 3000);
      }
    });

    return () => {
      handle.then(h => h.remove());
    };
  }, []);

  useEffect(() => {
    // Check for existing session
    const unsubscribe = onAuthStateChange((user) => {
      setCheckingAuth(false);
      if (user) {
        // Convert DB user to UserProfile format
        const profile: UserProfile = {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email || undefined,
          age: user.age,
          gender: user.gender || 'unknown',
          coins: user.coins,
          riskProfile: user.risk_profile || 'Unknown risk profile',
          avatarUrl: user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          socialDebt: user.social_debt,
          totalWins: user.total_wins,
          totalClashes: user.total_clashes,
          winStreak: user.win_streak,
          bestWinStreak: user.best_win_streak,
          stealSuccessful: user.steals_successful,
          stealsDefended: user.steals_defended,
          timesRobbed: user.times_robbed,
          pushEnabled: user.push_enabled,
          soundEnabled: user.sound_enabled,
          hapticsEnabled: user.haptics_enabled,
          trustScore: user.trust_score,
          isVerified: user.is_verified,
          lastAllowanceClaimed: user.last_allowance_claimed || undefined,
          lastLogin: user.last_login || undefined,
          loginStreak: user.login_streak,
        };
        onLoginSuccess(profile);
      }
    });

    // Set up OAuth callback listener
    const cleanupOAuth = setupOAuthListener(
      (user) => {
        logDebug('[Login] OAuth success callback received, user:', user.id);
        oauthInProgress.current = false;
        const profile: UserProfile = {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email || undefined,
          age: user.age,
          gender: user.gender || 'unknown',
          coins: user.coins,
          riskProfile: user.risk_profile || 'Unknown risk profile',
          avatarUrl: user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          socialDebt: user.social_debt,
          totalWins: user.total_wins,
          totalClashes: user.total_clashes,
          winStreak: user.win_streak,
          bestWinStreak: user.best_win_streak,
          stealSuccessful: user.steals_successful,
          stealsDefended: user.steals_defended,
          timesRobbed: user.times_robbed,
          pushEnabled: user.push_enabled,
          soundEnabled: user.sound_enabled,
          hapticsEnabled: user.haptics_enabled,
          trustScore: user.trust_score,
          isVerified: user.is_verified,
          lastAllowanceClaimed: user.last_allowance_claimed || undefined,
          lastLogin: user.last_login || undefined,
          loginStreak: user.login_streak,
        };
        setLoading(false);
        logDebug('[Login] Calling onLoginSuccess with profile');
        onLoginSuccess(profile);
      },
      (err) => {
        logDebug('[Login] OAuth error callback:', err);
        oauthInProgress.current = false;
        setLoading(false);
        setError(err);
      }
    );

    return () => {
      unsubscribe();
      cleanupOAuth();
    };
  }, [onLoginSuccess]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    oauthInProgress.current = true;

    // Reset the OAuth callback flag before starting a new OAuth flow
    resetOAuthCallback();
    logDebug('[Login] Starting Google sign-in');

    const result = await signInWithGoogle();

    if (!result.success) {
      setLoading(false);
      oauthInProgress.current = false;
      setError(result.error || 'Failed to sign in');
    }
    // If success, the OAuth callback or app resume listener will handle resetting
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (!name.trim() || !username.trim()) {
        setError('Name and username are required');
        setLoading(false);
        return;
      }

      const result = await signUp({
        email,
        password,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        age: 18, // Will be updated during onboarding
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.user) {
        const profile: UserProfile = {
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
          email: result.user.email || undefined,
          age: result.user.age,
          gender: result.user.gender || 'unknown',
          coins: result.user.coins,
          riskProfile: result.user.risk_profile || '',
          avatarUrl: result.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.user.id}`,
          socialDebt: result.user.social_debt,
          totalWins: result.user.total_wins,
          totalClashes: result.user.total_clashes,
          winStreak: result.user.win_streak,
          bestWinStreak: result.user.best_win_streak,
          stealSuccessful: result.user.steals_successful,
          stealsDefended: result.user.steals_defended,
          timesRobbed: result.user.times_robbed,
          pushEnabled: result.user.push_enabled,
          soundEnabled: result.user.sound_enabled,
          hapticsEnabled: result.user.haptics_enabled,
          trustScore: result.user.trust_score,
          isVerified: result.user.is_verified,
          lastAllowanceClaimed: result.user.last_allowance_claimed || undefined,
          lastLogin: result.user.last_login || undefined,
          loginStreak: result.user.login_streak,
        };
        onLoginSuccess(profile);
      }
    } else {
      const result = await signIn({ email, password });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.user) {
        const profile: UserProfile = {
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
          email: result.user.email || undefined,
          age: result.user.age,
          gender: result.user.gender || 'unknown',
          coins: result.user.coins,
          riskProfile: result.user.risk_profile || '',
          avatarUrl: result.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.user.id}`,
          socialDebt: result.user.social_debt,
          totalWins: result.user.total_wins,
          totalClashes: result.user.total_clashes,
          winStreak: result.user.win_streak,
          bestWinStreak: result.user.best_win_streak,
          stealSuccessful: result.user.steals_successful,
          stealsDefended: result.user.steals_defended,
          timesRobbed: result.user.times_robbed,
          pushEnabled: result.user.push_enabled,
          soundEnabled: result.user.sound_enabled,
          hapticsEnabled: result.user.haptics_enabled,
          trustScore: result.user.trust_score,
          isVerified: result.user.is_verified,
          lastAllowanceClaimed: result.user.last_allowance_claimed || undefined,
          lastLogin: result.user.last_login || undefined,
          loginStreak: result.user.login_streak,
        };
        onLoginSuccess(profile);
      }
    }

    setLoading(false);
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  if (checkingAuth) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bingo-black">
        <i className="fas fa-cat fa-spin text-5xl text-acid-green mb-4"></i>
        <p className="text-gray-400 text-sm">Checking your identity...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bingo-black overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #ccff00 10px, #ccff00 11px)`,
        }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="text-6xl mb-4">😼</div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
            BAD <span className="text-acid-green">BINGO</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2 italic">
            "Your friends aren't ready for this."
          </p>
        </div>

        {/* Tagline */}
        <div className="mb-12 text-center max-w-xs">
          <p className="text-gray-400 text-sm leading-relaxed">
            Social betting with your actual friends.
            <br />
            <span className="text-hot-pink">No money. Just chaos.</span>
          </p>
        </div>

        {!showEmailForm ? (
          <>
            {/* Sign In with Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`
                w-full max-w-xs flex items-center justify-center gap-3
                bg-white hover:bg-gray-100 text-gray-800
                py-4 px-6 rounded-xl font-bold text-lg
                shadow-[0_0_30px_rgba(255,255,255,0.1)]
                transition-all duration-200
                ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
              `}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 w-full max-w-xs my-4">
              <div className="flex-1 h-px bg-gray-700"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-700"></div>
            </div>

            {/* Email Sign In Button */}
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full max-w-xs flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 text-white py-4 px-6 rounded-xl font-bold transition-all active:scale-95"
            >
              <i className="fas fa-envelope"></i>
              <span>Continue with Email</span>
            </button>
          </>
        ) : (
          <form onSubmit={handleEmailSubmit} className="w-full max-w-xs space-y-4">
            {/* Back button */}
            <button
              type="button"
              onClick={() => { setShowEmailForm(false); setError(null); }}
              className="text-gray-400 hover:text-white flex items-center gap-2 text-sm mb-4"
            >
              <i className="fas fa-arrow-left"></i>
              Back
            </button>

            <h2 className="text-xl font-bold text-white mb-4">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>

            {authMode === 'signup' && (
              <>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-acid-green focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="yourusername"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-acid-green focus:outline-none"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-acid-green focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-acid-green focus:outline-none"
                required
                minLength={6}
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-acid-green focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-acid-green text-black font-bold py-4 rounded-lg uppercase tracking-wider transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-acid-green/90 active:scale-95'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                authMode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>

            <p className="text-center text-gray-400 text-sm">
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={toggleAuthMode}
                className="text-acid-green hover:underline"
              >
                {authMode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-alert-red/20 border border-alert-red/50 rounded-lg max-w-xs">
            <p className="text-alert-red text-sm text-center">{error}</p>
          </div>
        )}

        {/* Age disclaimer */}
        <p className="text-gray-600 text-xs mt-8 text-center max-w-xs">
          By signing in, you confirm you're 18+ and agree to bet responsibly with your friends.
          <br />
          <span className="text-gray-700">No real money involved.</span>
        </p>

        {/* Dev Mode - Skip Login for Testing */}
        <button
          onClick={() => {
            const devProfile: UserProfile = {
              id: 'dev-user-' + Date.now(),
              name: '',
              username: '',
              email: 'dev@test.com',
              age: 21,
              gender: '',
              coins: 1000,
              riskProfile: '',
              avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devuser&backgroundColor=b6e3f4',
              socialDebt: 0,
              totalWins: 0,
              totalClashes: 0,
              winStreak: 0,
              bestWinStreak: 0,
              stealSuccessful: 0,
              stealsDefended: 0,
              timesRobbed: 0,
              pushEnabled: false,
              soundEnabled: true,
              hapticsEnabled: true,
              trustScore: 100,
              isVerified: false,
              loginStreak: 1,
            };
            onLoginSuccess(devProfile);
          }}
          className="mt-4 text-gray-600 text-xs underline hover:text-gray-400"
        >
          [Dev] Skip Login & Test Onboarding
        </button>
      </div>

      {/* Bottom decoration */}
      <div className="h-1 bg-gradient-to-r from-acid-green via-hot-pink to-cyan-glitch" />
    </div>
  );
};

export default Login;
