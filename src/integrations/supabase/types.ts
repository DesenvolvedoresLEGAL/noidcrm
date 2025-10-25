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
      accounts: {
        Row: {
          cnae: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          nome_fantasia: string | null
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
          origem_principal?: string | null
          razao_social?: string
          segmento?: string | null
          tamanho?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          pipeline_id?: string | null
          updated_at?: string | null
          work_hours_end?: string | null
          work_hours_start?: string | null
        }
        Relationships: [
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
      contacts: {
        Row: {
          account_id: string | null
          cargo: string | null
          created_at: string | null
          emails: string[] | null
          id: string
          nome: string
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
        ]
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
      pipelines: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
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
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
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
          status?: string
          steps?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          section: string
          updated_at: string | null
          user_id: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          section: string
          updated_at?: string | null
          user_id?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          section?: string
          updated_at?: string | null
          user_id?: string | null
          value?: Json
        }
        Relationships: []
      }
      stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          order_index: number
          pipeline_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id: string
          name: string
          order_index: number
          pipeline_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          pipeline_id?: string | null
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "sales"
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
      app_role: ["admin", "manager", "sales"],
    },
  },
} as const
