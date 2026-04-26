import { ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function MCPRegistryHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">MCP Registry</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Governança técnica do NOID Intelligence para tools, contexto, prompts, permissões e auditoria de agentes.
          </p>
        </div>
      </div>

      <Card className="border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Modo fundação ativo. Nenhuma tool executa ações reais nesta fase.
            </p>
            <p className="text-amber-800/90 dark:text-amber-300/80 mt-1 leading-relaxed">
              O MCP Registry define quais ferramentas, fontes de contexto e prompts os agentes do NOID Intelligence
              poderão usar. Nesta fase, o registry está em modo seguro, com tools desabilitadas por padrão e sem
              execução real.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
