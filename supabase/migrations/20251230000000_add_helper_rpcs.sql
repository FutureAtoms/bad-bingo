-- Add Helper RPC Functions for Atomic Updates
-- =============================================
-- These functions allow atomic increment/decrement operations on user fields
-- to prevent race conditions when multiple operations happen concurrently.

-- =============================================
-- ATOMIC INCREMENT FUNCTION
-- =============================================
-- Atomically increment a numeric field on bb_users table
-- Usage: SELECT bb_increment_user_field(user_id, 'steals_defended', 1);
CREATE OR REPLACE FUNCTION bb_increment_user_field(
  user_uuid UUID,
  field_name TEXT,
  increment_by INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_value INTEGER;
BEGIN
  -- Validate field name to prevent SQL injection
  IF field_name NOT IN (
    'coins', 'social_debt', 'total_earnings', 'total_losses',
    'total_wins', 'total_clashes', 'win_streak', 'best_win_streak',
    'steals_successful', 'steals_defended', 'times_robbed',
    'login_streak', 'trust_score', 'strike_count'
  ) THEN
    RAISE EXCEPTION 'Invalid field name: %', field_name;
  END IF;

  EXECUTE format(
    'UPDATE bb_users SET %I = COALESCE(%I, 0) + $1 WHERE id = $2 RETURNING %I',
    field_name, field_name, field_name
  )
  USING increment_by, user_uuid
  INTO new_value;

  RETURN new_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ATOMIC DECREMENT FUNCTION
-- =============================================
-- Atomically decrement a numeric field on bb_users table
-- Ensures value doesn't go below 0 for most fields
-- Usage: SELECT bb_decrement_user_field(user_id, 'social_debt', 50);
CREATE OR REPLACE FUNCTION bb_decrement_user_field(
  user_uuid UUID,
  field_name TEXT,
  decrement_by INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_value INTEGER;
BEGIN
  -- Validate field name to prevent SQL injection
  IF field_name NOT IN (
    'coins', 'social_debt', 'total_earnings', 'total_losses',
    'total_wins', 'total_clashes', 'win_streak', 'best_win_streak',
    'steals_successful', 'steals_defended', 'times_robbed',
    'login_streak', 'trust_score', 'strike_count'
  ) THEN
    RAISE EXCEPTION 'Invalid field name: %', field_name;
  END IF;

  -- For trust_score, allow it to go to 0 but not below
  -- For other fields, same behavior
  EXECUTE format(
    'UPDATE bb_users SET %I = GREATEST(0, COALESCE(%I, 0) - $1) WHERE id = $2 RETURNING %I',
    field_name, field_name, field_name
  )
  USING decrement_by, user_uuid
  INTO new_value;

  RETURN new_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CONVENIENCE FUNCTIONS
-- =============================================

-- Increment steals_defended by 1 for a user
CREATE OR REPLACE FUNCTION bb_increment_steals_defended(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN bb_increment_user_field(user_uuid, 'steals_defended', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment social_debt by specified amount
CREATE OR REPLACE FUNCTION bb_increment_social_debt(user_uuid UUID, amount INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN bb_increment_user_field(user_uuid, 'social_debt', amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement social_debt by specified amount
CREATE OR REPLACE FUNCTION bb_decrement_social_debt(user_uuid UUID, amount INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN bb_decrement_user_field(user_uuid, 'social_debt', amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement trust_score by specified amount (with floor at 0)
CREATE OR REPLACE FUNCTION bb_decrement_trust_score(user_uuid UUID, amount INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN bb_decrement_user_field(user_uuid, 'trust_score', amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION bb_increment_user_field(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bb_decrement_user_field(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bb_increment_steals_defended(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bb_increment_social_debt(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bb_decrement_social_debt(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bb_decrement_trust_score(UUID, INTEGER) TO authenticated;
