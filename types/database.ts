// Database types for Bad Bingo Supabase tables

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      bb_users: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          username: string;
          name: string;
          age: number;
          gender: string | null;
          bio: string | null;
          avatar_url: string | null;
          city: string | null;
          country: string | null;
          timezone: string | null;
          work: string | null;
          schools: string[] | null;
          has_pets: boolean;
          pet_type: string | null;
          pet_name: string | null;
          sibling_count: number;
          relationship_status: string | null;
          daily_routine: string | null;
          vices: string[] | null;
          triggers: string[] | null;
          common_lies: string[] | null;
          risk_profile: string | null;
          personality_badges: string[] | null;
          coins: number;
          social_debt: number;
          total_earnings: number;
          total_losses: number;
          total_wins: number;
          total_clashes: number;
          win_streak: number;
          best_win_streak: number;
          steals_successful: number;
          steals_defended: number;
          times_robbed: number;
          last_allowance_claimed: string | null;
          last_login: string;
          login_streak: number;
          trust_score: number;
          is_verified: boolean;
          is_banned: boolean;
          ban_reason: string | null;
          strike_count: number;
          push_enabled: boolean;
          sound_enabled: boolean;
          haptics_enabled: boolean;
          created_at: string;
          updated_at: string;
          device_tokens: string[] | null;
        };
        Insert: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          username: string;
          name: string;
          age: number;
          gender?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          timezone?: string | null;
          work?: string | null;
          schools?: string[] | null;
          has_pets?: boolean;
          pet_type?: string | null;
          pet_name?: string | null;
          sibling_count?: number;
          relationship_status?: string | null;
          daily_routine?: string | null;
          vices?: string[] | null;
          triggers?: string[] | null;
          common_lies?: string[] | null;
          risk_profile?: string | null;
          personality_badges?: string[] | null;
          coins?: number;
          social_debt?: number;
          total_earnings?: number;
          total_losses?: number;
          total_wins?: number;
          total_clashes?: number;
          win_streak?: number;
          best_win_streak?: number;
          steals_successful?: number;
          steals_defended?: number;
          times_robbed?: number;
          last_allowance_claimed?: string | null;
          last_login?: string;
          login_streak?: number;
          trust_score?: number;
          is_verified?: boolean;
          is_banned?: boolean;
          ban_reason?: string | null;
          strike_count?: number;
          push_enabled?: boolean;
          sound_enabled?: boolean;
          haptics_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          device_tokens?: string[] | null;
        };
        Update: Partial<Database['public']['Tables']['bb_users']['Insert']>;
      };
      bb_friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked' | 'rejected';
          initiated_by: string;
          heat_level: 1 | 2 | 3;
          user_proposed_heat: number | null;
          friend_proposed_heat: number | null;
          heat_confirmed: boolean;
          heat_changed_at: string | null;
          // New heat proposal fields for mutual consent
          heat_level_proposed: number | null;
          heat_level_proposed_by: string | null;
          heat_level_proposed_at: string | null;
          relationship_description: string | null;
          trust_score: number;
          total_bets: number;
          wins_against_friend: number;
          location_relationship: 'same_city' | 'different_city' | 'ldr' | 'unknown' | null;
          distance_km: number | null;
          created_at: string;
          accepted_at: string | null;
          // Questionnaire fields
          user_questionnaire_completed: boolean;
          user_questionnaire_completed_at: string | null;
          friend_questionnaire_completed: boolean;
          friend_questionnaire_completed_at: string | null;
          questionnaire_reward_claimed: boolean;
          questionnaire_reward_claimed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked' | 'rejected';
          initiated_by: string;
          heat_level?: 1 | 2 | 3;
          user_proposed_heat?: number | null;
          friend_proposed_heat?: number | null;
          heat_confirmed?: boolean;
          heat_changed_at?: string | null;
          // New heat proposal fields for mutual consent
          heat_level_proposed?: number | null;
          heat_level_proposed_by?: string | null;
          heat_level_proposed_at?: string | null;
          relationship_description?: string | null;
          trust_score?: number;
          total_bets?: number;
          wins_against_friend?: number;
          location_relationship?: 'same_city' | 'different_city' | 'ldr' | 'unknown' | null;
          distance_km?: number | null;
          created_at?: string;
          accepted_at?: string | null;
          // Questionnaire fields
          user_questionnaire_completed?: boolean;
          user_questionnaire_completed_at?: string | null;
          friend_questionnaire_completed?: boolean;
          friend_questionnaire_completed_at?: string | null;
          questionnaire_reward_claimed?: boolean;
          questionnaire_reward_claimed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bb_friendships']['Insert']>;
      };
      bb_bets: {
        Row: {
          id: string;
          text: string;
          category: string | null;
          background_type: string;
          base_stake: number;
          proof_type: 'photo' | 'video' | 'location' | 'time' | 'confirm';
          creator_id: string | null;
          target_type: 'single' | 'multiple' | 'all';
          target_users: string[] | null;
          heat_level_required: number;
          batch_number: number | null;
          batch_date: string | null;
          available_at: string;
          expires_at: string;
          is_approved: boolean;
          flagged_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          category?: string | null;
          background_type?: string;
          base_stake: number;
          proof_type?: 'photo' | 'video' | 'location' | 'time' | 'confirm';
          creator_id?: string | null;
          target_type?: 'single' | 'multiple' | 'all';
          target_users?: string[] | null;
          heat_level_required?: number;
          batch_number?: number | null;
          batch_date?: string | null;
          available_at?: string;
          expires_at: string;
          is_approved?: boolean;
          flagged_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_bets']['Insert']>;
      };
      bb_bet_participants: {
        Row: {
          id: string;
          bet_id: string;
          user_id: string;
          swipe: 'yes' | 'no' | null;
          swiped_at: string | null;
          stake_amount: number;
          stake_locked: boolean;
        };
        Insert: {
          id?: string;
          bet_id: string;
          user_id: string;
          swipe?: 'yes' | 'no' | null;
          swiped_at?: string | null;
          stake_amount?: number;
          stake_locked?: boolean;
        };
        Update: Partial<Database['public']['Tables']['bb_bet_participants']['Insert']>;
      };
      bb_clashes: {
        Row: {
          id: string;
          bet_id: string;
          user1_id: string;
          user2_id: string;
          user1_swipe: string;
          user2_swipe: string;
          user1_stake: number;
          user2_stake: number;
          total_pot: number;
          status: 'pending_proof' | 'proof_submitted' | 'reviewing' | 'disputed' | 'completed' | 'expired' | 'forfeited';
          prover_id: string | null;
          proof_url: string | null;
          proof_type: string | null;
          proof_submitted_at: string | null;
          proof_deadline: string | null;
          proof_view_duration: number | null;
          proof_is_view_once: boolean;
          proof_viewed_at: string | null;
          proof_expired: boolean;
          winner_id: string | null;
          loser_id: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          disputed_by: string | null;
          dispute_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bet_id: string;
          user1_id: string;
          user2_id: string;
          user1_swipe: string;
          user2_swipe: string;
          user1_stake: number;
          user2_stake: number;
          total_pot: number;
          status?: 'pending_proof' | 'proof_submitted' | 'reviewing' | 'disputed' | 'completed' | 'expired' | 'forfeited';
          prover_id?: string | null;
          proof_url?: string | null;
          proof_type?: string | null;
          proof_submitted_at?: string | null;
          proof_deadline?: string | null;
          proof_view_duration?: number | null;
          proof_is_view_once?: boolean;
          proof_viewed_at?: string | null;
          proof_expired?: boolean;
          winner_id?: string | null;
          loser_id?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          disputed_by?: string | null;
          dispute_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_clashes']['Insert']>;
      };
      bb_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          balance_after: number;
          type: 'allowance' | 'clash_stake_lock' | 'clash_win' | 'clash_loss' | 'steal_success' | 'steal_victim' | 'steal_penalty' | 'defend_bonus' | 'beg_received' | 'beg_given' | 'borrow' | 'repay' | 'interest' | 'repo_seized' | 'login_bonus' | 'streak_bonus' | 'penalty' | 'friend_bonus';
          reference_type: string | null;
          reference_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          balance_after: number;
          type: 'allowance' | 'clash_stake_lock' | 'clash_win' | 'clash_loss' | 'steal_success' | 'steal_victim' | 'steal_penalty' | 'defend_bonus' | 'beg_received' | 'beg_given' | 'borrow' | 'repay' | 'interest' | 'repo_seized' | 'login_bonus' | 'streak_bonus' | 'penalty' | 'friend_bonus';
          reference_type?: string | null;
          reference_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_transactions']['Insert']>;
      };
      bb_steals: {
        Row: {
          id: string;
          thief_id: string;
          target_id: string;
          steal_percentage: number | null;
          potential_amount: number | null;
          actual_amount: number | null;
          target_was_online: boolean | null;
          defense_window_start: string | null;
          defense_window_end: string | null;
          was_defended: boolean;
          defended_at: string | null;
          status: 'in_progress' | 'success' | 'defended' | 'failed';
          thief_penalty: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          thief_id: string;
          target_id: string;
          steal_percentage?: number | null;
          potential_amount?: number | null;
          actual_amount?: number | null;
          target_was_online?: boolean | null;
          defense_window_start?: string | null;
          defense_window_end?: string | null;
          was_defended?: boolean;
          defended_at?: string | null;
          status?: 'in_progress' | 'success' | 'defended' | 'failed';
          thief_penalty?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bb_steals']['Insert']>;
      };
      bb_notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          priority: 'critical' | 'high' | 'medium' | 'normal';
          reference_type: string | null;
          reference_id: string | null;
          read: boolean;
          read_at: string | null;
          push_sent: boolean;
          push_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          priority?: 'critical' | 'high' | 'medium' | 'normal';
          reference_type?: string | null;
          reference_id?: string | null;
          read?: boolean;
          read_at?: string | null;
          push_sent?: boolean;
          push_sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_notifications']['Insert']>;
      };
      bb_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_type: string;
          badge_name: string;
          badge_description: string | null;
          is_shame_badge: boolean;
          icon: string | null;
          color: string | null;
          earned_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          badge_name: string;
          badge_description?: string | null;
          is_shame_badge?: boolean;
          icon?: string | null;
          color?: string | null;
          earned_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bb_badges']['Insert']>;
      };
      bb_debts: {
        Row: {
          id: string;
          borrower_id: string;
          lender_id: string | null;
          principal: number;
          interest_rate: number;
          accrued_interest: number;
          amount_repaid: number;
          status: 'active' | 'repaid' | 'defaulted' | 'repo_triggered';
          repo_triggered: boolean;
          repo_triggered_at: string | null;
          seized_amount: number;
          created_at: string;
          due_at: string | null;
          last_interest_calc: string;
        };
        Insert: {
          id?: string;
          borrower_id: string;
          lender_id?: string | null;
          principal: number;
          interest_rate?: number;
          accrued_interest?: number;
          amount_repaid?: number;
          status?: 'active' | 'repaid' | 'defaulted' | 'repo_triggered';
          repo_triggered?: boolean;
          repo_triggered_at?: string | null;
          seized_amount?: number;
          created_at?: string;
          due_at?: string | null;
          last_interest_calc?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_debts']['Insert']>;
      };
      bb_begs: {
        Row: {
          id: string;
          beggar_id: string;
          target_id: string;
          dare_type: string | null;
          dare_text: string | null;
          dare_assigned_at: string | null;
          proof_url: string | null;
          proof_submitted_at: string | null;
          reward_amount: number;
          status: 'pending' | 'dare_assigned' | 'proof_submitted' | 'completed' | 'rejected' | 'expired';
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          beggar_id: string;
          target_id: string;
          dare_type?: string | null;
          dare_text?: string | null;
          dare_assigned_at?: string | null;
          proof_url?: string | null;
          proof_submitted_at?: string | null;
          reward_amount?: number;
          status?: 'pending' | 'dare_assigned' | 'proof_submitted' | 'completed' | 'rejected' | 'expired';
          created_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bb_begs']['Insert']>;
      };
      bb_proofs: {
        Row: {
          id: string;
          clash_id: string | null;
          uploader_id: string;
          storage_bucket: string;
          storage_path: string;
          encryption_key_id: string | null;
          media_type: 'photo' | 'video' | null;
          duration_seconds: number | null;
          captured_at: string | null;
          device_info: string | null;
          location_lat: number | null;
          location_lng: number | null;
          location_verified: boolean;
          view_count: number;
          max_views: number;
          view_duration_hours: number;
          expires_at: string | null;
          is_destroyed: boolean;
          screenshot_detected: boolean;
          screenshot_detected_at: string | null;
          screenshot_penalty_applied: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          clash_id?: string | null;
          uploader_id: string;
          storage_bucket: string;
          storage_path: string;
          encryption_key_id?: string | null;
          media_type?: 'photo' | 'video' | null;
          duration_seconds?: number | null;
          captured_at?: string | null;
          device_info?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          location_verified?: boolean;
          view_count?: number;
          max_views?: number;
          view_duration_hours?: number;
          expires_at?: string | null;
          is_destroyed?: boolean;
          screenshot_detected?: boolean;
          screenshot_detected_at?: string | null;
          screenshot_penalty_applied?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_proofs']['Insert']>;
      };
      bb_reports: {
        Row: {
          id: string;
          reporter_id: string;
          content_type: string;
          content_id: string | null;
          reported_user_id: string | null;
          reason: string;
          description: string | null;
          status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
          reviewed_by: string | null;
          reviewed_at: string | null;
          resolution: string | null;
          action_taken: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          content_type: string;
          content_id?: string | null;
          reported_user_id?: string | null;
          reason: string;
          description?: string | null;
          status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          resolution?: string | null;
          action_taken?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bb_reports']['Insert']>;
      };
    };
    Functions: {
      bb_calculate_stake: {
        Args: { wallet_balance: number };
        Returns: number;
      };
      bb_random_steal_percentage: {
        Args: Record<string, never>;
        Returns: number;
      };
      bb_can_claim_allowance: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      bb_claim_allowance: {
        Args: { user_uuid: string };
        Returns: number;
      };
      bb_lock_stake: {
        Args: { user_uuid: string; stake_amount: number };
        Returns: boolean;
      };
      bb_award_clash_win: {
        Args: { winner_uuid: string; loser_uuid: string; clash_uuid: string; total_pot: number };
        Returns: void;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type DBUser = Database['public']['Tables']['bb_users']['Row'];
export type DBUserInsert = Database['public']['Tables']['bb_users']['Insert'];
export type DBFriendship = Database['public']['Tables']['bb_friendships']['Row'];
export type DBBet = Database['public']['Tables']['bb_bets']['Row'];
export type DBBetParticipant = Database['public']['Tables']['bb_bet_participants']['Row'];
export type DBClash = Database['public']['Tables']['bb_clashes']['Row'];
export type DBTransaction = Database['public']['Tables']['bb_transactions']['Row'];
export type DBSteal = Database['public']['Tables']['bb_steals']['Row'];
export type DBNotification = Database['public']['Tables']['bb_notifications']['Row'];
export type DBBadge = Database['public']['Tables']['bb_badges']['Row'];
export type DBDebt = Database['public']['Tables']['bb_debts']['Row'];
export type DBBeg = Database['public']['Tables']['bb_begs']['Row'];
export type DBProof = Database['public']['Tables']['bb_proofs']['Row'];
