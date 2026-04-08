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
      appointments: {
        Row: {
          account_id: string
          booked_by: Database["public"]["Enums"]["booked_by_type"]
          booking_type_id: string | null
          call_session_id: string | null
          contact_id: string | null
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          provider: Database["public"]["Enums"]["calendar_provider"] | null
          provider_event_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          booked_by?: Database["public"]["Enums"]["booked_by_type"]
          booking_type_id?: string | null
          call_session_id?: string | null
          contact_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"] | null
          provider_event_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone?: string
          title?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          booked_by?: Database["public"]["Enums"]["booked_by_type"]
          booking_type_id?: string | null
          call_session_id?: string | null
          contact_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"] | null
          provider_event_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_booking_type_id_fkey"
            columns: ["booking_type_id"]
            isOneToOne: false
            referencedRelation: "booking_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      booking_rules: {
        Row: {
          account_id: string
          assistant_mode_id: string
          booking_type_id: string
          caller_group_id: string
          can_book_directly: boolean
          can_offer_alternatives: boolean
          created_at: string
          id: string
          max_suggestions: number
          updated_at: string
        }
        Insert: {
          account_id: string
          assistant_mode_id: string
          booking_type_id: string
          caller_group_id: string
          can_book_directly?: boolean
          can_offer_alternatives?: boolean
          created_at?: string
          id?: string
          max_suggestions?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          assistant_mode_id?: string
          booking_type_id?: string
          caller_group_id?: string
          can_book_directly?: boolean
          can_offer_alternatives?: boolean
          created_at?: string
          id?: string
          max_suggestions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rules_assistant_mode_id_fkey"
            columns: ["assistant_mode_id"]
            isOneToOne: false
            referencedRelation: "assistant_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rules_booking_type_id_fkey"
            columns: ["booking_type_id"]
            isOneToOne: false
            referencedRelation: "booking_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rules_caller_group_id_fkey"
            columns: ["caller_group_id"]
            isOneToOne: false
            referencedRelation: "caller_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_types: {
        Row: {
          account_id: string
          allowed_from_hour_local: number
          allowed_to_hour_local: number
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string
          duration_minutes: number
          enabled: boolean
          id: string
          max_days_ahead: number
          name: string
          requires_confirmation: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          account_id: string
          allowed_from_hour_local?: number
          allowed_to_hour_local?: number
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          max_days_ahead?: number
          name: string
          requires_confirmation?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          allowed_from_hour_local?: number
          allowed_to_hour_local?: number
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          duration_minutes?: number
          enabled?: boolean
          id?: string
          max_days_ahead?: number
          name?: string
          requires_confirmation?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_types_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_calendars: {
        Row: {
          account_id: string
          calendar_connection_id: string
          created_at: string
          id: string
          is_primary: boolean
          is_read_only: boolean
          name: string
          provider_calendar_id: string
        }
        Insert: {
          account_id: string
          calendar_connection_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_read_only?: boolean
          name: string
          provider_calendar_id: string
        }
        Update: {
          account_id?: string
          calendar_connection_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_read_only?: boolean
          name?: string
          provider_calendar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_calendars_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_calendars_calendar_connection_id_fkey"
            columns: ["calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token_encrypted: string | null
          account_id: string
          created_at: string
          id: string
          profile_id: string
          provider: Database["public"]["Enums"]["calendar_provider"]
          provider_account_id: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          status: Database["public"]["Enums"]["calendar_connection_status"]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          account_id: string
          created_at?: string
          id?: string
          profile_id: string
          provider?: Database["public"]["Enums"]["calendar_provider"]
          provider_account_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["calendar_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          account_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          provider?: Database["public"]["Enums"]["calendar_provider"]
          provider_account_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["calendar_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      call_messages: {
        Row: {
          account_id: string
          call_session_id: string
          content_json: Json | null
          content_text: string | null
          created_at: string
          ended_at: string | null
          id: string
          seq_no: number
          speaker: Database["public"]["Enums"]["speaker_role"]
          started_at: string | null
          tool_name: string | null
        }
        Insert: {
          account_id: string
          call_session_id: string
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          seq_no: number
          speaker?: Database["public"]["Enums"]["speaker_role"]
          started_at?: string | null
          tool_name?: string | null
        }
        Update: {
          account_id?: string
          call_session_id?: string
          content_json?: Json | null
          content_text?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          seq_no?: number
          speaker?: Database["public"]["Enums"]["speaker_role"]
          started_at?: string | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_messages_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          account_id: string
          active_mode_id: string | null
          answered_at: string | null
          assistant_handled: boolean
          caller_country_code: string | null
          caller_group_id: string | null
          caller_name_raw: string | null
          caller_phone_e164: string | null
          contact_id: string | null
          created_at: string
          detected_intent: string | null
          direction: Database["public"]["Enums"]["call_direction"]
          duration_seconds: number | null
          ended_at: string | null
          escalated_to_user: boolean
          escalation_status: Database["public"]["Enums"]["escalation_status"]
          final_outcome: Database["public"]["Enums"]["call_outcome"]
          id: string
          metadata: Json | null
          phone_number_id: string | null
          profile_id: string | null
          provider: string
          provider_call_id: string | null
          recording_url: string | null
          started_at: string
          summary_long: string | null
          summary_short: string | null
          transcript_status: Database["public"]["Enums"]["transcript_status"]
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"]
          urgency_score: number | null
        }
        Insert: {
          account_id: string
          active_mode_id?: string | null
          answered_at?: string | null
          assistant_handled?: boolean
          caller_country_code?: string | null
          caller_group_id?: string | null
          caller_name_raw?: string | null
          caller_phone_e164?: string | null
          contact_id?: string | null
          created_at?: string
          detected_intent?: string | null
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number | null
          ended_at?: string | null
          escalated_to_user?: boolean
          escalation_status?: Database["public"]["Enums"]["escalation_status"]
          final_outcome?: Database["public"]["Enums"]["call_outcome"]
          id?: string
          metadata?: Json | null
          phone_number_id?: string | null
          profile_id?: string | null
          provider?: string
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string
          summary_long?: string | null
          summary_short?: string | null
          transcript_status?: Database["public"]["Enums"]["transcript_status"]
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
          urgency_score?: number | null
        }
        Update: {
          account_id?: string
          active_mode_id?: string | null
          answered_at?: string | null
          assistant_handled?: boolean
          caller_country_code?: string | null
          caller_group_id?: string | null
          caller_name_raw?: string | null
          caller_phone_e164?: string | null
          contact_id?: string | null
          created_at?: string
          detected_intent?: string | null
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_seconds?: number | null
          ended_at?: string | null
          escalated_to_user?: boolean
          escalation_status?: Database["public"]["Enums"]["escalation_status"]
          final_outcome?: Database["public"]["Enums"]["call_outcome"]
          id?: string
          metadata?: Json | null
          phone_number_id?: string | null
          profile_id?: string | null
          provider?: string
          provider_call_id?: string | null
          recording_url?: string | null
          started_at?: string
          summary_long?: string | null
          summary_short?: string | null
          transcript_status?: Database["public"]["Enums"]["transcript_status"]
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_active_mode_id_fkey"
            columns: ["active_mode_id"]
            isOneToOne: false
            referencedRelation: "assistant_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_caller_group_id_fkey"
            columns: ["caller_group_id"]
            isOneToOne: false
            referencedRelation: "caller_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      callback_requests: {
        Row: {
          account_id: string
          call_session_id: string | null
          caller_name: string | null
          caller_phone_e164: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: Database["public"]["Enums"]["booked_by_type"]
          id: string
          preferred_time_note: string | null
          priority: Database["public"]["Enums"]["callback_priority"]
          reason: string | null
          status: Database["public"]["Enums"]["callback_status"]
        }
        Insert: {
          account_id: string
          call_session_id?: string | null
          caller_name?: string | null
          caller_phone_e164?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: Database["public"]["Enums"]["booked_by_type"]
          id?: string
          preferred_time_note?: string | null
          priority?: Database["public"]["Enums"]["callback_priority"]
          reason?: string | null
          status?: Database["public"]["Enums"]["callback_status"]
        }
        Update: {
          account_id?: string
          call_session_id?: string | null
          caller_name?: string | null
          caller_phone_e164?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: Database["public"]["Enums"]["booked_by_type"]
          id?: string
          preferred_time_note?: string | null
          priority?: Database["public"]["Enums"]["callback_priority"]
          reason?: string | null
          status?: Database["public"]["Enums"]["callback_status"]
        }
        Relationships: [
          {
            foreignKeyName: "callback_requests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callback_requests_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "callback_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
      escalation_events: {
        Row: {
          account_id: string
          attempted_at: string | null
          call_session_id: string
          created_at: string
          id: string
          method: Database["public"]["Enums"]["escalation_method"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["escalation_event_status"]
          target_profile_id: string
          trigger_reason: string
          urgency_level: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          account_id: string
          attempted_at?: string | null
          call_session_id: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["escalation_method"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["escalation_event_status"]
          target_profile_id: string
          trigger_reason: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          account_id?: string
          attempted_at?: string | null
          call_session_id?: string
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["escalation_method"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["escalation_event_status"]
          target_profile_id?: string
          trigger_reason?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "escalation_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          account_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          fallback_order: number
          id: string
          priority_threshold: Database["public"]["Enums"]["notification_priority"]
          profile_id: string
          quiet_hours_override: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          fallback_order?: number
          id?: string
          priority_threshold?: Database["public"]["Enums"]["notification_priority"]
          profile_id: string
          quiet_hours_override?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          fallback_order?: number
          id?: string
          priority_threshold?: Database["public"]["Enums"]["notification_priority"]
          profile_id?: string
          quiet_hours_override?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string
          body: string | null
          call_session_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["notification_priority"]
          profile_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
        }
        Insert: {
          account_id: string
          body?: string | null
          call_session_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          profile_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
        }
        Update: {
          account_id?: string
          body?: string | null
          call_session_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          profile_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      subscription_plans: {
        Row: {
          active: boolean
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          features_json: Json
          id: string
          included_calls_per_month: number
          included_phone_numbers: number
          name: string
          price_cents: number
        }
        Insert: {
          active?: boolean
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          features_json?: Json
          id?: string
          included_calls_per_month?: number
          included_phone_numbers?: number
          name: string
          price_cents?: number
        }
        Update: {
          active?: boolean
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          code?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          features_json?: Json
          id?: string
          included_calls_per_month?: number
          included_phone_numbers?: number
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_id: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          provider: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_plan_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_plan_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_invocations: {
        Row: {
          account_id: string
          call_session_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          request_json: Json | null
          response_json: Json | null
          status: Database["public"]["Enums"]["tool_invocation_status"]
          tool_name: string
        }
        Insert: {
          account_id: string
          call_session_id: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_json?: Json | null
          response_json?: Json | null
          status?: Database["public"]["Enums"]["tool_invocation_status"]
          tool_name: string
        }
        Update: {
          account_id?: string
          call_session_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_json?: Json | null
          response_json?: Json | null
          status?: Database["public"]["Enums"]["tool_invocation_status"]
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_invocations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_invocations_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          account_id: string
          assistant_minutes_total: number
          booked_appointments_count: number
          created_at: string
          escalations_count: number
          handled_calls_count: number
          id: string
          inbound_calls_count: number
          outbound_calls_count: number
          period_month: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assistant_minutes_total?: number
          booked_appointments_count?: number
          created_at?: string
          escalations_count?: number
          handled_calls_count?: number
          id?: string
          inbound_calls_count?: number
          outbound_calls_count?: number
          period_month: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assistant_minutes_total?: number
          booked_appointments_count?: number
          created_at?: string
          escalations_count?: number
          handled_calls_count?: number
          id?: string
          inbound_calls_count?: number
          outbound_calls_count?: number
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
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
      appointment_status:
        | "tentative"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      billing_interval: "monthly" | "yearly"
      billing_provider: "stripe" | "manual"
      booked_by_type: "assistant" | "user" | "external"
      calendar_connection_status: "active" | "expired" | "revoked" | "error"
      calendar_provider: "google" | "outlook" | "apple" | "other"
      call_behavior:
        | "answer_and_take_message"
        | "answer_and_transfer"
        | "answer_and_book"
        | "answer_and_escalate"
        | "answer_only"
        | "block"
        | "voicemail"
      call_direction: "inbound" | "outbound"
      call_outcome:
        | "completed"
        | "missed"
        | "rejected"
        | "failed"
        | "voicemail"
        | "escalated"
        | "transferred"
      callback_priority: "low" | "normal" | "high" | "urgent"
      callback_status:
        | "pending"
        | "scheduled"
        | "completed"
        | "cancelled"
        | "expired"
      caller_group_type: "system" | "custom"
      contact_source:
        | "manual"
        | "google_contacts"
        | "apple_contacts"
        | "csv_import"
        | "call_history"
        | "other"
      currency_code: "eur" | "usd"
      escalation_event_status:
        | "pending"
        | "attempting"
        | "reached"
        | "unreached"
        | "timeout"
      escalation_method: "call" | "push" | "sms"
      escalation_status:
        | "none"
        | "pending"
        | "accepted"
        | "declined"
        | "timeout"
      mode_type: "manual" | "scheduled" | "auto"
      notification_channel: "push" | "sms" | "email"
      notification_event_type:
        | "urgent_call"
        | "callback_request"
        | "appointment_booked"
        | "call_summary"
      notification_priority: "low" | "normal" | "high" | "critical"
      notification_status: "pending" | "sent" | "delivered" | "failed"
      ownership_type: "owned" | "rented" | "trial"
      record_status: "active" | "inactive" | "suspended" | "deleted"
      speaker_role: "caller" | "assistant" | "system" | "tool"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      tool_invocation_status: "pending" | "success" | "error" | "timeout"
      transcript_status: "none" | "pending" | "processing" | "ready" | "failed"
      urgency_level: "none" | "low" | "medium" | "high" | "critical"
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
      appointment_status: [
        "tentative",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      billing_interval: ["monthly", "yearly"],
      billing_provider: ["stripe", "manual"],
      booked_by_type: ["assistant", "user", "external"],
      calendar_connection_status: ["active", "expired", "revoked", "error"],
      calendar_provider: ["google", "outlook", "apple", "other"],
      call_behavior: [
        "answer_and_take_message",
        "answer_and_transfer",
        "answer_and_book",
        "answer_and_escalate",
        "answer_only",
        "block",
        "voicemail",
      ],
      call_direction: ["inbound", "outbound"],
      call_outcome: [
        "completed",
        "missed",
        "rejected",
        "failed",
        "voicemail",
        "escalated",
        "transferred",
      ],
      callback_priority: ["low", "normal", "high", "urgent"],
      callback_status: [
        "pending",
        "scheduled",
        "completed",
        "cancelled",
        "expired",
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
      currency_code: ["eur", "usd"],
      escalation_event_status: [
        "pending",
        "attempting",
        "reached",
        "unreached",
        "timeout",
      ],
      escalation_method: ["call", "push", "sms"],
      escalation_status: ["none", "pending", "accepted", "declined", "timeout"],
      mode_type: ["manual", "scheduled", "auto"],
      notification_channel: ["push", "sms", "email"],
      notification_event_type: [
        "urgent_call",
        "callback_request",
        "appointment_booked",
        "call_summary",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: ["pending", "sent", "delivered", "failed"],
      ownership_type: ["owned", "rented", "trial"],
      record_status: ["active", "inactive", "suspended", "deleted"],
      speaker_role: ["caller", "assistant", "system", "tool"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      tool_invocation_status: ["pending", "success", "error", "timeout"],
      transcript_status: ["none", "pending", "processing", "ready", "failed"],
      urgency_level: ["none", "low", "medium", "high", "critical"],
      verification_status: ["pending", "verified", "failed"],
    },
  },
} as const
