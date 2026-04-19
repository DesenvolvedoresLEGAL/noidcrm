import { Card, CardContent } from '@/components/ui/card';
import { Mail, Eye, MessageSquare, TrendingUp, Trophy, DollarSign, MousePointerClick } from 'lucide-react';
import type { OutcomesKPIs } from '@/hooks/useAgentOutcomes';

interface Props {
  kpis: OutcomesKPIs;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function OutcomeKPIs({ kpis }: Props) {
  const items = [
    { label: 'Emails enviados', value: String(kpis.emails_sent), icon: Mail, tone: 'text-primary' },
    { label: 'Taxa de abertura', value: fmtPct(kpis.open_rate), icon: Eye, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Taxa de clique', value: fmtPct(kpis.click_rate), icon: MousePointerClick, tone: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Taxa de resposta', value: fmtPct(kpis.reply_rate), icon: MessageSquare, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Deals progrediram', value: String(kpis.deals_progressed), icon: TrendingUp, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Deals ganhos', value: String(kpis.deals_won), icon: Trophy, tone: 'text-green-600 dark:text-green-400' },
    { label: 'Receita influenciada', value: fmtMoney(kpis.influenced_revenue), icon: DollarSign, tone: 'text-green-700 dark:text-green-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${tone}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-xl font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
