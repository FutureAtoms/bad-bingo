# Bad Bingo - Comprehensive Implementation Plan

## Executive Summary

**Current State:** ~25% of GDD implemented
**Target State:** Full GDD implementation + Native iOS/Android apps

This document provides a complete audit of what's built vs what's missing, detailed database schema, mobile enablement strategy, and a structured backlog for full implementation.

---

## Table of Contents

1. [Gap Analysis: Done vs Not Done](#gap-analysis)
2. [Database Schema (Supabase)](#database-schema)
3. [Mobile Enablement Strategy](#mobile-enablement)
4. [Implementation Backlog](#implementation-backlog)
5. [GDD-to-Code Tracking Matrix](#tracking-matrix)
6. [Technical Architecture](#technical-architecture)
7. [Security & Compliance](#security-compliance)

---

## Gap Analysis: Done vs Not Done {#gap-analysis}

### Status Legend
- ✅ **Done** - Fully implemented and working
- 🟡 **Partial** - Basic implementation exists, needs enhancement
- ❌ **Missing** - Not implemented at all

---

### 1. CORE GAME OBJECTS

| Feature | Status | Current State | Gap Analysis |
|---------|--------|---------------|--------------|
| **Player Profile** | 🟡 | `types.ts:UserProfile` - has id, name, age, gender, coins, riskProfile, avatarUrl, socialDebt | **Missing:** bio, schools[], work, city, pets{type, name}, siblings, personality badges[], stats{wins, losses, steals}, last_login, login_streak, last_allowance timestamp |
| **Friend Object** | 🟡 | `types.ts:Friend` - has relationship level, description, status, coins | **Missing:** trust_score, location_relationship, shared_bet_history[], debt_indicator, blocked status |
| **Bet Card** | 🟡 | `types.ts:BetScenario` - has text, backgroundType, stake, category | **Missing:** expires_at, proof_type, creator_id, target_type, batch_number, locked_stakes |
| **Active Bet** | 🟡 | `types.ts:ActiveBet` - basic tracking | **Missing:** both_swipes, actual_proof_expiry, view_once_enforced, clash_resolution |

**Files to modify:** `types.ts`

---

### 2. MAIN GAME LOOP

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **App Flow** | 🟡 | Onboarding → Dashboard → Friend Select → Clash | **Missing:** Swipe Feed as main screen, not friend list |
| **Bet Generation** | 🟡 | On-demand via `generateDailyBets()` | **Missing:** 3x daily batches (morning/noon/night), server-side scheduling |
| **2-Hour Windows** | ❌ | None | Need countdown timers, expiry logic, push notifications |
| **Swipe Feed** | ❌ | Goes to friend-specific clash | Need Tinder-style card stack as main dashboard |

**Files affected:** `App.tsx`, new `SwipeFeed.tsx` component

---

### 3. BETTING MECHANICS

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **Swipe Gestures** | ✅ | `Clash.tsx` - touch drag with visual feedback | Working |
| **Same Swipe (Hairball)** | 🟡 | Shows "boring" overlay | Need: Random sarcastic pool from BINGO_VOICE.md |
| **Opposite Swipe (Clash)** | ✅ | "CLAWS OUT" animation + haptics | Working |
| **Stake Calculation** | ❌ | AI generates fixed values | Need: `wallet/50` formula, 2 coin minimum, All-In option |
| **Stake Locking** | ❌ | Stakes aren't locked from either party | Need: Deduct from both wallets on clash |
| **Proof Window** | ❌ | No enforced deadline | Need: 24h countdown, auto-forfeit |

**Files affected:** `Clash.tsx`, `services/economyService.ts` (new)

---

### 4. PROOF SYSTEM

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **Photo Capture** | ✅ | `CameraProof.tsx` - native camera + canvas | Working |
| **Video Capture** | ❌ | None | Need: 5-15 second recording with timer |
| **Location Proof** | ❌ | None | Need: GPS capture + location verification |
| **Time Proof** | ❌ | None | Need: Server timestamp + embedded metadata |
| **Timer Selection** | 🟡 | UI exists (1H/6H/12H buttons) | Not enforced - proof doesn't expire |
| **View Once** | 🟡 | Toggle exists | Not enforced - can view multiple times |
| **Proof Vault** | ❌ | None | Need: Secure viewer with expiry + destruction |
| **Anti-Screenshot** | ❌ | None | Need: Native detection + penalties |
| **Metadata Watermark** | ❌ | None | Need: Timestamp + username overlay on proofs |

**Files affected:** `CameraProof.tsx`, new `ProofVault.tsx`, native Capacitor plugins

---

### 5. RELATIONSHIP SYSTEM

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **3 Levels** | ✅ | `types.ts:RelationshipLevel` enum | CIVILIAN/ROAST/NUCLEAR working |
| **AI Level Assignment** | ✅ | `generateFriendshipProfile()` in geminiService | Working |
| **Visual Heat Slider** | ❌ | AI determines, no user control | Need: Slider UI in AddFriend |
| **Mutual Consent** | ❌ | One-sided decision | Need: Both users agree on level |
| **24h Cooldown** | ❌ | Can change anytime | Need: Timer before level changes |
| **Bet Restrictions** | ❌ | AI generates all types | Need: Enforce level-appropriate bets |
| **LDR Mode** | ❌ | None | Need: Distance detection, LDR-specific bets |
| **Trust Score** | ❌ | None | Need: Track reliability, proof honesty |

**Files affected:** `AddFriend.tsx`, `types.ts`, `services/relationshipService.ts` (new)

---

### 6. PLAYER-CREATED BETS

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **Create Bet Screen** | ❌ | None | Full implementation needed |
| **Audience Selection** | ❌ | None | Single/Multiple/All friends picker |
| **Template Categories** | ❌ | None | Routine/Social/Health/Truth/Prediction/Challenge |
| **Custom Text Input** | ❌ | None | Freeform with character limit |
| **Proof Type Selector** | ❌ | None | Photo/Video/Location/Time/Confirm dropdown |
| **Content Moderation** | ❌ | None | AI filtering before submission |

**New file:** `components/CreateBet.tsx`

---

### 7. CURRENCY ECONOMY

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **Coin Wallet** | ✅ | `user.coins` in state | Working |
| **Display** | ✅ | Dashboard shows balance | Working with lingo ("bingo stash") |
| **Win Transfer** | 🟡 | Basic in handleBetCreated | Need: Proper resolution + deduction from loser |
| **Daily Allowance** | ❌ | None | Need: 100 bingos every 48 hours + claim UI |
| **Transaction History** | ❌ | None | Need: Full log of all changes |
| **Login Streak** | ❌ | None | Need: 10-50 coin bonus system |
| **All-In Option** | ❌ | None | Need: Risk entire wallet on single bet |

**Files affected:** `Dashboard.tsx`, new `WalletScreen.tsx`, `services/economyService.ts`

---

### 8. RECOVERY MECHANICS

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **BEG Button** | 🟡 | Exists in Dashboard (disabled) | Need: Full flow implementation |
| **BEG Flow** | ❌ | None | Request → Dare assigned → Complete dare → Get bingos |
| **Dare Templates** | ❌ | None | Embarrassing selfie, voice note, pushups video, etc. |
| **BORROW Button** | 🟡 | Exists in Dashboard (disabled) | Need: Full flow implementation |
| **BORROW Flow** | ❌ | None | Request amount → Auto-approve → Track debt |
| **Interest System** | ❌ | None | 10% daily compound interest |
| **Debt Tracking** | ❌ | None | UI showing outstanding debts |
| **Repo Rights** | ❌ | None | When interest > principal: lock profile, seizure |
| **STEAL (Offline)** | 🟡 | `StealMinigame.tsx` - tap game | Works but fixed 12% steal amount |
| **STEAL (Online)** | ❌ | None | 16-second defense window, 2x penalty if caught |
| **Steal Range** | ❌ | Fixed at 12% | Need: 1-50% random range |

**Files affected:** `StealMinigame.tsx`, new `BegScreen.tsx`, `BorrowScreen.tsx`, `DebtTracker.tsx`

---

### 9. NOTIFICATION SYSTEM

| Feature | Status | Current State | Gap |
|---------|--------|---------------|-----|
| **In-App Toast** | ✅ | `App.tsx` notification system | Working with styling |
| **Push Notifications** | ❌ | None | Need: Firebase/APNs integration |
| **Robbery Alert** | ❌ | None | CRITICAL: Real-time 16s countdown push |
| **Clash Alert** | 🟡 | In-app only | Need: Push notification |
| **Proof Request** | ❌ | None | Need: Push with timer |
| **Bet Drop** | ❌ | None | Need: 3x daily push notifications |
| **Notification Center** | ❌ | None | Full chronological list screen |
| **Priority Colors** | 🟡 | Implemented for toasts | Need for notification center |

**Files affected:** `App.tsx`, new `NotificationCenter.tsx`, `services/pushService.ts`

---

### 10. SCREENS AUDIT

| Screen | Status | Current File | Gap |
|--------|--------|--------------|-----|
| **Splash Screen** | ❌ | None | Logo animation, cat mascot |
| **Onboarding** | ✅ | `Onboarding.tsx` | Working, good voice |
| **Swipe Feed** | ❌ | None | MAIN SCREEN - card stack |
| **Clash Screen** | ✅ | `Clash.tsx` | Working |
| **Proof Capture** | 🟡 | `CameraProof.tsx` | Need: Video, metadata |
| **Proof Vault** | ❌ | None | Secure viewing |
| **Friends List** | 🟡 | `Dashboard.tsx` | Mixed with other UI |
| **Add Friend** | ✅ | `AddFriend.tsx` | Working |
| **Create Bet** | ❌ | None | Player-created bets |
| **Wallet/Economy** | ❌ | None | Full economy hub |
| **Beg Screen** | ❌ | None | Dare system |
| **Borrow Screen** | ❌ | None | Loan system |
| **Steal Screen** | 🟡 | `StealMinigame.tsx` | Need: Online defense |
| **Profile** | 🟡 | `Profile.tsx` | Basic, needs stats/badges |
| **Notifications** | ❌ | None | Full center |
| **Settings** | ❌ | None | Privacy, 2FA, etc. |

---

### 11. ADDICTION MECHANICS

| Feature | Status | Gap |
|---------|--------|-----|
| **Variable Rewards** | ❌ | Random bet drops, luck-based steals |
| **Loss Aversion** | ❌ | Locked stakes, robbery threats |
| **Social Pressure** | ❌ | Public shame badges, beg history |
| **Scarcity/FOMO** | ❌ | 2h windows, finite allowance, proof expiry |
| **Streaks** | ❌ | Login streaks, win streak badges |
| **Anticipation** | 🟡 | Some animations | Need: Reveal animations, countdowns |

---

### 12. ULTRA-SOCIAL FEATURES

| Feature | Status | Gap |
|---------|--------|-----|
| **Location-Aware** | ❌ | Same city vs LDR mode, geo-triggered bets |
| **Relationship-Dynamic** | ❌ | Sibling/pet/work/partner-specific bets |
| **Surrounding-Aware** | ❌ | Background detection, time/season awareness |
| **Group Bets** | ❌ | Multi-friend selection, majority voting |

---

### 13. TECHNICAL SPECS

| Spec | Status | Gap |
|------|--------|-----|
| **Core Timers** | ❌ | Bet expiry, proof deadline, allowance cooldown |
| **Currency Math** | ❌ | wallet/50, interest compound, steal range |
| **Screenshot Detection** | ❌ | iOS/Android native APIs |
| **Native Camera** | ✅ | Using mediaDevices API |
| **Push Notifications** | ❌ | Firebase + APNs |
| **Location Services** | ❌ | GPS for proofs + friend proximity |

---

### 14. CONTENT MODERATION

| Feature | Status | Gap |
|---------|--------|-----|
| **AI Text Moderation** | ❌ | Filter custom bets for prohibited content |
| **NSFW Detection** | ❌ | Photo/video moderation API |
| **Report Mechanism** | ❌ | Flag content, human review queue |
| **Strike System** | ❌ | 3 strikes = ban |
| **Age Verification** | ❌ | 18+ gate on launch |

---

## Database Schema (Supabase) {#database-schema}

### Core Tables

```sql
-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  gender TEXT,
  bio TEXT,
  avatar_url TEXT,

  -- Location
  city TEXT,
  country TEXT,
  timezone TEXT,

  -- Personal Details (for bet generation)
  work TEXT,
  schools TEXT[], -- array of school names
  has_pets BOOLEAN DEFAULT false,
  pet_type TEXT,
  pet_name TEXT,
  sibling_count INTEGER DEFAULT 0,
  relationship_status TEXT, -- single, taken, complicated, etc.

  -- Behavioral Data
  daily_routine TEXT,
  vices TEXT[], -- caffeine, gaming, doomscrolling, etc.
  triggers TEXT[], -- things that make them unhinged
  common_lies TEXT[],

  -- AI-Generated Profile
  risk_profile TEXT,
  personality_badges TEXT[],

  -- Economy
  coins INTEGER DEFAULT 100,
  social_debt INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,

  -- Stats
  total_wins INTEGER DEFAULT 0,
  total_clashes INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  steals_successful INTEGER DEFAULT 0,
  steals_defended INTEGER DEFAULT 0,
  times_robbed INTEGER DEFAULT 0,

  -- Timers
  last_allowance_claimed TIMESTAMPTZ,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  login_streak INTEGER DEFAULT 0,

  -- Trust & Standing
  trust_score INTEGER DEFAULT 100, -- 0-100, decreases with bad behavior
  is_verified BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  strike_count INTEGER DEFAULT 0,

  -- Settings
  push_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  haptics_enabled BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  device_tokens TEXT[] -- for push notifications
);

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'rejected')),
  initiated_by UUID REFERENCES users(id),

  -- Heat Level (both must agree)
  heat_level INTEGER DEFAULT 1 CHECK (heat_level IN (1, 2, 3)),
  user_proposed_heat INTEGER,
  friend_proposed_heat INTEGER,
  heat_confirmed BOOLEAN DEFAULT false,
  heat_changed_at TIMESTAMPTZ,

  -- AI-Generated Description
  relationship_description TEXT,

  -- Trust & History
  trust_score INTEGER DEFAULT 100,
  total_bets INTEGER DEFAULT 0,
  wins_against_friend INTEGER DEFAULT 0,

  -- Location Relationship
  location_relationship TEXT CHECK (location_relationship IN ('same_city', 'different_city', 'ldr', 'unknown')),
  distance_km INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(user_id, friend_id)
);

-- ============================================
-- BETS TABLE (Generated bet cards)
-- ============================================
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  text TEXT NOT NULL,
  category TEXT, -- routine, social, health, truth, prediction, challenge
  background_type TEXT DEFAULT 'default',

  -- Stake
  base_stake INTEGER NOT NULL,
  proof_type TEXT DEFAULT 'photo' CHECK (proof_type IN ('photo', 'video', 'location', 'time', 'confirm')),

  -- Targeting
  creator_id UUID REFERENCES users(id), -- NULL if AI-generated
  target_type TEXT DEFAULT 'single' CHECK (target_type IN ('single', 'multiple', 'all')),
  target_users UUID[], -- specific user IDs if targeted
  heat_level_required INTEGER DEFAULT 1,

  -- Scheduling
  batch_number INTEGER, -- which daily batch (1, 2, or 3)
  batch_date DATE,

  -- Timing
  available_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Moderation
  is_approved BOOLEAN DEFAULT true,
  flagged_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BET_PARTICIPANTS (User swipes on bets)
-- ============================================
CREATE TABLE bet_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Swipe
  swipe TEXT CHECK (swipe IN ('yes', 'no')),
  swiped_at TIMESTAMPTZ,

  -- Stake (locked from wallet on swipe)
  stake_amount INTEGER NOT NULL DEFAULT 0,
  stake_locked BOOLEAN DEFAULT false,

  UNIQUE(bet_id, user_id)
);

-- ============================================
-- CLASHES (When two users disagree)
-- ============================================
CREATE TABLE clashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,

  -- Participants
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  user1_swipe TEXT NOT NULL,
  user2_swipe TEXT NOT NULL,

  -- Stakes
  user1_stake INTEGER NOT NULL,
  user2_stake INTEGER NOT NULL,
  total_pot INTEGER NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending_proof' CHECK (status IN (
    'pending_proof',
    'proof_submitted',
    'reviewing',
    'disputed',
    'completed',
    'expired',
    'forfeited'
  )),

  -- Who needs to prove
  prover_id UUID REFERENCES users(id), -- user who swiped YES

  -- Proof
  proof_url TEXT,
  proof_type TEXT,
  proof_submitted_at TIMESTAMPTZ,
  proof_deadline TIMESTAMPTZ,
  proof_view_duration INTEGER, -- hours: 1, 6, or 12
  proof_is_view_once BOOLEAN DEFAULT false,
  proof_viewed_at TIMESTAMPTZ,
  proof_expired BOOLEAN DEFAULT false,

  -- Resolution
  winner_id UUID REFERENCES users(id),
  loser_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Disputes
  disputed_by UUID REFERENCES users(id),
  dispute_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEBTS (Borrow mechanic)
-- ============================================
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  borrower_id UUID REFERENCES users(id),
  lender_id UUID REFERENCES users(id), -- NULL if borrowing from "the house"

  -- Amounts
  principal INTEGER NOT NULL,
  interest_rate DECIMAL DEFAULT 0.10, -- 10% daily
  accrued_interest INTEGER DEFAULT 0,
  total_owed INTEGER GENERATED ALWAYS AS (principal + accrued_interest) STORED,
  amount_repaid INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'defaulted', 'repo_triggered')),

  -- Repo
  repo_triggered BOOLEAN DEFAULT false,
  repo_triggered_at TIMESTAMPTZ,
  seized_amount INTEGER DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  last_interest_calc TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BEGS (Beg mechanic)
-- ============================================
CREATE TABLE begs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  beggar_id UUID REFERENCES users(id),
  target_id UUID REFERENCES users(id),

  -- Dare
  dare_type TEXT, -- selfie, voice_note, pushups, etc.
  dare_text TEXT,
  dare_assigned_at TIMESTAMPTZ,

  -- Proof
  proof_url TEXT,
  proof_submitted_at TIMESTAMPTZ,

  -- Reward
  reward_amount INTEGER DEFAULT 10,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'dare_assigned',
    'proof_submitted',
    'completed',
    'rejected',
    'expired'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================
-- STEALS
-- ============================================
CREATE TABLE steals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  thief_id UUID REFERENCES users(id),
  target_id UUID REFERENCES users(id),

  -- Attempt
  steal_percentage INTEGER, -- 1-50% random
  potential_amount INTEGER,
  actual_amount INTEGER,

  -- Target State
  target_was_online BOOLEAN,

  -- Defense
  defense_window_start TIMESTAMPTZ,
  defense_window_end TIMESTAMPTZ, -- 16 seconds after start
  was_defended BOOLEAN DEFAULT false,
  defended_at TIMESTAMPTZ,

  -- Result
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'success', 'defended', 'failed')),

  -- Penalties
  thief_penalty INTEGER DEFAULT 0, -- 2x amount if caught

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- BADGES
-- ============================================
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,

  -- Shame vs Glory
  is_shame_badge BOOLEAN DEFAULT false,

  -- Display
  icon TEXT,
  color TEXT,

  earned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- some badges are temporary
);

-- Badge types:
-- GLORY: RISK_TAKER, WIN_STREAK_5, WIN_STREAK_10, HEIST_MASTER, DEFENDER, GENEROUS
-- SHAME: SNITCH (screenshot), DEADBEAT (unpaid debt), BEGGAR (begged 5+ times), LOSER_STREAK

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  type TEXT NOT NULL, -- clash, robbery, proof, beg, debt, system, badge
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'medium', 'normal')),

  -- Related Entity
  reference_type TEXT, -- clash, steal, bet, debt, etc.
  reference_id UUID,

  -- State
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Push
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS (Full audit trail)
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Amount (positive = credit, negative = debit)
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  -- Type
  type TEXT NOT NULL CHECK (type IN (
    'allowance',
    'clash_stake_lock',
    'clash_win',
    'clash_loss',
    'steal_success',
    'steal_victim',
    'steal_penalty',
    'defend_bonus',
    'beg_received',
    'beg_given',
    'borrow',
    'repay',
    'interest',
    'repo_seized',
    'login_bonus',
    'streak_bonus',
    'penalty'
  )),

  -- Reference
  reference_type TEXT,
  reference_id UUID,

  -- Notes
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROOFS (Encrypted media storage metadata)
-- ============================================
CREATE TABLE proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  clash_id UUID REFERENCES clashes(id),
  uploader_id UUID REFERENCES users(id),

  -- Storage
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  encryption_key_id TEXT, -- reference to key management

  -- Media Type
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  duration_seconds INTEGER, -- for video

  -- Metadata (embedded in proof)
  captured_at TIMESTAMPTZ,
  device_info TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_verified BOOLEAN DEFAULT false,

  -- Viewing
  view_count INTEGER DEFAULT 0,
  max_views INTEGER DEFAULT 999, -- 1 for view_once
  view_duration_hours INTEGER DEFAULT 12,
  expires_at TIMESTAMPTZ,
  is_destroyed BOOLEAN DEFAULT false,

  -- Screenshot Detection
  screenshot_detected BOOLEAN DEFAULT false,
  screenshot_detected_at TIMESTAMPTZ,
  screenshot_penalty_applied BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORTS (Content moderation)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  reporter_id UUID REFERENCES users(id),

  -- What's being reported
  content_type TEXT NOT NULL, -- bet, proof, user, message
  content_id UUID,
  reported_user_id UUID REFERENCES users(id),

  -- Details
  reason TEXT NOT NULL, -- harassment, nsfw, cheating, etc.
  description TEXT,

  -- Review
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID, -- admin user
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,

  -- Action Taken
  action_taken TEXT, -- warning, strike, ban, none

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Friendships
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- Bets
CREATE INDEX idx_bets_expires_at ON bets(expires_at);
CREATE INDEX idx_bets_batch_date ON bets(batch_date);
CREATE INDEX idx_bets_creator_id ON bets(creator_id);

-- Bet Participants
CREATE INDEX idx_bet_participants_bet_id ON bet_participants(bet_id);
CREATE INDEX idx_bet_participants_user_id ON bet_participants(user_id);

-- Clashes
CREATE INDEX idx_clashes_user1_id ON clashes(user1_id);
CREATE INDEX idx_clashes_user2_id ON clashes(user2_id);
CREATE INDEX idx_clashes_status ON clashes(status);
CREATE INDEX idx_clashes_proof_deadline ON clashes(proof_deadline);

-- Debts
CREATE INDEX idx_debts_borrower_id ON debts(borrower_id);
CREATE INDEX idx_debts_status ON debts(status);

-- Steals
CREATE INDEX idx_steals_target_id ON steals(target_id);
CREATE INDEX idx_steals_defense_window ON steals(defense_window_end);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Transactions
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE begs ENABLE ROW LEVEL SECURITY;
ALTER TABLE steals ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own profile
CREATE POLICY users_select ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);

-- Friendships: can see own friendships
CREATE POLICY friendships_select ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY friendships_insert ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY friendships_update ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Bets: can see bets targeted at them or created by them
CREATE POLICY bets_select ON bets FOR SELECT
  USING (
    creator_id = auth.uid()
    OR target_type = 'all'
    OR auth.uid() = ANY(target_users)
  );

-- Notifications: only own
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Transactions: only own
CREATE POLICY transactions_select ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Calculate interest on debts (run daily via cron)
CREATE OR REPLACE FUNCTION calculate_debt_interest()
RETURNS void AS $$
BEGIN
  UPDATE debts
  SET
    accrued_interest = accrued_interest + FLOOR(principal * interest_rate),
    last_interest_calc = NOW()
  WHERE
    status = 'active'
    AND last_interest_calc < NOW() - INTERVAL '1 day';

  -- Trigger repo when interest > principal
  UPDATE debts
  SET
    repo_triggered = true,
    repo_triggered_at = NOW()
  WHERE
    status = 'active'
    AND accrued_interest > principal
    AND NOT repo_triggered;
END;
$$ LANGUAGE plpgsql;

-- Auto-expire clashes
CREATE OR REPLACE FUNCTION expire_clashes()
RETURNS void AS $$
BEGIN
  UPDATE clashes
  SET
    status = 'expired',
    winner_id = CASE WHEN prover_id = user1_id THEN user2_id ELSE user1_id END,
    loser_id = prover_id,
    resolved_at = NOW()
  WHERE
    status = 'pending_proof'
    AND proof_deadline < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## Mobile Enablement Strategy {#mobile-enablement}

### Overview

**Approach:** Capacitor (wrap existing React app)
**Platforms:** iOS 14+ and Android 10+
**Native Features Required:** Camera, Push Notifications, Geolocation, Haptics, Secure Storage, Screenshot Detection

### Phase 1: Capacitor Setup

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli

# Initialize Capacitor
npx cap init "Bad Bingo" "com.badbingo.app" --web-dir dist

# Add platforms
npx cap add ios
npx cap add android
```

### Phase 2: Required Plugins

```bash
# Core native plugins
npm install @capacitor/camera
npm install @capacitor/push-notifications
npm install @capacitor/geolocation
npm install @capacitor/haptics
npm install @capacitor/preferences  # Secure storage
npm install @capacitor/local-notifications
npm install @capacitor/app  # App lifecycle
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/keyboard
npm install @capacitor/network

# Community plugins
npm install @capacitor-community/privacy-screen  # Anti-screenshot
npm install @capacitor-community/media  # Video recording
npm install capacitor-secure-storage-plugin  # Encrypted storage
```

### Phase 3: Native Feature Implementation

#### 3.1 Camera & Video
```typescript
// services/nativeCameraService.ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Media } from '@capacitor-community/media';

export const capturePhoto = async () => {
  const photo = await Camera.getPhoto({
    quality: 90,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    allowEditing: false,
    saveToGallery: false
  });
  return photo;
};

export const recordVideo = async (durationMs: number) => {
  // Implement video recording with timer
  // Max 15 seconds for proofs
};
```

#### 3.2 Push Notifications
```typescript
// services/pushService.ts
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const initPushNotifications = async () => {
  if (Capacitor.getPlatform() === 'web') return;

  // Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  // Register for push
  await PushNotifications.register();

  // Handle registration
  PushNotifications.addListener('registration', (token) => {
    // Send token to backend
    saveDeviceToken(token.value);
  });

  // Handle incoming push
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Handle based on type
    if (notification.data.type === 'robbery') {
      // Show critical alert, navigate to defense
    }
  });

  // Handle tap on notification
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // Navigate to appropriate screen
  });
};
```

#### 3.3 Anti-Screenshot Protection
```typescript
// services/screenshotService.ts
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

export const enableScreenProtection = async () => {
  await PrivacyScreen.enable();
};

export const disableScreenProtection = async () => {
  await PrivacyScreen.disable();
};

// iOS: Uses UIScreen.capturedDidChangeNotification
// Android: Uses FLAG_SECURE + MediaProjection detection

// On screenshot detected:
export const handleScreenshotDetected = async (userId: string, proofId?: string) => {
  // 1. Log the violation
  await logScreenshotViolation(userId, proofId);

  // 2. Determine penalty
  const violations = await getViolationCount(userId);
  const penalty = violations === 1 ? 50 : violations === 2 ? 100 : 200;

  // 3. Deduct coins
  await deductCoins(userId, penalty);

  // 4. Award SNITCH badge after 3 violations
  if (violations >= 3) {
    await awardBadge(userId, 'SNITCH', true);
  }

  // 5. Notify user
  showNotification({
    type: 'system',
    priority: 'high',
    message: `Screenshot detected. ${penalty} bingos confiscated. Don't be a snitch.`
  });
};
```

#### 3.4 Geolocation
```typescript
// services/locationService.ts
import { Geolocation } from '@capacitor/geolocation';

export const getCurrentLocation = async () => {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy
  };
};

export const verifyLocation = async (
  targetLat: number,
  targetLng: number,
  radiusMeters: number = 100
) => {
  const current = await getCurrentLocation();
  const distance = calculateDistance(
    current.lat, current.lng,
    targetLat, targetLng
  );
  return distance <= radiusMeters;
};
```

#### 3.5 Haptics
```typescript
// services/hapticsService.ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const hapticLight = () => Haptics.impact({ style: ImpactStyle.Light });
export const hapticMedium = () => Haptics.impact({ style: ImpactStyle.Medium });
export const hapticHeavy = () => Haptics.impact({ style: ImpactStyle.Heavy });

export const hapticSuccess = () => Haptics.notification({ type: NotificationType.Success });
export const hapticWarning = () => Haptics.notification({ type: NotificationType.Warning });
export const hapticError = () => Haptics.notification({ type: NotificationType.Error });

// Usage in components:
// Swipe feedback: hapticLight()
// Clash triggered: hapticHeavy() + hapticHeavy() (double)
// Steal success: hapticSuccess()
// Steal caught: hapticError()
```

#### 3.6 Secure Storage
```typescript
// services/secureStorageService.ts
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const secureStore = {
  set: async (key: string, value: string) => {
    await SecureStoragePlugin.set({ key, value });
  },
  get: async (key: string) => {
    const result = await SecureStoragePlugin.get({ key });
    return result.value;
  },
  remove: async (key: string) => {
    await SecureStoragePlugin.remove({ key });
  }
};

// Store sensitive data:
// - Auth tokens
// - Encryption keys for proofs
// - Push notification tokens
```

### Phase 4: iOS Specific

#### Info.plist Permissions
```xml
<!-- ios/App/App/Info.plist -->
<key>NSCameraUsageDescription</key>
<string>Bad Bingo needs camera access to capture proof of your bets</string>

<key>NSMicrophoneUsageDescription</key>
<string>Bad Bingo needs microphone access for video proofs</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Bad Bingo uses location to verify location-based bets</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Bad Bingo needs photo library access for proof capture</string>

<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

#### App Store Requirements
- Age Rating: 17+ (gambling themes)
- IDFA disclosure for ads (if applicable)
- Privacy nutrition labels

### Phase 5: Android Specific

#### AndroidManifest.xml
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- For secure window (anti-screenshot) -->
<activity
  android:name=".MainActivity"
  android:windowSoftInputMode="adjustResize"
  android:configChanges="orientation|keyboardHidden|keyboard|screenSize"
  android:launchMode="singleTask">
```

#### Play Store Requirements
- Content rating: Teen+ or Mature
- Data safety form completion
- Target API level compliance

### Phase 6: Build & Deploy Commands

```bash
# Development
npm run build
npx cap sync

# iOS
npx cap open ios
# Then build in Xcode

# Android
npx cap open android
# Then build in Android Studio

# Or use Capacitor's live reload
npx cap run ios --livereload --external
npx cap run android --livereload --external
```

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.badbingo.app',
  appName: 'Bad Bingo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0a0a'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    PrivacyScreen: {
      enable: true
    }
  }
};

export default config;
```

---

## Implementation Backlog {#implementation-backlog}

### Epic 0: Foundation (Required First)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Set up Supabase project | P0 | 2h | None |
| Create database schema | P0 | 4h | Supabase setup |
| Implement auth service (email/phone) | P0 | 8h | Schema |
| Create Supabase client wrapper | P0 | 2h | Auth |
| Migrate types.ts to match DB schema | P0 | 4h | Schema |
| Add age verification gate (18+) | P0 | 4h | Auth |
| Set up Capacitor project | P0 | 4h | None |
| Configure iOS project | P0 | 4h | Capacitor |
| Configure Android project | P0 | 4h | Capacitor |

### Epic 1: Core Game Loop (MVP)

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create SwipeFeed component | P0 | 8h | Schema |
| Make SwipeFeed the main screen | P0 | 2h | SwipeFeed |
| Implement bet scheduling (3x daily) | P0 | 8h | Backend |
| Add bet expiry timers | P0 | 4h | Scheduling |
| Implement stake calculation (wallet/50) | P0 | 4h | None |
| Lock stakes from both parties on clash | P0 | 4h | Backend |
| Implement clash resolution logic | P0 | 8h | Backend |
| Add proof deadline countdown | P1 | 4h | Clashes |
| Auto-forfeit expired clashes | P1 | 4h | Deadlines |

### Epic 2: Proof System

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add video capture (5-15s) | P0 | 8h | Capacitor |
| Implement proof storage (Supabase Storage) | P0 | 8h | Backend |
| Add metadata watermark to proofs | P1 | 4h | Storage |
| Implement proof expiry enforcement | P0 | 4h | Storage |
| Build ProofVault viewer component | P0 | 8h | Storage |
| Implement view-once destruction | P1 | 4h | ProofVault |
| Add location proof capture | P1 | 8h | Geolocation |
| Implement anti-screenshot (iOS) | P1 | 8h | Native |
| Implement anti-screenshot (Android) | P1 | 8h | Native |
| Add screenshot penalty system | P1 | 4h | Detection |

### Epic 3: Push Notifications

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Set up Firebase project | P0 | 2h | None |
| Configure APNs for iOS | P0 | 4h | Firebase |
| Configure FCM for Android | P0 | 4h | Firebase |
| Implement device token registration | P0 | 4h | Firebase |
| Create notification service | P0 | 8h | Token reg |
| Bet drop notifications | P0 | 4h | Service |
| Clash triggered notifications | P0 | 4h | Service |
| Proof deadline reminders | P1 | 4h | Service |
| CRITICAL: Robbery alert (16s) | P0 | 8h | Service |
| Build Notification Center screen | P1 | 8h | Service |

### Epic 4: Economy System

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Implement daily allowance (48h) | P0 | 4h | Backend |
| Create Wallet screen | P0 | 8h | UI |
| Transaction history UI | P1 | 8h | Wallet |
| Login streak bonus system | P1 | 4h | Backend |
| All-In bet option | P2 | 4h | Stakes |
| Transaction audit logging | P1 | 4h | Backend |

### Epic 5: Recovery Mechanics

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| BEG flow: request screen | P1 | 4h | UI |
| BEG: dare assignment system | P1 | 8h | Backend |
| BEG: dare templates library | P1 | 4h | System |
| BEG: dare proof submission | P1 | 4h | Proofs |
| BORROW: loan request flow | P1 | 8h | Backend |
| BORROW: interest calculation | P1 | 4h | Backend |
| Debt tracking UI | P1 | 8h | BORROW |
| Repo rights implementation | P2 | 8h | Debt |
| STEAL: online detection | P0 | 4h | Backend |
| STEAL: 16-second defense window | P0 | 8h | Online |
| STEAL: defense minigame | P0 | 8h | Window |
| STEAL: 2x penalty if caught | P0 | 4h | Defense |
| STEAL: 1-50% random range | P1 | 2h | Backend |

### Epic 6: Relationship System

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Visual heat slider in AddFriend | P1 | 4h | UI |
| Mutual consent for heat level | P1 | 8h | Backend |
| 24h cooldown on level changes | P1 | 4h | Backend |
| Enforce bet type restrictions | P1 | 8h | Generation |
| Trust score tracking | P2 | 8h | Backend |
| LDR mode detection | P2 | 8h | Location |
| LDR-specific bet generation | P2 | 4h | LDR mode |

### Epic 7: Player-Created Bets

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create Bet screen UI | P1 | 8h | UI |
| Template categories selector | P1 | 4h | Screen |
| Custom text input with char limit | P1 | 4h | Screen |
| Proof type selector | P1 | 4h | Screen |
| Audience selection (single/multi/all) | P1 | 8h | Screen |
| AI content moderation | P1 | 8h | Submission |
| Bet submission flow | P1 | 4h | Moderation |

### Epic 8: Social Features

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Group bet creation | P2 | 16h | Backend |
| Group voting/majority wins | P2 | 8h | Groups |
| Shared bet history view | P2 | 8h | UI |
| Friend debt indicators | P2 | 4h | UI |

### Epic 9: Badges & Gamification

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Badge system backend | P1 | 8h | Backend |
| Glory badges (achievements) | P1 | 8h | System |
| Shame badges (SNITCH, DEADBEAT) | P1 | 4h | System |
| Badge display on profile | P1 | 4h | Profile |
| Win streak tracking | P1 | 4h | Backend |
| Badge notification on earn | P2 | 4h | Notifs |

### Epic 10: Profile Enhancement

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Stats dashboard (wins/losses/steals) | P1 | 8h | Backend |
| Editable profile fields | P2 | 4h | Profile |
| Badge display grid | P1 | 4h | Badges |
| Bet history on profile | P2 | 8h | Profile |

### Epic 11: Settings & Privacy

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Settings screen | P1 | 8h | UI |
| Push notification toggles | P1 | 4h | Settings |
| Sound/haptics toggles | P2 | 2h | Settings |
| Block list management | P2 | 8h | Backend |
| Account deletion flow | P1 | 8h | Backend |
| Privacy policy screen | P1 | 2h | UI |
| Terms of service screen | P1 | 2h | UI |

### Epic 12: Content Moderation

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| AI text filtering for custom bets | P1 | 8h | AI |
| NSFW image detection API integration | P2 | 16h | Backend |
| Report mechanism UI | P1 | 8h | UI |
| Admin review queue | P2 | 16h | Backend |
| Strike system implementation | P1 | 8h | Backend |
| Ban flow | P1 | 4h | Strikes |

### Epic 13: Polish & UX

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Splash screen animation | P2 | 8h | Native |
| Loading state improvements | P2 | 4h | UI |
| Error handling & recovery | P1 | 8h | All |
| Offline mode handling | P2 | 8h | Network |
| Sound effects library | P2 | 8h | Assets |
| Additional haptic patterns | P2 | 4h | Haptics |
| Sarcastic message randomization | P2 | 4h | Voice |
| Time-based message variants | P3 | 4h | Voice |

### Epic 14: App Store Deployment

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| App icon design (all sizes) | P1 | 8h | Design |
| Screenshot generation | P1 | 8h | Build |
| App Store description | P1 | 4h | Copy |
| Privacy policy hosting | P1 | 4h | Legal |
| iOS TestFlight submission | P1 | 4h | Build |
| Android beta track submission | P1 | 4h | Build |
| iOS App Store submission | P1 | 8h | TestFlight |
| Google Play Store submission | P1 | 8h | Beta |
| Address review feedback | P1 | Variable | Submission |

---

## GDD-to-Code Tracking Matrix {#tracking-matrix}

| GDD Section | Feature | Status | Primary Files | Backend Tables | Native Plugin |
|-------------|---------|--------|---------------|----------------|---------------|
| 1. Core Objects | Player Profile | 🟡 | `types.ts`, `Profile.tsx` | `users` | - |
| 1. Core Objects | Friend Object | 🟡 | `types.ts`, `Dashboard.tsx` | `friendships` | - |
| 1. Core Objects | Bet Card | 🟡 | `types.ts`, `Clash.tsx` | `bets`, `bet_participants` | - |
| 2. Game Loop | Swipe Feed Main | ❌ | NEW: `SwipeFeed.tsx` | `bets`, `bet_participants` | - |
| 2. Game Loop | Bet Scheduling | ❌ | `services/betService.ts` | `bets` | Push |
| 2. Game Loop | 2-Hour Windows | ❌ | `services/timerService.ts` | `bets.expires_at` | Local Notifs |
| 3. Betting | Swipe Gestures | ✅ | `Clash.tsx` | - | Haptics |
| 3. Betting | Stake Calculation | ❌ | `services/economyService.ts` | `transactions` | - |
| 3. Betting | Stake Locking | ❌ | `services/clashService.ts` | `clashes` | - |
| 4. Proof | Photo Capture | ✅ | `CameraProof.tsx` | `proofs` | Camera |
| 4. Proof | Video Capture | ❌ | `CameraProof.tsx` | `proofs` | Camera, Media |
| 4. Proof | Location Proof | ❌ | `services/locationService.ts` | `proofs` | Geolocation |
| 4. Proof | Time Proof | ❌ | `services/proofService.ts` | `proofs` | - |
| 4. Proof | Proof Vault | ❌ | NEW: `ProofVault.tsx` | `proofs` | PrivacyScreen |
| 4. Proof | View Once | 🟡 | `CameraProof.tsx` → `ProofVault.tsx` | `proofs.max_views` | - |
| 4. Proof | Anti-Screenshot | ❌ | `services/screenshotService.ts` | `proofs` | PrivacyScreen |
| 5. Relationships | Heat Levels | ✅ | `types.ts`, `AddFriend.tsx` | `friendships.heat_level` | - |
| 5. Relationships | Heat Slider | ❌ | `AddFriend.tsx` | `friendships` | - |
| 5. Relationships | Mutual Consent | ❌ | `services/friendshipService.ts` | `friendships` | - |
| 5. Relationships | Trust Score | ❌ | `services/trustService.ts` | `friendships.trust_score` | - |
| 5. Relationships | LDR Mode | ❌ | `services/locationService.ts` | `friendships.location_relationship` | Geolocation |
| 6. Custom Bets | Create Bet | ❌ | NEW: `CreateBet.tsx` | `bets` | - |
| 6. Custom Bets | Moderation | ❌ | `services/moderationService.ts` | `reports` | - |
| 7. Economy | Wallet | ✅ | `Dashboard.tsx` | `users.coins` | - |
| 7. Economy | Allowance | ❌ | NEW: `WalletScreen.tsx` | `users.last_allowance_claimed` | - |
| 7. Economy | Transaction History | ❌ | NEW: `WalletScreen.tsx` | `transactions` | - |
| 7. Economy | Login Streak | ❌ | `services/authService.ts` | `users.login_streak` | - |
| 8. Recovery | BEG Flow | ❌ | NEW: `BegScreen.tsx` | `begs` | Camera |
| 8. Recovery | BORROW Flow | ❌ | NEW: `BorrowScreen.tsx` | `debts` | - |
| 8. Recovery | Interest System | ❌ | `services/debtService.ts` | `debts` | - |
| 8. Recovery | Repo Rights | ❌ | `services/repoService.ts` | `debts`, `badges` | - |
| 8. Recovery | STEAL Offline | 🟡 | `StealMinigame.tsx` | `steals` | Haptics |
| 8. Recovery | STEAL Online | ❌ | `StealMinigame.tsx`, `DefenseMinigame.tsx` | `steals` | Push |
| 9. Notifications | In-App Toast | ✅ | `App.tsx` | - | - |
| 9. Notifications | Push | ❌ | `services/pushService.ts` | `notifications` | Push |
| 9. Notifications | Robbery Alert | ❌ | `services/pushService.ts` | `steals` | Push |
| 9. Notifications | Notif Center | ❌ | NEW: `NotificationCenter.tsx` | `notifications` | - |
| 10. Screens | Splash | ❌ | `SplashScreen.tsx` | - | SplashScreen |
| 10. Screens | Onboarding | ✅ | `Onboarding.tsx` | - | - |
| 11. Addiction | Variable Rewards | ❌ | `services/betService.ts` | - | - |
| 11. Addiction | Loss Aversion | ❌ | Various | - | - |
| 11. Addiction | Streaks | ❌ | `services/streakService.ts` | `users`, `badges` | - |
| 12. Social | Location-Aware | ❌ | `services/locationService.ts` | `friendships` | Geolocation |
| 12. Social | Group Bets | ❌ | NEW: `GroupBet.tsx` | `bets`, `bet_participants` | - |
| 13. Tech | Screenshot Detection | ❌ | Native | - | PrivacyScreen |
| 13. Tech | Push | ❌ | `services/pushService.ts` | - | Push |
| 14. Moderation | AI Filter | ❌ | `services/moderationService.ts` | `reports` | - |
| 14. Moderation | Age Gate | ❌ | `AgeVerification.tsx` | `users.is_verified` | - |

---

## Technical Architecture {#technical-architecture}

### Project Structure (Target)

```
bad-bingo/
├── src/
│   ├── components/
│   │   ├── screens/              # Full-page views
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── AgeVerification.tsx
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── SwipeFeed.tsx
│   │   │   ├── ClashScreen.tsx
│   │   │   ├── ProofCapture.tsx
│   │   │   ├── ProofVault.tsx
│   │   │   ├── FriendsScreen.tsx
│   │   │   ├── AddFriendScreen.tsx
│   │   │   ├── CreateBetScreen.tsx
│   │   │   ├── WalletScreen.tsx
│   │   │   ├── BegScreen.tsx
│   │   │   ├── BorrowScreen.tsx
│   │   │   ├── StealScreen.tsx
│   │   │   ├── DefenseScreen.tsx
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── NotificationCenter.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── ui/                   # Reusable components
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Timer.tsx
│   │   │   ├── CoinDisplay.tsx
│   │   │   ├── HeatSlider.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── Badge.tsx
│   │   └── game/                 # Game-specific
│   │       ├── SwipeCard.tsx
│   │       ├── StakeCalculator.tsx
│   │       ├── ProofViewer.tsx
│   │       ├── TapMinigame.tsx
│   │       └── DefenseMinigame.tsx
│   ├── services/
│   │   ├── supabase.ts           # Supabase client
│   │   ├── auth.ts               # Authentication
│   │   ├── users.ts              # User operations
│   │   ├── friends.ts            # Friendship operations
│   │   ├── bets.ts               # Bet generation & management
│   │   ├── clashes.ts            # Clash resolution
│   │   ├── proofs.ts             # Proof upload/retrieval
│   │   ├── economy.ts            # Currency operations
│   │   ├── steals.ts             # Steal mechanics
│   │   ├── debts.ts              # Borrow/debt tracking
│   │   ├── begs.ts               # Beg mechanics
│   │   ├── notifications.ts      # In-app notifications
│   │   ├── push.ts               # Push notifications
│   │   ├── moderation.ts         # Content moderation
│   │   ├── gemini.ts             # AI service
│   │   └── native/               # Native-specific services
│   │       ├── camera.ts
│   │       ├── location.ts
│   │       ├── haptics.ts
│   │       ├── screenshot.ts
│   │       └── secureStorage.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useUser.ts
│   │   ├── useFriends.ts
│   │   ├── useBets.ts
│   │   ├── useWallet.ts
│   │   ├── useNotifications.ts
│   │   └── useNative.ts
│   ├── stores/                   # Global state (zustand or context)
│   │   ├── authStore.ts
│   │   ├── gameStore.ts
│   │   ├── notificationStore.ts
│   │   └── uiStore.ts
│   ├── types/
│   │   ├── index.ts              # All TypeScript interfaces
│   │   └── database.ts           # Supabase-generated types
│   ├── utils/
│   │   ├── stake.ts              # Stake calculation
│   │   ├── timer.ts              # Timer utilities
│   │   ├── format.ts             # Display formatters
│   │   └── voice.ts              # Bad Bingo lingo
│   ├── constants/
│   │   ├── dareTemplates.ts
│   │   ├── badges.ts
│   │   └── config.ts
│   ├── App.tsx
│   └── main.tsx
├── ios/                          # Capacitor iOS
├── android/                      # Capacitor Android
├── public/
│   └── assets/
├── capacitor.config.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Components                      │
├─────────────────────────────────────────────────────────────┤
│                      Custom Hooks                            │
│   useAuth, useUser, useBets, useWallet, useNotifications    │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                            │
│   auth.ts, bets.ts, clashes.ts, economy.ts, push.ts, etc.   │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Client                           │
│           Database | Storage | Realtime | Auth              │
├─────────────────────────────────────────────────────────────┤
│                   Native Services                            │
│   @capacitor/camera, push, geolocation, haptics             │
└─────────────────────────────────────────────────────────────┘
```

---

## Security & Compliance {#security-compliance}

### Age Verification
- Gate ALL access behind 18+ verification
- Use date picker with age calculation
- Store verification status in database
- Consider ID verification API for high-risk markets

### Data Privacy
- GDPR compliance: Right to deletion, data export
- Encrypt proofs at rest and in transit
- Automatic proof deletion after expiry
- No third-party data sharing without consent

### Financial Safety
- This is a social game with virtual currency only
- No real money transactions
- Clear disclaimer: "No gambling of real money"
- Terms of Service: Virtual currency has no cash value

### Content Safety
- AI moderation on all user-generated content
- NSFW detection on proofs
- Report mechanism with human review
- Swift ban enforcement for violations

### Platform Compliance
- iOS: No simulated gambling UI that resembles real casinos
- Android: Appropriate content rating (Teen/Mature)
- Both: Clear age gate and content warnings

---

## Summary

**What's Built:**
- Basic onboarding flow with AI personality
- Friend management with relationship levels
- Swipe-based clash mechanic
- Simple proof capture (photo only)
- Basic steal minigame
- In-app toast notifications

**Critical Missing Pieces (MVP Blockers):**
1. ❌ Real backend (currently localStorage only)
2. ❌ Swipe Feed as main screen
3. ❌ Stake locking & clash resolution
4. ❌ Push notifications (especially robbery alerts)
5. ❌ Proof expiry enforcement

**Estimated Total Effort:**
- Phase 0-1 (Foundation + Core MVP): ~160 hours
- Phase 2-3 (Economy + Notifications): ~120 hours
- Phase 4-5 (Recovery + Relationships): ~160 hours
- Phase 6-7 (Social + Polish): ~120 hours
- Phase 8 (Mobile Deployment): ~80 hours

**Total: ~640 hours (~16 weeks at 40h/week for 1 developer)**

**Recommended Team:**
- 1 Full-stack developer (React + Supabase)
- 1 Mobile developer (Capacitor + native)
- 1 Designer (UI/UX + assets)

**First Sprint Priorities:**
1. Set up Supabase with schema
2. Implement authentication
3. Create SwipeFeed component
4. Set up Capacitor project
5. Configure push notifications
