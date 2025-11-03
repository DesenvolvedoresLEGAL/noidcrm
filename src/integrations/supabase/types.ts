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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accelerator_policies: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          min_attendance_pct: number
          min_avg_score: number
          multiplier: number
          name: string
          notes: string | null
          organization_id: string
          tier: Database["public"]["Enums"]["accelerator_tier_type"]
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          min_attendance_pct: number
          min_avg_score: number
          multiplier: number
          name: string
          notes?: string | null
          organization_id: string
          tier: Database["public"]["Enums"]["accelerator_tier_type"]
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          min_attendance_pct?: number
          min_avg_score?: number
          multiplier?: number
          name?: string
          notes?: string | null
          organization_id?: string
          tier?: Database["public"]["Enums"]["accelerator_tier_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accelerator_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          cnae: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          nome_fantasia: string | null
          organization_id: string
          origem_principal: string | null
          razao_social: string
          segmento: string | null
          tamanho: string | null
          updated_at: string | null
        }
        Insert: {
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          nome_fantasia?: string | null
          organization_id: string
          origem_principal?: string | null
          razao_social: string
          segmento?: string | null
          tamanho?: string | null
          updated_at?: string | null
        }
        Update: {
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          nome_fantasia?: string | null
          organization_id?: string
          origem_principal?: string | null
          razao_social?: string
          segmento?: string | null
          tamanho?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          account_id: string | null
          ai_generated: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_automated: boolean | null
          opportunity_id: string | null
          organization_id: string
          owner_user_id: string
          scheduled_date: string | null
          sentiment: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          ai_generated?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_automated?: boolean | null
          opportunity_id?: string | null
          organization_id: string
          owner_user_id: string
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          ai_generated?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_automated?: boolean | null
          opportunity_id?: string | null
          organization_id?: string
          owner_user_id?: string
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          organization_id: string
          present: boolean | null
          seller_id: string
          training_window: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          organization_id: string
          present?: boolean | null
          seller_id: string
          training_window?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          organization_id?: string
          present?: boolean | null
          seller_id?: string
          training_window?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_config: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          followup_frequency_burning: number | null
          followup_frequency_cold: number | null
          followup_frequency_hot: number | null
          followup_frequency_warm: number | null
          id: string
          max_messages_per_week: number | null
          organization_id: string
          pipeline_id: string | null
          updated_at: string | null
          work_hours_end: string | null
          work_hours_start: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          followup_frequency_burning?: number | null
          followup_frequency_cold?: number | null
          followup_frequency_hot?: number | null
          followup_frequency_warm?: number | null
          id?: string
          max_messages_per_week?: number | null
          organization_id: string
          pipeline_id?: string | null
          updated_at?: string | null
          work_hours_end?: string | null
          work_hours_start?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          followup_frequency_burning?: number | null
          followup_frequency_cold?: number | null
          followup_frequency_hot?: number | null
          followup_frequency_warm?: number | null
          id?: string
          max_messages_per_week?: number | null
          organization_id?: string
          pipeline_id?: string | null
          updated_at?: string | null
          work_hours_end?: string | null
          work_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_config_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action_type: string
          ai_context: string | null
          channel: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_content: string | null
          metadata: Json | null
          opportunity_id: string | null
          status: string
        }
        Insert: {
          action_type: string
          ai_context?: string | null
          channel?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metadata?: Json | null
          opportunity_id?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          ai_context?: string | null
          channel?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metadata?: Json | null
          opportunity_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_archetypes: {
        Row: {
          complexity_score: number | null
          created_at: string | null
          decision_role:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          id: string
          level: Database["public"]["Enums"]["archetype_level_type"] | null
          min_message_exchanges: number | null
          name: string
          objection_set: Json | null
          organization_id: string
          tone_style: Database["public"]["Enums"]["tone_style_type"] | null
          type: Database["public"]["Enums"]["client_type"] | null
          updated_at: string | null
        }
        Insert: {
          complexity_score?: number | null
          created_at?: string | null
          decision_role?:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          id?: string
          level?: Database["public"]["Enums"]["archetype_level_type"] | null
          min_message_exchanges?: number | null
          name: string
          objection_set?: Json | null
          organization_id: string
          tone_style?: Database["public"]["Enums"]["tone_style_type"] | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
        }
        Update: {
          complexity_score?: number | null
          created_at?: string | null
          decision_role?:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          id?: string
          level?: Database["public"]["Enums"]["archetype_level_type"] | null
          min_message_exchanges?: number | null
          name?: string
          objection_set?: Json | null
          organization_id?: string
          tone_style?: Database["public"]["Enums"]["tone_style_type"] | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_archetypes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string | null
          cargo: string | null
          created_at: string | null
          emails: string[] | null
          id: string
          nome: string
          organization_id: string
          telefones: string[] | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          cargo?: string | null
          created_at?: string | null
          emails?: string[] | null
          id?: string
          nome: string
          organization_id: string
          telefones?: string[] | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          cargo?: string | null
          created_at?: string | null
          emails?: string[] | null
          id?: string
          nome?: string
          organization_id?: string
          telefones?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          account_id: string
          contact_id: string | null
          contract_value: number | null
          created_at: string | null
          end_date: string | null
          id: string
          opportunity_id: string | null
          organization_id: string
          owner_user_id: string
          payment_terms: string | null
          start_date: string | null
          status: string
          terms_and_conditions: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id: string
          owner_user_id: string
          payment_terms?: string | null
          start_date?: string | null
          status?: string
          terms_and_conditions?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string
          owner_user_id?: string
          payment_terms?: string | null
          start_date?: string | null
          status?: string
          terms_and_conditions?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_rubrics: {
        Row: {
          created_at: string | null
          dimensions: Json
          id: string
          name: string
          organization_id: string
          passing_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dimensions?: Json
          id?: string
          name: string
          organization_id: string
          passing_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dimensions?: Json
          id?: string
          name?: string
          organization_id?: string
          passing_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_rubrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      icp_profiles: {
        Row: {
          buying_triggers: Json | null
          company_size: string | null
          competing_alternatives: Json | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          pain_points: Json | null
          revenue_band: string | null
          segment: string | null
          success_criteria: Json | null
          tech_maturity: number | null
          updated_at: string | null
        }
        Insert: {
          buying_triggers?: Json | null
          company_size?: string | null
          competing_alternatives?: Json | null
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          pain_points?: Json | null
          revenue_band?: string | null
          segment?: string | null
          success_criteria?: Json | null
          tech_maturity?: number | null
          updated_at?: string | null
        }
        Update: {
          buying_triggers?: Json | null
          company_size?: string | null
          competing_alternatives?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          pain_points?: Json | null
          revenue_band?: string | null
          segment?: string | null
          success_criteria?: Json | null
          tech_maturity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icp_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_status: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          current_step: number
          data: Json | null
          id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          data?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          data?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          account_id: string | null
          automation_enabled: boolean | null
          close_date_prevista: string | null
          contact_id: string | null
          created_at: string | null
          days_since_contact: number | null
          fonte: string | null
          id: string
          last_contact_date: string | null
          next_followup_date: string | null
          organization_id: string
          origem: string | null
          owner_user_id: string
          pipeline_id: string | null
          prob: number | null
          produto: string | null
          stage_id: string | null
          status: string | null
          temperatura: string | null
          temperature: string | null
          title: string
          updated_at: string | null
          urgency_score: number | null
          valor_previsto: number | null
        }
        Insert: {
          account_id?: string | null
          automation_enabled?: boolean | null
          close_date_prevista?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_contact?: number | null
          fonte?: string | null
          id?: string
          last_contact_date?: string | null
          next_followup_date?: string | null
          organization_id: string
          origem?: string | null
          owner_user_id: string
          pipeline_id?: string | null
          prob?: number | null
          produto?: string | null
          stage_id?: string | null
          status?: string | null
          temperatura?: string | null
          temperature?: string | null
          title: string
          updated_at?: string | null
          urgency_score?: number | null
          valor_previsto?: number | null
        }
        Update: {
          account_id?: string | null
          automation_enabled?: boolean | null
          close_date_prevista?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_contact?: number | null
          fonte?: string | null
          id?: string
          last_contact_date?: string | null
          next_followup_date?: string | null
          organization_id?: string
          origem?: string | null
          owner_user_id?: string
          pipeline_id?: string | null
          prob?: number | null
          produto?: string | null
          stage_id?: string | null
          status?: string | null
          temperatura?: string | null
          temperature?: string | null
          title?: string
          updated_at?: string | null
          urgency_score?: number | null
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          opportunity_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          opportunity_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          opportunity_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_notes_created_by_profiles_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          org_role: Database["public"]["Enums"]["org_role"] | null
          organization_id: string
          permission_set_id: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"] | null
          organization_id: string
          permission_set_id?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          org_role?: Database["public"]["Enums"]["org_role"] | null
          organization_id?: string
          permission_set_id?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          organization_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          cnpj: string | null
          created_at: string | null
          current_plan_id: string | null
          domain: string | null
          email: string | null
          id: string
          industry: string | null
          is_plan_locked: boolean | null
          legal_name: string | null
          logo_url: string | null
          max_opportunities: number | null
          max_users: number | null
          municipal_registration: string | null
          name: string
          phone: string | null
          primary_color: string | null
          responsible_user_id: string | null
          settings: Json | null
          slug: string
          state_registration: string | null
          status: string
          team_size: string | null
          trial_ends_at: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_plan_locked?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          max_opportunities?: number | null
          max_users?: number | null
          municipal_registration?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          responsible_user_id?: string | null
          settings?: Json | null
          slug: string
          state_registration?: string | null
          status?: string
          team_size?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj?: string | null
          created_at?: string | null
          current_plan_id?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_plan_locked?: boolean | null
          legal_name?: string | null
          logo_url?: string | null
          max_opportunities?: number | null
          max_users?: number | null
          municipal_registration?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          responsible_user_id?: string | null
          settings?: Json | null
          slug?: string
          state_registration?: string | null
          status?: string
          team_size?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_insights: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          next_roleplay_suggestion: string | null
          organization_id: string
          predicted_loss_reason: string | null
          recommended_actions: Json | null
          seller_id: string
          session_id: string | null
          strengths: Json | null
          weaknesses: Json | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          next_roleplay_suggestion?: string | null
          organization_id: string
          predicted_loss_reason?: string | null
          recommended_actions?: Json | null
          seller_id: string
          session_id?: string | null
          strengths?: Json | null
          weaknesses?: Json | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          next_roleplay_suggestion?: string | null
          organization_id?: string
          predicted_loss_reason?: string | null
          recommended_actions?: Json | null
          seller_id?: string
          session_id?: string | null
          strengths?: Json | null
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_insights_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_insights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roleplay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_sets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          business_unit_ids: string[] | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          type: string
        }
        Insert: {
          business_unit_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          organization_id: string
          type: string
        }
        Update: {
          business_unit_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          key: string
          plan_id: string
          value: string
        }
        Insert: {
          key: string
          plan_id: string
          value: string
        }
        Update: {
          key?: string
          plan_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_public: boolean | null
          name: string
          price_month_cents: number | null
          price_year_cents: number | null
          visible_in_ui: boolean | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id: string
          is_public?: boolean | null
          name: string
          price_month_cents?: number | null
          price_year_cents?: number | null
          visible_in_ui?: boolean | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_public?: boolean | null
          name?: string
          price_month_cents?: number | null
          price_year_cents?: number | null
          visible_in_ui?: boolean | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          price: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          price?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          monthly_goal: number | null
          organization_id: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          monthly_goal?: number | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          monthly_goal?: number | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          characteristics: Json | null
          created_at: string | null
          description: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          ipi_percent: number | null
          markup_percent: number | null
          name: string
          order_index: number | null
          organization_id: string
          product_id: string | null
          proposal_id: string
          quantity: number | null
          total: number | null
          unit_cost: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          characteristics?: Json | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          ipi_percent?: number | null
          markup_percent?: number | null
          name: string
          order_index?: number | null
          organization_id: string
          product_id?: string | null
          proposal_id: string
          quantity?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          characteristics?: Json | null
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          ipi_percent?: number | null
          markup_percent?: number | null
          name?: string
          order_index?: number | null
          organization_id?: string
          product_id?: string | null
          proposal_id?: string
          quantity?: number | null
          total?: number | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_payment_terms: {
        Row: {
          comments: string | null
          contract_total: number | null
          created_at: string | null
          discount_percent: number | null
          due_day: number | null
          entry_date: string | null
          entry_percent: number | null
          first_installment_date: string | null
          first_payment_date: string | null
          id: string
          installment_interval_days: number | null
          installments: number | null
          monthly_value: number | null
          organization_id: string
          payment_type: string
          proposal_id: string
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          contract_total?: number | null
          created_at?: string | null
          discount_percent?: number | null
          due_day?: number | null
          entry_date?: string | null
          entry_percent?: number | null
          first_installment_date?: string | null
          first_payment_date?: string | null
          id?: string
          installment_interval_days?: number | null
          installments?: number | null
          monthly_value?: number | null
          organization_id: string
          payment_type?: string
          proposal_id: string
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          contract_total?: number | null
          created_at?: string | null
          discount_percent?: number | null
          due_day?: number | null
          entry_date?: string | null
          entry_percent?: number | null
          first_installment_date?: string | null
          first_payment_date?: string | null
          id?: string
          installment_interval_days?: number | null
          installments?: number | null
          monthly_value?: number | null
          organization_id?: string
          payment_type?: string
          proposal_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_payment_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_payment_terms_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_items: Json | null
          description: string | null
          id: string
          introduction: string | null
          is_default: boolean | null
          name: string
          notes: string | null
          organization_id: string
          terms: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_items?: Json | null
          description?: string | null
          id?: string
          introduction?: string | null
          is_default?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          terms?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_items?: Json | null
          description?: string | null
          id?: string
          introduction?: string | null
          is_default?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          terms?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_views: {
        Row: {
          duration_seconds: number | null
          id: string
          proposal_id: string
          viewed_at: string | null
          viewer_ip: string | null
          viewer_user_agent: string | null
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          proposal_id: string
          viewed_at?: string | null
          viewer_ip?: string | null
          viewer_user_agent?: string | null
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          proposal_id?: string
          viewed_at?: string | null
          viewer_ip?: string | null
          viewer_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_views_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          client_email: string | null
          client_name: string | null
          content: Json | null
          created_at: string | null
          declined_at: string | null
          declined_reason: string | null
          discount_amount: number | null
          expires_at: string | null
          id: string
          introduction: string | null
          last_viewed_at: string | null
          notes: string | null
          opportunity_id: string
          organization_id: string
          parent_proposal_id: string | null
          pdf_url: string | null
          public_token: string | null
          sent_at: string | null
          signature_status: string | null
          signed_at: string | null
          status: string
          subtotal: number | null
          template_name: string | null
          terms: string | null
          title: string | null
          total_amount: number | null
          updated_at: string | null
          value: number | null
          version: number | null
          viewed_at: string | null
          views_count: number | null
        }
        Insert: {
          accepted_at?: string | null
          client_email?: string | null
          client_name?: string | null
          content?: Json | null
          created_at?: string | null
          declined_at?: string | null
          declined_reason?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          id?: string
          introduction?: string | null
          last_viewed_at?: string | null
          notes?: string | null
          opportunity_id: string
          organization_id: string
          parent_proposal_id?: string | null
          pdf_url?: string | null
          public_token?: string | null
          sent_at?: string | null
          signature_status?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number | null
          template_name?: string | null
          terms?: string | null
          title?: string | null
          total_amount?: number | null
          updated_at?: string | null
          value?: number | null
          version?: number | null
          viewed_at?: string | null
          views_count?: number | null
        }
        Update: {
          accepted_at?: string | null
          client_email?: string | null
          client_name?: string | null
          content?: Json | null
          created_at?: string | null
          declined_at?: string | null
          declined_reason?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          id?: string
          introduction?: string | null
          last_viewed_at?: string | null
          notes?: string | null
          opportunity_id?: string
          organization_id?: string
          parent_proposal_id?: string | null
          pdf_url?: string | null
          public_token?: string | null
          sent_at?: string | null
          signature_status?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number | null
          template_name?: string | null
          terms?: string | null
          title?: string | null
          total_amount?: number | null
          updated_at?: string | null
          value?: number | null
          version?: number | null
          viewed_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          id: string
          sender: Database["public"]["Enums"]["roleplay_sender_type"]
          session_id: string
          timestamp: string | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          id?: string
          sender: Database["public"]["Enums"]["roleplay_sender_type"]
          session_id: string
          timestamp?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          sender?: Database["public"]["Enums"]["roleplay_sender_type"]
          session_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roleplay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roleplay_sessions: {
        Row: {
          archetype_id: string | null
          coach_notes: string | null
          created_at: string | null
          exchanges_count: number | null
          finished_at: string | null
          icp_id: string | null
          id: string
          linked_opportunity_id: string | null
          meeting_unlocked: boolean | null
          organization_id: string
          passed: boolean | null
          rubric_id: string | null
          score_overall: number | null
          scores_json: Json | null
          seller_id: string
          simulated_client_id: string | null
          started_at: string | null
          time_spent_sec: number | null
          updated_at: string | null
        }
        Insert: {
          archetype_id?: string | null
          coach_notes?: string | null
          created_at?: string | null
          exchanges_count?: number | null
          finished_at?: string | null
          icp_id?: string | null
          id?: string
          linked_opportunity_id?: string | null
          meeting_unlocked?: boolean | null
          organization_id: string
          passed?: boolean | null
          rubric_id?: string | null
          score_overall?: number | null
          scores_json?: Json | null
          seller_id: string
          simulated_client_id?: string | null
          started_at?: string | null
          time_spent_sec?: number | null
          updated_at?: string | null
        }
        Update: {
          archetype_id?: string | null
          coach_notes?: string | null
          created_at?: string | null
          exchanges_count?: number | null
          finished_at?: string | null
          icp_id?: string | null
          id?: string
          linked_opportunity_id?: string | null
          meeting_unlocked?: boolean | null
          organization_id?: string
          passed?: boolean | null
          rubric_id?: string | null
          score_overall?: number | null
          scores_json?: Json | null
          seller_id?: string
          simulated_client_id?: string | null
          started_at?: string | null
          time_spent_sec?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleplay_sessions_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "client_archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "evaluation_rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleplay_sessions_simulated_client_id_fkey"
            columns: ["simulated_client_id"]
            isOneToOne: false
            referencedRelation: "simulated_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stats: {
        Row: {
          accelerator_tier:
            | Database["public"]["Enums"]["accelerator_tier_type"]
            | null
          attendance_pct: number | null
          avg_score: number | null
          created_at: string | null
          id: string
          max_score: number | null
          meetings_unlocked: number | null
          messages_avg_per_roleplay: number | null
          min_score: number | null
          organization_id: string
          period: string
          roleplays_done: number | null
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          accelerator_tier?:
            | Database["public"]["Enums"]["accelerator_tier_type"]
            | null
          attendance_pct?: number | null
          avg_score?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          meetings_unlocked?: number | null
          messages_avg_per_roleplay?: number | null
          min_score?: number | null
          organization_id: string
          period: string
          roleplays_done?: number | null
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          accelerator_tier?:
            | Database["public"]["Enums"]["accelerator_tier_type"]
            | null
          attendance_pct?: number | null
          avg_score?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          meetings_unlocked?: number | null
          messages_avg_per_roleplay?: number | null
          min_score?: number | null
          organization_id?: string
          period?: string
          roleplays_done?: number | null
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string
          hire_date: string | null
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["seller_role_type"] | null
          squad: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email: string
          hire_date?: string | null
          id?: string
          name: string
          organization_id: string
          role?: Database["public"]["Enums"]["seller_role_type"] | null
          squad?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string
          hire_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["seller_role_type"] | null
          squad?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          status: string
          steps: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          steps?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          steps?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          organization_id: string
          section: string
          updated_at: string | null
          user_id: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          organization_id: string
          section: string
          updated_at?: string | null
          user_id?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          organization_id?: string
          section?: string
          updated_at?: string | null
          user_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulated_clients: {
        Row: {
          archetype_id: string | null
          created_at: string | null
          decision_role:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          fake_cnpj: string
          fake_company: string
          fake_name: string
          fake_role: string
          icp_id: string | null
          id: string
          objection_pattern: Json | null
          organization_id: string
          tone_style: Database["public"]["Enums"]["tone_style_type"] | null
        }
        Insert: {
          archetype_id?: string | null
          created_at?: string | null
          decision_role?:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          fake_cnpj: string
          fake_company: string
          fake_name: string
          fake_role: string
          icp_id?: string | null
          id?: string
          objection_pattern?: Json | null
          organization_id: string
          tone_style?: Database["public"]["Enums"]["tone_style_type"] | null
        }
        Update: {
          archetype_id?: string | null
          created_at?: string | null
          decision_role?:
            | Database["public"]["Enums"]["decision_role_type"]
            | null
          fake_cnpj?: string
          fake_company?: string
          fake_name?: string
          fake_role?: string
          icp_id?: string | null
          id?: string
          objection_pattern?: Json | null
          organization_id?: string
          tone_style?: Database["public"]["Enums"]["tone_style_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "simulated_clients_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "client_archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_clients_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulated_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          allow_create_opportunity: boolean | null
          allow_lose_opportunity: boolean | null
          allow_win_opportunity: boolean | null
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          pipeline_id: string | null
          probability: number | null
          stagnation_alert_days: number | null
        }
        Insert: {
          allow_create_opportunity?: boolean | null
          allow_lose_opportunity?: boolean | null
          allow_win_opportunity?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          pipeline_id?: string | null
          probability?: number | null
          stagnation_alert_days?: number | null
        }
        Update: {
          allow_create_opportunity?: boolean | null
          allow_lose_opportunity?: boolean | null
          allow_win_opportunity?: boolean | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          organization_id?: string
          pipeline_id?: string | null
          probability?: number | null
          stagnation_alert_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          id: string
          interval: string | null
          organization_id: string | null
          period_end: string
          period_start: string
          plan_id: string | null
          provider_subscription_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interval?: string | null
          organization_id?: string | null
          period_end: string
          period_start: string
          plan_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interval?: string | null
          organization_id?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string | null
          provider_subscription_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          manager_id: string | null
          monthly_goal: number | null
          name: string
          organization_id: string
          parent_team_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          monthly_goal?: number | null
          name: string
          organization_id: string
          parent_team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          monthly_goal?: number | null
          name?: string
          organization_id?: string
          parent_team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          metric: string
          organization_id: string
          period: string
          value: number | null
        }
        Insert: {
          metric: string
          organization_id: string
          period: string
          value?: number | null
        }
        Update: {
          metric?: string
          organization_id?: string
          period?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_role: Database["public"]["Enums"]["org_role"]
          organization_id: string
          permission_set_id: string | null
          status: string
          team_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id: string
          permission_set_id?: string | null
          status?: string
          team_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id?: string
          permission_set_id?: string | null
          status?: string
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_permission_set_id_fkey"
            columns: ["permission_set_id"]
            isOneToOne: false
            referencedRelation: "permission_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_library: {
        Row: {
          created_at: string | null
          duration_sec: number
          id: string
          language: string | null
          level: Database["public"]["Enums"]["video_level_type"] | null
          organization_id: string
          source: Database["public"]["Enums"]["video_source_type"] | null
          tags: Json | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          duration_sec: number
          id?: string
          language?: string | null
          level?: Database["public"]["Enums"]["video_level_type"] | null
          organization_id: string
          source?: Database["public"]["Enums"]["video_source_type"] | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          duration_sec?: number
          id?: string
          language?: string | null
          level?: Database["public"]["Enums"]["video_level_type"] | null
          organization_id?: string
          source?: Database["public"]["Enums"]["video_source_type"] | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_recommendations: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          reasoning: string | null
          recommended_at: string | null
          seller_id: string
          session_id: string | null
          video_ids: Json | null
          watched: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          reasoning?: string | null
          recommended_at?: string | null
          seller_id: string
          session_id?: string | null
          video_ids?: Json | null
          watched?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          reasoning?: string | null
          recommended_at?: string | null
          seller_id?: string
          session_id?: string | null
          video_ids?: Json | null
          watched?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "video_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_recommendations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_recommendations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "roleplay_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_proposal_public_token: { Args: never; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_permissions: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: {
          p_inc?: number
          p_metric: string
          p_org_id: string
          p_period: string
        }
        Returns: undefined
      }
      user_is_org_admin: { Args: { _org_id: string }; Returns: boolean }
      user_is_org_member: { Args: { _org_id: string }; Returns: boolean }
    }
    Enums: {
      accelerator_tier_type: "NONE" | "BRONZE" | "SILVER" | "GOLD" | "DIAMOND"
      app_role: "admin" | "manager" | "sales"
      archetype_level_type:
        | "Entrada"
        | "Intermediário"
        | "Avançado"
        | "Enterprise"
      client_type:
        | "Organizador"
        | "Expositor"
        | "Agência"
        | "Empresa Contratante"
      decision_role_type: "Decisor" | "Influenciador" | "Usuário-Chave"
      org_role: "owner" | "admin" | "manager" | "sales" | "viewer"
      roleplay_sender_type: "seller" | "ai_client"
      seller_role_type: "Closer" | "SDR" | "Farmer"
      tone_style_type:
        | "técnico"
        | "apressado"
        | "cético"
        | "indeciso"
        | "agressivo"
        | "metódico"
      video_level_type: "Básico" | "Intermediário" | "Avançado"
      video_source_type: "Interno" | "YouTube" | "Vimeo" | "Loom"
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
      accelerator_tier_type: ["NONE", "BRONZE", "SILVER", "GOLD", "DIAMOND"],
      app_role: ["admin", "manager", "sales"],
      archetype_level_type: [
        "Entrada",
        "Intermediário",
        "Avançado",
        "Enterprise",
      ],
      client_type: [
        "Organizador",
        "Expositor",
        "Agência",
        "Empresa Contratante",
      ],
      decision_role_type: ["Decisor", "Influenciador", "Usuário-Chave"],
      org_role: ["owner", "admin", "manager", "sales", "viewer"],
      roleplay_sender_type: ["seller", "ai_client"],
      seller_role_type: ["Closer", "SDR", "Farmer"],
      tone_style_type: [
        "técnico",
        "apressado",
        "cético",
        "indeciso",
        "agressivo",
        "metódico",
      ],
      video_level_type: ["Básico", "Intermediário", "Avançado"],
      video_source_type: ["Interno", "YouTube", "Vimeo", "Loom"],
    },
  },
} as const
