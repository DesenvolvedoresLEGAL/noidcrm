import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

const STEPS: { title: string; body: string }[] = [
  {
    title: '1. Para habilitar',
    body:
      'Revise o Contexto CRM do usuário, marque como validado, ative o piloto e confirme a flag do tenant.',
  },
  {
    title: '2. Para testar',
    body:
      'Entre como o usuário ou peça para ele acessar a home. Confirme Central do Dia, Pace Diário e Top 10 ações.',
  },
  {
    title: '3. Para voltar ao legado',
    body: 'Use o botão "Voltar ao dashboard atual" no próprio Dashboard Comercial.',
  },
  {
    title: '4. Para desligar um usuário',
    body: 'Use "Desligar piloto" no painel de Ativação Controlada.',
  },
  {
    title: '5. Para desligar tudo no tenant',
    body: 'Use "Desligar dashboard dinâmico no tenant" no painel de Rollback.',
  },
  {
    title: '6. Para analisar uso',
    body: 'Veja os blocos de Saúde, Performance, Feedback, Auditoria e Logs nesta mesma aba.',
  },
];

export function CloserRunbookCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Como operar o Dashboard Comercial
        </CardTitle>
        <CardDescription>
          Runbook rápido para Owner/Admin. Não dispara nenhuma ação por si só.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-md border p-3 bg-muted/30">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.body}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
