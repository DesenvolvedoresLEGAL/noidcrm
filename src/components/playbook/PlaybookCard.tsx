import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Play, Pause, MoreVertical, TrendingUp, TrendingDown, Minus,
  Rocket, AlertTriangle, CheckCircle2, XCircle, History, Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrencyFull } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Playbook } from '@/hooks/usePlaybookSystem';

interface PlaybookCardProps {
  playbook: Playbook;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (playbook: Playbook) => void;
  onDeploy: (id: string) => void;
  onViewVersions: (id: string) => void;
  onDuplicate: (playbook: Playbook) => void;
}

export function PlaybookCard({ 
  playbook, 
  onToggle, 
  onEdit, 
  onDeploy, 
  onViewVersions,
  onDuplicate 
}: PlaybookCardProps) {
  const getHealthStatus = () => {
    if (playbook.auto_disabled) return { status: 'critical', color: 'destructive', icon: XCircle };
    if (playbook.usage_count < playbook.min_sample_size) return { status: 'warning', color: 'warning', icon: AlertTriangle };
    if (playbook.roi_score >= playbook.roi_threshold && playbook.conversion_rate >= 20) {
      return { status: 'excellent', color: 'success', icon: CheckCircle2 };
    }
    if (playbook.roi_score >= playbook.roi_threshold * 0.7) return { status: 'good', color: 'default', icon: CheckCircle2 };
    return { status: 'warning', color: 'warning', icon: AlertTriangle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'prospecting': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'discovery': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'negotiation': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'closing': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getComplexityLabel = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'Simples';
      case 'moderate': return 'Moderado';
      case 'complex': return 'Complexo';
      default: return complexity;
    }
  };

  const getTrendIcon = () => {
    // Simple trend based on recent activity
    if (playbook.conversion_rate > 30) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (playbook.conversion_rate < 10 && playbook.usage_count > 5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      !playbook.is_active && "opacity-60",
      playbook.auto_disabled && "border-destructive/50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <HealthIcon className={cn(
                "h-4 w-4",
                health.status === 'excellent' && "text-green-500",
                health.status === 'good' && "text-blue-500",
                health.status === 'warning' && "text-amber-500",
                health.status === 'critical' && "text-destructive"
              )} />
              <CardTitle className="text-sm font-medium truncate">
                {playbook.name}
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {playbook.category && (
                <Badge variant="outline" className={cn("text-xs", getCategoryColor(playbook.category))}>
                  {playbook.category}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                v{playbook.version}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {getComplexityLabel(playbook.complexity)}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(playbook)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeploy(playbook.id)}>
                <Rocket className="h-4 w-4 mr-2" />
                Deploy Nova Versão
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewVersions(playbook.id)}>
                <History className="h-4 w-4 mr-2" />
                Histórico de Versões
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(playbook)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onToggle(playbook.id, !playbook.is_active)}
                className={playbook.is_active ? "text-destructive" : "text-green-600"}
              >
                {playbook.is_active ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Desativar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Ativar
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {playbook.auto_disabled && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {playbook.disabled_reason || 'Desativado automaticamente por baixo ROI'}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">ROI/hora</div>
            <div className="font-semibold flex items-center gap-1">
              {formatCurrencyFull(playbook.roi_score || 0)}
              {getTrendIcon()}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Conversão</div>
            <div className="font-semibold">{(playbook.conversion_rate || 0).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Execuções</div>
            <div className="font-semibold">{playbook.usage_count || 0}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Revenue</div>
            <div className="font-semibold">{formatCurrencyFull(playbook.total_revenue_generated || 0)}</div>
          </div>
        </div>

        {/* Sample Size Progress */}
        {playbook.usage_count < playbook.min_sample_size && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Amostra para avaliação</span>
              <span>{playbook.usage_count}/{playbook.min_sample_size}</span>
            </div>
            <Progress 
              value={(playbook.usage_count / playbook.min_sample_size) * 100} 
              className="h-1.5"
            />
          </div>
        )}

        {/* ROI Threshold Indicator */}
        {playbook.usage_count >= playbook.min_sample_size && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">ROI vs Threshold</span>
              <span className={cn(
                "font-medium",
                playbook.roi_score >= playbook.roi_threshold ? "text-green-500" : "text-amber-500"
              )}>
                {formatCurrencyFull(playbook.roi_score)} / {formatCurrencyFull(playbook.roi_threshold)}
              </span>
            </div>
            <Progress 
              value={Math.min((playbook.roi_score / playbook.roi_threshold) * 100, 100)} 
              className={cn(
                "h-1.5",
                playbook.roi_score >= playbook.roi_threshold 
                  ? "[&>div]:bg-green-500" 
                  : "[&>div]:bg-amber-500"
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
