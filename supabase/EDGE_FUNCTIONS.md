# Bad Bingo Edge Functions

This document describes the Supabase Edge Functions used by Bad Bingo and how to deploy and schedule them.

## Edge Functions Overview

| Function | Purpose | Schedule |
|----------|---------|----------|
| `accrue-interest` | Daily interest accrual on debts, repo seizure | Daily at midnight UTC |
| `generate-bets` | Generate shared bets for all friend pairs | 3x daily (8:00, 14:00, 20:00 UTC) |
| `notify-bet-drop` | Send push notifications for new bets | Called after `generate-bets` |
| `send-push-notification` | Generic push notification sender | On-demand |

## Environment Variables Required

Set these secrets in your Supabase project (Dashboard > Edge Functions > Secrets):

```bash
# Automatically available (no need to set)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Required for push notifications
FIREBASE_PROJECT_ID=bad-bingo
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@bad-bingo.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Required for AI bet generation
GEMINI_API_KEY=your-gemini-api-key
# OR
VITE_GEMINI_API_KEY=your-gemini-api-key
```

## Deployment

### Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy accrue-interest
supabase functions deploy generate-bets
supabase functions deploy notify-bet-drop
supabase functions deploy send-push-notification
```

### Deploy Individual Function

```bash
# Deploy a specific function
supabase functions deploy accrue-interest

# Deploy with verification
supabase functions deploy generate-bets --no-verify-jwt
```

### Local Development

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve accrue-interest --env-file secrets/edge.env
supabase functions serve generate-bets --env-file secrets/edge.env
```

## Cron Job Configuration

Supabase uses pg_cron for scheduled jobs. Configure these in SQL or via the Supabase Dashboard.

### Option 1: Using pg_cron (SQL)

Run these SQL commands in Supabase SQL Editor:

```sql
-- Enable pg_cron extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule accrue-interest: Daily at midnight UTC
SELECT cron.schedule(
    'accrue-interest-daily',
    '0 0 * * *',  -- Every day at 00:00 UTC
    $$
    SELECT
      net.http_post(
        url := 'https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/accrue-interest',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
);

-- Schedule generate-bets: 8:00 UTC
SELECT cron.schedule(
    'generate-bets-morning',
    '0 8 * * *',  -- Every day at 08:00 UTC
    $$
    SELECT
      net.http_post(
        url := 'https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/generate-bets',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
);

-- Schedule generate-bets: 14:00 UTC
SELECT cron.schedule(
    'generate-bets-afternoon',
    '0 14 * * *',  -- Every day at 14:00 UTC
    $$
    SELECT
      net.http_post(
        url := 'https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/generate-bets',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
);

-- Schedule generate-bets: 20:00 UTC
SELECT cron.schedule(
    'generate-bets-evening',
    '0 20 * * *',  -- Every day at 20:00 UTC
    $$
    SELECT
      net.http_post(
        url := 'https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/generate-bets',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key') || '"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule a job (if needed)
-- SELECT cron.unschedule('accrue-interest-daily');
```

### Option 2: Using Supabase Dashboard

1. Go to **Database** > **Extensions** > Enable `pg_cron` and `pg_net`
2. Go to **SQL Editor**
3. Run the schedule commands above

### Option 3: External Scheduler (Alternative)

If pg_cron is not available, use an external service:

**GitHub Actions Example (.github/workflows/cron.yml):**

```yaml
name: Bad Bingo Scheduled Jobs

on:
  schedule:
    # Accrue interest daily at midnight UTC
    - cron: '0 0 * * *'
    # Generate bets 3x daily
    - cron: '0 8 * * *'
    - cron: '0 14 * * *'
    - cron: '0 20 * * *'
  workflow_dispatch: # Manual trigger

jobs:
  accrue-interest:
    if: github.event.schedule == '0 0 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger accrue-interest
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/accrue-interest" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"

  generate-bets:
    if: contains('0 8 * * *,0 14 * * *,0 20 * * *', github.event.schedule) || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger generate-bets
        id: generate
        run: |
          RESPONSE=$(curl -s -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/generate-bets" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json")
          echo "response=$RESPONSE" >> $GITHUB_OUTPUT

      - name: Trigger notify-bet-drop
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/notify-bet-drop" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '${{ steps.generate.outputs.response }}'
```

## Function Details

### accrue-interest

**Purpose:** Accrues daily 10% interest on all active debts and triggers repo seizures.

