import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { checkPushPermission, initializePushNotifications, isPushAvailable } from '../services/pushNotifications';
import { updateProfile } from '../services/auth';
import { getTransactionHistory } from '../services/economy';
import { supabase } from '../services/supabase';
import type { DBTransaction, DBBadge } from '../types/database';
import ProfilePictureEditor from './ProfilePictureEditor';
import { CatFilterType } from '../services/catFilter';

interface ProfileProps {
  user: UserProfile;
  onBack: () => void;
  onOpenRules?: () => void;
  onOpenSettings?: () => void;
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
  onRetakeInterrogation?: () => void;
}

interface EditableFields {
  name: string;
  age: number;
  gender: string;
  work: string;
  schools: string;
  hasPets: boolean;
  petType: string;
  siblingCount: number;
  city: string;
  bio: string;
  avatarUrl: string;
}

// Get reputation title based on user stats
const getReputationTitle = (user: UserProfile): string => {
  const wins = user.totalWins || 0;
  const steals = user.stealSuccessful || 0;
  const robbed = user.timesRobbed || 0;

  if (steals >= 10) return 'MASTER THIEF';
  if (wins >= 20) return 'APEX PREDATOR';
  if (robbed >= 5) return 'EASY TARGET';
  if (steals >= 5) return 'CHAOTIC GREMLIN';
  if (wins >= 10) return 'RISING STRAY';
  if (wins >= 5) return 'CERTIFIED STRAY';
  if (steals >= 1) return 'OPPORTUNIST';
  if (wins >= 1) return 'NEWBORN KITTEN';
  return 'FRESH MEAT';
};

// Badge display info mapping
const BADGE_DISPLAY_INFO: Record<string, { icon: string; color: string }> = {
  'first_win': { icon: 'fa-trophy', color: 'text-acid-green' },
  'win_streak_3': { icon: 'fa-fire', color: 'text-orange-400' },
  'win_streak_5': { icon: 'fa-fire-flame-curved', color: 'text-hot-pink' },
  'win_streak_10': { icon: 'fa-meteor', color: 'text-alert-red' },
  'first_steal': { icon: 'fa-mask', color: 'text-cyan-glitch' },
  'heist_master': { icon: 'fa-user-ninja', color: 'text-purple-400' },
  'defender': { icon: 'fa-shield', color: 'text-blue-400' },
  'social_butterfly': { icon: 'fa-users', color: 'text-pink-400' },
  'chaotic_gremlin': { icon: 'fa-radiation', color: 'text-alert-red' },
  'certified_stray': { icon: 'fa-cat', color: 'text-acid-green' },
  'snitch': { icon: 'fa-camera', color: 'text-gray-500' },
  'loan_shark': { icon: 'fa-hand-holding-dollar', color: 'text-hot-pink' },
  'beggar': { icon: 'fa-hands-praying', color: 'text-cyan-glitch' },
};

