// Re-export functions from Supabase service
export { 
  listOpportunityHistory,
  listAuditLogByTraceId,
  getActionDescription,
  fieldLabels,
  formatAuditValue,
  type AuditLogEntry
} from '../supabase/audit-log';
