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
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
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
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string | null
          domain: string | null
          id: string
          industry: string | null
          logo_url: string | null
          max_opportunities: number | null
          max_users: number | null
          name: string
          primary_color: string | null
          settings: Json | null
          slug: string
          status: string
          team_size: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_opportunities?: number | null
          max_users?: number | null
          name: string
          primary_color?: string | null
          settings?: Json | null
          slug: string
          status?: string
          team_size?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_opportunities?: number | null
          max_users?: number | null
          name?: string
          primary_color?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          team_size?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      pipelines: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          organization_id: string
          type: string
        }
        Update: {
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
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
      proposals: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
          organization_id: string
          pdf_url: string | null
          sent_at: string | null
          status: string
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          opportunity_id: string
          organization_id: string
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          opportunity_id?: string
          organization_id?: string
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          viewed_at?: string | null
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
          color: string | null
          created_at: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          pipeline_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          order_index: number
          organization_id: string
          pipeline_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          organization_id?: string
          pipeline_id?: string | null
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
      get_user_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
