
-- Deletar organização 'legal' incorreta e todos os dados relacionados
-- Org ID: 8ad682ab-e3d2-4d82-a341-c8643005220e

-- Desabilitar triggers temporariamente
SET session_replication_role = replica;

-- Tabelas de logs e auditoria
DELETE FROM security_audit_log WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM audit_log WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM user_access_logs WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de notificações e briefings
DELETE FROM notifications WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM daily_briefings WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de AI
DELETE FROM ai_suggestions WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM stage_progression_suggestions WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de propostas (filhas primeiro)
DELETE FROM proposal_items WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM proposal_payment_terms WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM proposal_participants WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM proposal_views WHERE proposal_id IN (SELECT id FROM proposals WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM proposal_alerts WHERE proposal_id IN (SELECT id FROM proposals WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM proposals WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM proposal_templates WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM proposal_layouts WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de atividades
DELETE FROM activity_participants WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM activities WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de deals e oportunidades
DELETE FROM deal_participants WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM opportunity_notes WHERE opportunity_id IN (SELECT id FROM opportunities WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM opportunity_files WHERE opportunity_id IN (SELECT id FROM opportunities WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM opportunity_emails WHERE opportunity_id IN (SELECT id FROM opportunities WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM opportunities WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Contratos
DELETE FROM contracts WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de contas e contatos
DELETE FROM account_partners WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM contacts WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM accounts WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de pipeline
DELETE FROM stages WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM pipelines WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de produtos
DELETE FROM product_price_history WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM products WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM measurement_units WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de automação e workflows
DELETE FROM workflow_executions WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM workflow_rules WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM sequences WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM automation_config WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de roleplay
DELETE FROM video_recommendations WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM performance_insights WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM roleplay_sessions WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM simulated_clients WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM video_library WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM evaluation_rubrics WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM client_archetypes WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM icp_profiles WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de sellers
DELETE FROM attendance WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM seller_stats WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM seller_achievements WHERE seller_id IN (SELECT id FROM sellers WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM seller_badges WHERE seller_id IN (SELECT id FROM sellers WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e');
DELETE FROM sellers WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de equipes e territórios
DELETE FROM team_members WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM teams WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM territory_assignments WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM territories WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de configuração
DELETE FROM custom_field_values WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM custom_fields WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM custom_field_groups WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM dynamic_variables WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM scoring_rules WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM loss_reasons WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM email_templates WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM email_sync_config WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM calendar_sync_config WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de import/export
DELETE FROM import_logs WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM export_logs WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM export_templates WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de billing
DELETE FROM usage_counters WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM subscriptions WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Tabelas de permissões e convites
DELETE FROM user_invitations WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM permission_sets WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Badges e achievements
DELETE FROM badges WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM achievements WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM accelerator_policies WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Business units
DELETE FROM business_units WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Settings e org settings
DELETE FROM settings WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';
DELETE FROM organization_settings WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Limpar referência em profiles
UPDATE profiles SET organization_id = NULL WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Membros da organização
DELETE FROM organization_members WHERE organization_id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Deletar a organização
DELETE FROM organizations WHERE id = '8ad682ab-e3d2-4d82-a341-c8643005220e';

-- Restaurar triggers
SET session_replication_role = DEFAULT;