const Profile: React.FC<ProfileProps> = ({ user, onBack, onOpenRules, onOpenSettings, onProfileUpdate, onRetakeInterrogation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [badges, setBadges] = useState<DBBadge[]>([]);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showPictureEditor, setShowPictureEditor] = useState(false);
  const [editedFields, setEditedFields] = useState<EditableFields>({
    name: user.name,
    age: user.age,
    gender: user.gender,
    work: user.work || '',
    schools: user.schools?.join(', ') || '',
    hasPets: user.hasPets || false,
    petType: user.petType || '',
    siblingCount: user.siblingCount || 0,
    city: user.city || '',
    bio: user.bio || '',
    avatarUrl: user.avatarUrl,
  });
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  // Check notification permission status on mount
  useEffect(() => {
    const checkNotifications = async () => {
      if (!isPushAvailable()) {
        setNotificationStatus('denied');
        return;
      }
      const status = await checkPushPermission();
      setNotificationStatus(status);
      setNotificationsEnabled(status === 'granted');
    };
    checkNotifications();
  }, []);

  // Update edited fields when user changes
  useEffect(() => {
    setEditedFields({
      name: user.name,
      age: user.age,
      gender: user.gender,
      work: user.work || '',
      schools: user.schools?.join(', ') || '',
      hasPets: user.hasPets || false,
      petType: user.petType || '',
      siblingCount: user.siblingCount || 0,
      city: user.city || '',
      bio: user.bio || '',
      avatarUrl: user.avatarUrl,
    });
    // Reset avatar error state when user changes
    setAvatarLoadError(false);
  }, [user]);

  // Fetch badges and transaction history from database
  useEffect(() => {
    const fetchProfileData = async () => {
      setLoadingData(true);
      try {
        // Fetch badges
        const { data: badgeData } = await supabase
          .from('bb_badges')
          .select('*')
          .eq('user_id', user.id)
          .order('awarded_at', { ascending: false });

        if (badgeData) {
          setBadges(badgeData);
        }

        // Fetch recent transactions
        const txResult = await getTransactionHistory(user.id, 10);
        if (txResult.transactions) {
          setTransactions(txResult.transactions);
        }
      } catch (err) {
        // Silently fail - will show empty state
      }
      setLoadingData(false);
    };

    fetchProfileData();
  }, [user.id]);

  const handleToggleNotifications = async () => {
    if (notificationStatus === 'granted') {
      // Can't programmatically revoke - tell user to go to settings
      alert('To disable notifications, go to your device Settings > Apps > Bad Bingo > Notifications');
      return;
    }

    // Request permission
    const result = await initializePushNotifications();
    if (result.success) {
      setNotificationsEnabled(true);
      setNotificationStatus('granted');
    } else {
      alert('Could not enable notifications. Please check your device settings.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {
        name: editedFields.name,
        age: editedFields.age,
        gender: editedFields.gender,
        work: editedFields.work || null,
        schools: editedFields.schools ? editedFields.schools.split(',').map(s => s.trim()) : null,
        has_pets: editedFields.hasPets,
        pet_type: editedFields.petType || null,
        sibling_count: editedFields.siblingCount,
        city: editedFields.city || null,
        bio: editedFields.bio || null,
        avatar_url: editedFields.avatarUrl,
      };

      const { error } = await updateProfile(user.id, updates);
      if (error) {
        alert(`Failed to save: ${error}`);
      } else {
        // Update local state via callback if provided
        if (onProfileUpdate) {
          onProfileUpdate({
            name: editedFields.name,
            age: editedFields.age,
            gender: editedFields.gender,
            work: editedFields.work,
            schools: editedFields.schools ? editedFields.schools.split(',').map(s => s.trim()) : undefined,
            hasPets: editedFields.hasPets,
            petType: editedFields.petType,
            siblingCount: editedFields.siblingCount,
            city: editedFields.city,
            bio: editedFields.bio,
            avatarUrl: editedFields.avatarUrl,
          });
        }
        setIsEditing(false);
      }
    } catch (err) {
      alert('Failed to save profile');
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setEditedFields({
      name: user.name,
      age: user.age,
      gender: user.gender,
      work: user.work || '',
      schools: user.schools?.join(', ') || '',
      hasPets: user.hasPets || false,
      petType: user.petType || '',
      siblingCount: user.siblingCount || 0,
      city: user.city || '',
      bio: user.bio || '',
      avatarUrl: user.avatarUrl,
    });
    setIsEditing(false);
  };

  const handleAvatarChange = () => {
    // Generate a new random avatar
    const seed = Math.random().toString(36).substring(7);
    setEditedFields(prev => ({
      ...prev,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4`
    }));
  };

  const handleProfilePictureSave = async (newAvatarUrl: string, _selectedFilter: CatFilterType) => {
    // Update the profile with the new avatar URL
    try {
      const { error } = await updateProfile(user.id, { avatar_url: newAvatarUrl });
      if (error) {
        console.error('Failed to update avatar:', error);
      } else {
        // Update local state
        if (onProfileUpdate) {
          onProfileUpdate({ avatarUrl: newAvatarUrl });
        }
        setEditedFields(prev => ({ ...prev, avatarUrl: newAvatarUrl }));
      }
    } catch (err) {
      console.error('Avatar update error:', err);
    }
    setShowPictureEditor(false);
  };

  // Real stats from user profile
  const stats = {
    wins: user.totalWins || 0,
    losses: Math.max(0, (user.totalClashes || 0) - (user.totalWins || 0)),
    steals: user.stealSuccessful || 0,
    robbed: user.timesRobbed || 0,
    reputation: getReputationTitle(user)
  };

  // Handler for sound toggle
  const handleSoundToggle = async () => {
    const newValue = !user.soundEnabled;
    if (onProfileUpdate) {
      onProfileUpdate({ soundEnabled: newValue });
    }
    await updateProfile(user.id, { sound_enabled: newValue });
  };

  // Handler for haptics toggle
  const handleHapticsToggle = async () => {
    const newValue = !user.hapticsEnabled;
    if (onProfileUpdate) {
      onProfileUpdate({ hapticsEnabled: newValue });
    }
    await updateProfile(user.id, { haptics_enabled: newValue });
  };

  // Format transaction for history display
  const formatTransaction = (tx: DBTransaction) => {
    const isPositive = tx.amount > 0;
    let result = 'TX';

    switch (tx.type) {
      case 'clash_win':
        result = 'WIN';
        break;
      case 'clash_loss':
      case 'clash_stake_lock':
        result = 'L';
        break;
      case 'steal_success':
        result = 'HEIST';
        break;
      case 'steal_victim':
        result = 'ROBBED';
        break;
      case 'steal_penalty':
        result = 'BUSTED';
        break;
      case 'allowance':
        result = 'FEEDING';
        break;
      case 'borrow':
        result = 'LOAN';
        break;
      case 'repay':
        result = 'REPAID';
        break;
      case 'beg_received':
        result = 'BEGGED';
        break;
    }

    return {
      id: tx.id,
      text: tx.description,
      result,
      amount: isPositive ? `+${tx.amount}` : `${tx.amount}`,
    };
  };

  return (
    <div className="h-full bg-bingo-black flex flex-col relative overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header with safe area padding for mobile */}
        <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="p-4 flex justify-between items-center">
                <button
                    onClick={onBack}
                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
                >
                    <i className="fas fa-arrow-left text-2xl"></i>
                </button>
                <div className="text-acid-green font-mono text-xs tracking-[0.2em] uppercase">Criminal Record</div>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-acid-green active:text-acid-green transition-colors rounded-full active:bg-white/10"
                    >
                        <i className="fas fa-pencil text-xl"></i>
                    </button>
                ) : (
                    <div className="w-12"></div>
                )}
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 pt-2">
            {/* ID Card Look */}
            <div className="bg-gray-900 border-2 border-white/10 rounded-xl p-6 relative overflow-hidden mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <i className="fas fa-fingerprint text-9xl text-white"></i>
                </div>

                <div className="flex flex-col items-center relative z-10">
                    <div className="relative">
                        <button
                            onClick={() => !isEditing && setShowPictureEditor(true)}
                            disabled={isEditing}
                            className="w-24 h-24 rounded-full border-2 border-acid-green p-1 mb-4 shadow-[0_0_15px_rgba(204,255,0,0.3)] relative group cursor-pointer disabled:cursor-default transition-transform hover:scale-105 active:scale-95"
                        >
                            <img
                              src={avatarLoadError
                                ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}&backgroundColor=b6e3f4`
                                : (isEditing ? editedFields.avatarUrl : user.avatarUrl)}
                              alt="Avatar"
                              className="w-full h-full rounded-full bg-gray-800 object-cover"
                              onError={() => setAvatarLoadError(true)}
                            />
                            {!isEditing && (
                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <i className="fas fa-camera text-white text-xl"></i>
                                </div>
                            )}
                        </button>
                        {isEditing && (
                            <button
                                onClick={handleAvatarChange}
                                className="absolute bottom-3 right-0 w-8 h-8 bg-acid-green text-black rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                            >
                                <i className="fas fa-refresh text-sm"></i>
                            </button>
                        )}
                        {!isEditing && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full border border-gray-700 whitespace-nowrap">
                                <i className="fas fa-cat mr-1 text-acid-green"></i>
                                Tap to change
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <input
                            type="text"
                            value={editedFields.name}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, name: e.target.value }))}
                            className="text-2xl font-black text-white uppercase tracking-tighter bg-transparent border-b-2 border-acid-green text-center w-full max-w-[200px] focus:outline-none"
                        />
                    ) : (
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">{user.name}</h1>
                    )}
                    <div className="text-xs font-mono text-hot-pink bg-hot-pink/10 px-3 py-1 rounded mt-2 border border-hot-pink/30">
                        LVL 1 • {stats.reputation}
                    </div>
                </div>

            </div>

            {/* Risk Profile Analysis Card - Prominent Display */}
            {user.riskProfile && !isEditing && (
                <div className="bg-gray-900/80 border-2 border-acid-green/30 rounded-xl p-5 mb-6 relative overflow-hidden shadow-[0_0_20px_rgba(204,255,0,0.1)]">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 opacity-5">
                        <i className="fas fa-cat text-[120px] text-acid-green translate-x-8 -translate-y-4"></i>
                    </div>

                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <div className="w-8 h-8 rounded-full bg-acid-green/20 flex items-center justify-center">
                            <i className="fas fa-brain text-acid-green"></i>
                        </div>
                        <div>
                            <h3 className="text-acid-green font-mono text-xs uppercase tracking-widest">Bad Bingo's Analysis</h3>
                            <p className="text-gray-600 text-[10px]">Your psychological profile</p>
                        </div>
                    </div>

                    {/* Risk Profile Content */}
                    <div className="bg-black/40 rounded-lg p-4 mb-4 relative z-10">
                        <p className="text-white text-sm leading-relaxed font-mono italic">
                            "{user.riskProfile}"
                        </p>
                    </div>

                    {/* Retake Button */}
                    {onRetakeInterrogation && (
                        <button
                            onClick={onRetakeInterrogation}
                            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-acid-green/50 text-gray-300 hover:text-acid-green font-bold py-3 rounded-lg uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 relative z-10"
                        >
                            <i className="fas fa-refresh"></i>
                            <span>Retake the Interrogation</span>
                        </button>
                    )}
                </div>
            )}

            {/* Edit Form */}
            {isEditing && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6 space-y-4">
                    <h3 className="text-acid-green font-mono text-xs uppercase tracking-widest mb-4">Edit Profile</h3>

                    {/* Age & Gender */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Age</label>
                            <input
                                type="number"
                                value={editedFields.age}
                                onChange={(e) => setEditedFields(prev => ({ ...prev, age: parseInt(e.target.value) || 18 }))}
                                className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm"
                                min={18}
                                max={120}
                            />
                        </div>
                        <div>
                            <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Gender</label>
                            <input
                                type="text"
                                value={editedFields.gender}
                                onChange={(e) => setEditedFields(prev => ({ ...prev, gender: e.target.value }))}
                                className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm"
                            />
                        </div>
                    </div>

                    {/* Work */}
                    <div>
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Work</label>
                        <input
                            type="text"
                            value={editedFields.work}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, work: e.target.value }))}
                            placeholder="What do you do?"
                            className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm placeholder-gray-600"
                        />
                    </div>

                    {/* Schools */}
                    <div>
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Schools (comma-separated)</label>
                        <input
                            type="text"
                            value={editedFields.schools}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, schools: e.target.value }))}
                            placeholder="Where did you study?"
                            className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm placeholder-gray-600"
                        />
                    </div>

                    {/* City */}
                    <div>
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">City/Location</label>
                        <input
                            type="text"
                            value={editedFields.city}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="Where's your chaos at?"
                            className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm placeholder-gray-600"
                        />
                    </div>

                    {/* Pets */}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editedFields.hasPets}
                                onChange={(e) => setEditedFields(prev => ({ ...prev, hasPets: e.target.checked }))}
                                className="w-4 h-4 accent-acid-green"
                            />
                            <span className="text-gray-400 text-sm">Has Pets</span>
                        </label>
                        {editedFields.hasPets && (
                            <input
                                type="text"
                                value={editedFields.petType}
                                onChange={(e) => setEditedFields(prev => ({ ...prev, petType: e.target.value }))}
                                placeholder="Pet type"
                                className="flex-1 bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm placeholder-gray-600"
                            />
                        )}
                    </div>

                    {/* Siblings */}
                    <div>
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Number of Siblings</label>
                        <input
                            type="number"
                            value={editedFields.siblingCount}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, siblingCount: parseInt(e.target.value) || 0 }))}
                            className="w-24 bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm"
                            min={0}
                            max={20}
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="text-gray-500 text-[10px] uppercase tracking-wider block mb-1">Bio</label>
                        <textarea
                            value={editedFields.bio}
                            onChange={(e) => setEditedFields(prev => ({ ...prev, bio: e.target.value }))}
                            placeholder="Tell us about yourself..."
                            rows={3}
                            className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-acid-green text-sm placeholder-gray-600 resize-none"
                        />
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleCancel}
                            className="flex-1 bg-gray-800 text-gray-400 font-bold py-3 rounded-lg uppercase text-sm hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-acid-green text-black font-bold py-3 rounded-lg uppercase text-sm hover:bg-white transition-colors disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Extended Profile Display (when not editing) */}
            {!isEditing && (user.work || user.schools?.length || user.city || user.hasPets) && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6">
                    <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">The Dossier</h3>
                    <div className="space-y-2">
                        {user.work && (
                            <div className="flex items-center gap-3 text-sm">
                                <i className="fas fa-briefcase text-cyan-glitch w-5 text-center"></i>
                                <span className="text-gray-400">{user.work}</span>
                            </div>
                        )}
                        {user.schools && user.schools.length > 0 && (
                            <div className="flex items-center gap-3 text-sm">
                                <i className="fas fa-graduation-cap text-hot-pink w-5 text-center"></i>
                                <span className="text-gray-400">{user.schools.join(', ')}</span>
                            </div>
                        )}
                        {user.city && (
                            <div className="flex items-center gap-3 text-sm">
                                <i className="fas fa-map-marker-alt text-acid-green w-5 text-center"></i>
                                <span className="text-gray-400">{user.city}</span>
                            </div>
                        )}
                        {user.hasPets && (
                            <div className="flex items-center gap-3 text-sm">
                                <i className="fas fa-paw text-orange-400 w-5 text-center"></i>
                                <span className="text-gray-400">{user.petType || 'Has pets'}</span>
                            </div>
                        )}
                        {user.siblingCount !== undefined && user.siblingCount > 0 && (
                            <div className="flex items-center gap-3 text-sm">
                                <i className="fas fa-users text-purple-400 w-5 text-center"></i>
                                <span className="text-gray-400">{user.siblingCount} sibling{user.siblingCount !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-acid-green transition-colors">
                    <div className="text-acid-green text-2xl font-black">{stats.wins}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Bodies Claimed</div>
                </div>
                <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-alert-red transition-colors">
                    <div className="text-alert-red text-2xl font-black">{stats.losses}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Times Bodied</div>
                </div>
                 <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-cyan-glitch transition-colors">
                    <div className="text-cyan-glitch text-2xl font-black">{stats.steals}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Successful Heists</div>
                </div>
                 <div className="bg-bingo-dark p-4 rounded border border-gray-800 flex flex-col items-center hover:border-white transition-colors">
                    <div className="text-white text-2xl font-black">{user.coins}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Bingo Stash</div>
                </div>
            </div>

            {/* Badges */}
            <div className="mb-8">
                <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">Titles & Shame</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {loadingData ? (
                        <div className="flex items-center justify-center py-4 w-full">
                            <i className="fas fa-spinner fa-spin text-gray-600"></i>
                        </div>
                    ) : badges.length > 0 ? (
                        badges.map((badge) => {
                            const displayInfo = BADGE_DISPLAY_INFO[badge.badge_type] || { icon: 'fa-star', color: 'text-gray-400' };
                            return (
                                <div key={badge.id} className="flex-shrink-0 bg-black border border-gray-800 px-4 py-3 rounded flex flex-col items-center min-w-[80px]">
                                    <i className={`fas ${displayInfo.icon} text-xl mb-2 ${displayInfo.color}`}></i>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{badge.badge_type.replace(/_/g, ' ')}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex-shrink-0 bg-black/30 border border-gray-800 border-dashed px-4 py-3 rounded flex flex-col items-center min-w-[150px] justify-center opacity-70">
                            <i className="fas fa-question text-gray-600 mb-1 text-xl"></i>
                            <span className="text-[10px] text-gray-500">No badges yet</span>
                            <span className="text-[8px] text-gray-600 mt-1">Start winning!</span>
                        </div>
                    )}
                    <div className="flex-shrink-0 bg-black/30 border border-gray-800 border-dashed px-4 py-3 rounded flex flex-col items-center min-w-[80px] justify-center opacity-50">
                        <i className="fas fa-lock text-gray-600 mb-1"></i>
                        <span className="text-[10px] text-gray-600">MORE</span>
                    </div>
                </div>
            </div>

            {/* History */}
            <div className="pb-4">
                 <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">The Damage Report</h3>
                 <div className="space-y-2">
                    {loadingData ? (
                        <div className="flex items-center justify-center py-8">
                            <i className="fas fa-spinner fa-spin text-gray-600"></i>
                        </div>
                    ) : transactions.length > 0 ? (
                        transactions.map(tx => {
                            const h = formatTransaction(tx);
                            const isWin = ['WIN', 'HEIST', 'FEEDING', 'LOAN', 'BEGGED'].includes(h.result);
                            return (
                                <div key={h.id} className="bg-bingo-dark/50 p-3 rounded flex justify-between items-center border-l-2 border-gray-700 hover:border-acid-green transition-colors">
                                    <div>
                                        <div className="text-xs text-white font-bold truncate max-w-[200px]">{h.text}</div>
                                        <div className={`text-[10px] font-mono mt-1 ${isWin ? 'text-acid-green' : 'text-gray-500'}`}>{h.result}</div>
                                    </div>
                                    <div className={`font-mono text-sm font-bold ${h.amount.startsWith('+') ? 'text-acid-green' : 'text-alert-red'}`}>
                                        {h.amount}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8">
                            <i className="fas fa-ghost text-3xl text-gray-700 mb-2"></i>
                            <p className="text-gray-500 text-xs">No history yet</p>
                            <p className="text-gray-600 text-[10px] mt-1">Start making chaos!</p>
                        </div>
                    )}
                 </div>
            </div>

            {/* Settings */}
            <div className="mb-6">
                <h3 className="text-gray-500 text-xs uppercase tracking-widest mb-3 pl-1">Settings</h3>

                {/* Notifications Toggle */}
                <div className="bg-bingo-dark p-4 rounded-lg border border-gray-800 flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-full bg-hot-pink/10 flex items-center justify-center">
                        <i className={`fas fa-bell text-xl ${notificationsEnabled ? 'text-hot-pink' : 'text-gray-600'}`}></i>
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-white font-bold">Notifications</div>
                        <div className="text-xs text-gray-500">
                            {notificationStatus === 'checking' && 'Checking...'}
                            {notificationStatus === 'granted' && 'Get alerts for challenges & steals'}
                            {notificationStatus === 'denied' && 'Enable in device settings'}
                            {notificationStatus === 'prompt' && 'Tap to enable alerts'}
                        </div>
                    </div>
                    <button
                        onClick={handleToggleNotifications}
                        disabled={notificationStatus === 'checking'}
                        className={`w-14 h-8 rounded-full p-1 transition-colors ${
                            notificationsEnabled
                                ? 'bg-hot-pink'
                                : 'bg-gray-700'
                        }`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                            notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}></div>
                    </button>
                </div>

                {/* Sound Toggle */}
                <button
                    onClick={handleSoundToggle}
                    className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 flex items-center gap-4 mb-3 hover:border-cyan-glitch/50 transition-colors active:scale-[0.99]"
                >
                    <div className="w-12 h-12 rounded-full bg-cyan-glitch/10 flex items-center justify-center">
                        <i className={`fas fa-volume-high text-xl ${user.soundEnabled ? 'text-cyan-glitch' : 'text-gray-600'}`}></i>
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-white font-bold">Sound Effects</div>
                        <div className="text-xs text-gray-500">Beeps, boops, and chaos</div>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1 transition-colors ${user.soundEnabled ? 'bg-cyan-glitch' : 'bg-gray-700'}`}>
                        <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${user.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                </button>

                {/* Haptics Toggle */}
                <button
                    onClick={handleHapticsToggle}
                    className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 flex items-center gap-4 hover:border-acid-green/50 transition-colors active:scale-[0.99]"
                >
                    <div className="w-12 h-12 rounded-full bg-acid-green/10 flex items-center justify-center">
                        <i className={`fas fa-hand-point-up text-xl ${user.hapticsEnabled ? 'text-acid-green' : 'text-gray-600'}`}></i>
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-white font-bold">Vibration</div>
                        <div className="text-xs text-gray-500">Feel the chaos</div>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1 transition-colors ${user.hapticsEnabled ? 'bg-acid-green' : 'bg-gray-700'}`}>
                        <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${user.hapticsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                </button>
            </div>

            {/* Rules & Settings */}
            <div className="pb-8 space-y-3">
                <button
                    onClick={onOpenRules}
                    className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-acid-green transition-colors flex items-center gap-4"
                >
                    <div className="w-12 h-12 rounded-full bg-acid-green/10 flex items-center justify-center">
                        <i className="fas fa-book text-xl text-acid-green"></i>
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-white font-bold">House Rules</div>
                        <div className="text-xs text-gray-500">How this den operates</div>
                    </div>
                    <i className="fas fa-chevron-right text-gray-600"></i>
                </button>

                <button
                    onClick={onOpenSettings}
                    className="w-full bg-bingo-dark p-4 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors flex items-center gap-4"
                >
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                        <i className="fas fa-cog text-xl text-gray-400"></i>
                    </div>
                    <div className="text-left flex-1">
                        <div className="text-white font-bold">Settings</div>
                        <div className="text-xs text-gray-500">Customize your chaos</div>
                    </div>
                    <i className="fas fa-chevron-right text-gray-600"></i>
                </button>
            </div>
        </div>

        {/* Profile Picture Editor Modal */}
        {showPictureEditor && (
            <ProfilePictureEditor
                userId={user.id}
                currentAvatarUrl={user.avatarUrl}
                onSave={handleProfilePictureSave}
                onCancel={() => setShowPictureEditor(false)}
            />
        )}
    </div>
  );
};

export default Profile;
