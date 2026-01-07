-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 01_enums.sql
-- Generated: 2026-01-07
-- Description: All custom ENUM types (22 types)
-- ============================================================

-- Drop existing types if needed
DO $$ BEGIN DROP TYPE IF EXISTS accelerator_tier_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS app_role CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS archetype_level_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS client_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS decision_role_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS graph_edge_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS graph_insight_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS graph_node_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS interaction_channel CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS interaction_type_enum CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS memory_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS org_role CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS platform_admin_role CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS roleplay_sender_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS seller_role_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS tipo_pessoa_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS tone_style_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS video_level_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS video_source_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS workflow_action_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS workflow_trigger_type CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Create ENUM types
CREATE TYPE accelerator_tier_type AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

CREATE TYPE app_role AS ENUM ('admin', 'manager', 'sales', 'cs');

CREATE TYPE archetype_level_type AS ENUM ('Entrada', 'Intermediário', 'Avançado', 'Enterprise');

CREATE TYPE client_type AS ENUM ('Organizador', 'Expositor', 'Agência', 'Empresa Contratante');

CREATE TYPE decision_role_type AS ENUM ('Decisor', 'Influenciador', 'Usuário-Chave');

CREATE TYPE graph_edge_type AS ENUM ('works_at', 'owns', 'relates_to', 'influences', 'communicates_with', 'champions', 'blocks', 'participates_in', 'converts_to', 'decision_maker');

CREATE TYPE graph_insight_type AS ENUM ('missing_champion', 'missing_decision_maker', 'silent_stakeholder', 'isolated_deal', 'weak_relationship', 'network_gap', 'high_centrality', 'engagement_decay');

CREATE TYPE graph_node_type AS ENUM ('account', 'contact', 'opportunity', 'interaction', 'proposal', 'contract', 'user');

CREATE TYPE interaction_channel AS ENUM ('email', 'phone', 'whatsapp', 'linkedin', 'meeting', 'form', 'chat', 'website', 'proposal', 'contract', 'other');

CREATE TYPE interaction_type_enum AS ENUM ('call_made', 'call_received', 'call_missed', 'email_sent', 'email_received', 'email_opened', 'email_clicked', 'meeting_scheduled', 'meeting_held', 'meeting_canceled', 'meeting_no_show', 'message_sent', 'message_received', 'form_submitted', 'chat_started', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'contract_sent', 'contract_signed', 'linkedin_connection', 'linkedin_message', 'website_visit', 'demo_requested', 'note_added', 'task_completed', 'other');

CREATE TYPE memory_type AS ENUM ('objection', 'win_pattern', 'loss_pattern', 'churn_signal', 'converting_language', 'countermeasure');

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'manager', 'sales', 'viewer', 'cs', 'finance', 'operations');

CREATE TYPE platform_admin_role AS ENUM ('super_admin', 'admin', 'support');

CREATE TYPE roleplay_sender_type AS ENUM ('seller', 'ai_client');

CREATE TYPE seller_role_type AS ENUM ('Closer', 'SDR', 'Farmer', 'CS', 'BDR', 'AE', 'AM', 'Hunter');

CREATE TYPE tipo_pessoa_type AS ENUM ('PJ', 'PF');

CREATE TYPE tone_style_type AS ENUM ('técnico', 'apressado', 'cético', 'indeciso', 'agressivo', 'metódico');

CREATE TYPE video_level_type AS ENUM ('Básico', 'Intermediário', 'Avançado');

CREATE TYPE video_source_type AS ENUM ('Interno', 'YouTube', 'Vimeo', 'Loom');

CREATE TYPE workflow_action_type AS ENUM ('move_stage', 'move_pipeline', 'duplicate', 'close_won', 'close_lost', 'create_activity', 'update_fields', 'notify_user', 'send_email');

CREATE TYPE workflow_trigger_type AS ENUM ('stage_enter', 'stage_exit', 'opportunity_won', 'opportunity_lost', 'activity_completed', 'opportunity_created', 'field_changed', 'proposal_viewed');
