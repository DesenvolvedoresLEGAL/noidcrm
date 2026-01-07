# NOID Revenue OS - Database Schema Dump

Generated: 2026-01-07

## Overview

This directory contains complete database schema dumps for the NOID Revenue OS, enabling full replication in external PostgreSQL/Supabase instances.

### Statistics
- **218 tables** in public schema
- **160 functions** (triggers, utilities, RLS helpers)
- **640+ RLS policies**
- **801 indexes**
- **163 triggers**
- **22 custom ENUM types**

## Files Structure

### Execution Order (IMPORTANT!)

Execute files in numerical order to respect dependencies:

```
1. 01_enums.sql           → Custom ENUM types (run first)
2. 02_core_functions.sql  → RLS helper functions
3. 03_tables_*.sql        → Table definitions (03-14)
4. 15_indexes.sql         → All indexes
5. 16_triggers.sql        → All triggers
6. 17_functions.sql       → All database functions
7. 18_rls_policies.sql    → All RLS policies (run last)
```

### File Descriptions

| File | Contents | Records |
|------|----------|---------|
| `01_enums.sql` | 22 custom ENUM types | - |
| `02_core_functions.sql` | Essential RLS functions | 10 |
| `03_tables_core.sql` | Organizations, Profiles, Members | ~50 |
| `04_tables_crm.sql` | Accounts, Contacts, Pipelines | ~5000 |
| `05_tables_sales.sql` | Sellers, OTE, Commissions | ~500 |
| `06_tables_gamification.sql` | Badges, Missions, Roleplay | ~3000 |
| `07_tables_ai.sql` | AI Scores, Suggestions, Runs | ~400 |
| `08_tables_automation.sql` | Workflows, Sequences | ~1700 |
| `09_tables_billing.sql` | Subscriptions, Invoices | - |
| `10_tables_analytics.sql` | Snapshots, Graphs, Events | ~52000 |
| `11_tables_community.sql` | Help, Discussions | ~70 |
| `12_tables_admin.sql` | Audit, Security, Access | ~31500 |
| `13_tables_config.sql` | Settings, Custom Fields | ~600 |
| `14_tables_misc.sql` | Notifications, Holidays | ~4600 |
| `15_indexes.sql` | 801 indexes | - |
| `16_triggers.sql` | 163 triggers | - |
| `17_functions.sql` | 160 functions | - |
| `18_rls_policies.sql` | 640+ policies | - |

## Usage

### Full Import (New Instance)

```bash
# Connect to your Supabase/PostgreSQL
psql "postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/postgres"

# Execute in order
\i 01_enums.sql
\i 02_core_functions.sql
\i 03_tables_core.sql
\i 04_tables_crm.sql
# ... continue with all files
\i 18_rls_policies.sql
```

### Partial Import

For specific modules, import only relevant files:

**CRM Only:**
```bash
\i 01_enums.sql
\i 02_core_functions.sql
\i 03_tables_core.sql
\i 04_tables_crm.sql
\i 18_rls_policies.sql  # Filter for CRM tables
```

## Table Categories

### Core (03)
- organizations, profiles, organization_members
- plans, plan_entitlements
- onboarding_status, user_roles, user_invitations

### CRM (04)
- accounts, account_partners, contacts
- pipelines, stages, opportunities
- activities, interactions, proposals
- proposal_items, contracts, tags

### Sales Performance (05)
- sellers, teams, team_members
- ote_levels, ote_rules, ote_multipliers
- sales_goals, seller_targets
- win_reasons, loss_reasons

### Gamification (06)
- achievements, badges, missions
- seller_achievements, seller_badges
- roleplay_sessions, roleplay_messages
- simulated_clients, client_archetypes

### AI (07)
- ai_actions, ai_alerts, ai_feedback
- ai_playbooks, ai_runs, ai_scores
- ai_suggestions, memories

### Automation (08)
- workflow_rules, workflow_executions
- auto_tasks_rules, sequences
- calendar_sync_config, email_sync_config

### Analytics (10)
- entity_snapshots, forecast_predictions
- graph_nodes, graph_edges, graph_builds
- revenue_events, score_history

### Admin (12)
- audit_log, auth_audit_log
- security_audit_log, admin_access_logs
- platform_admins, backup_history

## Notes

1. **Foreign Keys**: Tables reference `auth.users` for user relationships. The Supabase auth schema is managed separately.

2. **RLS Policies**: All policies use helper functions (`get_user_organization_id()`, `user_is_org_admin()`, etc.) defined in `02_core_functions.sql`.

3. **Triggers**: Many tables have `updated_at` triggers and audit logging.

4. **Indexes**: Includes unique constraints, foreign key indexes, and performance indexes.

## Maintenance

To regenerate these dumps:
1. Query `information_schema.columns` for table structures
2. Query `pg_proc` for functions
3. Query `pg_policies` for RLS policies
4. Query `pg_indexes` for indexes
5. Query `information_schema.triggers` for triggers