**Behavior:**
- Fetches all debts with `status = 'active'`
- Skips if interest was already accrued within 24 hours
- Calculates 10% daily interest on remaining balance
- If debt is overdue (past `due_at`):
  - Marks `repo_triggered = true`
  - Decreases borrower's `trust_score` by 10
  - Creates critical notification
  - Sends push notification
- If debt is >7 days overdue:
  - Seizes up to 50% of user's coins
  - Logs repo_seized transaction
  - Sends critical push notification

**Endpoint:** `POST /functions/v1/accrue-interest`

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 debts, skipped 2, 1 overdue, 0 seizures",
  "processed": 5,
  "skipped": 2,
  "overdueTriggered": 1,
  "repoSeizures": 0,
  "pushNotificationsSent": 1,
  "errors": []
}
```

### generate-bets

**Purpose:** Generates shared betting scenarios for all friend pairs using AI.

**Behavior:**
- Determines batch number (1, 2, or 3) based on current time
- Fetches all accepted friendships
- For each unique friend pair:
  - Skips if bets already exist for this batch
  - Generates 3 bets using Gemini AI (or fallback)
  - Stakes are calculated as `wallet / 50` (min 2)
  - Sets 2-hour expiry
  - Creates participant records for both users
- Returns list of users to notify

**Endpoint:** `POST /functions/v1/generate-bets`

**Response:**
```json
{
  "success": true,
  "batchNumber": 2,
  "batchDate": "2024-12-30",
  "expiresAt": "2024-12-30T16:00:00.000Z",
  "betsCreated": 15,
  "pairsProcessed": 5,
  "usersToNotify": ["uuid1", "uuid2", "uuid3"]
}
```

### notify-bet-drop

**Purpose:** Sends push and in-app notifications when new bets are available.

**Behavior:**
- Accepts optional `userIds` array (from generate-bets response)
- If no users specified, notifies all users with accepted friendships
- Creates in-app notification for each user
- Sends FCM push notification to users with registered tokens
- Uses random sarcastic messages from Bad Bingo

**Endpoint:** `POST /functions/v1/notify-bet-drop`

**Request Body (optional):**
```json
{
  "userIds": ["uuid1", "uuid2"],
  "batchNumber": 2,
  "betsCreated": 15
}
```

**Response:**
```json
{
  "success": true,
  "notificationsSent": 10,
  "pushNotificationsSent": 8,
  "errors": []
}
```

### send-push-notification

**Purpose:** Generic push notification sender (used by other services).

**Endpoint:** `POST /functions/v1/send-push-notification`

**Request Body:**
```json
{
  "tokens": ["fcm-token-1", "fcm-token-2"],
  "title": "Bad Bingo",
  "body": "You have a new clash!",
  "data": {
    "type": "clash",
    "clash_id": "uuid"
  },
  "badge": 1,
  "sound": "default"
}
```

## Testing Functions

### Manual Testing

```bash
# Test accrue-interest
curl -X POST \
  "https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/accrue-interest" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Test generate-bets
curl -X POST \
  "https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/generate-bets" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Test notify-bet-drop
curl -X POST \
  "https://wpgrhvdwdvmknhjzpkwz.supabase.co/functions/v1/notify-bet-drop" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["test-user-id"]}'
```

### Local Testing

```bash
# Start Supabase locally
supabase start

# Serve function locally
supabase functions serve generate-bets --env-file .env.local

# Test local function
curl -X POST http://localhost:54321/functions/v1/generate-bets \
  -H "Authorization: Bearer YOUR_LOCAL_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Monitoring

### View Function Logs

```bash
# View logs for a specific function
supabase functions logs accrue-interest

# Follow logs in real-time
supabase functions logs generate-bets --follow
```

### Dashboard Monitoring

1. Go to **Edge Functions** in Supabase Dashboard
2. Click on a function to view invocation logs
3. Check execution time, status codes, and error messages

## Troubleshooting

### Common Issues

1. **"Firebase not configured"**
   - Ensure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set in Supabase secrets

2. **"Failed to fetch debts/friendships"**
   - Check that `bb_debts` and `bb_friendships` tables exist
   - Run migrations if needed

3. **AI bet generation failing**
   - Check `GEMINI_API_KEY` is set correctly
   - Function will fallback to pre-defined bets if AI fails

4. **Push notifications not sending**
   - Verify Firebase credentials are correct
   - Check that `bb_push_tokens` table has valid tokens
   - Ensure user has push_enabled = true

5. **Cron jobs not running**
   - Verify `pg_cron` and `pg_net` extensions are enabled
   - Check `cron.job` table for scheduled jobs
   - Review `cron.job_run_details` for execution history

### Debug Mode

Add `?debug=true` to function URL to get verbose logging (in development only).
