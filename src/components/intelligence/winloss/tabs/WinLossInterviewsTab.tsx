import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare, Send, CheckCircle2, TrendingUp, TrendingDown,
  AlertTriangle, Mail, Phone, Info
} from 'lucide-react';

interface Props {
  organizationId: string;
}

export function WinLossInterviewsTab({ organizationId }: Props) {
  const { toast } = useToast();

  const { data: interviewsData, refetch } = useQuery({
    queryKey: ['winloss-interviews', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('winloss_interviews')
        .select(`*, account:accounts(razao_social, nome_fantasia), contact:contacts(nome)`)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const pending = data?.filter(i => i.status === 'pending').length || 0;
      const sent = data?.filter(i => i.status === 'sent').length || 0;
      const completed = data?.filter(i => i.status === 'completed').length || 0;
      return { interviews: data || [], pending, sent, completed };
    },
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: async (params: { interviewType: 'win' | 'loss' | 'churn'; channel: string }) => {
      const { data, error } = await supabase.functions.invoke('winloss-interview-bot', {
        body: { organizationId, interviewType: params.interviewType, channel: params.channel }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { refetch(); toast({ title: 'Entrevista criada' }); },
    onError: (e) => { toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' }); },
  });

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              As entrevistas são agendadas no sistema mas <strong>não enviadas automaticamente</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { label: 'Pendentes', value: interviewsData?.pending || 0, icon: MessageSquare, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Agendadas', value: interviewsData?.sent || 0, icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Completadas', value: interviewsData?.completed || 0, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${kpi.bg}`}><kpi.icon className={`h-4 w-4 ${kpi.color}`} /></div>
                <div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-xl font-bold">{kpi.value}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Agendar Nova Entrevista</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { type: 'win' as const, icon: TrendingUp, color: 'text-emerald-500', label: 'Entrevista Win', desc: 'Entenda o que fez o cliente escolher você' },
              { type: 'loss' as const, icon: TrendingDown, color: 'text-red-500', label: 'Entrevista Loss', desc: 'Descubra os reais motivos da perda' },
              { type: 'churn' as const, icon: AlertTriangle, color: 'text-yellow-500', label: 'Entrevista Churn', desc: 'Entenda por que o cliente cancelou' },
            ].map(item => (
              <div key={item.type}
                className="p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => createMutation.mutate({ interviewType: item.type, channel: item.type === 'churn' ? 'email' : 'whatsapp' })}
              >
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Entrevistas Recentes</CardTitle></CardHeader>
        <CardContent>
          {interviewsData?.interviews && interviewsData.interviews.length > 0 ? (
            <div className="space-y-2">
              {interviewsData.interviews.slice(0, 5).map((interview: any) => (
                <div key={interview.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="flex items-center gap-2">
                    {interview.interview_type === 'win' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : interview.interview_type === 'loss' ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                    <div>
                      <p className="font-medium text-sm">{interview.account?.nome_fantasia || interview.account?.razao_social || 'Conta'}</p>
                      <p className="text-xs text-muted-foreground">{interview.contact?.nome || 'Contato'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={interview.status === 'completed' ? 'default' : interview.status === 'sent' ? 'secondary' : 'outline'} className="text-xs">
                      {interview.status === 'completed' ? 'Completo' : interview.status === 'sent' ? 'Agendado' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma entrevista agendada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
