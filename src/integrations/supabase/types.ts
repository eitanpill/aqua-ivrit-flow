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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          enrollment_id: string
          id: string
          marked_at: string
          marked_by: string | null
          notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          swimmer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          swimmer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          swimmer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_swimmer_id_fkey"
            columns: ["swimmer_id"]
            isOneToOne: false
            referencedRelation: "swimmers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_age: number | null
          min_age: number | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_age?: number | null
          min_age?: number | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      class_types: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number
          id: string
          level_id: string | null
          max_participants: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          level_id?: string | null
          max_participants?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          level_id?: string | null
          max_participants?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_types_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "class_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_rates: {
        Row: {
          coach_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          rate_per_hour: number
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate_per_hour?: number
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          rate_per_hour?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_rates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_wallets: {
        Row: {
          created_at: string
          credits_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          enrolled_at: string
          enrolled_by: string | null
          id: string
          notes: string | null
          session_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          swimmer_id: string
          type: Database["public"]["Enums"]["enrollment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          notes?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          swimmer_id: string
          type?: Database["public"]["Enums"]["enrollment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          notes?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          swimmer_id?: string
          type?: Database["public"]["Enums"]["enrollment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_swimmer_id_fkey"
            columns: ["swimmer_id"]
            isOneToOne: false
            referencedRelation: "swimmers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_number: string
          issued_at: string
          transaction_id: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_number: string
          issued_at?: string
          transaction_id?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          transaction_id?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      make_up_tokens: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          issued_by: string | null
          original_enrollment_id: string | null
          reason: string | null
          swimmer_id: string
          updated_at: string
          used_at: string | null
          used_for_enrollment_id: string | null
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          issued_by?: string | null
          original_enrollment_id?: string | null
          reason?: string | null
          swimmer_id: string
          updated_at?: string
          used_at?: string | null
          used_for_enrollment_id?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          issued_by?: string | null
          original_enrollment_id?: string | null
          reason?: string | null
          swimmer_id?: string
          updated_at?: string
          used_at?: string | null
          used_for_enrollment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "make_up_tokens_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_tokens_original_enrollment_id_fkey"
            columns: ["original_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_tokens_swimmer_id_fkey"
            columns: ["swimmer_id"]
            isOneToOne: false
            referencedRelation: "swimmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "make_up_tokens_used_for_enrollment_id_fkey"
            columns: ["used_for_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          credits_amount: number | null
          description: string | null
          duration_days: number | null
          id: string
          name: string
          price: number
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits_amount?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          name: string
          price?: number
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits_amount?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          name?: string
          price?: number
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          location_id: string
          name: string
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id: string
          name: string
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_series: {
        Row: {
          active: boolean
          class_type_id: string
          coach_id: string | null
          created_at: string
          day_of_week: number
          duration_minutes: number
          id: string
          max_participants: number | null
          name: string
          recurrence_weeks: number
          resource_id: string | null
          start_time: string
          term_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_type_id: string
          coach_id?: string | null
          created_at?: string
          day_of_week: number
          duration_minutes?: number
          id?: string
          max_participants?: number | null
          name: string
          recurrence_weeks?: number
          resource_id?: string | null
          start_time: string
          term_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_type_id?: string
          coach_id?: string | null
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          id?: string
          max_participants?: number | null
          name?: string
          recurrence_weeks?: number
          resource_id?: string | null
          start_time?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_series_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_series_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_series_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          active: boolean
          class_type_id: string
          coach_id: string | null
          created_at: string
          day_of_week: number
          id: string
          name: string
          resource_id: string | null
          season_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_type_id: string
          coach_id?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          name: string
          resource_id?: string | null
          season_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_type_id?: string
          coach_id?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          name?: string
          resource_id?: string | null
          season_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          active: boolean
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          class_type_id: string
          coach_id: string | null
          created_at: string
          end_time: string
          id: string
          is_cancelled: boolean
          max_participants: number | null
          notes: string | null
          resource_id: string | null
          series_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          class_type_id: string
          coach_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          is_cancelled?: boolean
          max_participants?: number | null
          notes?: string | null
          resource_id?: string | null
          series_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["session_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          class_type_id?: string
          coach_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_cancelled?: boolean
          max_participants?: number | null
          notes?: string | null
          resource_id?: string | null
          series_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "schedule_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level_id: string | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level_id?: string | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level_id?: string | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "class_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      swimmer_evaluations: {
        Row: {
          achieved: boolean
          achieved_at: string | null
          created_at: string
          evaluated_by: string | null
          id: string
          notes: string | null
          skill_id: string
          swimmer_id: string
          updated_at: string
        }
        Insert: {
          achieved?: boolean
          achieved_at?: string | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          notes?: string | null
          skill_id: string
          swimmer_id: string
          updated_at?: string
        }
        Update: {
          achieved?: boolean
          achieved_at?: string | null
          created_at?: string
          evaluated_by?: string | null
          id?: string
          notes?: string | null
          skill_id?: string
          swimmer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swimmer_evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swimmer_evaluations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swimmer_evaluations_swimmer_id_fkey"
            columns: ["swimmer_id"]
            isOneToOne: false
            referencedRelation: "swimmers"
            referencedColumns: ["id"]
          },
        ]
      }
      swimmers: {
        Row: {
          birth_date: string | null
          created_at: string
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          last_name: string
          medical_notes: string | null
          parent_id: string
          skill_level: Database["public"]["Enums"]["skill_level"] | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          last_name: string
          medical_notes?: string | null
          parent_id: string
          skill_level?: Database["public"]["Enums"]["skill_level"] | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          parent_id?: string
          skill_level?: Database["public"]["Enums"]["skill_level"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swimmers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_policies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      terms: {
        Row: {
          active: boolean
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          notified_at: string | null
          parent_id: string
          position: number
          session_id: string
          status: string
          swimmer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          parent_id: string
          position: number
          session_id: string
          status?: string
          swimmer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          parent_id?: string
          position?: number
          session_id?: string
          status?: string
          swimmer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_swimmer_id_fkey"
            columns: ["swimmer_id"]
            isOneToOne: false
            referencedRelation: "swimmers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "customer_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_to_waitlist: {
        Args: {
          p_parent_id: string
          p_session_id: string
          p_swimmer_id: string
        }
        Returns: Json
      }
      check_pool_conflict: {
        Args: {
          p_end_time: string
          p_exclude_session_id?: string
          p_resource_id: string
          p_start_time: string
        }
        Returns: boolean
      }
      generate_sessions_from_series: {
        Args: { p_series_id: string }
        Returns: Json
      }
      get_next_waitlist_position: {
        Args: { p_session_id: string }
        Returns: number
      }
      get_session_availability: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      promote_from_waitlist: { Args: { p_waitlist_id: string }; Returns: Json }
      set_user_role_by_email: {
        Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: Json
      }
      validate_enrollment: {
        Args: {
          p_force_override?: boolean
          p_session_id: string
          p_swimmer_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "coach" | "customer"
      attendance_status: "present" | "absent" | "late" | "excused"
      enrollment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "attended"
        | "no_show"
      enrollment_type: "permanent" | "single" | "makeup"
      gender_type: "male" | "female" | "other"
      product_type: "subscription" | "punch_card" | "single_session" | "trial"
      resource_type: "pool" | "lane"
      session_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      skill_level: "beginner" | "intermediate" | "advanced" | "competitive"
      wallet_transaction_type:
        | "purchase"
        | "usage"
        | "refund"
        | "adjustment"
        | "expiry"
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
      app_role: ["admin", "coach", "customer"],
      attendance_status: ["present", "absent", "late", "excused"],
      enrollment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "attended",
        "no_show",
      ],
      enrollment_type: ["permanent", "single", "makeup"],
      gender_type: ["male", "female", "other"],
      product_type: ["subscription", "punch_card", "single_session", "trial"],
      resource_type: ["pool", "lane"],
      session_status: ["scheduled", "in_progress", "completed", "cancelled"],
      skill_level: ["beginner", "intermediate", "advanced", "competitive"],
      wallet_transaction_type: [
        "purchase",
        "usage",
        "refund",
        "adjustment",
        "expiry",
      ],
    },
  },
} as const
