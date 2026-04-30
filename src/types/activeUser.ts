export type ActiveUserOption = {
  tenant_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  org_role: string | null;
  status: 'active';
  context_permission_key?: string | null;
  context_department_key?: string | null;
  context_business_function_key?: string | null;
  context_business_function_name?: string | null;
  context_department_name?: string | null;
  is_dashboard_dynamic_enabled?: boolean | null;
  /** Convenience for select components: label = full_name */
  label: string;
  /** Convenience for select components: value = user_id */
  value: string;
  /**
   * Marker used when an inactive/historical user is intentionally appended
   * (e.g. current owner of an existing record). Not selectable.
   */
  isInactive?: boolean;
};
