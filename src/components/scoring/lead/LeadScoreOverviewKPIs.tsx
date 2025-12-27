import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Flame, TrendingUp, ThermometerSun, Snowflake, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadScoreOverviewKPIsProps {
  kpis: {
    totalLeads: number;
    averageScore: number;
    gradeA: number;
    gradeB: number;
    gradeC: number;
    gradeD: number;
    gradeF: number;
  };
  onFilterGrade: (grade: string | null) => void;
  activeGrade?: string | null;
  isLoading: boolean;
}

const gradeConfig = [
  { 
    grade: 'A', 
    label: 'Quentes', 
    icon: Flame, 
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    tooltip: 'Lead Score ≥ 80 pontos. Leads com alto FIT e INTENT. Prioridade máxima de contato!'
  },
  { 
    grade: 'B', 
    label: 'Ativos', 
    icon: TrendingUp, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    tooltip: 'Lead Score 60 a 79 pontos. Leads engajados que demonstram interesse ativo.'
  },
  { 
    grade: 'C', 
    label: 'Mornos', 
    icon: ThermometerSun, 
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    tooltip: 'Lead Score 40 a 59 pontos. Leads com potencial mas precisam de nutrição.'
  },
  { 
    grade: 'D', 
    label: 'Frios', 
    icon: Snowflake, 
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    tooltip: 'Lead Score 20 a 39 pontos. Leads com baixo engajamento. Requerem reativação.'
  },
  { 
    grade: 'F', 
    label: 'Gelados', 
    icon: Snowflake, 
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    tooltip: 'Lead Score < 20 pontos. Leads sem engajamento. Considere reciclar ou desqualificar.'
  },
];

export function LeadScoreOverviewKPIs({ kpis, onFilterGrade, activeGrade, isLoading }: LeadScoreOverviewKPIsProps) {
  const gradeValues: Record<string, number> = {
    A: kpis.gradeA,
    B: kpis.gradeB,
    C: kpis.gradeC,
    D: kpis.gradeD,
    F: kpis.gradeF,
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {/* Total Leads */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Total</span>
              </div>
              <div className="text-2xl font-bold">{kpis.totalLeads}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>Total de contas/leads cadastrados</p>
        </TooltipContent>
      </Tooltip>

      {/* Average Score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Score Médio</span>
              </div>
              <div className="text-2xl font-bold">{kpis.averageScore}</div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>Média do Lead Score de todas as contas</p>
        </TooltipContent>
      </Tooltip>

      {/* Grade Cards */}
      {gradeConfig.map(({ grade, label, icon: Icon, color, bgColor, borderColor, tooltip }) => (
        <Tooltip key={grade}>
          <TooltipTrigger asChild>
            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                borderColor,
                activeGrade === grade ? "ring-2 ring-primary" : ""
              )}
              onClick={() => onFilterGrade(activeGrade === grade ? null : grade)}
            >
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-2 mb-2", bgColor, "rounded-md p-1 -mx-1")}>
                  <Icon className={cn("h-4 w-4", color)} />
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{gradeValues[grade]}</div>
                  <Badge variant="outline" className={cn("text-xs", color)}>
                    {grade}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
