// ============================================
// APP STATE TYPES (Local UI State)
// ============================================

export enum AppView {
  SPLASH = 'SPLASH',
  AGE_VERIFICATION = 'AGE_VERIFICATION',
  ONBOARDING = 'ONBOARDING',
  TUTORIAL = 'TUTORIAL',
  DASHBOARD = 'DASHBOARD',
  SWIPE_FEED = 'SWIPE_FEED',
  CLASH = 'CLASH',
  STEAL = 'STEAL',
  DEFENSE = 'DEFENSE',
  PROFILE = 'PROFILE',
  TROPHY = 'TROPHY',
  CAMERA = 'CAMERA',
  PROOF_VAULT = 'PROOF_VAULT',
  ADD_FRIEND = 'ADD_FRIEND',
  CREATE_BET = 'CREATE_BET',
  WALLET = 'WALLET',
  BEG = 'BEG',
  BORROW = 'BORROW',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SETTINGS = 'SETTINGS',
  RULES = 'RULES'
}

export enum RelationshipLevel {
  CIVILIAN = 1, // Safe / Mom / Boss
  ROAST = 2,    // Friends / Besties
  NUCLEAR = 3   // Partner / Ex / Deep History
}

// ============================================
// USER TYPES
// ============================================

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  age: number;
  gender: string;
  coins: number;
  riskProfile: string;
  avatarUrl: string;
  socialDebt: number;

  // Stats
  totalWins: number;
  totalClashes: number;
  winStreak: number;
  bestWinStreak: number;
  stealSuccessful: number;
  stealsDefended: number;
  timesRobbed: number;

  // Settings
  pushEnabled: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;

  // Trust & Standing
  trustScore: number;
  isVerified: boolean;

  // Timing
  lastAllowanceClaimed?: string;
  lastLogin?: string;
  loginStreak: number;

  // Extended Profile (Phase 4)
  work?: string;
  schools?: string[];
  hasPets?: boolean;
  petType?: string | null;
  siblingCount?: number;
  city?: string;
  country?: string;
  bio?: string;
  vices?: string[];
  triggers?: string[];
  commonLies?: string[];
  relationshipStatus?: string;
  dailyRoutine?: string;
}

// ============================================
// FRIEND TYPES
// ============================================

export interface Friend {
  id: string;
  name: string;
  username: string;
  relationshipLevel: RelationshipLevel;
  relationshipDescription: string;
  status: 'online' | 'offline';
  friendshipStatus: 'accepted' | 'pending_sent' | 'pending_received';
  coins: number;
  avatarUrl: string;
  trustScore: number;
  totalBetsAgainst: number;
  winsAgainst: number;
  heatConfirmed: boolean;
  locationRelationship?: 'same_city' | 'different_city' | 'ldr' | 'unknown';
  // Heat level consent tracking (Phase 4)
  userProposedHeat?: RelationshipLevel;
  friendProposedHeat?: RelationshipLevel;
  heatChangedAt?: string; // ISO timestamp of last heat change
  friendshipId?: string; // Reference to the friendship record
}

// ============================================
// BET TYPES
// ============================================

export interface BetScenario {
  id: string;
  text: string;
  backgroundType: 'bedroom' | 'gym' | 'club' | 'street' | 'office' | 'default';
  opponentName: string;
  stake: number;
  category: string;
  proofType: 'photo' | 'video' | 'location' | 'time' | 'confirm';
  friendVote: boolean; // True = Yes, False = No (Hidden until user swipes)
  expiresAt: string;
  heatLevelRequired: RelationshipLevel;
}

export interface ActiveBet {
  id: string;
  betId: string;
  scenario: string;
  opponentId: string;
  opponentName: string;
  stake: number;
  totalPot: number;
  status: 'pending_proof' | 'proof_submitted' | 'reviewing' | 'disputed' | 'completed' | 'expired';
  isProver: boolean; // Does this user need to prove?
  proofUrl?: string;
  proofType?: string;
  proofDeadline?: string;
  proofViewDuration?: number;
  proofIsViewOnce?: boolean;
  winnerId?: string;
  createdAt: string;
}

// ============================================
// ECONOMY TYPES
// ============================================

