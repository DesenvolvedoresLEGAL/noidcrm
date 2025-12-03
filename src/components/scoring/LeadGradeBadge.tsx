import { cn } from '@/lib/utils';

interface LeadGradeBadgeProps {
  grade: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export function LeadGradeBadge({ grade, score, size = 'md', showScore = false }: LeadGradeBadgeProps) {
  const getGradeStyles = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-500 text-white';
      case 'B':
        return 'bg-blue-500 text-white';
      case 'C':
        return 'bg-yellow-500 text-white';
      case 'D':
        return 'bg-orange-500 text-white';
      case 'F':
        return 'bg-red-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'A': return 'Quente 🔥';
      case 'B': return 'Ativo';
      case 'C': return 'Morno';
      case 'D': return 'Frio';
      case 'F': return 'Gelado ❄️';
      default: return 'N/A';
    }
  };

  const sizeStyles = {
    sm: 'h-5 w-5 text-xs',
    md: 'h-7 w-7 text-sm',
    lg: 'h-9 w-9 text-base'
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full font-bold flex items-center justify-center',
          getGradeStyles(grade),
          sizeStyles[size]
        )}
      >
        {grade}
      </div>
      {showScore && score !== undefined && (
        <div className="flex flex-col">
          <span className="text-xs font-medium">{score}/100</span>
          <span className="text-xs text-muted-foreground">{getGradeLabel(grade)}</span>
        </div>
      )}
    </div>
  );
}
