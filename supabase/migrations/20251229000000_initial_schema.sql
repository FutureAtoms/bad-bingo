-- Bad Bingo Initial Database Schema
-- =====================================

-- Note: gen_random_uuid() is built into Postgres 13+ and available in Supabase

-- =====================================
-- USERS TABLE
-- =====================================
CREATE TABLE bb_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  gender TEXT,
  bio TEXT,
  avatar_url TEXT,
  city TEXT,
  country TEXT,
  timezone TEXT,
  work TEXT,
  schools TEXT[],
  has_pets BOOLEAN DEFAULT false,
  pet_type TEXT,
  pet_name TEXT,
  sibling_count INTEGER DEFAULT 0,
  relationship_status TEXT,
  daily_routine TEXT,
  vices TEXT[],
  triggers TEXT[],
  common_lies TEXT[],
  risk_profile TEXT,
  personality_badges TEXT[],
  coins INTEGER DEFAULT 1000 NOT NULL,
  social_debt INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_clashes INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  steals_successful INTEGER DEFAULT 0,
  steals_defended INTEGER DEFAULT 0,
  times_robbed INTEGER DEFAULT 0,
  last_allowance_claimed TIMESTAMPTZ,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  login_streak INTEGER DEFAULT 1,
  trust_score INTEGER DEFAULT 100,
  is_verified BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  strike_count INTEGER DEFAULT 0,
  push_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  haptics_enabled BOOLEAN DEFAULT true,
  device_tokens TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- FRIENDSHIPS TABLE
-- =====================================
CREATE TABLE bb_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked', 'rejected')),
  initiated_by UUID REFERENCES bb_users(id) NOT NULL,
  heat_level INTEGER DEFAULT 1 CHECK (heat_level BETWEEN 1 AND 3),
  user_proposed_heat INTEGER,
  friend_proposed_heat INTEGER,
  heat_confirmed BOOLEAN DEFAULT false,
  heat_changed_at TIMESTAMPTZ,
  relationship_description TEXT,
  trust_score INTEGER DEFAULT 100,
  total_bets INTEGER DEFAULT 0,
  wins_against_friend INTEGER DEFAULT 0,
  location_relationship TEXT CHECK (location_relationship IN ('same_city', 'different_city', 'ldr', 'unknown')),
  distance_km NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, friend_id)
);

-- =====================================
-- BETS TABLE
-- =====================================
CREATE TABLE bb_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT,
  background_type TEXT DEFAULT 'gradient',
  base_stake INTEGER NOT NULL,
  proof_type TEXT DEFAULT 'photo' CHECK (proof_type IN ('photo', 'video', 'location', 'time', 'confirm')),
  creator_id UUID REFERENCES bb_users(id),
  target_type TEXT DEFAULT 'all' CHECK (target_type IN ('single', 'multiple', 'all')),
  target_users UUID[],
  heat_level_required INTEGER DEFAULT 1,
  batch_number INTEGER,
  batch_date DATE,
  available_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- BET PARTICIPANTS TABLE
-- =====================================
CREATE TABLE bb_bet_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bb_bets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  swipe TEXT CHECK (swipe IN ('yes', 'no')),
  swiped_at TIMESTAMPTZ,
  stake_amount INTEGER DEFAULT 0,
  stake_locked BOOLEAN DEFAULT false,
  UNIQUE(bet_id, user_id)
);

-- =====================================
-- CLASHES TABLE
-- =====================================
CREATE TABLE bb_clashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bb_bets(id) NOT NULL,
  user1_id UUID REFERENCES bb_users(id) NOT NULL,
  user2_id UUID REFERENCES bb_users(id) NOT NULL,
  user1_swipe TEXT NOT NULL,
  user2_swipe TEXT NOT NULL,
  user1_stake INTEGER NOT NULL,
  user2_stake INTEGER NOT NULL,
  total_pot INTEGER NOT NULL,
  status TEXT DEFAULT 'pending_proof' CHECK (status IN ('pending_proof', 'proof_submitted', 'reviewing', 'disputed', 'completed', 'expired', 'forfeited')),
  prover_id UUID REFERENCES bb_users(id),
  proof_url TEXT,
  proof_type TEXT,
  proof_submitted_at TIMESTAMPTZ,
  proof_deadline TIMESTAMPTZ,
  proof_view_duration INTEGER,
  proof_is_view_once BOOLEAN DEFAULT true,
  proof_viewed_at TIMESTAMPTZ,
  proof_expired BOOLEAN DEFAULT false,
  winner_id UUID REFERENCES bb_users(id),
  loser_id UUID REFERENCES bb_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  disputed_by UUID REFERENCES bb_users(id),
  dispute_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- TRANSACTIONS TABLE
