import React, { useState } from 'react';
import { UserProfile, AppView } from '../types';
import { signOut, updateProfile } from '../services/auth';
import { triggerHaptic } from '../services/effects';

interface SettingsProps {
  user: UserProfile;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onNavigate, onLogout, onUpdateUser }) => {
  const [soundEnabled, setSoundEnabled] = useState(user.soundEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState(user.hapticsEnabled);
  const [pushEnabled, setPushEnabled] = useState(user.pushEnabled);
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleToggle = async (
    setting: 'sound' | 'haptics' | 'push',
    value: boolean
  ) => {
    setSaving(true);
    triggerHaptic('light');

    const updates: Partial<UserProfile> = {};
    switch (setting) {
      case 'sound':
        setSoundEnabled(value);
        updates.soundEnabled = value;
        break;
      case 'haptics':
        setHapticsEnabled(value);
        updates.hapticsEnabled = value;
        break;
      case 'push':
        setPushEnabled(value);
        updates.pushEnabled = value;
        break;
    }

    try {
      await updateProfile(user.id, {
        sound_enabled: updates.soundEnabled,
        haptics_enabled: updates.hapticsEnabled,
        push_enabled: updates.pushEnabled,
      });
      onUpdateUser(updates);
    } catch (error) {
      // Revert on error
      switch (setting) {
        case 'sound':
          setSoundEnabled(!value);
          break;
        case 'haptics':
          setHapticsEnabled(!value);
          break;
        case 'push':
          setPushEnabled(!value);
          break;
      }
    }

    setSaving(false);
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    const { error } = await signOut();
    if (!error) {
      onLogout();
    }
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <button
            onClick={() => onNavigate(AppView.PROFILE)}
            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
          >
            <i className="fas fa-arrow-left text-2xl"></i>
          </button>
          <div>
            <h1 className="text-white font-bold uppercase tracking-widest">Settings</h1>
            <p className="text-xs text-gray-500">Customize your chaos</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Notifications Section */}
        <div className="mb-6">
          <h2 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Notifications</h2>
          <div className="bg-bingo-dark rounded-lg border border-gray-800">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-bell text-hot-pink"></i>
                <div>
                  <div className="text-white font-medium">Push Notifications</div>
                  <div className="text-xs text-gray-500">Get alerts when friends challenge you</div>
                </div>
              </div>
              <button
                onClick={() => handleToggle('push', !pushEnabled)}
                disabled={saving}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  pushEnabled ? 'bg-acid-green' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                    pushEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Sound & Haptics Section */}
        <div className="mb-6">
          <h2 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Feedback</h2>
          <div className="bg-bingo-dark rounded-lg border border-gray-800 divide-y divide-gray-800">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-volume-high text-cyan-glitch"></i>
                <div>
                  <div className="text-white font-medium">Sound Effects</div>
                  <div className="text-xs text-gray-500">Hear satisfying sounds</div>
                </div>
              </div>
              <button
                onClick={() => handleToggle('sound', !soundEnabled)}
                disabled={saving}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  soundEnabled ? 'bg-acid-green' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                    soundEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-mobile-screen-button text-orange-400"></i>
                <div>
                  <div className="text-white font-medium">Haptic Feedback</div>
                  <div className="text-xs text-gray-500">Feel the vibrations</div>
                </div>
              </div>
              <button
                onClick={() => handleToggle('haptics', !hapticsEnabled)}
                disabled={saving}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  hapticsEnabled ? 'bg-acid-green' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow ${
                    hapticsEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="mb-6">
          <h2 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Account</h2>
          <div className="bg-bingo-dark rounded-lg border border-gray-800 divide-y divide-gray-800">
            <button
              onClick={() => onNavigate(AppView.PROFILE)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-user text-gray-400"></i>
                <div>
                  <div className="text-white font-medium">Edit Profile</div>
                  <div className="text-xs text-gray-500">Update your info</div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>

            <button
              onClick={() => onNavigate(AppView.RULES)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-book text-gray-400"></i>
                <div>
                  <div className="text-white font-medium">Rules</div>
                  <div className="text-xs text-gray-500">How to play Bad Bingo</div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>

            <button
              onClick={() => onNavigate(AppView.TUTORIAL)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-graduation-cap text-gray-400"></i>
                <div>
                  <div className="text-white font-medium">Replay Tutorial</div>
                  <div className="text-xs text-gray-500">Learn the basics again</div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mb-6">
          <h2 className="text-gray-500 text-xs uppercase tracking-widest mb-3">Danger Zone</h2>
          <div className="bg-bingo-dark rounded-lg border border-gray-800">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full p-4 flex items-center gap-3 text-left"
            >
              <i className="fas fa-sign-out-alt text-alert-red"></i>
              <div>
                <div className="text-alert-red font-medium">Log Out</div>
                <div className="text-xs text-gray-500">See you later, troublemaker</div>
              </div>
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="text-center text-gray-600 text-xs">
          <p>Bad Bingo v1.0.0</p>
          <p className="mt-1">Made with chaos in mind</p>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-bingo-dark rounded-lg p-6 max-w-sm w-full border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-2">Log Out?</h3>
            <p className="text-gray-400 text-sm mb-6">
              You'll miss all the drama while you're gone...
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-bold uppercase text-sm"
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 bg-alert-red text-white rounded-lg font-bold uppercase text-sm"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
