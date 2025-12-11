import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Copy, 
  ArrowRight,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutomationGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Guia de Automação</CardTitle>
              <CardDescription className="text-xs">
                Como configurar ações corretamente
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-1"
          >
            {isExpanded ? (
              <>
                Ocultar
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Ver guia
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Cenário: Ganhou + Duplicar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h4 className="font-medium text-sm">
                Cenário: Ganhar oportunidade e duplicar para outro funil
              </h4>
            </div>

            {/* Ordem correta */}
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Ordem Correta
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <ActionBadge number={1} label="Encerrar como Ganha" type="close_won" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <ActionBadge number={2} label="Duplicar" type="duplicate" hasConfig />
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pl-6 border-l-2 border-green-500/30 mt-3">
                <p><strong>1. close_won</strong> — Encerra a oportunidade original como ganha</p>
                <p><strong>2. duplicate</strong> — Cria nova oportunidade no funil destino</p>
                <p className="text-green-600 dark:text-green-400">
                  ✓ Configure <code className="bg-muted px-1 rounded">target_pipeline_id</code> e <code className="bg-muted px-1 rounded">target_stage_id</code> na ação duplicate
                </p>
              </div>
            </div>

            {/* O que NÃO fazer */}
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Evite: Ação move_stage após duplicate
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <ActionBadge number={1} label="close_won" type="close_won" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <ActionBadge number={2} label="duplicate" type="duplicate" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <ActionBadge number={3} label="move_stage" type="move_stage" isError />
              </div>

              <p className="text-xs text-muted-foreground pl-6 border-l-2 border-destructive/30">
                A ação <strong>move_stage</strong> após duplicate é redundante, pois o duplicate já define o stage destino. 
                Usar as duas ações pode causar inconsistências.
              </p>
            </div>

            {/* Dica para close_lost */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Dica:</strong> Para oportunidades perdidas, use a mesma lógica: 
                primeiro <code className="bg-muted px-1 rounded">close_lost</code>, 
                depois <code className="bg-muted px-1 rounded">duplicate</code> (se necessário).
              </p>
            </div>
          </div>

          {/* Resumo rápido */}
          <div className="pt-2 border-t">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Resumo das Ações
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shrink-0">
                  close_won
                </Badge>
                <span className="text-muted-foreground">Encerra a oportunidade original como ganha</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 shrink-0">
                  close_lost
                </Badge>
                <span className="text-muted-foreground">Encerra a oportunidade original como perdida</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0">
                  duplicate
                </Badge>
                <span className="text-muted-foreground">Cria cópia no funil/stage configurado</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 shrink-0">
                  move_stage
                </Badge>
                <span className="text-muted-foreground">Move para outro stage (mesmo funil)</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface ActionBadgeProps {
  number: number;
  label: string;
  type: 'close_won' | 'close_lost' | 'duplicate' | 'move_stage';
  hasConfig?: boolean;
  isError?: boolean;
}

function ActionBadge({ number, label, type, hasConfig, isError }: ActionBadgeProps) {
  const typeColors = {
    close_won: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    close_lost: 'bg-red-500/10 text-red-600 border-red-500/30',
    duplicate: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    move_stage: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium",
      isError ? 'bg-destructive/10 text-destructive border-destructive/30 line-through opacity-70' : typeColors[type]
    )}>
      <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
        {number}
      </span>
      {label}
      {hasConfig && (
        <span className="text-[10px] opacity-60">(com config)</span>
      )}
    </div>
  );
}
