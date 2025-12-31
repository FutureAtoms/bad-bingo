-- Create bb_users table for Bad Bingo
CREATE TABLE IF NOT EXISTS bb_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 18,
  gender TEXT,
  risk_profile TEXT,
  avatar_url TEXT,
  coins INTEGER NOT NULL DEFAULT 1000,
  social_debt INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_clashes INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  steals_successful INTEGER NOT NULL DEFAULT 0,
  steals_defended INTEGER NOT NULL DEFAULT 0,
  times_robbed INTEGER NOT NULL DEFAULT 0,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  haptics_enabled BOOLEAN NOT NULL DEFAULT true,
  trust_score INTEGER NOT NULL DEFAULT 100,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_allowance_claimed TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  login_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bb_users ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can insert" ON bb_users;
DROP POLICY IF EXISTS "Anyone can select" ON bb_users;
DROP POLICY IF EXISTS "Users can update own" ON bb_users;

CREATE POLICY "Anyone can insert" ON bb_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can select" ON bb_users FOR SELECT USING (true);
CREATE POLICY "Users can update own" ON bb_users FOR UPDATE USING (auth.uid() = id);

-- Transactions table for tuna history
CREATE TABLE IF NOT EXISTS bb_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES bb_users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bb_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON bb_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON bb_transactions;

CREATE POLICY "Users can view own transactions" ON bb_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON bb_transactions FOR INSERT WITH CHECK (true);
