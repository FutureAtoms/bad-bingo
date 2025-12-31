-- Add last_interest_accrual column to bb_debts if it doesn't exist
-- This column tracks when interest was last accrued to prevent double-accrual

DO $$
BEGIN
    -- Add last_interest_accrual column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bb_debts' AND column_name = 'last_interest_accrual'
    ) THEN
        ALTER TABLE bb_debts ADD COLUMN last_interest_accrual TIMESTAMPTZ;

        -- Update existing rows to have last_interest_accrual = last_interest_calc
        UPDATE bb_debts SET last_interest_accrual = last_interest_calc WHERE last_interest_accrual IS NULL;
    END IF;

    -- Add repo_triggered_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bb_debts' AND column_name = 'repo_triggered_at'
    ) THEN
        ALTER TABLE bb_debts ADD COLUMN repo_triggered_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index on bb_debts for efficient querying by status
CREATE INDEX IF NOT EXISTS idx_debts_status ON bb_debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_at ON bb_debts(due_at);

-- Create index on bb_bets for batch queries
CREATE INDEX IF NOT EXISTS idx_bets_batch ON bb_bets(batch_number, batch_date);
CREATE INDEX IF NOT EXISTS idx_bets_target_users ON bb_bets USING GIN (target_users);

-- Comment for documentation
COMMENT ON COLUMN bb_debts.last_interest_accrual IS 'Timestamp of last interest accrual (used by accrue-interest Edge Function)';
COMMENT ON COLUMN bb_debts.repo_triggered_at IS 'Timestamp when repo was first triggered for this debt';
