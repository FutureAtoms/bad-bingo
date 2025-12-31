import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');

interface PushNotificationRequest {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

interface FCMMessage {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: string;
    notification: {
      sound: string;
      channel_id: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge?: number;
      };
    };
  };
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
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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
async function sendFCMMessage(accessToken: string, message: FCMMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('FCM error:', errorData);
      return { success: false, error: errorData.error?.message || 'FCM send failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('FCM send exception:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Validate environment
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      console.error('Missing Firebase configuration');
      return new Response(
        JSON.stringify({ error: 'Firebase not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: PushNotificationRequest = await req.json();
    const { tokens, title, body: messageBody, data, badge, sound } = body;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tokens provided' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate access token
    const accessToken = await generateJWT();

    // Convert data to string values (FCM requirement)
    const stringData: Record<string, string> = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    // Send to all tokens in parallel
    const results = await Promise.all(
      tokens.map(async (token) => {
        const message: FCMMessage = {
          token,
          notification: {
            title,
            body: messageBody,
          },
          data: stringData,
          android: {
            priority: 'high',
            notification: {
              sound: sound || 'default',
              channel_id: 'bad_bingo_notifications',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: sound || 'default',
                badge: badge,
              },
            },
          },
        };

        return sendFCMMessage(accessToken, message);
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const errors = results.filter((r) => r.error).map((r) => r.error);

    console.log(`Push notifications sent: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