export interface Transaction {
  id: string;
  amount: number;
  balanceAfter: number;
  type: TransactionType;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export type TransactionType =
  | 'allowance'
  | 'clash_stake_lock'
  | 'clash_win'
  | 'clash_loss'
  | 'steal_success'
  | 'steal_victim'
  | 'steal_penalty'
  | 'defend_bonus'
  | 'beg_received'
  | 'beg_given'
  | 'borrow'
  | 'repay'
  | 'interest'
  | 'repo_seized'
  | 'login_bonus'
  | 'streak_bonus'
  | 'penalty';

export interface Debt {
  id: string;
  principal: number;
  interestRate: number;
  accruedInterest: number;
  totalOwed: number;
  amountRepaid: number;
  status: 'active' | 'repaid' | 'defaulted' | 'repo_triggered';
  repoTriggered: boolean;
  createdAt: string;
  dueAt?: string;
}

// ============================================
// STEAL TYPES
// ============================================

export interface StealAttempt {
  id: string;
  thiefId: string;
  targetId: string;
  targetName: string;
  stealPercentage: number;
  potentialAmount: number;
  actualAmount?: number;
  targetWasOnline: boolean;
  defenseWindowEnd?: string;
  wasDefended: boolean;
  status: 'in_progress' | 'success' | 'defended' | 'failed';
  thiefPenalty: number;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface InGameNotification {
  id: string;
  type: 'robbery' | 'clash' | 'proof' | 'system' | 'badge' | 'debt' | 'beg';
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'normal';
  referenceType?: string;
  referenceId?: string;
  read: boolean;
  timestamp: number;
}

// ============================================
// BADGE TYPES
// ============================================

export interface Badge {
  id: string;
  type: string;
  name: string;
  description?: string;
  isShame: boolean;
  icon?: string;
  color?: string;
  earnedAt: string;
  expiresAt?: string;
}

export const BADGE_TYPES = {
  // Glory badges
  RISK_TAKER: { name: 'Risk Taker', isShame: false, icon: '🎲', color: 'gold' },
  WIN_STREAK_5: { name: 'Hot Paws', isShame: false, icon: '🔥', color: 'orange' },
  WIN_STREAK_10: { name: 'Untouchable', isShame: false, icon: '👑', color: 'purple' },
  HEIST_MASTER: { name: 'Heist Master', isShame: false, icon: '🦹', color: 'green' },
  DEFENDER: { name: 'The Wall', isShame: false, icon: '🛡️', color: 'blue' },
  GENEROUS: { name: 'Sugar Daddy', isShame: false, icon: '💰', color: 'pink' },

  // Shame badges
  SNITCH: { name: 'SNITCH', isShame: true, icon: '📸', color: 'red' },
  DEADBEAT: { name: 'DEADBEAT', isShame: true, icon: '💀', color: 'gray' },
  BEGGAR: { name: 'Professional Beggar', isShame: true, icon: '🥺', color: 'brown' },
  LOSER_STREAK: { name: 'Down Bad', isShame: true, icon: '📉', color: 'red' },
};

// ============================================
// BEG TYPES
// ============================================

export interface BegRequest {
  id: string;
  targetId: string;
  targetName: string;
  dareType?: string;
  dareText?: string;
  proofUrl?: string;
  rewardAmount: number;
  status: 'pending' | 'dare_assigned' | 'proof_submitted' | 'completed' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt?: string;
}

export const DARE_TEMPLATES = [
  { type: 'selfie', text: 'Take an embarrassing selfie with a weird face', reward: 15 },
  { type: 'voice_note', text: 'Record yourself singing the national anthem badly', reward: 20 },
  { type: 'pushups', text: 'Do 10 pushups on video (no cheating!)', reward: 25 },
  { type: 'outfit', text: 'Put on your most ridiculous outfit and take a pic', reward: 15 },
  { type: 'confession', text: 'Write your most embarrassing story (100+ words)', reward: 30 },
  { type: 'compliment', text: 'Give 3 genuine compliments to strangers (on video)', reward: 35 },
];

// ============================================
// CHAT TYPES
// ============================================

export interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
}

// ============================================
// PROOF TYPES
// ============================================

export interface ProofMetadata {
  capturedAt: string;
  deviceInfo?: string;
  locationLat?: number;
  locationLng?: number;
  locationVerified: boolean;
}

export interface ProofViewSettings {
  viewDurationHours: 1 | 6 | 12;
  isViewOnce: boolean;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
