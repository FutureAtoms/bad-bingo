-- Fix the Edge Function URL to use correct project ref
UPDATE app_settings
SET value = 'https://rsienbixfyzoiullonvw.supabase.co/functions/v1'
WHERE key = 'edge_function_base_url';
