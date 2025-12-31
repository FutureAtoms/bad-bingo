-- Migration: Add pg_cron jobs for scheduled Edge Function execution
-- This migration sets up automated scheduling for:
--   1. generate-bets: Runs 3x daily (8:00, 14:00, 20:00 UTC)
--   2. accrue-interest: Runs daily at midnight UTC
--   3. notify-bet-drop: Chained to run after generate-bets
--
-- Prerequisites:
--   - pg_cron extension must be enabled in Supabase dashboard
--   - pg_net extension must be enabled for HTTP calls
--   - Edge Functions must be deployed
--
-- Note: pg_cron and pg_net are available on Supabase Pro plan and above

-- ============================================================================
-- STEP 1: Enable required extensions
-- ============================================================================

-- pg_cron: Job scheduler for PostgreSQL
-- Note: This may fail on Supabase Free tier - the extension needs to be enabled
-- via the Supabase Dashboard: Database > Extensions > pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- pg_net: HTTP client for PostgreSQL (allows calling Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (required for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- STEP 2: Create configuration table for Edge Function settings
-- ============================================================================

-- Store Edge Function configuration (URL, keys) in a secure table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on app_settings (only service role can access)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then create
DROP POLICY IF EXISTS "Service role only" ON app_settings;
CREATE POLICY "Service role only" ON app_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert default configuration (these should be updated with actual values)
-- The Edge Function URL is constructed from the Supabase project reference
INSERT INTO app_settings (key, value, description) VALUES
    ('edge_function_base_url', 'https://rsienbixfyzoiullonvw.supabase.co/functions/v1', 'Base URL for Edge Functions'),
    ('service_role_key', 'REPLACE_WITH_SERVICE_ROLE_KEY', 'Service role key for Edge Function auth (update via SQL or Dashboard)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STEP 3: Create helper function to call Edge Functions
-- ============================================================================

-- Function to trigger an Edge Function via HTTP POST
CREATE OR REPLACE FUNCTION trigger_edge_function(
    function_name TEXT,
    payload JSONB DEFAULT '{}'::JSONB,
    timeout_ms INTEGER DEFAULT 30000
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_url TEXT;
    service_key TEXT;
    full_url TEXT;
    request_id BIGINT;
BEGIN
    -- Get configuration from app_settings
    SELECT value INTO base_url FROM app_settings WHERE key = 'edge_function_base_url';
    SELECT value INTO service_key FROM app_settings WHERE key = 'service_role_key';

    -- Validate configuration
    IF base_url IS NULL THEN
        RAISE EXCEPTION 'Edge function base URL not configured in app_settings';
    END IF;

    IF service_key IS NULL OR service_key = 'REPLACE_WITH_SERVICE_ROLE_KEY' THEN
        RAISE WARNING 'Service role key not configured - Edge Function call may fail';
    END IF;

    -- Construct full URL
    full_url := base_url || '/' || function_name;

    -- Make HTTP POST request using pg_net
    SELECT net.http_post(
        url := full_url,
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key,
            'Content-Type', 'application/json',
            'x-cron-trigger', 'true'
        ),
        body := payload,
        timeout_milliseconds := timeout_ms
    ) INTO request_id;

    -- Log the trigger (optional - for debugging)
    RAISE NOTICE 'Triggered Edge Function: % (request_id: %)', function_name, request_id;

    RETURN request_id;
END;
$$;

-- Grant execute to postgres (for cron jobs)
GRANT EXECUTE ON FUNCTION trigger_edge_function(TEXT, JSONB, INTEGER) TO postgres;

-- ============================================================================
-- STEP 4: Create wrapper functions for each scheduled job
-- ============================================================================

-- Wrapper for generate-bets that also chains notify-bet-drop
CREATE OR REPLACE FUNCTION cron_generate_bets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    generate_request_id BIGINT;
BEGIN
    -- Trigger generate-bets Edge Function
    generate_request_id := trigger_edge_function('generate-bets', '{}'::JSONB, 60000);

    -- Log execution
    INSERT INTO cron_job_logs (job_name, request_id, triggered_at)
    VALUES ('generate-bets', generate_request_id, NOW());

    -- Chain notify-bet-drop (with 5 second delay to allow generate-bets to complete)
    -- Using pg_sleep would block, so we schedule it for immediate execution
    PERFORM trigger_edge_function('notify-bet-drop', '{}'::JSONB, 30000);

    -- Log chained execution
    INSERT INTO cron_job_logs (job_name, request_id, triggered_at, notes)
    VALUES ('notify-bet-drop', NULL, NOW(), 'Chained from generate-bets');

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail (cron job should be resilient)
    INSERT INTO cron_job_logs (job_name, triggered_at, error_message)
    VALUES ('generate-bets', NOW(), SQLERRM);
    RAISE WARNING 'cron_generate_bets failed: %', SQLERRM;
END;
$$;

-- Wrapper for accrue-interest
CREATE OR REPLACE FUNCTION cron_accrue_interest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_id BIGINT;
BEGIN
    -- Trigger accrue-interest Edge Function
    request_id := trigger_edge_function('accrue-interest', '{}'::JSONB, 60000);

    -- Log execution
    INSERT INTO cron_job_logs (job_name, request_id, triggered_at)
    VALUES ('accrue-interest', request_id, NOW());

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail
    INSERT INTO cron_job_logs (job_name, triggered_at, error_message)
    VALUES ('accrue-interest', NOW(), SQLERRM);
    RAISE WARNING 'cron_accrue_interest failed: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cron_generate_bets() TO postgres;
GRANT EXECUTE ON FUNCTION cron_accrue_interest() TO postgres;

-- ============================================================================
-- STEP 5: Create logging table for cron job execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS cron_job_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    request_id BIGINT,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'triggered',
    notes TEXT,
    error_message TEXT
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_triggered_at ON cron_job_logs(triggered_at DESC);

-- Enable RLS
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access logs
DROP POLICY IF EXISTS "Service role only logs" ON cron_job_logs;
CREATE POLICY "Service role only logs" ON cron_job_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Auto-cleanup old logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM cron_job_logs WHERE triggered_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================================
-- STEP 6: Schedule the cron jobs
-- ============================================================================

-- Remove existing jobs if they exist (to allow re-running migration)
SELECT cron.unschedule('generate-bets-morning') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'generate-bets-morning'
);
SELECT cron.unschedule('generate-bets-afternoon') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'generate-bets-afternoon'
);
SELECT cron.unschedule('generate-bets-evening') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'generate-bets-evening'
);
SELECT cron.unschedule('accrue-interest-daily') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'accrue-interest-daily'
);
SELECT cron.unschedule('cleanup-cron-logs') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-cron-logs'
);

