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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_members: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invited_by_profile_id: string | null
          is_default_account: boolean
          joined_at: string
          profile_id: string
          role: Database["public"]["Enums"]["account_role"]
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invited_by_profile_id?: string | null
          is_default_account?: boolean
          joined_at?: string
          profile_id: string
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invited_by_profile_id?: string | null
          is_default_account?: boolean
          joined_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_members_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: string
          created_at: string
          id: string
          locale: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["record_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          id?: string
          locale?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["record_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          id?: string
          locale?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["record_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_modes: {
        Row: {
          account_id: string
          allow_booking: boolean
          assistant_profile_id: string
          auto_activation_rules: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          mode_type: Database["public"]["Enums"]["mode_type"]
          name: string
          quiet_hours_enabled: boolean
          quiet_hours_end_local: string | null
          quiet_hours_start_local: string | null
          slug: string
          updated_at: string
          urgency_sensitivity: string
        }
        Insert: {
          account_id: string
          allow_booking?: boolean
          assistant_profile_id: string
          auto_activation_rules?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mode_type?: Database["public"]["Enums"]["mode_type"]
          name?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end_local?: string | null
          quiet_hours_start_local?: string | null
          slug?: string
          updated_at?: string
          urgency_sensitivity?: string
        }
        Update: {
          account_id?: string
          allow_booking?: boolean
          assistant_profile_id?: string
          auto_activation_rules?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mode_type?: Database["public"]["Enums"]["mode_type"]
          name?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end_local?: string | null
          quiet_hours_start_local?: string | null
          slug?: string
          updated_at?: string
          urgency_sensitivity?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_modes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_modes_assistant_profile_id_fkey"
            columns: ["assistant_profile_id"]
            isOneToOne: false
            referencedRelation: "assistant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_profiles: {
        Row: {
          account_id: string
          brevity_level: string
          created_at: string
          description: string | null
          greeting_text: string
          id: string
          introduction_style: string
          is_default: boolean
          language_code: string
          name: string
          status: Database["public"]["Enums"]["record_status"]
          tone_style: string
          updated_at: string
          voice_name: string
        }
        Insert: {
          account_id: string
          brevity_level?: string
          created_at?: string
          description?: string | null
          greeting_text?: string
          id?: string
          introduction_style?: string
          is_default?: boolean
          language_code?: string
          name?: string
          status?: Database["public"]["Enums"]["record_status"]
          tone_style?: string
          updated_at?: string
          voice_name?: string
        }
        Update: {
          account_id?: string
          brevity_level?: string
          created_at?: string
          description?: string | null
          greeting_text?: string
          id?: string
          introduction_style?: string
          is_default?: boolean
          language_code?: string
          name?: string
          status?: Database["public"]["Enums"]["record_status"]
          tone_style?: string
          updated_at?: string
          voice_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_handling_rules: {
        Row: {
          account_id: string
          assistant_mode_id: string
          behavior: Database["public"]["Enums"]["call_behavior"]
          booking_allowed: boolean
          callback_allowed: boolean
          caller_group_id: string
          created_at: string
          escalation_allowed: boolean
          force_escalation: boolean
          id: string
          priority_rank: number
          summary_required: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          assistant_mode_id: string
          behavior?: Database["public"]["Enums"]["call_behavior"]
          booking_allowed?: boolean
          callback_allowed?: boolean
          caller_group_id: string
          created_at?: string
          escalation_allowed?: boolean
          force_escalation?: boolean
          id?: string
          priority_rank?: number
          summary_required?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          assistant_mode_id?: string
          behavior?: Database["public"]["Enums"]["call_behavior"]
          booking_allowed?: boolean
          callback_allowed?: boolean
          caller_group_id?: string
          created_at?: string
          escalation_allowed?: boolean
          force_escalation?: boolean
          id?: string
          priority_rank?: number
          summary_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_handling_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_handling_rules_assistant_mode_id_fkey"
            columns: ["assistant_mode_id"]
            isOneToOne: false
            referencedRelation: "assistant_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_handling_rules_caller_group_id_fkey"
            columns: ["caller_group_id"]
            isOneToOne: false
            referencedRelation: "caller_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      caller_groups: {
        Row: {
          account_id: string
          color: string | null
          created_at: string
          description: string | null
          group_type: Database["public"]["Enums"]["caller_group_type"]
          icon: string | null
          id: string
          name: string
          priority_rank: number
          slug: string
          updated_at: string
        }
        Insert: {
          account_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["caller_group_type"]
          icon?: string | null
          id?: string
          name: string
          priority_rank?: number
          slug: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["caller_group_type"]
          icon?: string | null
          id?: string
          name?: string
          priority_rank?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caller_groups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_group_memberships: {
        Row: {
          account_id: string
          caller_group_id: string
          contact_id: string
          created_at: string
          id: string
        }
        Insert: {
          account_id: string
          caller_group_id: string
          contact_id: string
          created_at?: string
          id?: string
        }
        Update: {
          account_id?: string
          caller_group_id?: string
          contact_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_group_memberships_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_memberships_caller_group_id_fkey"
            columns: ["caller_group_id"]
            isOneToOne: false
            referencedRelation: "caller_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          company_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          external_source_id: string | null
          first_name: string | null
          id: string
          is_blocked: boolean
          is_favorite: boolean
          last_name: string | null
          notes: string | null
          primary_phone_e164: string | null
          secondary_phone_e164: string | null
          source: Database["public"]["Enums"]["contact_source"]
          updated_at: string
        }
        Insert: {
          account_id: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          external_source_id?: string | null
          first_name?: string | null
          id?: string
          is_blocked?: boolean
          is_favorite?: boolean
          last_name?: string | null
          notes?: string | null
          primary_phone_e164?: string | null
          secondary_phone_e164?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          external_source_id?: string | null
          first_name?: string | null
          id?: string
          is_blocked?: boolean
          is_favorite?: boolean
          last_name?: string | null
          notes?: string | null
          primary_phone_e164?: string | null
          secondary_phone_e164?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          account_id: string
          capabilities: Json
          country_code: string
          created_at: string
          e164_number: string
          id: string
          label: string | null
          ownership_type: Database["public"]["Enums"]["ownership_type"]
          provider: string
          provider_number_id: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          account_id: string
          capabilities?: Json
          country_code?: string
          created_at?: string
          e164_number: string
          id?: string
          label?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          provider?: string
          provider_number_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          account_id?: string
          capabilities?: Json
          country_code?: string
          created_at?: string
          e164_number?: string
          id?: string
          label?: string | null
          ownership_type?: Database["public"]["Enums"]["ownership_type"]
          provider?: string
          provider_number_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone_e164: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone_e164?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_e164?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_account_admin: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_account_member: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_role: "owner" | "admin" | "member" | "viewer"
      call_behavior:
        | "answer_and_take_message"
        | "answer_and_transfer"
        | "answer_and_book"
        | "answer_and_escalate"
        | "answer_only"
        | "block"
        | "voicemail"
      caller_group_type: "system" | "custom"
      contact_source:
        | "manual"
        | "google_contacts"
        | "apple_contacts"
        | "csv_import"
        | "call_history"
        | "other"
      mode_type: "manual" | "scheduled" | "auto"
      ownership_type: "owned" | "rented" | "trial"
      record_status: "active" | "inactive" | "suspended" | "deleted"
      verification_status: "pending" | "verified" | "failed"
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
    Enums: {
      account_role: ["owner", "admin", "member", "viewer"],
      call_behavior: [
        "answer_and_take_message",
        "answer_and_transfer",
        "answer_and_book",
        "answer_and_escalate",
        "answer_only",
        "block",
        "voicemail",
      ],
      caller_group_type: ["system", "custom"],
      contact_source: [
        "manual",
        "google_contacts",
        "apple_contacts",
        "csv_import",
        "call_history",
        "other",
      ],
      mode_type: ["manual", "scheduled", "auto"],
      ownership_type: ["owned", "rented", "trial"],
      record_status: ["active", "inactive", "suspended", "deleted"],
      verification_status: ["pending", "verified", "failed"],
    },
  },
} as const
