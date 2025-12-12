
-- =====================================================
-- SPRINT 2: INDEXES CRÍTICOS PARA PERFORMANCE
-- Objetivo: Reduzir sequential scans de 27M+ para <100k
-- =====================================================

-- 1. organization_members: 21M sequential scans (0.19% index usage)
CREATE INDEX IF NOT EXISTS idx_org_members_user_status 
ON organization_members(user_id, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_org_members_org_role_status 
ON organization_members(organization_id, org_role, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_org_members_org_user_status
ON organization_members(organization_id, user_id, status)
WHERE status = 'active';

-- 2. user_roles: 4.9M sequential scans (24% index usage)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON user_roles(user_id);

-- 3. organizations: 70k sequential scans
CREATE INDEX IF NOT EXISTS idx_organizations_status 
ON organizations(status) 
WHERE status = 'active';

-- 4. profiles: Usado em muitas consultas de usuário
CREATE INDEX IF NOT EXISTS idx_profiles_user_org
ON profiles(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id
ON profiles(organization_id);

-- 5. opportunities: Tabela central do CRM
CREATE INDEX IF NOT EXISTS idx_opportunities_org_status
ON opportunities(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunities_org_pipeline_status
ON opportunities(organization_id, pipeline_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunities_owner_status
ON opportunities(owner_user_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunities_account_status
ON opportunities(account_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage_org
ON opportunities(stage_id, organization_id);

-- 6. activities: Alta frequência de consultas
CREATE INDEX IF NOT EXISTS idx_activities_org_owner
ON activities(organization_id, owner_user_id);

CREATE INDEX IF NOT EXISTS idx_activities_org_status
ON activities(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_activities_opportunity
ON activities(opportunity_id) 
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_scheduled
ON activities(scheduled_date, status)
WHERE status = 'pending';

-- 7. accounts: Consultas frequentes
CREATE INDEX IF NOT EXISTS idx_accounts_org_lifecycle
ON accounts(organization_id, lifecycle_stage);

CREATE INDEX IF NOT EXISTS idx_accounts_owner
ON accounts(owner_user_id)
WHERE owner_user_id IS NOT NULL;

-- 8. contacts: Relacionamentos com accounts
CREATE INDEX IF NOT EXISTS idx_contacts_org_account
ON contacts(organization_id, account_id);

-- 9. proposals: Consultas de propostas ativas
CREATE INDEX IF NOT EXISTS idx_proposals_org_status
ON proposals(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity
ON proposals(opportunity_id);

-- 10. stages: Consultas por pipeline
CREATE INDEX IF NOT EXISTS idx_stages_pipeline_order
ON stages(pipeline_id, order_index);

-- 11. pipelines: Consultas por organização e tipo
CREATE INDEX IF NOT EXISTS idx_pipelines_org_type
ON pipelines(organization_id, pipeline_type);

-- 12. teams: Consultas de times
CREATE INDEX IF NOT EXISTS idx_teams_org_manager
ON teams(organization_id, manager_id);

-- 13. team_members: Relacionamentos de time
CREATE INDEX IF NOT EXISTS idx_team_members_team
ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user
ON team_members(user_id);

-- 14. contracts: Consultas de contratos ativos
CREATE INDEX IF NOT EXISTS idx_contracts_org_status
ON contracts(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_contracts_account
ON contracts(account_id);

-- 15. notifications: Consultas de notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notifications(user_id, read)
WHERE read = false;

-- 16. audit_log: Consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_log_org_entity
ON audit_log(organization_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
ON audit_log(created_at DESC);

-- 17. workflow_rules: Consultas de regras ativas
CREATE INDEX IF NOT EXISTS idx_workflow_rules_org_active
ON workflow_rules(organization_id, is_active)
WHERE is_active = true;

-- 18. workflow_executions: Consultas de execuções pendentes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status
ON workflow_executions(status)
WHERE status = 'pending';

-- 19. ai_suggestions: Consultas de sugestões pendentes
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_org_status
ON ai_suggestions(organization_id, status)
WHERE status = 'pending';

-- 20. revenue_events: Análises de receita
CREATE INDEX IF NOT EXISTS idx_revenue_events_org_created
ON revenue_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_events_opportunity
ON revenue_events(opportunity_id)
WHERE opportunity_id IS NOT NULL;

-- Atualizar estatísticas das tabelas críticas
ANALYZE organization_members;
ANALYZE user_roles;
ANALYZE organizations;
ANALYZE profiles;
ANALYZE opportunities;
ANALYZE activities;
ANALYZE accounts;
ANALYZE contacts;
ANALYZE proposals;
ANALYZE stages;
ANALYZE pipelines;
ANALYZE teams;
ANALYZE team_members;
ANALYZE contracts;
ANALYZE notifications;
