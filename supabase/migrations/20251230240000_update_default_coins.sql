-- Update default starting coins from 100 to 1000
-- Also update existing users who still have exactly 100 coins (starting amount)
UPDATE bb_users
SET coins = 1000
WHERE coins = 100;

-- Update the column default
ALTER TABLE bb_users ALTER COLUMN coins SET DEFAULT 1000;