-- =====================================
CREATE TABLE bb_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('allowance', 'clash_stake_lock', 'clash_win', 'clash_loss', 'steal_success', 'steal_victim', 'steal_penalty', 'defend_bonus', 'beg_received', 'beg_given', 'borrow', 'repay', 'interest', 'repo_seized', 'login_bonus', 'streak_bonus', 'penalty')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- STEALS TABLE
-- =====================================
CREATE TABLE bb_steals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thief_id UUID REFERENCES bb_users(id) NOT NULL,
  target_id UUID REFERENCES bb_users(id) NOT NULL,
  steal_percentage NUMERIC,
  potential_amount INTEGER,
  actual_amount INTEGER,
  target_was_online BOOLEAN,
  defense_window_start TIMESTAMPTZ,
  defense_window_end TIMESTAMPTZ,
  was_defended BOOLEAN DEFAULT false,
  defended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'success', 'defended', 'failed')),
  thief_penalty INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================================
-- NOTIFICATIONS TABLE
-- =====================================
CREATE TABLE bb_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'medium', 'normal')),
  reference_type TEXT,
  reference_id UUID,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- BADGES TABLE
-- =====================================
CREATE TABLE bb_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES bb_users(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  is_shame_badge BOOLEAN DEFAULT false,
  icon TEXT,
  color TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- =====================================
-- DEBTS TABLE
-- =====================================
CREATE TABLE bb_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID REFERENCES bb_users(id) NOT NULL,
  lender_id UUID REFERENCES bb_users(id),
  principal INTEGER NOT NULL,
  interest_rate NUMERIC DEFAULT 0.10,
  accrued_interest INTEGER DEFAULT 0,
  amount_repaid INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'defaulted', 'repo_triggered')),
  repo_triggered BOOLEAN DEFAULT false,
  repo_triggered_at TIMESTAMPTZ,
  seized_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  last_interest_calc TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- BEGS TABLE
-- =====================================
CREATE TABLE bb_begs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beggar_id UUID REFERENCES bb_users(id) NOT NULL,
  target_id UUID REFERENCES bb_users(id) NOT NULL,
  dare_type TEXT,
  dare_text TEXT,
  dare_assigned_at TIMESTAMPTZ,
  proof_url TEXT,
  proof_submitted_at TIMESTAMPTZ,
  reward_amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dare_assigned', 'proof_submitted', 'completed', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- =====================================
-- PROOFS TABLE
-- =====================================
CREATE TABLE bb_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clash_id UUID REFERENCES bb_clashes(id),
  uploader_id UUID REFERENCES bb_users(id) NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  encryption_key_id TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  duration_seconds INTEGER,
  captured_at TIMESTAMPTZ,
  device_info TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_verified BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  max_views INTEGER DEFAULT 1,
  view_duration_hours INTEGER DEFAULT 24,
  expires_at TIMESTAMPTZ,
  is_destroyed BOOLEAN DEFAULT false,
  screenshot_detected BOOLEAN DEFAULT false,
  screenshot_detected_at TIMESTAMPTZ,
  screenshot_penalty_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- REPORTS TABLE
