import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REVIEW_STATUS_LABELS, PERMISSION_LABELS, DEPARTMENT_LABELS } from './labels';
import type { ReviewStatus } from '@/hooks/userContext/useUserContextData';

const REVIEW_CLASSES: Record<ReviewStatus, string> = {
  validated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  needs_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  incomplete: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  no_context: 'bg-muted text-muted-foreground',
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge className={cn('font-medium', REVIEW_CLASSES[status])} variant="secondary">
      {REVIEW_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PermissionBadge({ permissionKey, fallback }: { permissionKey: string | null; fallback?: string | null }) {
  if (!permissionKey) return <span className="text-muted-foreground text-sm">—</span>;
  const label = PERMISSION_LABELS[permissionKey] || fallback || permissionKey;
  return <Badge variant="outline">{label}</Badge>;
}

export function DepartmentBadge({ departmentKey, fallback }: { departmentKey: string | null; fallback?: string | null }) {
  if (!departmentKey) return <span className="text-muted-foreground text-sm">—</span>;
  const label = DEPARTMENT_LABELS[departmentKey] || fallback || departmentKey;
  return <Badge variant="outline">{label}</Badge>;
}
