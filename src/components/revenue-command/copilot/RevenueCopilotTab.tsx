import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Send,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Database,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useRevenueCopilot,
  COPILOT_SUGGESTIONS,
  type CopilotConfidence,
} from '@/hooks/revenue-command/useRevenueCopilot';

const CONF_LABEL: Record<CopilotConfidence, string> = {
  high: 'Alta confiança',
  medium: 'Confiança média',
  low: 'Confiança baixa',
};
const CONF_TONE: Record<CopilotConfidence, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  low: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

export function RevenueCopilotTab() {
  const { question, setQuestion, ask, submitted, isLoading, answer } = useRevenueCopilot();
  const [local, setLocal] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = (local || question).trim();
    if (!q) return;
    setQuestion(q);
    ask(q);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-5">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Revenue Copilot</h2>
              <p className="text-sm text-muted-foreground">
                Pergunte qualquer coisa sobre sua operação comercial.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Por que a meta está em risco? Quem precisa de ajuda? Posso confiar nos dados?"
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !(local || question).trim()}>
              {isLoading && submitted ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Analisar
                </>
              )}
            </Button>
          </form>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {COPILOT_SUGGESTIONS.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setLocal(s.question);
                  setQuestion(s.question);
                  ask(s.question);
                }}
              >
                <Lightbulb className="mr-1 h-3 w-3" />
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && submitted && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando fontes do Revenue Command…
          </CardContent>
        </Card>
      )}

      {/* Answer */}
      {!isLoading && answer && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pergunta</p>
                <CardTitle className="text-base">{submitted}</CardTitle>
              </div>
              <Badge variant="outline" className={CONF_TONE[answer.confidence]}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {CONF_LABEL[answer.confidence]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* RESUMO */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resumo
              </p>
              <p className="mt-1 text-sm leading-relaxed">{answer.summary}</p>
            </section>

            {/* EVIDÊNCIAS */}
            {answer.evidence.length > 0 && (
              <>
                <Separator />
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidências
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {answer.evidence.map((e, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{e.label}</span>
                        <span
                          className={
                            e.tone === 'bad'
                              ? 'font-medium text-rose-600 dark:text-rose-400'
                              : e.tone === 'good'
                                ? 'font-medium text-emerald-600 dark:text-emerald-400'
                                : 'font-medium'
                          }
                        >
                          {e.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* IMPACTO */}
            {answer.impact && (
              <>
                <Separator />
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Impacto
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {answer.impact}
                  </p>
                </section>
              </>
            )}

            {/* PRÓXIMA AÇÃO */}
            {answer.nextAction && (
              <>
                <Separator />
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Próxima ação
                  </p>
                  <p className="mt-1 text-sm">{answer.nextAction}</p>
                </section>
              </>
            )}

            {/* LINKS */}
            {answer.links.length > 0 && (
              <>
                <Separator />
                <section className="flex flex-wrap gap-2">
                  {answer.links.map((l) => (
                    <Button
                      key={l.to}
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                    >
                      <Link to={l.to}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        {l.label}
                      </Link>
                    </Button>
                  ))}
                </section>
              </>
            )}

            {/* FONTES */}
            <Separator />
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fontes consultadas
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {answer.sources.length === 0 ? (
                  <Badge variant="outline" className="text-xs">
                    <Database className="mr-1 h-3 w-3" />
                    Nenhuma fonte retornou dados
                  </Badge>
                ) : (
                  answer.sources.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      <Database className="mr-1 h-3 w-3" />
                      {s}
                    </Badge>
                  ))
                )}
              </div>
            </section>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!submitted && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <p className="text-sm text-muted-foreground">
              Faça uma pergunta ou clique em uma sugestão acima para começar.
            </p>
            <p className="text-xs text-muted-foreground">
              O Copilot só lê dados — não executa ações, não envia mensagens e não altera o CRM.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
