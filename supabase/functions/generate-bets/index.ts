import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Batch schedule: 8:00, 14:00, 20:00 UTC
const BATCH_TIMES = [8, 14, 20];
const BETS_PER_PAIR = 3;
const BET_EXPIRY_HOURS = 2;

interface FriendPair {
  userId: string;
  friendId: string;
  friendName: string;
  heatLevel: 1 | 2 | 3;
  userRiskProfile: string;
  userCoins: number;
}

interface GeneratedBet {
  text: string;
  backgroundType: string;
  category: string;
  stake: number;
  proofType: string;
}

// Get current batch number (1, 2, or 3 based on time of day)
function getCurrentBatchNumber(): number {
  const hour = new Date().getUTCHours();
  if (hour >= 8 && hour < 14) return 1;
  if (hour >= 14 && hour < 20) return 2;
  return 3;
}

// Calculate stake based on wallet balance (wallet/50, min 2)
function calculateStake(walletBalance: number): number {
  return Math.max(2, Math.floor(walletBalance / 50));
}

// Generate bets using Gemini AI
async function generateBetsWithAI(
  genAI: GoogleGenerativeAI,
  friendName: string,
  heatLevel: 1 | 2 | 3,
  userRiskProfile: string
): Promise<GeneratedBet[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    let intensityDesc = '';
    let examples = '';

    if (heatLevel === 1) {
      intensityDesc = 'SAFE/CIVILIAN - Keep it light. Work appropriate. Nothing embarrassing.';
      examples = `
        GOOD EXAMPLES:
        - "${friendName} will be late to something today"
        - "${friendName} hasn't made their bed yet"
        - "${friendName} will check their phone within 5 minutes"
      `;
    } else if (heatLevel === 2) {
      intensityDesc = 'ROAST/FAIR GAME - Embarrassing but not cruel. Call out bad habits.';
      examples = `
        GOOD EXAMPLES:
        - "${friendName} has dirty dishes in their sink right now"
        - "${friendName} is wearing the same outfit they wore yesterday"
        - "${friendName} will cancel plans this weekend"
      `;
    } else {
      intensityDesc = 'NUCLEAR/NO MERCY - Spicy, personal, maximum chaos.';
      examples = `
        GOOD EXAMPLES:
        - "${friendName} isn't where they say they are right now"
        - "${friendName} has stalked an ex's profile this week"
        - "${friendName} lied about why they couldn't hang out"
      `;
    }

    const prompt = `
      You are Bad Bingo, a savage, sarcastic gambling cat.
      Generate ${BETS_PER_PAIR} betting scenarios about ${friendName}.

      USER CONTEXT: ${userRiskProfile || 'Unknown risk profile'}
      INTENSITY LEVEL: ${intensityDesc}
      ${examples}

      RULES:
      1. Each bet must be SPECIFIC and VERIFIABLE (provable with photo/video)
      2. Make them FUNNY and RELATABLE
      3. Mix timeframes: "right now", "today", "this week"
      4. Stakes should be 10-50 for safe, 30-80 for roast, 50-100 for nuclear

      Return ONLY a valid JSON array with objects containing:
      - text: string (the bet statement)
      - backgroundType: string (bedroom, gym, club, street, office)
      - category: string (Habits, Lifestyle, Social, Romance, Work, Chaos)
      - stake: number (bingos amount)
      - proofType: string (photo, video, screenshot, confession)
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((item: any) => ({
      text: item.text || `${friendName} is up to something suspicious`,
      backgroundType: item.backgroundType || 'bedroom',
      category: item.category || 'General',
      stake: item.stake || 25,
      proofType: item.proofType || 'photo',
    }));
  } catch (error) {
    console.error('[generate-bets] AI generation failed:', error);
    // Return fallback bets
    return getFallbackBets(friendName, heatLevel);
  }
}

// Fallback bets when AI fails
function getFallbackBets(friendName: string, heatLevel: 1 | 2 | 3): GeneratedBet[] {
  const baseBets = [
    { text: `${friendName} is procrastinating on something right now`, category: 'Habits', stake: 20, bg: 'bedroom' },
    { text: `${friendName} has at least 3 unread notifications`, category: 'Social', stake: 15, bg: 'office' },
    { text: `${friendName} will check social media in the next 10 minutes`, category: 'Lifestyle', stake: 25, bg: 'bedroom' },
  ];

  const roastBets = [
    { text: `${friendName} hasn't drunk enough water today`, category: 'Health', stake: 30, bg: 'office' },
    { text: `${friendName} is wearing something questionable right now`, category: 'Style', stake: 35, bg: 'bedroom' },
    { text: `${friendName} will complain about being tired today`, category: 'Habits', stake: 30, bg: 'office' },
  ];

  const nuclearBets = [
    { text: `${friendName} is lying about something today`, category: 'Chaos', stake: 60, bg: 'street' },
    { text: `${friendName} has a guilty pleasure they haven't admitted`, category: 'Secrets', stake: 70, bg: 'bedroom' },
    { text: `${friendName} did something embarrassing this week`, category: 'Chaos', stake: 80, bg: 'club' },
  ];

  const selectedBets = heatLevel === 1 ? baseBets : heatLevel === 2 ? roastBets : nuclearBets;

  return selectedBets.map((bet) => ({
    text: bet.text,
    backgroundType: bet.bg,
    category: bet.category,
    stake: bet.stake,
    proofType: 'photo',
  }));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Gemini AI
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('VITE_GEMINI_API_KEY');
    const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

    const batchNumber = getCurrentBatchNumber();
    const batchDate = new Date().toISOString().split('T')[0];
    const expiresAt = new Date(Date.now() + BET_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    console.log(`[generate-bets] Starting batch ${batchNumber} for ${batchDate}`);

    // Get all accepted friendships
    const { data: friendships, error: friendshipError } = await supabase
      .from('bb_friendships')
      .select(`
        user_id,
        friend_id,
        heat_level,
        friend:bb_users!bb_friendships_friend_id_fkey(id, name, risk_profile, coins)
      `)
      .eq('status', 'accepted');

    if (friendshipError) {
      throw new Error(`Failed to fetch friendships: ${friendshipError.message}`);
    }

    // Build unique friend pairs (avoid duplicates like A-B and B-A)
    const processedPairs = new Set<string>();
    const friendPairs: FriendPair[] = [];

    for (const friendship of friendships || []) {
      const pairKey = [friendship.user_id, friendship.friend_id].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const friend = friendship.friend as any;
      if (!friend) continue;

      // Get user info
      const { data: user } = await supabase
        .from('bb_users')
        .select('risk_profile, coins')
        .eq('id', friendship.user_id)
        .single();

      if (!user) continue;

      friendPairs.push({
        userId: friendship.user_id,
        friendId: friendship.friend_id,
        friendName: friend.name,
        heatLevel: friendship.heat_level as 1 | 2 | 3,
        userRiskProfile: user.risk_profile || '',
        userCoins: user.coins,
      });
    }

    console.log(`[generate-bets] Processing ${friendPairs.length} friend pairs`);

    const results = {
      betsCreated: 0,
      pairsProcessed: 0,
      errors: [] as string[],
      usersToNotify: new Set<string>(),
    };

    // Generate bets for each friend pair
    for (const pair of friendPairs) {
      try {
        // Check if bets already exist for this pair in this batch
        const { data: existingBets } = await supabase
          .from('bb_bets')
          .select('id')
          .eq('batch_number', batchNumber)
          .eq('batch_date', batchDate)
          .contains('target_users', [pair.userId, pair.friendId])
          .limit(1);

        if (existingBets && existingBets.length > 0) {
          console.log(`[generate-bets] Skipping pair ${pair.userId}-${pair.friendId} - already has bets for this batch`);
          continue;
        }

        // Generate bets using AI or fallback
        const generatedBets = genAI
          ? await generateBetsWithAI(genAI, pair.friendName, pair.heatLevel, pair.userRiskProfile)
          : getFallbackBets(pair.friendName, pair.heatLevel);

        const stake = calculateStake(pair.userCoins);

        // Create bets in database
        for (const bet of generatedBets) {
          const { data: createdBet, error: betError } = await supabase
            .from('bb_bets')
            .insert({
              text: bet.text,
              category: bet.category,
              background_type: bet.backgroundType,
              base_stake: stake,
              proof_type: bet.proofType === 'video' ? 'video' : 'photo',
              creator_id: null, // AI generated
              target_type: 'single',
              target_users: [pair.userId, pair.friendId],
              heat_level_required: pair.heatLevel,
              batch_number: batchNumber,
              batch_date: batchDate,
              expires_at: expiresAt,
              is_approved: true,
            })
            .select()
            .single();

          if (betError) {
            results.errors.push(`Bet creation failed for ${pair.userId}-${pair.friendId}: ${betError.message}`);
            continue;
          }

          // Create participant records for both users
          await supabase.from('bb_bet_participants').insert([
            { bet_id: createdBet.id, user_id: pair.userId, stake_amount: stake },
            { bet_id: createdBet.id, user_id: pair.friendId, stake_amount: stake },
          ]);

          results.betsCreated++;
          results.usersToNotify.add(pair.userId);
          results.usersToNotify.add(pair.friendId);
        }

        results.pairsProcessed++;
      } catch (err) {
        results.errors.push(`Pair ${pair.userId}-${pair.friendId}: ${(err as Error).message}`);
      }
    }

    console.log(
      `[generate-bets] Complete: ${results.betsCreated} bets created for ${results.pairsProcessed} pairs`
    );

    // Return list of users to notify (for the notify-bet-drop function)
    return new Response(
      JSON.stringify({
        success: true,
        batchNumber,
        batchDate,
        expiresAt,
        betsCreated: results.betsCreated,
        pairsProcessed: results.pairsProcessed,
        usersToNotify: Array.from(results.usersToNotify),
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[generate-bets] Error:', error);

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
