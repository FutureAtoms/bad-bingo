-- Bad Bingo - Missing Tables Migration
-- This migration creates tables that exist in the initial schema but haven't been applied
-- Run this if your Supabase project is missing: bb_clashes, bb_steals, bb_debts, bb_begs, bb_badges, bb_proofs, bb_reports
-- =====================================

-- Check and create bb_clashes if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_clashes') THEN
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

        CREATE INDEX IF NOT EXISTS idx_clashes_users ON bb_clashes(user1_id, user2_id);
        CREATE INDEX IF NOT EXISTS idx_clashes_status ON bb_clashes(status);

        ALTER TABLE bb_clashes ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own clashes" ON bb_clashes FOR SELECT
          USING (auth.uid() = user1_id OR auth.uid() = user2_id);
        CREATE POLICY "Users can update own clashes" ON bb_clashes FOR UPDATE
          USING (auth.uid() = user1_id OR auth.uid() = user2_id);

        RAISE NOTICE 'Created bb_clashes table';
    ELSE
        RAISE NOTICE 'bb_clashes table already exists';
    END IF;
END $$;

-- Check and create bb_steals if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_steals') THEN
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

        CREATE INDEX IF NOT EXISTS idx_steals_thief ON bb_steals(thief_id);
        CREATE INDEX IF NOT EXISTS idx_steals_target ON bb_steals(target_id);

        ALTER TABLE bb_steals ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own steals" ON bb_steals FOR SELECT
          USING (auth.uid() = thief_id OR auth.uid() = target_id);
        CREATE POLICY "Users can create steals" ON bb_steals FOR INSERT
          WITH CHECK (auth.uid() = thief_id);
        CREATE POLICY "Users can update steals" ON bb_steals FOR UPDATE
          USING (auth.uid() = thief_id OR auth.uid() = target_id);

        RAISE NOTICE 'Created bb_steals table';
    ELSE
        RAISE NOTICE 'bb_steals table already exists';
    END IF;
END $$;

-- Check and create bb_debts if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_debts') THEN
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

        CREATE INDEX IF NOT EXISTS idx_debts_borrower ON bb_debts(borrower_id);

        ALTER TABLE bb_debts ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own debts" ON bb_debts FOR SELECT
          USING (auth.uid() = borrower_id OR auth.uid() = lender_id);

        RAISE NOTICE 'Created bb_debts table';
    ELSE
        RAISE NOTICE 'bb_debts table already exists';
    END IF;
END $$;

-- Check and create bb_begs if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_begs') THEN
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

        ALTER TABLE bb_begs ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own begs" ON bb_begs FOR SELECT
          USING (auth.uid() = beggar_id OR auth.uid() = target_id);
        CREATE POLICY "Users can create begs" ON bb_begs FOR INSERT
          WITH CHECK (auth.uid() = beggar_id);
        CREATE POLICY "Users can update own begs" ON bb_begs FOR UPDATE
          USING (auth.uid() = beggar_id OR auth.uid() = target_id);

        RAISE NOTICE 'Created bb_begs table';
    ELSE
        RAISE NOTICE 'bb_begs table already exists';
    END IF;
END $$;

-- Check and create bb_badges if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_badges') THEN
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

        CREATE INDEX IF NOT EXISTS idx_badges_user ON bb_badges(user_id);

        ALTER TABLE bb_badges ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see all badges" ON bb_badges FOR SELECT USING (true);

        RAISE NOTICE 'Created bb_badges table';
    ELSE
        RAISE NOTICE 'bb_badges table already exists';
    END IF;
END $$;

-- Check and create bb_proofs if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_proofs') THEN
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

        ALTER TABLE bb_proofs ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own proofs" ON bb_proofs FOR SELECT
          USING (auth.uid() = uploader_id OR EXISTS (
            SELECT 1 FROM bb_clashes
            WHERE bb_clashes.id = bb_proofs.clash_id
            AND (bb_clashes.user1_id = auth.uid() OR bb_clashes.user2_id = auth.uid())
          ));
        CREATE POLICY "Users can upload proofs" ON bb_proofs FOR INSERT
          WITH CHECK (auth.uid() = uploader_id);

        RAISE NOTICE 'Created bb_proofs table';
    ELSE
        RAISE NOTICE 'bb_proofs table already exists';
    END IF;
END $$;

-- Check and create bb_reports if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bb_reports') THEN
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

        ALTER TABLE bb_reports ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can see own reports" ON bb_reports FOR SELECT
          USING (auth.uid() = reporter_id);
        CREATE POLICY "Users can create reports" ON bb_reports FOR INSERT
          WITH CHECK (auth.uid() = reporter_id);

        RAISE NOTICE 'Created bb_reports table';
    ELSE
        RAISE NOTICE 'bb_reports table already exists';
    END IF;
END $$;

-- Verify all tables exist
DO $$
DECLARE
    required_tables TEXT[] := ARRAY['bb_users', 'bb_friendships', 'bb_bets', 'bb_bet_participants', 'bb_clashes', 'bb_steals', 'bb_debts', 'bb_begs', 'bb_badges', 'bb_notifications', 'bb_transactions', 'bb_proofs', 'bb_reports'];
    tbl TEXT;
    missing_tables TEXT[] := '{}';
BEGIN
    FOREACH tbl IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            missing_tables := array_append(missing_tables, tbl);
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables exist!';
    END IF;
END $$;
