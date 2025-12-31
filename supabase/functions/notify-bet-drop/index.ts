import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');

// Sarcastic notification messages from Bad Bingo
const BET_DROP_MESSAGES = [
  'New bets dropped! Time to bet on your friends being trash.',
  'Fresh bets just landed. Your friends are already losing.',
  'Bet drop alert! Someone is about to eat dirt.',
  'New bets are here. Expose your friends or be exposed.',
  'Bingo dropped some spicy bets. Get swiping, kitten.',
  'Your daily dose of chaos just arrived. New bets waiting.',
  'New bets incoming! May the odds never be in your favor.',
  'Fresh betting content just dropped. Your friends are scared.',
];

// Get random message
function getRandomMessage(): string {
  return BET_DROP_MESSAGES[Math.floor(Math.random() * BET_DROP_MESSAGES.length)];
}

// Generate JWT for Firebase Auth
async function generateJWT(): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: FIREBASE_CLIENT_EMAIL,
    sub: FIREBASE_CLIENT_EMAIL,
    aud: 'https://fcm.googleapis.com/',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const privateKeyPEM = FIREBASE_PRIVATE_KEY;
  const pemContents = privateKeyPEM
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

// Send FCM message to a single token
async function sendFCMMessage(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title,
              body,
            },
            data,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'bad_bingo_bets',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error?.message || 'FCM send failed' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate Firebase configuration
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      console.warn('[notify-bet-drop] Firebase not configured - skipping push notifications');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body (optional - can provide specific user IDs)
    let userIds: string[] = [];
    let batchInfo: { batchNumber?: number; betsCreated?: number } = {};

    try {
      const body = await req.json();
      userIds = body.userIds || body.usersToNotify || [];
      batchInfo = {
        batchNumber: body.batchNumber,
        betsCreated: body.betsCreated,
      };
    } catch {
      // No body provided - notify all users with active friendships
    }

    // If no specific users provided, get all users who have friendships
    if (userIds.length === 0) {
      const { data: friendships } = await supabase
        .from('bb_friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted');

      const uniqueUsers = new Set<string>();
      for (const f of friendships || []) {
        uniqueUsers.add(f.user_id);
        uniqueUsers.add(f.friend_id);
      }
      userIds = Array.from(uniqueUsers);
    }

    console.log(`[notify-bet-drop] Notifying ${userIds.length} users`);

    const results = {
      notificationsSent: 0,
      pushNotificationsSent: 0,
      errors: [] as string[],
    };

    // Create in-app notifications for all users
    const notificationInserts = userIds.map((userId) => ({
      user_id: userId,
      type: 'bet_drop',
      title: 'New Bets Available!',
      message: getRandomMessage(),
      priority: 'normal',
      reference_type: 'batch',
      reference_id: null,
    }));

    if (notificationInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('bb_notifications')
        .insert(notificationInserts);

      if (insertError) {
        results.errors.push(`In-app notification insert failed: ${insertError.message}`);
      } else {
        results.notificationsSent = notificationInserts.length;
      }
    }

    // Send push notifications if Firebase is configured
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      // Get push tokens for all users
      const { data: pushTokens } = await supabase
        .from('bb_push_tokens')
        .select('user_id, token')
        .in('user_id', userIds);

      if (pushTokens && pushTokens.length > 0) {
        const accessToken = await generateJWT();
        const title = 'Bad Bingo';
        const body = getRandomMessage();
        const data = {
          type: 'bet_drop',
          action: 'open_swipe_feed',
          batch_number: String(batchInfo.batchNumber || 0),
        };

        // Send push notifications in parallel (batch of 10 at a time)
        const batchSize = 10;
        for (let i = 0; i < pushTokens.length; i += batchSize) {
          const batch = pushTokens.slice(i, i + batchSize);
          const pushResults = await Promise.all(
            batch.map((t) => sendFCMMessage(accessToken, t.token, title, body, data))
          );

          for (const result of pushResults) {
            if (result.success) {
              results.pushNotificationsSent++;
            } else if (result.error) {
              results.errors.push(result.error);
            }
          }
        }

        // Mark notifications as push_sent
        await supabase
          .from('bb_notifications')
          .update({
            push_sent: true,
            push_sent_at: new Date().toISOString(),
          })
          .in('user_id', userIds)
          .eq('type', 'bet_drop')
          .is('push_sent', false);
      }
    }

    console.log(
      `[notify-bet-drop] Complete: ${results.notificationsSent} in-app, ${results.pushNotificationsSent} push`
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[notify-bet-drop] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
