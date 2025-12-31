-- Migration: Add heat level proposal fields for mutual consent system
-- This adds the fields needed for the mutual heat consent feature

-- Add new columns to bb_friendships for heat proposals
ALTER TABLE bb_friendships
ADD COLUMN IF NOT EXISTS heat_level_proposed INTEGER CHECK (heat_level_proposed IN (1, 2, 3)),
ADD COLUMN IF NOT EXISTS heat_level_proposed_by UUID REFERENCES bb_users(id),
ADD COLUMN IF NOT EXISTS heat_level_proposed_at TIMESTAMPTZ;

-- Add index for faster lookups of pending proposals
CREATE INDEX IF NOT EXISTS idx_friendships_pending_proposals
ON bb_friendships (user_id, status, heat_level_proposed)
WHERE heat_level_proposed IS NOT NULL;

-- Add index for cooldown checks
CREATE INDEX IF NOT EXISTS idx_friendships_heat_changed
ON bb_friendships (heat_changed_at)
WHERE heat_changed_at IS NOT NULL;

-- Comment explaining the fields
COMMENT ON COLUMN bb_friendships.heat_level_proposed IS 'The proposed heat level (1-3) awaiting confirmation from the other user';
COMMENT ON COLUMN bb_friendships.heat_level_proposed_by IS 'The user ID who proposed the heat level change';
COMMENT ON COLUMN bb_friendships.heat_level_proposed_at IS 'When the heat level was proposed';

-- Enable realtime for friendships table if not already enabled
-- (This allows subscriptions to heat proposal changes)
ALTER PUBLICATION supabase_realtime ADD TABLE bb_friendships;
