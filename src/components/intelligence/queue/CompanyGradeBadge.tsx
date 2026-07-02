import { Badge } from '@/components/ui/badge';
import type { CompanyGrade } from '@/services/intelligence/qualifiedQueue';

const CONFIG: Record<CompanyGrade, { label: string; className: string }> = {
  'A+': { label: 'A+ · Prioridade máxima', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  'A': { label: 'A · Muito quente', className: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
  'B': { label: 'B · Boa oportunidade', className: 'bg-blue-500 hover:bg-blue-600 text-white' },
  'C': { label: 'C · Monitorar', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  'D': { label: 'D · Baixa prioridade', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  'F': { label: 'F · Não gastar', className: 'bg-red-600 hover:bg-red-700 text-white' },
};

interface Props {
  grade?: CompanyGrade | null;
  score?: number | null;
  compact?: boolean;
}

export function CompanyGradeBadge({ grade, score, compact }: Props) {
  if (!grade) return <Badge variant="outline">—</Badge>;
  const cfg = CONFIG[grade];
  return (
    <Badge className={cfg.className}>
      {compact ? grade : cfg.label}
      {typeof score === 'number' && !compact && <span className="ml-1 opacity-80">· {score}</span>}
    </Badge>
  );
}
