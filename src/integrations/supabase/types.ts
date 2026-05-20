export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bonus_points: {
        Row: {
          breakdown: Json
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bonus_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_predictions: {
        Row: {
          clean_sheet_country: string | null
          created_at: string
          early_exit_country: string | null
          final_away_score: number | null
          final_away_team: string | null
          final_home_score: number | null
          final_home_team: string | null
          id: string
          is_locked: boolean
          topscorer_country: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clean_sheet_country?: string | null
          created_at?: string
          early_exit_country?: string | null
          final_away_score?: number | null
          final_away_team?: string | null
          final_home_score?: number | null
          final_home_team?: string | null
          id?: string
          is_locked?: boolean
          topscorer_country?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clean_sheet_country?: string | null
          created_at?: string
          early_exit_country?: string | null
          final_away_score?: number | null
          final_away_team?: string | null
          final_home_score?: number | null
          final_home_team?: string | null
          id?: string
          is_locked?: boolean
          topscorer_country?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bonus_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_results: {
        Row: {
          clean_sheet_countries: string[] | null
          early_exit_country: string | null
          final_away_score: number | null
          final_away_team: string | null
          final_home_score: number | null
          final_home_team: string | null
          id: string
          singleton: boolean
          topscorer_country: string | null
          updated_at: string
        }
        Insert: {
          clean_sheet_countries?: string[] | null
          early_exit_country?: string | null
          final_away_score?: number | null
          final_away_team?: string | null
          final_home_score?: number | null
          final_home_team?: string | null
          id?: string
          singleton?: boolean
          topscorer_country?: string | null
          updated_at?: string
        }
        Update: {
          clean_sheet_countries?: string[] | null
          early_exit_country?: string | null
          final_away_score?: number | null
          final_away_team?: string | null
          final_home_score?: number | null
          final_home_team?: string | null
          id?: string
          singleton?: boolean
          topscorer_country?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bonus_tournament_stats: {
        Row: {
          clean_sheet_countries: string[]
          clean_sheet_leader_count: number
          clean_sheets_by_country: Json
          goals_by_country: Json
          id: string
          singleton: boolean
          top10_eliminated_in_groups: string | null
          topscorer_countries: string[]
          updated_at: string
        }
        Insert: {
          clean_sheet_countries?: string[]
          clean_sheet_leader_count?: number
          clean_sheets_by_country?: Json
          goals_by_country?: Json
          id?: string
          singleton?: boolean
          top10_eliminated_in_groups?: string | null
          topscorer_countries?: string[]
          updated_at?: string
        }
        Update: {
          clean_sheet_countries?: string[]
          clean_sheet_leader_count?: number
          clean_sheets_by_country?: Json
          goals_by_country?: Json
          id?: string
          singleton?: boolean
          top10_eliminated_in_groups?: string | null
          topscorer_countries?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      email_digest_log: {
        Row: {
          duration_ms: number
          id: string
          matches_count: number
          message: string | null
          ran_at: string
          recipients_count: number
          status: string
        }
        Insert: {
          duration_ms?: number
          id?: string
          matches_count?: number
          message?: string | null
          ran_at?: string
          recipients_count?: number
          status: string
        }
        Update: {
          duration_ms?: number
          id?: string
          matches_count?: number
          message?: string | null
          ran_at?: string
          recipients_count?: number
          status?: string
        }
        Relationships: []
      }
      match_stats: {
        Row: {
          api_fixture_id: number | null
          away_goals_detail: Json
          away_red_cards: number
          away_yellow_cards: number
          created_at: string
          home_goals_detail: Json
          home_red_cards: number
          home_yellow_cards: number
          id: string
          match_id: string
          penalties_in_match: boolean
          updated_at: string
          went_to_extra_time: boolean
        }
        Insert: {
          api_fixture_id?: number | null
          away_goals_detail?: Json
          away_red_cards?: number
          away_yellow_cards?: number
          created_at?: string
          home_goals_detail?: Json
          home_red_cards?: number
          home_yellow_cards?: number
          id?: string
          match_id: string
          penalties_in_match?: boolean
          updated_at?: string
          went_to_extra_time?: boolean
        }
        Update: {
          api_fixture_id?: number | null
          away_goals_detail?: Json
          away_red_cards?: number
          away_yellow_cards?: number
          created_at?: string
          home_goals_detail?: Json
          home_red_cards?: number
          home_yellow_cards?: number
          id?: string
          match_id?: string
          penalties_in_match?: boolean
          updated_at?: string
          went_to_extra_time?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          actual_away_score: number | null
          actual_home_score: number | null
          api_fixture_id: number | null
          auto_sync_override: boolean
          away_team: string
          group_code: string | null
          home_team: string
          id: string
          is_locked: boolean
          last_synced_at: string | null
          last_synced_score: Json | null
          match_date: string
          match_number: number
          phase: string
          source: string
          venue: string | null
        }
        Insert: {
          actual_away_score?: number | null
          actual_home_score?: number | null
          api_fixture_id?: number | null
          auto_sync_override?: boolean
          away_team: string
          group_code?: string | null
          home_team: string
          id?: string
          is_locked?: boolean
          last_synced_at?: string | null
          last_synced_score?: Json | null
          match_date: string
          match_number: number
          phase: string
          source?: string
          venue?: string | null
        }
        Update: {
          actual_away_score?: number | null
          actual_home_score?: number | null
          api_fixture_id?: number | null
          auto_sync_override?: boolean
          away_team?: string
          group_code?: string | null
          home_team?: string
          id?: string
          is_locked?: boolean
          last_synced_at?: string | null
          last_synced_score?: Json | null
          match_date?: string
          match_number?: number
          phase?: string
          source?: string
          venue?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          points_breakdown: Json
          points_earned: number | null
          predicted_away_score: number
          predicted_home_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          points_breakdown?: Json
          points_earned?: number | null
          predicted_away_score: number
          predicted_home_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          points_breakdown?: Json
          points_earned?: number | null
          predicted_away_score?: number
          predicted_home_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_initials: string
          created_at: string
          display_name: string
          email: string
          id: string
          is_admin: boolean
          profile_confirmed: boolean
        }
        Insert: {
          avatar_initials?: string
          created_at?: string
          display_name?: string
          email: string
          id?: string
          is_admin?: boolean
          profile_confirmed?: boolean
        }
        Update: {
          avatar_initials?: string
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_admin?: boolean
          profile_confirmed?: boolean
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          api_calls_used: number
          duration_ms: number
          id: string
          matches_locked: number
          matches_updated: number
          message: string | null
          ran_at: string
          status: string
        }
        Insert: {
          api_calls_used?: number
          duration_ms?: number
          id?: string
          matches_locked?: number
          matches_updated?: number
          message?: string | null
          ran_at?: string
          status: string
        }
        Update: {
          api_calls_used?: number
          duration_ms?: number
          id?: string
          matches_locked?: number
          matches_updated?: number
          message?: string | null
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_initials: string | null
          display_name: string | null
          grand_total: number | null
          rank: number | null
          total_bonus_points: number | null
          total_match_points: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_match_points: {
        Args: { _match_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      recalculate_all_points: { Args: never; Returns: undefined }
      user_bonus_points: { Args: { _uid: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
