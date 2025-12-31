-- Add questionnaire fields to bb_friendships
ALTER TABLE bb_friendships
ADD COLUMN IF NOT EXISTS user_questionnaire_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS user_questionnaire_completed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS friend_questionnaire_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS friend_questionnaire_completed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS questionnaire_reward_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS questionnaire_reward_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding incomplete questionnaires
CREATE INDEX IF NOT EXISTS idx_bb_friendships_questionnaire
ON bb_friendships(user_id, user_questionnaire_completed)
WHERE status = 'accepted';