-- Schedule generate-bets to run 3x daily
-- Morning batch: 8:00 UTC
SELECT cron.schedule(
    'generate-bets-morning',
    '0 8 * * *',
    $$SELECT cron_generate_bets()$$
);

-- Afternoon batch: 14:00 UTC
SELECT cron.schedule(
    'generate-bets-afternoon',
    '0 14 * * *',
    $$SELECT cron_generate_bets()$$
);

-- Evening batch: 20:00 UTC
SELECT cron.schedule(
    'generate-bets-evening',
    '0 20 * * *',
    $$SELECT cron_generate_bets()$$
);

-- Schedule accrue-interest to run daily at midnight UTC
SELECT cron.schedule(
    'accrue-interest-daily',
    '0 0 * * *',
    $$SELECT cron_accrue_interest()$$
);

-- Schedule log cleanup weekly (Sundays at 3:00 UTC)
SELECT cron.schedule(
    'cleanup-cron-logs',
    '0 3 * * 0',
    $$SELECT cleanup_old_cron_logs()$$
);

-- ============================================================================
-- STEP 7: Create manual trigger function for testing
-- ============================================================================

-- Function to manually trigger any cron job (for testing)
CREATE OR REPLACE FUNCTION manual_trigger_cron_job(job_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    CASE job_name
        WHEN 'generate-bets' THEN
            PERFORM cron_generate_bets();
            RETURN 'Triggered generate-bets (and chained notify-bet-drop)';
        WHEN 'accrue-interest' THEN
            PERFORM cron_accrue_interest();
            RETURN 'Triggered accrue-interest';
        WHEN 'notify-bet-drop' THEN
            PERFORM trigger_edge_function('notify-bet-drop', '{}'::JSONB, 30000);
            RETURN 'Triggered notify-bet-drop';
        WHEN 'cleanup-logs' THEN
            PERFORM cleanup_old_cron_logs();
            RETURN 'Cleaned up old cron logs';
        ELSE
            RAISE EXCEPTION 'Unknown job name: %. Valid jobs: generate-bets, accrue-interest, notify-bet-drop, cleanup-logs', job_name;
    END CASE;
END;
$$;

-- Grant execute for testing
GRANT EXECUTE ON FUNCTION manual_trigger_cron_job(TEXT) TO postgres;

-- ============================================================================
-- STEP 8: Create view for monitoring cron jobs
-- ============================================================================

CREATE OR REPLACE VIEW cron_job_status AS
SELECT
    j.jobname AS job_name,
    j.schedule,
    j.active,
    l.triggered_at AS last_triggered,
    l.status AS last_status,
    l.error_message AS last_error,
    CASE
        WHEN j.schedule LIKE '0 8 * * *' THEN 'Daily at 8:00 UTC'
        WHEN j.schedule LIKE '0 14 * * *' THEN 'Daily at 14:00 UTC'
        WHEN j.schedule LIKE '0 20 * * *' THEN 'Daily at 20:00 UTC'
        WHEN j.schedule LIKE '0 0 * * *' THEN 'Daily at midnight UTC'
        WHEN j.schedule LIKE '0 3 * * 0' THEN 'Weekly on Sundays at 3:00 UTC'
        ELSE j.schedule
    END AS schedule_description
FROM cron.job j
LEFT JOIN LATERAL (
    SELECT * FROM cron_job_logs
    WHERE job_name = j.jobname
    ORDER BY triggered_at DESC
    LIMIT 1
) l ON true
WHERE j.jobname IN (
    'generate-bets-morning',
    'generate-bets-afternoon',
    'generate-bets-evening',
    'accrue-interest-daily',
    'cleanup-cron-logs'
);

-- Grant select on view
GRANT SELECT ON cron_job_status TO postgres;

-- ============================================================================
-- STEP 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE app_settings IS 'Configuration settings for Edge Functions and other app-level config';
COMMENT ON TABLE cron_job_logs IS 'Execution logs for pg_cron scheduled jobs';
COMMENT ON FUNCTION trigger_edge_function IS 'Triggers a Supabase Edge Function via HTTP POST using pg_net';
COMMENT ON FUNCTION cron_generate_bets IS 'Cron wrapper for generate-bets Edge Function (chains notify-bet-drop)';
COMMENT ON FUNCTION cron_accrue_interest IS 'Cron wrapper for accrue-interest Edge Function';
COMMENT ON FUNCTION manual_trigger_cron_job IS 'Manually trigger a cron job for testing purposes';
COMMENT ON VIEW cron_job_status IS 'View showing status of all scheduled cron jobs';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
--
-- IMPORTANT: After running this migration, you must:
--
-- 1. Update the service_role_key in app_settings:
--    UPDATE app_settings SET value = 'your-actual-service-role-key'
--    WHERE key = 'service_role_key';
--
-- 2. Verify Edge Functions are deployed:
--    - generate-bets
--    - accrue-interest
--    - notify-bet-drop
--
-- 3. Test the jobs manually:
--    SELECT manual_trigger_cron_job('generate-bets');
--    SELECT manual_trigger_cron_job('accrue-interest');
--
-- 4. Monitor job status:
--    SELECT * FROM cron_job_status;
--    SELECT * FROM cron_job_logs ORDER BY triggered_at DESC LIMIT 20;
--
-- 5. Check pg_net request logs (if needed):
--    SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
--
-- Schedule Summary:
-- - generate-bets-morning:   Every day at 8:00 UTC
-- - generate-bets-afternoon: Every day at 14:00 UTC
-- - generate-bets-evening:   Every day at 20:00 UTC
-- - accrue-interest-daily:   Every day at 00:00 UTC (midnight)
-- - cleanup-cron-logs:       Every Sunday at 3:00 UTC
--
-- ============================================================================
