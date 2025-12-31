import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');

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

// Send critical push notification for overdue debt
async function sendCriticalPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  debtId: string
): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return false;
  }

  try {
    // Get user's push tokens
    const { data: tokens } = await supabase
      .from('bb_push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) {
      return false;
    }

    const accessToken = await generateJWT();

    for (const { token } of tokens) {
      await fetch(
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
              data: {
                type: 'debt_overdue',
                action: 'open_borrow',
                debt_id: debtId,
              },
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  channel_id: 'bad_bingo_critical',
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              },
            },
          }),
        }
      );
    }

    return true;
  } catch (error) {
    console.error('[accrue-interest] Push notification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active debts
    const { data: debts, error: fetchError } = await supabase
      .from('bb_debts')
      .select('*')
      .eq('status', 'active');

    if (fetchError) {
      throw new Error(`Failed to fetch debts: ${fetchError.message}`);
    }

    const results = {
      processed: 0,
      skipped: 0,
      overdueTriggered: 0,
      repoSeizures: 0,
      pushNotificationsSent: 0,
      errors: [] as string[],
    };

    const now = new Date();

    for (const debt of debts || []) {
      try {
        // Check if interest was already accrued in the last 24 hours
        const lastAccrual = debt.last_interest_accrual
          ? new Date(debt.last_interest_accrual)
          : new Date(debt.created_at);
        const hoursSinceAccrual = (now.getTime() - lastAccrual.getTime()) / (1000 * 60 * 60);

        if (hoursSinceAccrual < 24) {
          results.skipped++;
          continue;
        }

        // Calculate daily interest (10% on remaining balance)
        const totalOwed = debt.principal + debt.accrued_interest - debt.amount_repaid;
        const dailyInterest = Math.ceil(totalOwed * debt.interest_rate);
        const newAccruedInterest = debt.accrued_interest + dailyInterest;

        // Update debt with new interest
        const { error: updateError } = await supabase
          .from('bb_debts')
          .update({
            accrued_interest: newAccruedInterest,
            last_interest_accrual: now.toISOString(),
          })
          .eq('id', debt.id);

        if (updateError) {
          results.errors.push(`Debt ${debt.id}: ${updateError.message}`);
          continue;
        }

        results.processed++;

        // Check if debt is overdue
        const dueDate = new Date(debt.due_at);
        const daysOverdue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysOverdue > 0 && !debt.repo_triggered) {
          // Mark debt as repo triggered
          await supabase
            .from('bb_debts')
            .update({
              repo_triggered: true,
              repo_triggered_at: now.toISOString(),
            })
            .eq('id', debt.id);

          // Decrease user trust score
          const { data: user } = await supabase
            .from('bb_users')
            .select('trust_score, coins')
            .eq('id', debt.borrower_id)
            .single();

          if (user) {
            const newTrustScore = Math.max(0, user.trust_score - 10);
            await supabase
              .from('bb_users')
              .update({ trust_score: newTrustScore })
              .eq('id', debt.borrower_id);
          }

          // Create critical notification
          const newTotalOwed = totalOwed + dailyInterest;
          await supabase.from('bb_notifications').insert({
            user_id: debt.borrower_id,
            type: 'debt_overdue',
            title: 'Debt Overdue!',
            message: `Your debt of ${newTotalOwed} bingos is overdue! Pay up or your reputation suffers. Interest keeps piling up.`,
            priority: 'critical',
            reference_type: 'debt',
            reference_id: debt.id,
          });

          // Send critical push notification
          const pushSent = await sendCriticalPush(
            supabase,
            debt.borrower_id,
            'DEBT OVERDUE',
            `You owe ${newTotalOwed} bingos! Pay now or face repo.`,
            debt.id
          );

          if (pushSent) {
            results.pushNotificationsSent++;
          }

          results.overdueTriggered++;
        }

        // Check if debt is severely overdue (> 7 days) - trigger repo seizure
        if (daysOverdue > 7 && debt.repo_triggered && !debt.seized_amount) {
          const { data: user } = await supabase
            .from('bb_users')
            .select('coins')
            .eq('id', debt.borrower_id)
            .single();

          if (user && user.coins > 0) {
            // Seize up to 50% of user's coins or remaining debt, whichever is less
            const newTotalOwed = totalOwed + dailyInterest;
            const maxSeizure = Math.floor(user.coins * 0.5);
            const seizureAmount = Math.min(maxSeizure, newTotalOwed);

            if (seizureAmount > 0) {
              // Update user coins
              const newBalance = user.coins - seizureAmount;
              await supabase
                .from('bb_users')
                .update({ coins: newBalance })
                .eq('id', debt.borrower_id);

              // Update debt with seizure
              await supabase
                .from('bb_debts')
                .update({
                  seized_amount: seizureAmount,
                  amount_repaid: debt.amount_repaid + seizureAmount,
                  status: seizureAmount >= newTotalOwed ? 'repaid' : 'repo_triggered',
                })
                .eq('id', debt.id);

              // Log transaction
              await supabase.from('bb_transactions').insert({
                user_id: debt.borrower_id,
                amount: -seizureAmount,
                balance_after: newBalance,
                type: 'repo_seized',
                reference_type: 'debt',
                reference_id: debt.id,
                description: `Repo man came knocking. ${seizureAmount} bingos seized for unpaid debt.`,
              });

              // Create notification
              await supabase.from('bb_notifications').insert({
                user_id: debt.borrower_id,
                type: 'repo_seized',
                title: 'REPO SEIZURE',
                message: `The repo cat took ${seizureAmount} bingos from your wallet. Should have paid your debts, kitten.`,
                priority: 'critical',
                reference_type: 'debt',
                reference_id: debt.id,
              });

              // Send critical push
              await sendCriticalPush(
                supabase,
                debt.borrower_id,
                'REPO SEIZURE',
                `${seizureAmount} bingos seized from your wallet. Debts have consequences.`,
                debt.id
              );

              results.repoSeizures++;
            }
          }
        }
      } catch (err) {
        results.errors.push(`Debt ${debt.id}: ${(err as Error).message}`);
      }
    }

    console.log('[accrue-interest] Results:', JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} debts, skipped ${results.skipped}, ${results.overdueTriggered} overdue, ${results.repoSeizures} seizures`,
        ...results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[accrue-interest] Error:', error);

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
