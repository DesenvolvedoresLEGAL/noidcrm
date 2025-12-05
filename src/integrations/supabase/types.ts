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
      account_partners: {
        Row: {
          account_id: string
          cpf_cnpj_socio: string | null
          created_at: string | null
          data_entrada: string | null
          faixa_etaria: string | null
          id: string
          nome_socio: string
          organization_id: string
          qualificacao: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          cpf_cnpj_socio?: string | null
          created_at?: string | null
          data_entrada?: string | null
          faixa_etaria?: string | null
          id?: string
          nome_socio: string
          organization_id: string
          qualificacao?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          cpf_cnpj_socio?: string | null
          created_at?: string | null
          data_entrada?: string | null
          faixa_etaria?: string | null
          id?: string
          nome_socio?: string
          organization_id?: string
          qualificacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_partners_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_partners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          bairro: string | null
          capital_social: number | null
          cep: string | null
          cidade: string | null
          cnae: string | null
          cnaes_secundarios: string[] | null
          cnpj: string | null
          codigo_externo: string | null
          complemento: string | null
          created_at: string | null
          cs_user_id: string | null
          data_fundacao: string | null
          data_situacao_cadastral: string | null
          data_tornou_cliente: string | null
          email_nota_fiscal: string | null
          emails: string[] | null
          facebook: string | null
          fit_score: number | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          instagram: string | null
          intent_score: number | null
          latitude: number | null
          lead_grade: string | null
          lead_score: number | null
          lifecycle_stage: string | null
          linkedin: string | null
          logo_url: string | null
          logradouro: string | null
          longitude: number | null
          matriz_filial: string | null
          natureza_juridica: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          opcao_mei: boolean | null
          opcao_simples: boolean | null
          organization_id: string
          origem_principal: string | null
          owner_user_id: string | null
          pontuacao_nps: number | null
          porte: string | null
          qualified_at: string | null
          razao_social: string
          score_updated_at: string | null
          scoring_factors: Json | null
          segmento: string | null
          situacao_cadastral: string | null
          tamanho: string | null
          telefones: Json | null
          tipo_empresa: string | null
          uf: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnae?: string | null
          cnaes_secundarios?: string[] | null
          cnpj?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          created_at?: string | null
          cs_user_id?: string | null
          data_fundacao?: string | null
          data_situacao_cadastral?: string | null
          data_tornou_cliente?: string | null
          email_nota_fiscal?: string | null
          emails?: string[] | null
          facebook?: string | null
          fit_score?: number | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          instagram?: string | null
          intent_score?: number | null
          latitude?: number | null
          lead_grade?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          linkedin?: string | null
          logo_url?: string | null
          logradouro?: string | null
          longitude?: number | null
          matriz_filial?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          opcao_mei?: boolean | null
          opcao_simples?: boolean | null
          organization_id: string
          origem_principal?: string | null
          owner_user_id?: string | null
          pontuacao_nps?: number | null
          porte?: string | null
          qualified_at?: string | null
          razao_social: string
          score_updated_at?: string | null
          scoring_factors?: Json | null
          segmento?: string | null
          situacao_cadastral?: string | null
          tamanho?: string | null
          telefones?: Json | null
          tipo_empresa?: string | null
          uf?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          bairro?: string | null
          capital_social?: number | null
          cep?: string | null
          cidade?: string | null
          cnae?: string | null
          cnaes_secundarios?: string[] | null
          cnpj?: string | null
          codigo_externo?: string | null
          complemento?: string | null
          created_at?: string | null
          cs_user_id?: string | null
          data_fundacao?: string | null
          data_situacao_cadastral?: string | null
          data_tornou_cliente?: string | null
          email_nota_fiscal?: string | null
          emails?: string[] | null
          facebook?: string | null
          fit_score?: number | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          instagram?: string | null
          intent_score?: number | null
          latitude?: number | null
          lead_grade?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          linkedin?: string | null
          logo_url?: string | null
          logradouro?: string | null
          longitude?: number | null
          matriz_filial?: string | null
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          opcao_mei?: boolean | null
          opcao_simples?: boolean | null
          organization_id?: string
          origem_principal?: string | null
          owner_user_id?: string | null
          pontuacao_nps?: number | null
          porte?: string | null
          qualified_at?: string | null
          razao_social?: string
          score_updated_at?: string | null
          scoring_factors?: Json | null
          segmento?: string | null
          situacao_cadastral?: string | null
          tamanho?: string | null
          telefones?: Json | null
          tipo_empresa?: string | null
          uf?: string | null
          updated_at?: string | null
          website?: string | null
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
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          target_value: number
          xp_reward: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          target_value: number
          xp_reward?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          target_value?: number
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_organization_id_fkey"
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
          duration_minutes: number | null
          external_id: string | null
          external_link: string | null
          id: string
          is_automated: boolean | null
          opportunity_id: string | null
          organization_id: string
          owner_user_id: string
          scheduled_date: string | null
          sentiment: string | null
          status: string | null
          sync_metadata: Json | null
          sync_provider: string | null
          sync_source: string | null
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
          duration_minutes?: number | null
          external_id?: string | null
          external_link?: string | null
          id?: string
          is_automated?: boolean | null
          opportunity_id?: string | null
          organization_id: string
          owner_user_id: string
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string | null
          sync_metadata?: Json | null
          sync_provider?: string | null
          sync_source?: string | null
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
          duration_minutes?: number | null
          external_id?: string | null
          external_link?: string | null
          id?: string
          is_automated?: boolean | null
          opportunity_id?: string | null
          organization_id?: string
          owner_user_id?: string
          scheduled_date?: string | null
          sentiment?: string | null
          status?: string | null
          sync_metadata?: Json | null
          sync_provider?: string | null
          sync_source?: string | null
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
      activity_participants: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          is_confirmed: boolean | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          is_confirmed?: boolean | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          confidence_score: number
          context_data: Json | null
          created_at: string
          decision_data: Json
          entity_id: string | null
          entity_type: string | null
          executed_at: string | null
          id: string
          organization_id: string
          override_data: Json | null
          override_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number
          context_data?: Json | null
          created_at?: string
          decision_data?: Json
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string | null
          id?: string
          organization_id: string
          override_data?: Json | null
          override_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number
          context_data?: Json | null
          created_at?: string
          decision_data?: Json
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string | null
          id?: string
          organization_id?: string
          override_data?: Json | null
          override_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          metadata: Json | null
          organization_id: string
          priority: string
          resolved_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          metadata?: Json | null
          organization_id: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          ai_action_id: string | null
          corrected_decision: Json | null
          created_at: string
          created_by: string
          feedback_rating: number | null
          feedback_reason: string | null
          feedback_type: string
          id: string
          organization_id: string
          original_decision: Json
        }
        Insert: {
          ai_action_id?: string | null
          corrected_decision?: Json | null
          created_at?: string
          created_by: string
          feedback_rating?: number | null
          feedback_reason?: string | null
          feedback_type: string
          id?: string
          organization_id: string
          original_decision: Json
        }
        Update: {
          ai_action_id?: string | null
          corrected_decision?: Json | null
          created_at?: string
          created_by?: string
          feedback_rating?: number | null
          feedback_reason?: string | null
          feedback_type?: string
          id?: string
          organization_id?: string
          original_decision?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_ai_action_id_fkey"
            columns: ["ai_action_id"]
            isOneToOne: false
            referencedRelation: "ai_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          action_taken_at: string | null
          confidence_score: number | null
          created_at: string
          current_value: Json | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          field_name: string | null
          id: string
          opportunity_id: string | null
          organization_id: string
          reasoning: string | null
          status: string
          suggested_value: Json | null
          suggestion_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken_at?: string | null
          confidence_score?: number | null
          created_at?: string
          current_value?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          field_name?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id: string
          reasoning?: string | null
          status?: string
          suggested_value?: Json | null
          suggestion_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken_at?: string | null
          confidence_score?: number | null
          created_at?: string
          current_value?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          field_name?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string
          reasoning?: string | null
          status?: string
          suggested_value?: Json | null
          suggestion_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_organization_id_fkey"
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
          entity_id: string | null
          entity_type: string | null
          field_name: string | null
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
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
            referencedRelation: "pipeline_health"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "automation_config_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipeline_metrics"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "automation_config_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_config_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_metrics"
            referencedColumns: ["pipeline_id"]
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
      badges: {
        Row: {
          category: string
          code: string
          created_at: string | null
          criteria: Json
          description: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          rarity: number
          xp_reward: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          criteria?: Json
          description: string
          icon: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          rarity?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          rarity?: number
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "badges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      calendar_sync_config: {
        Row: {
          access_token_encrypted: string | null
          auto_log_enabled: boolean | null
          calendar_id: string | null
          calendar_name: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted: string | null
          sync_enabled: boolean | null
          sync_from_date: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          auto_log_enabled?: boolean | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          auto_log_enabled?: boolean | null
          calendar_id?: string | null
          calendar_name?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_config_organization_id_fkey"
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
      custom_field_groups: {
        Row: {
          created_at: string
          display_order: number
          entity_type: string
          id: string
          is_active: boolean
          is_collapsed_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          entity_type: string
          id?: string
          is_active?: boolean
          is_collapsed_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          entity_type?: string
          id?: string
          is_active?: boolean
          is_collapsed_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          custom_field_id: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          custom_field_id: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          custom_field_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string
          default_value: string | null
          display_order: number
          entity_type: string
          field_key: string
          field_type: string
          group_id: string | null
          help_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          options: Json | null
          organization_id: string
          updated_at: string
          validation_rules: Json | null
          visibility_config: Json | null
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          entity_type: string
          field_key: string
          field_type: string
          group_id?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          options?: Json | null
          organization_id: string
          updated_at?: string
          validation_rules?: Json | null
          visibility_config?: Json | null
        }
        Update: {
          created_at?: string
          default_value?: string | null
          display_order?: number
          entity_type?: string
          field_key?: string
          field_type?: string
          group_id?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          options?: Json | null
          organization_id?: string
          updated_at?: string
          validation_rules?: Json | null
          visibility_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "custom_field_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefings: {
        Row: {
          at_risk_deals: Json
          briefing_date: string
          created_at: string
          hot_opportunities: Json
          id: string
          organization_id: string
          priority_actions: Json
          summary: string | null
          tasks_created: number | null
          user_id: string
        }
        Insert: {
          at_risk_deals?: Json
          briefing_date: string
          created_at?: string
          hot_opportunities?: Json
          id?: string
          organization_id: string
          priority_actions?: Json
          summary?: string | null
          tasks_created?: number | null
          user_id: string
        }
        Update: {
          at_risk_deals?: Json
          briefing_date?: string
          created_at?: string
          hot_opportunities?: Json
          id?: string
          organization_id?: string
          priority_actions?: Json
          summary?: string | null
          tasks_created?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_participants: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
          organization_id: string
          role: string
          share_percentage: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          opportunity_id: string
          organization_id: string
          role?: string
          share_percentage?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          opportunity_id?: string
          organization_id?: string
          role?: string
          share_percentage?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_participants_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_variables: {
        Row: {
          category: string
          created_at: string
          description: string | null
          format_type: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          organization_id: string | null
          source_entity: string | null
          source_field: string | null
          updated_at: string
          variable_key: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          format_type?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          organization_id?: string | null
          source_entity?: string | null
          source_field?: string | null
          updated_at?: string
          variable_key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          format_type?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          organization_id?: string | null
          source_entity?: string | null
          source_field?: string | null
          updated_at?: string
          variable_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_variables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_config: {
        Row: {
          access_token_encrypted: string | null
          auto_log_enabled: boolean | null
          created_at: string | null
          email_address: string
          id: string
          last_sync_at: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted: string | null
          sync_enabled: boolean | null
          sync_from_date: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          auto_log_enabled?: boolean | null
          created_at?: string | null
          email_address: string
          id?: string
          last_sync_at?: string | null
          organization_id: string
          provider: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          auto_log_enabled?: boolean | null
          created_at?: string | null
          email_address?: string
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          provider?: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          sync_from_date?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
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
      export_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          entity_type: string
          error_message: string | null
          executed_by: string | null
          file_path: string | null
          file_size: number | null
          format: string
          id: string
          organization_id: string
          record_count: number | null
          scheduled_export_id: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          entity_type: string
          error_message?: string | null
          executed_by?: string | null
          file_path?: string | null
          file_size?: number | null
          format: string
          id?: string
          organization_id: string
          record_count?: number | null
          scheduled_export_id?: string | null
          status: string
          template_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          entity_type?: string
          error_message?: string | null
          executed_by?: string | null
          file_path?: string | null
          file_size?: number | null
          format?: string
          id?: string
          organization_id?: string
          record_count?: number | null
          scheduled_export_id?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_logs_scheduled_export_id_fkey"
            columns: ["scheduled_export_id"]
            isOneToOne: false
            referencedRelation: "scheduled_exports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "export_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      export_templates: {
        Row: {
          columns: Json
          created_at: string | null
          created_by: string
          description: string | null
          entity_type: string
          filters: Json | null
          format: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          columns?: Json
          created_at?: string | null
          created_by: string
          description?: string | null
          entity_type: string
          filters?: Json | null
          format: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string | null
          created_by?: string
          description?: string | null
          entity_type?: string
          filters?: Json | null
          format?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_templates_organization_id_fkey"
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
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          entity_type: string
          error_count: number | null
          error_details: Json | null
          file_name: string
          id: string
          operation_mode: string | null
          organization_id: string
          relationship_count: number | null
          status: string
          success_count: number | null
          total_rows: number
          update_count: number | null
          upsert_settings: Json | null
          user_id: string
          warning_count: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          entity_type: string
          error_count?: number | null
          error_details?: Json | null
          file_name: string
          id?: string
          operation_mode?: string | null
          organization_id: string
          relationship_count?: number | null
          status?: string
          success_count?: number | null
          total_rows: number
          update_count?: number | null
          upsert_settings?: Json | null
          user_id: string
          warning_count?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          entity_type?: string
          error_count?: number | null
          error_details?: Json | null
          file_name?: string
          id?: string
          operation_mode?: string | null
          organization_id?: string
          relationship_count?: number | null
          status?: string
          success_count?: number | null
          total_rows?: number
          update_count?: number | null
          upsert_settings?: Json | null
          user_id?: string
          warning_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          pipeline_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          pipeline_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          pipeline_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          abbreviation: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          abbreviation: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string
          icon: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          target_type: string
          target_value: number
          type: string
          xp_reward: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          target_type: string
          target_value?: number
          type: string
          xp_reward?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          target_type?: string
          target_value?: number
          type?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          organization_id: string
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          organization_id: string
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          organization_id?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_nonces: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          provider: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce: string
          provider: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          provider?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          engagement_score: number | null
          fonte: string | null
          id: string
          last_contact_date: string | null
          loss_comment: string | null
          loss_reason_id: string | null
          next_followup_date: string | null
          opportunity_score: number | null
          organization_id: string
          origem: string | null
          owner_user_id: string
          pipeline_id: string | null
          prob: number | null
          produto: string | null
          qualified_at: string | null
          qualified_by_user_id: string | null
          risk_score: number | null
          score_confidence: string | null
          score_updated_at: string | null
          scoring_factors: Json | null
          source_opportunity_id: string | null
          stage_id: string | null
          status: string | null
          temperatura: string | null
          temperature: string | null
          title: string
          updated_at: string | null
          urgency_score: number | null
          valor_previsto: number | null
          velocity_score: number | null
          win_probability_ai: number | null
        }
        Insert: {
          account_id?: string | null
          automation_enabled?: boolean | null
          close_date_prevista?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_contact?: number | null
          engagement_score?: number | null
          fonte?: string | null
          id?: string
          last_contact_date?: string | null
          loss_comment?: string | null
          loss_reason_id?: string | null
          next_followup_date?: string | null
          opportunity_score?: number | null
          organization_id: string
          origem?: string | null
          owner_user_id: string
          pipeline_id?: string | null
          prob?: number | null
          produto?: string | null
          qualified_at?: string | null
          qualified_by_user_id?: string | null
          risk_score?: number | null
          score_confidence?: string | null
          score_updated_at?: string | null
          scoring_factors?: Json | null
          source_opportunity_id?: string | null
          stage_id?: string | null
          status?: string | null
          temperatura?: string | null
          temperature?: string | null
          title: string
          updated_at?: string | null
          urgency_score?: number | null
          valor_previsto?: number | null
          velocity_score?: number | null
          win_probability_ai?: number | null
        }
        Update: {
          account_id?: string | null
          automation_enabled?: boolean | null
          close_date_prevista?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_contact?: number | null
          engagement_score?: number | null
          fonte?: string | null
          id?: string
          last_contact_date?: string | null
          loss_comment?: string | null
          loss_reason_id?: string | null
          next_followup_date?: string | null
          opportunity_score?: number | null
          organization_id?: string
          origem?: string | null
          owner_user_id?: string
          pipeline_id?: string | null
          prob?: number | null
          produto?: string | null
          qualified_at?: string | null
          qualified_by_user_id?: string | null
          risk_score?: number | null
          score_confidence?: string | null
          score_updated_at?: string | null
          scoring_factors?: Json | null
          source_opportunity_id?: string | null
          stage_id?: string | null
          status?: string | null
          temperatura?: string | null
          temperature?: string | null
          title?: string
          updated_at?: string | null
          urgency_score?: number | null
          valor_previsto?: number | null
          velocity_score?: number | null
          win_probability_ai?: number | null
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
            foreignKeyName: "opportunities_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
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
            referencedRelation: "pipeline_health"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipeline_metrics"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_metrics"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "opportunities_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_health"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_metrics"
            referencedColumns: ["stage_id"]
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
      opportunity_emails: {
        Row: {
          body: string
          cc_emails: string[] | null
          clicked_at: string | null
          created_at: string
          from_email: string
          id: string
          link_clicks: Json | null
          opened_at: string | null
          opened_count: number | null
          opportunity_id: string
          organization_id: string
          sent_at: string
          sent_by: string
          subject: string
          to_emails: string[]
          updated_at: string
        }
        Insert: {
          body: string
          cc_emails?: string[] | null
          clicked_at?: string | null
          created_at?: string
          from_email: string
          id?: string
          link_clicks?: Json | null
          opened_at?: string | null
          opened_count?: number | null
          opportunity_id: string
          organization_id: string
          sent_at?: string
          sent_by: string
          subject: string
          to_emails?: string[]
          updated_at?: string
        }
        Update: {
          body?: string
          cc_emails?: string[] | null
          clicked_at?: string | null
          created_at?: string
          from_email?: string
          id?: string
          link_clicks?: Json | null
          opened_at?: string | null
          opened_count?: number | null
          opportunity_id?: string
          organization_id?: string
          sent_at?: string
          sent_by?: string
          subject?: string
          to_emails?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_emails_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_emails_sent_by_profiles_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      opportunity_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          opportunity_id: string
          organization_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          opportunity_id: string
          organization_id: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          opportunity_id?: string
          organization_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_files_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_files_uploaded_by_profiles_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      opportunity_tags: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          opportunity_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          opportunity_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tags_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
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
          default_currency: string | null
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
          proposal_prefix: string | null
          proposal_sequence: number | null
          proposal_validity_days: number | null
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
          default_currency?: string | null
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
          proposal_prefix?: string | null
          proposal_sequence?: number | null
          proposal_validity_days?: number | null
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
          default_currency?: string | null
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
          proposal_prefix?: string | null
          proposal_sequence?: number | null
          proposal_validity_days?: number | null
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
      origin_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "origin_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      origins: {
        Row: {
          created_at: string | null
          description: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "origins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "origin_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "origins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_release_changes: {
        Row: {
          change_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          processed_at: string | null
          release_note_id: string | null
        }
        Insert: {
          change_type?: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          release_note_id?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          release_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_release_changes_release_note_id_fkey"
            columns: ["release_note_id"]
            isOneToOne: false
            referencedRelation: "release_notes"
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
          pipeline_type: string | null
          type: string
        }
        Insert: {
          business_unit_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          organization_id: string
          pipeline_type?: string | null
          type: string
        }
        Update: {
          business_unit_ids?: string[] | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          pipeline_type?: string | null
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
      product_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
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
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_cost: number | null
          new_price: number | null
          old_cost: number | null
          old_price: number | null
          organization_id: string
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          organization_id: string
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          organization_id?: string
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category_id: string | null
          code: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          ipi_percent: number
          name: string
          organization_id: string
          price: number | null
          reference: string | null
          type: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          code?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ipi_percent?: number
          name: string
          organization_id: string
          price?: number | null
          reference?: string | null
          type?: string
          unit?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          code?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ipi_percent?: number
          name?: string
          organization_id?: string
          price?: number | null
          reference?: string | null
          type?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
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
      proposal_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          organization_id: string
          proposal_id: string
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          organization_id: string
          proposal_id: string
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          organization_id?: string
          proposal_id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_alerts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
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
      proposal_layout_pages: {
        Row: {
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          layout_id: string
          page_number: number
          page_type: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          layout_id: string
          page_number: number
          page_type?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          layout_id?: string
          page_number?: number
          page_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_layout_pages_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "proposal_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_layouts: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          pipeline_ids: string[] | null
          terms_pdf_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          pipeline_ids?: string[] | null
          terms_pdf_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          pipeline_ids?: string[] | null
          terms_pdf_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_layouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_participants: {
        Row: {
          can_edit: boolean | null
          created_at: string | null
          id: string
          notified_at: string | null
          organization_id: string
          proposal_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string | null
          id?: string
          notified_at?: string | null
          organization_id: string
          proposal_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string | null
          id?: string
          notified_at?: string | null
          organization_id?: string
          proposal_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_participants_proposal_id_fkey"
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
          payment_method: string | null
          payment_type: string
          proposal_id: string
          recurring_due_day: number | null
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
          payment_method?: string | null
          payment_type?: string
          proposal_id: string
          recurring_due_day?: number | null
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
          payment_method?: string | null
          payment_type?: string
          proposal_id?: string
          recurring_due_day?: number | null
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
          control_prefix: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          default_items: Json | null
          description: string | null
          discount_percent_default: number | null
          due_day_default: number | null
          entry_days_default: number | null
          entry_percent_default: number | null
          id: string
          installment_interval_days: number | null
          installments_default: number | null
          introduction: string | null
          is_default: boolean | null
          layout_id: string | null
          mrr_comment: string | null
          mrr_due_day: number | null
          mrr_first_payment_days: number | null
          mrr_payment_method: string | null
          name: string
          notes: string | null
          observations: string | null
          organization_id: string
          payment_comment: string | null
          payment_method_default: string | null
          terms: string | null
          updated_at: string | null
          validity_days: number | null
        }
        Insert: {
          control_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_items?: Json | null
          description?: string | null
          discount_percent_default?: number | null
          due_day_default?: number | null
          entry_days_default?: number | null
          entry_percent_default?: number | null
          id?: string
          installment_interval_days?: number | null
          installments_default?: number | null
          introduction?: string | null
          is_default?: boolean | null
          layout_id?: string | null
          mrr_comment?: string | null
          mrr_due_day?: number | null
          mrr_first_payment_days?: number | null
          mrr_payment_method?: string | null
          name: string
          notes?: string | null
          observations?: string | null
          organization_id: string
          payment_comment?: string | null
          payment_method_default?: string | null
          terms?: string | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Update: {
          control_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          default_items?: Json | null
          description?: string | null
          discount_percent_default?: number | null
          due_day_default?: number | null
          entry_days_default?: number | null
          entry_percent_default?: number | null
          id?: string
          installment_interval_days?: number | null
          installments_default?: number | null
          introduction?: string | null
          is_default?: boolean | null
          layout_id?: string | null
          mrr_comment?: string | null
          mrr_due_day?: number | null
          mrr_first_payment_days?: number | null
          mrr_payment_method?: string | null
          name?: string
          notes?: string | null
          observations?: string | null
          organization_id?: string
          payment_comment?: string | null
          payment_method_default?: string | null
          terms?: string | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "proposal_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_view_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          proposal_id: string
          session_id: string
          timestamp: string
          view_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          proposal_id: string
          session_id: string
          timestamp?: string
          view_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          proposal_id?: string
          session_id?: string
          timestamp?: string
          view_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_view_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_view_events_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "proposal_views"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          duration_seconds: number | null
          id: string
          interactions: Json | null
          is_forwarded: boolean | null
          proposal_id: string
          referrer: string | null
          scroll_depth_percent: number | null
          section_views: Json | null
          sections_viewed: string[] | null
          session_id: string | null
          time_per_section: Json | null
          view_end_at: string | null
          viewed_at: string | null
          viewer_ip: string | null
          viewer_type: string | null
          viewer_user_agent: string | null
          viewer_user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          interactions?: Json | null
          is_forwarded?: boolean | null
          proposal_id: string
          referrer?: string | null
          scroll_depth_percent?: number | null
          section_views?: Json | null
          sections_viewed?: string[] | null
          session_id?: string | null
          time_per_section?: Json | null
          view_end_at?: string | null
          viewed_at?: string | null
          viewer_ip?: string | null
          viewer_type?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          id?: string
          interactions?: Json | null
          is_forwarded?: boolean | null
          proposal_id?: string
          referrer?: string | null
          scroll_depth_percent?: number | null
          section_views?: Json | null
          sections_viewed?: string[] | null
          session_id?: string | null
          time_per_section?: Json | null
          view_end_at?: string | null
          viewed_at?: string | null
          viewer_ip?: string | null
          viewer_type?: string | null
          viewer_user_agent?: string | null
          viewer_user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
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
          acceptance_hash: string | null
          acceptance_proof_url: string | null
          accepted_at: string | null
          acceptor_document: string | null
          acceptor_ip: string | null
          acceptor_name: string | null
          acceptor_position: string | null
          acceptor_user_agent: string | null
          client_email: string | null
          client_name: string | null
          content: Json | null
          created_at: string | null
          currency: string | null
          declined_at: string | null
          declined_reason: string | null
          discount_amount: number | null
          expires_at: string | null
          id: string
          introduction: string | null
          last_viewed_at: string | null
          layout_id: string | null
          notes: string | null
          opportunity_id: string
          organization_id: string
          parent_proposal_id: string | null
          pdf_url: string | null
          proposal_number: string | null
          proposal_version: number | null
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
          acceptance_hash?: string | null
          acceptance_proof_url?: string | null
          accepted_at?: string | null
          acceptor_document?: string | null
          acceptor_ip?: string | null
          acceptor_name?: string | null
          acceptor_position?: string | null
          acceptor_user_agent?: string | null
          client_email?: string | null
          client_name?: string | null
          content?: Json | null
          created_at?: string | null
          currency?: string | null
          declined_at?: string | null
          declined_reason?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          id?: string
          introduction?: string | null
          last_viewed_at?: string | null
          layout_id?: string | null
          notes?: string | null
          opportunity_id: string
          organization_id: string
          parent_proposal_id?: string | null
          pdf_url?: string | null
          proposal_number?: string | null
          proposal_version?: number | null
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
          acceptance_hash?: string | null
          acceptance_proof_url?: string | null
          accepted_at?: string | null
          acceptor_document?: string | null
          acceptor_ip?: string | null
          acceptor_name?: string | null
          acceptor_position?: string | null
          acceptor_user_agent?: string | null
          client_email?: string | null
          client_name?: string | null
          content?: Json | null
          created_at?: string | null
          currency?: string | null
          declined_at?: string | null
          declined_reason?: string | null
          discount_amount?: number | null
          expires_at?: string | null
          id?: string
          introduction?: string | null
          last_viewed_at?: string | null
          layout_id?: string | null
          notes?: string | null
          opportunity_id?: string
          organization_id?: string
          parent_proposal_id?: string | null
          pdf_url?: string | null
          proposal_number?: string | null
          proposal_version?: number | null
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
            foreignKeyName: "proposals_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "proposal_layouts"
            referencedColumns: ["id"]
          },
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
      rate_limit_log: {
        Row: {
          blocked: boolean | null
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          blocked?: boolean | null
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          blocked?: boolean | null
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      release_notes: {
        Row: {
          changes: Json
          created_at: string | null
          description: string | null
          id: string
          is_major: boolean | null
          organization_id: string | null
          release_date: string
          title: string
          version: string
        }
        Insert: {
          changes?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_major?: boolean | null
          organization_id?: string | null
          release_date?: string
          title: string
          version: string
        }
        Update: {
          changes?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_major?: boolean | null
          organization_id?: string | null
          release_date?: string
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_notes_organization_id_fkey"
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
          checkpoints_reached: Json | null
          coach_notes: string | null
          created_at: string | null
          current_phase: string | null
          exchanges_count: number | null
          finished_at: string | null
          icp_id: string | null
          id: string
          linked_opportunity_id: string | null
          meeting_unlocked: boolean | null
          objections_resolved: string[] | null
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
          checkpoints_reached?: Json | null
          coach_notes?: string | null
          created_at?: string | null
          current_phase?: string | null
          exchanges_count?: number | null
          finished_at?: string | null
          icp_id?: string | null
          id?: string
          linked_opportunity_id?: string | null
          meeting_unlocked?: boolean | null
          objections_resolved?: string[] | null
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
          checkpoints_reached?: Json | null
          coach_notes?: string | null
          created_at?: string | null
          current_phase?: string | null
          exchanges_count?: number | null
          finished_at?: string | null
          icp_id?: string | null
          id?: string
          linked_opportunity_id?: string | null
          meeting_unlocked?: boolean | null
          objections_resolved?: string[] | null
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
      scheduled_exports: {
        Row: {
          created_at: string | null
          created_by: string
          cron_expression: string
          description: string | null
          email_recipients: string[]
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          run_count: number | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          cron_expression: string
          description?: string | null
          email_recipients?: string[]
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          run_count?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          cron_expression?: string
          description?: string | null
          email_recipients?: string[]
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          run_count?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_exports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "export_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      score_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          organization_id: string
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          organization_id: string
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          organization_id?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          change_reason: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          factors: Json | null
          id: string
          new_value: number
          old_value: number | null
          organization_id: string
          score_type: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          factors?: Json | null
          id?: string
          new_value: number
          old_value?: number | null
          organization_id: string
          score_type: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          factors?: Json | null
          id?: string
          new_value?: number
          old_value?: number | null
          organization_id?: string
          score_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          condition_field: string
          condition_operator: string
          condition_value: string | null
          created_at: string | null
          description: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          points: number
          score_type: string
          updated_at: string | null
        }
        Insert: {
          condition_field: string
          condition_operator: string
          condition_value?: string | null
          created_at?: string | null
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          points: number
          score_type: string
          updated_at?: string | null
        }
        Update: {
          condition_field?: string
          condition_operator?: string
          condition_value?: string | null
          created_at?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          points?: number
          score_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          organization_id: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organization_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_achievements: {
        Row: {
          achievement_id: string
          completed: boolean | null
          completed_at: string | null
          current_progress: number | null
          id: string
          notified: boolean | null
          seller_id: string
        }
        Insert: {
          achievement_id: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          notified?: boolean | null
          seller_id: string
        }
        Update: {
          achievement_id?: string
          completed?: boolean | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          notified?: boolean | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_achievements_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_badges: {
        Row: {
          badge_id: string
          id: string
          metadata: Json | null
          notified: boolean | null
          seller_id: string
          unlocked_at: string | null
        }
        Insert: {
          badge_id: string
          id?: string
          metadata?: Json | null
          notified?: boolean | null
          seller_id: string
          unlocked_at?: string | null
        }
        Update: {
          badge_id?: string
          id?: string
          metadata?: Json | null
          notified?: boolean | null
          seller_id?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_badges_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_missions: {
        Row: {
          claimed: boolean | null
          claimed_at: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          current_progress: number | null
          id: string
          mission_id: string
          period_start: string
          seller_id: string
        }
        Insert: {
          claimed?: boolean | null
          claimed_at?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          current_progress?: number | null
          id?: string
          mission_id: string
          period_start: string
          seller_id: string
        }
        Update: {
          claimed?: boolean | null
          claimed_at?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          current_progress?: number | null
          id?: string
          mission_id?: string
          period_start?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_missions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
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
          current_level: number | null
          current_title: string | null
          email: string
          hire_date: string | null
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["seller_role_type"] | null
          squad: string | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          current_level?: number | null
          current_title?: string | null
          email: string
          hire_date?: string | null
          id?: string
          name: string
          organization_id: string
          role?: Database["public"]["Enums"]["seller_role_type"] | null
          squad?: string | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          current_level?: number | null
          current_title?: string | null
          email?: string
          hire_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["seller_role_type"] | null
          squad?: string | null
          total_xp?: number | null
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
      sequence_enrollments: {
        Row: {
          ab_variant: string | null
          completed_at: string | null
          created_at: string | null
          current_step_index: number
          engagement_data: Json | null
          enrolled_at: string
          exit_reason: string | null
          id: string
          last_step_executed_at: string | null
          next_step_scheduled_at: string | null
          opportunity_id: string
          organization_id: string
          pause_reason: string | null
          paused_at: string | null
          sequence_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          ab_variant?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step_index?: number
          engagement_data?: Json | null
          enrolled_at?: string
          exit_reason?: string | null
          id?: string
          last_step_executed_at?: string | null
          next_step_scheduled_at?: string | null
          opportunity_id: string
          organization_id: string
          pause_reason?: string | null
          paused_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          ab_variant?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step_index?: number
          engagement_data?: Json | null
          enrolled_at?: string
          exit_reason?: string | null
          id?: string
          last_step_executed_at?: string | null
          next_step_scheduled_at?: string | null
          opportunity_id?: string
          organization_id?: string
          pause_reason?: string | null
          paused_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          ab_test_results: Json | null
          ai_enabled: boolean | null
          ai_variations: Json | null
          auto_pause_rules: Json | null
          created_at: string | null
          description: string | null
          entry_criteria: Json | null
          id: string
          name: string
          organization_id: string
          status: string
          steps: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          ab_test_results?: Json | null
          ai_enabled?: boolean | null
          ai_variations?: Json | null
          auto_pause_rules?: Json | null
          created_at?: string | null
          description?: string | null
          entry_criteria?: Json | null
          id?: string
          name: string
          organization_id: string
          status?: string
          steps?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          ab_test_results?: Json | null
          ai_enabled?: boolean | null
          ai_variations?: Json | null
          auto_pause_rules?: Json | null
          created_at?: string | null
          description?: string | null
          entry_criteria?: Json | null
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
      stage_progression_suggestions: {
        Row: {
          action_taken_at: string | null
          confidence_score: number | null
          created_at: string | null
          current_stage_id: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          opportunity_id: string
          organization_id: string
          reasoning: string
          status: string
          suggested_stage_id: string | null
        }
        Insert: {
          action_taken_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_stage_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id: string
          organization_id: string
          reasoning: string
          status?: string
          suggested_stage_id?: string | null
        }
        Update: {
          action_taken_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_stage_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          opportunity_id?: string
          organization_id?: string
          reasoning?: string
          status?: string
          suggested_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_progression_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_progression_suggestions_organization_id_fkey"
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
            referencedRelation: "pipeline_health"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipeline_metrics"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_metrics"
            referencedColumns: ["pipeline_id"]
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
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          items_created: number | null
          items_processed: number | null
          items_updated: number | null
          organization_id: string
          provider: string
          started_at: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          items_updated?: number | null
          organization_id: string
          provider: string
          started_at?: string | null
          status: string
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          items_updated?: number | null
          organization_id?: string
          provider?: string
          started_at?: string | null
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string | null
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: string | null
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string | null
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          visibility_scope: string | null
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
          visibility_scope?: string | null
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
          visibility_scope?: string | null
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
      territories: {
        Row: {
          created_at: string | null
          criteria: Json | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_assignments: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string | null
          territory_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: string | null
          territory_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string | null
          territory_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_assignments_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
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
      workflow_executions: {
        Row: {
          actions_executed: Json
          activity_id: string | null
          completed_at: string | null
          conditions_evaluated: Json | null
          created_at: string
          error_message: string | null
          id: string
          opportunity_id: string | null
          organization_id: string
          started_at: string
          status: string
          trigger_data: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger_type"]
          workflow_rule_id: string
        }
        Insert: {
          actions_executed?: Json
          activity_id?: string | null
          completed_at?: string | null
          conditions_evaluated?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id: string
          started_at?: string
          status?: string
          trigger_data?: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger_type"]
          workflow_rule_id: string
        }
        Update: {
          actions_executed?: Json
          activity_id?: string | null
          completed_at?: string | null
          conditions_evaluated?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          opportunity_id?: string | null
          organization_id?: string
          started_at?: string
          status?: string
          trigger_data?: Json
          trigger_type?: Database["public"]["Enums"]["workflow_trigger_type"]
          workflow_rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_rule_id_fkey"
            columns: ["workflow_rule_id"]
            isOneToOne: false
            referencedRelation: "workflow_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          execution_order: number
          executions_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          organization_id: string
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger_type"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_order?: number
          executions_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          organization_id: string
          trigger_config?: Json
          trigger_type: Database["public"]["Enums"]["workflow_trigger_type"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          execution_order?: number
          executions_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          organization_id?: string
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["workflow_trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      closer_performance: {
        Row: {
          avg_deal_size: number | null
          avg_sales_cycle_days: number | null
          closer_name: string | null
          closer_user_id: string | null
          deals_active: number | null
          deals_lost: number | null
          deals_won: number | null
          organization_id: string | null
          pipeline_value: number | null
          revenue_closed: number | null
          win_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_metrics: {
        Row: {
          active_after_handoff: number | null
          avg_qualification_hours: number | null
          closer_name: string | null
          closer_user_id: string | null
          handoff_win_rate: number | null
          lost_after_handoff: number | null
          organization_id: string | null
          revenue_from_handoffs: number | null
          sdr_name: string | null
          sdr_user_id: string | null
          total_handoffs: number | null
          won_after_handoff: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_health: {
        Row: {
          avg_age_days: number | null
          deal_count: number | null
          lost_deals: number | null
          order_index: number | null
          organization_id: string | null
          pipeline_id: string | null
          pipeline_name: string | null
          probability: number | null
          stage_id: string | null
          stage_name: string | null
          stale_deals: number | null
          total_value: number | null
          weighted_value: number | null
          won_deals: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_metrics: {
        Row: {
          active_count: number | null
          avg_won_value: number | null
          lost_count: number | null
          organization_id: string | null
          pipeline_id: string | null
          pipeline_name: string | null
          pipeline_type: string | null
          total_opportunities: number | null
          total_value: number | null
          win_rate: number | null
          won_count: number | null
          won_value: number | null
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
      proposal_items_public: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percent: number | null
          id: string | null
          name: string | null
          order_index: number | null
          organization_id: string | null
          product_id: string | null
          proposal_id: string | null
          quantity: number | null
          total: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string | null
          name?: string | null
          order_index?: number | null
          organization_id?: string | null
          product_id?: string | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string | null
          name?: string | null
          order_index?: number | null
          organization_id?: string | null
          product_id?: string | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
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
      sdr_performance: {
        Row: {
          avg_qualification_hours: number | null
          conversion_rate: number | null
          deals_lost: number | null
          deals_won: number | null
          organization_id: string | null
          revenue_attributed: number | null
          sdr_name: string | null
          sdr_user_id: string | null
          total_sqls_generated: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_conversion_metrics: {
        Row: {
          conversion_rate_to_next: number | null
          opportunities_count: number | null
          order_index: number | null
          organization_id: string | null
          pipeline_id: string | null
          pipeline_name: string | null
          pipeline_type: string | null
          stage_id: string | null
          stage_name: string | null
          stage_value: number | null
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
      unified_timeline: {
        Row: {
          account_id: string | null
          activity_type: string | null
          contact_id: string | null
          id: string | null
          metadata: Json | null
          metadata_type: string | null
          opportunity_id: string | null
          organization_id: string | null
          owner_user_id: string | null
          timestamp: string | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_lead_grade: { Args: { score: number }; Returns: string }
      can_view_all: { Args: { _user_id: string }; Returns: boolean }
      can_view_by_team: {
        Args: { _owner_user_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_opportunity: {
        Args: { _opportunity_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_user_data: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      cleanup_expired_oauth_nonces: { Args: never; Returns: number }
      create_proposal_version: {
        Args: { p_proposal_id: string }
        Returns: string
      }
      create_system_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_org_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      detect_proposal_forward: {
        Args: { p_proposal_id: string; p_viewer_ip: string }
        Returns: boolean
      }
      generate_acceptance_hash: {
        Args: {
          p_acceptor_document: string
          p_proposal_id: string
          p_timestamp: string
        }
        Returns: string
      }
      generate_proposal_number: {
        Args: { p_org_id: string; p_prefix?: string }
        Returns: string
      }
      generate_proposal_public_token: { Args: never; Returns: string }
      get_team_member_ids: { Args: { _manager_id: string }; Returns: string[] }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_permissions: { Args: { _user_id: string }; Returns: Json }
      get_user_settings_access_level: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      get_visible_user_ids: { Args: { _user_id: string }; Returns: string[] }
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
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_team_manager: { Args: { _user_id: string }; Returns: boolean }
      preview_next_proposal_number: {
        Args: { p_org_id: string; p_prefix?: string }
        Returns: string
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
      workflow_action_type:
        | "move_stage"
        | "move_pipeline"
        | "duplicate"
        | "close_won"
        | "close_lost"
        | "create_activity"
        | "update_fields"
        | "notify_user"
        | "send_email"
      workflow_trigger_type:
        | "stage_enter"
        | "stage_exit"
        | "opportunity_won"
        | "opportunity_lost"
        | "activity_completed"
        | "opportunity_created"
        | "field_changed"
        | "proposal_viewed"
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
      workflow_action_type: [
        "move_stage",
        "move_pipeline",
        "duplicate",
        "close_won",
        "close_lost",
        "create_activity",
        "update_fields",
        "notify_user",
        "send_email",
      ],
      workflow_trigger_type: [
        "stage_enter",
        "stage_exit",
        "opportunity_won",
        "opportunity_lost",
        "activity_completed",
        "opportunity_created",
        "field_changed",
        "proposal_viewed",
      ],
    },
  },
} as const