-- =====================================
CREATE TABLE bb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES bb_users(id) NOT NULL,
  content_type TEXT NOT NULL,
  content_id UUID,
  reported_user_id UUID REFERENCES bb_users(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES bb_users(id),
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- INDEXES
-- =====================================
CREATE INDEX idx_users_username ON bb_users(username);
CREATE INDEX idx_users_email ON bb_users(email);
CREATE INDEX idx_friendships_user_id ON bb_friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON bb_friendships(friend_id);
CREATE INDEX idx_friendships_status ON bb_friendships(status);
CREATE INDEX idx_bets_available ON bb_bets(available_at, expires_at);
CREATE INDEX idx_bet_participants_bet ON bb_bet_participants(bet_id);
CREATE INDEX idx_bet_participants_user ON bb_bet_participants(user_id);
CREATE INDEX idx_clashes_users ON bb_clashes(user1_id, user2_id);
CREATE INDEX idx_clashes_status ON bb_clashes(status);
CREATE INDEX idx_transactions_user ON bb_transactions(user_id);
CREATE INDEX idx_transactions_created ON bb_transactions(created_at);
CREATE INDEX idx_steals_thief ON bb_steals(thief_id);
CREATE INDEX idx_steals_target ON bb_steals(target_id);
CREATE INDEX idx_notifications_user ON bb_notifications(user_id, read);
CREATE INDEX idx_badges_user ON bb_badges(user_id);
CREATE INDEX idx_debts_borrower ON bb_debts(borrower_id);

-- =====================================
-- FUNCTIONS
-- =====================================

-- Calculate stake (wallet / 50, min 1)
CREATE OR REPLACE FUNCTION bb_calculate_stake(wallet_balance INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, wallet_balance / 50);
END;
$$ LANGUAGE plpgsql;

-- Random steal percentage (5-25%)
CREATE OR REPLACE FUNCTION bb_random_steal_percentage()
RETURNS NUMERIC AS $$
BEGIN
  RETURN 5 + (random() * 20);
END;
$$ LANGUAGE plpgsql;

-- Check if user can claim daily allowance
CREATE OR REPLACE FUNCTION bb_can_claim_allowance(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_claimed TIMESTAMPTZ;
BEGIN
  SELECT last_allowance_claimed INTO last_claimed
  FROM bb_users WHERE id = user_uuid;

  IF last_claimed IS NULL THEN
    RETURN true;
  END IF;

  RETURN NOW() - last_claimed > INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Claim daily allowance
CREATE OR REPLACE FUNCTION bb_claim_allowance(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  allowance INTEGER := 50;
  new_balance INTEGER;
BEGIN
  IF NOT bb_can_claim_allowance(user_uuid) THEN
    RETURN 0;
  END IF;

  UPDATE bb_users
  SET coins = coins + allowance,
      last_allowance_claimed = NOW()
  WHERE id = user_uuid
  RETURNING coins INTO new_balance;

  INSERT INTO bb_transactions (user_id, amount, balance_after, type, description)
  VALUES (user_uuid, allowance, new_balance, 'allowance', 'Daily allowance claimed. Fresh tuna for the stray.');

  RETURN allowance;
END;
$$ LANGUAGE plpgsql;

-- Lock stake for a clash
CREATE OR REPLACE FUNCTION bb_lock_stake(user_uuid UUID, stake_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT coins INTO current_balance FROM bb_users WHERE id = user_uuid FOR UPDATE;

  IF current_balance < stake_amount THEN
    RETURN false;
  END IF;

  UPDATE bb_users SET coins = coins - stake_amount WHERE id = user_uuid;

  INSERT INTO bb_transactions (user_id, amount, balance_after, type, description)
  VALUES (user_uuid, -stake_amount, current_balance - stake_amount, 'clash_stake_lock', 'Tuna locked for clash. No takebacks.');

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Award clash win
CREATE OR REPLACE FUNCTION bb_award_clash_win(
  winner_uuid UUID,
  loser_uuid UUID,
  clash_uuid UUID,
  pot_amount INTEGER
)
RETURNS VOID AS $$
DECLARE
  winner_balance INTEGER;
BEGIN
  UPDATE bb_users
  SET coins = coins + pot_amount,
      total_wins = total_wins + 1,
      total_earnings = total_earnings + pot_amount,
      win_streak = win_streak + 1,
      best_win_streak = GREATEST(best_win_streak, win_streak + 1)
  WHERE id = winner_uuid
  RETURNING coins INTO winner_balance;

  UPDATE bb_users
  SET total_losses = total_losses + 1,
      win_streak = 0
  WHERE id = loser_uuid;

  INSERT INTO bb_transactions (user_id, amount, balance_after, type, reference_type, reference_id, description)
  VALUES (winner_uuid, pot_amount, winner_balance, 'clash_win', 'clash', clash_uuid, 'Victory! The pot is yours, kitten.');

  UPDATE bb_clashes
  SET winner_id = winner_uuid,
      loser_id = loser_uuid,
      status = 'completed',
      resolved_at = NOW()
  WHERE id = clash_uuid;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- ROW LEVEL SECURITY
-- =====================================
ALTER TABLE bb_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_bet_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_clashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_steals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_begs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bb_reports ENABLE ROW LEVEL SECURITY;

-- Users: Users can read all profiles, update their own
CREATE POLICY "Users can read all profiles" ON bb_users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON bb_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON bb_users FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships: Users can see their own friendships
CREATE POLICY "Users can see own friendships" ON bb_friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friendships" ON bb_friendships FOR INSERT
  WITH CHECK (auth.uid() = initiated_by);
CREATE POLICY "Users can update own friendships" ON bb_friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Bets: All users can read approved bets
CREATE POLICY "Users can read approved bets" ON bb_bets FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can create bets" ON bb_bets FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Bet participants: Users can see and manage their own participation
CREATE POLICY "Users can see own bet participation" ON bb_bet_participants FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can participate in bets" ON bb_bet_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participation" ON bb_bet_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Clashes: Users can see clashes they're part of
CREATE POLICY "Users can see own clashes" ON bb_clashes FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own clashes" ON bb_clashes FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Transactions: Users can only see their own
CREATE POLICY "Users can see own transactions" ON bb_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Steals: Users can see steals they're involved in
CREATE POLICY "Users can see own steals" ON bb_steals FOR SELECT
  USING (auth.uid() = thief_id OR auth.uid() = target_id);
CREATE POLICY "Users can create steals" ON bb_steals FOR INSERT
  WITH CHECK (auth.uid() = thief_id);
CREATE POLICY "Users can update steals" ON bb_steals FOR UPDATE
  USING (auth.uid() = thief_id OR auth.uid() = target_id);

-- Notifications: Users can only see their own
CREATE POLICY "Users can see own notifications" ON bb_notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON bb_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Badges: All users can see all badges
CREATE POLICY "Users can see all badges" ON bb_badges FOR SELECT USING (true);

-- Debts: Users can see debts they're involved in
CREATE POLICY "Users can see own debts" ON bb_debts FOR SELECT
  USING (auth.uid() = borrower_id OR auth.uid() = lender_id);

-- Begs: Users can see begs they're involved in
CREATE POLICY "Users can see own begs" ON bb_begs FOR SELECT
  USING (auth.uid() = beggar_id OR auth.uid() = target_id);
CREATE POLICY "Users can create begs" ON bb_begs FOR INSERT
  WITH CHECK (auth.uid() = beggar_id);
CREATE POLICY "Users can update own begs" ON bb_begs FOR UPDATE
  USING (auth.uid() = beggar_id OR auth.uid() = target_id);

-- Proofs: Users can see proofs in their clashes
CREATE POLICY "Users can see own proofs" ON bb_proofs FOR SELECT
  USING (auth.uid() = uploader_id OR EXISTS (
    SELECT 1 FROM bb_clashes
    WHERE bb_clashes.id = bb_proofs.clash_id
    AND (bb_clashes.user1_id = auth.uid() OR bb_clashes.user2_id = auth.uid())
  ));
CREATE POLICY "Users can upload proofs" ON bb_proofs FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Reports: Users can see their own reports
CREATE POLICY "Users can see own reports" ON bb_reports FOR SELECT
  USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create reports" ON bb_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
