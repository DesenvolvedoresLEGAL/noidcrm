// Re-export functions from Supabase service
export { 
  listOpportunityHistory,
  listAuditLogByTraceId,
  getActionDescription,
  fieldLabels,
  formatAuditValue,
  type AuditLogEntry,
  type EntityNameMaps,
  type OpportunityHistoryResult
} from '../supabase/audit-log';
