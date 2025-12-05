import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Mail, 
  Calendar, 
  Send, 
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SellerMetrics {
  id: string;
  name: string;
  opportunities_count: number;
  pipeline_value: number;
  won_value: number;
  activities_count: number;
  conversion_rate: number;
  goal_progress: number;
}

interface WeeklyDigestCardProps {
  teamName: string;
  teamMembers: SellerMetrics[];
  teamGoal: number;
}

export function WeeklyDigestCard({ teamName, teamMembers, teamGoal }: WeeklyDigestCardProps) {
  const [sending, setSending] = useState(false);
  const [autoDigest, setAutoDigest] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const generateDigestContent = () => {
    const totalPipeline = teamMembers.reduce((sum, m) => sum + m.pipeline_value, 0);
    const totalWon = teamMembers.reduce((sum, m) => sum + m.won_value, 0);
    const totalActivities = teamMembers.reduce((sum, m) => sum + m.activities_count, 0);
    const avgConversion = teamMembers.length > 0 
      ? teamMembers.reduce((sum, m) => sum + m.conversion_rate, 0) / teamMembers.length 
      : 0;
    const teamProgress = teamGoal > 0 ? (totalWon / teamGoal) * 100 : 0;

    const topPerformers = [...teamMembers]
      .sort((a, b) => b.goal_progress - a.goal_progress)
      .slice(0, 3);

    const needsAttention = teamMembers.filter(m => m.goal_progress < 50);

    return {
      summary: {
        totalPipeline,
        totalWon,
        totalActivities,
        avgConversion,
        teamProgress,
        teamGoal
      },
      topPerformers,
      needsAttention
    };
  };

  const sendDigest = async () => {
    setSending(true);
    
    try {
      const digest = generateDigestContent();
      
      // Get user and organization info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) throw new Error('Organização não encontrada');

      // Create notification for the manager
      await supabase.from('notifications').insert({
        user_id: user.id,
        organization_id: membership.organization_id,
        type: 'weekly_digest',
        title: `📊 Resumo Semanal - ${teamName}`,
        message: `Pipeline: R$ ${digest.summary.totalPipeline.toLocaleString('pt-BR')} | Ganho: R$ ${digest.summary.totalWon.toLocaleString('pt-BR')} | Meta: ${digest.summary.teamProgress.toFixed(0)}%`,
        metadata: {
          team_name: teamName,
          ...digest.summary,
          top_performers: digest.topPerformers.map(p => ({ id: p.id, name: p.name, progress: p.goal_progress })),
          needs_attention: digest.needsAttention.map(p => ({ id: p.id, name: p.name, progress: p.goal_progress }))
        }
      });

      setLastSent(new Date());
      toast.success('Resumo semanal gerado com sucesso!');
    } catch (error) {
      console.error('Error sending digest:', error);
      toast.error('Erro ao enviar resumo');
    } finally {
      setSending(false);
    }
  };

  const digest = generateDigestContent();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Resumo Semanal
          </CardTitle>
          {lastSent && (
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Enviado {lastSent.toLocaleDateString('pt-BR')}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="p-3 rounded-lg bg-muted/50 border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" />
            Preview do Resumo
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Pipeline Total</p>
              <p className="font-medium">
                R$ {digest.summary.totalPipeline.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor Ganho</p>
              <p className="font-medium text-green-600">
                R$ {digest.summary.totalWon.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Progresso Meta</p>
              <p className="font-medium">
                {digest.summary.teamProgress.toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Atividades</p>
              <p className="font-medium">
                {digest.summary.totalActivities}
              </p>
            </div>
          </div>

          {digest.topPerformers.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Top Performers</p>
              <div className="flex flex-wrap gap-1">
                {digest.topPerformers.map((p, i) => (
                  <Badge key={p.id} variant="secondary" className="text-xs">
                    {i + 1}. {p.name} ({p.goal_progress.toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {digest.needsAttention.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Precisam de Atenção</p>
              <div className="flex flex-wrap gap-1">
                {digest.needsAttention.map((p) => (
                  <Badge key={p.id} variant="outline" className="text-xs text-orange-600">
                    {p.name} ({p.goal_progress.toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auto-digest toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="auto-digest" className="text-sm font-medium">
                Envio Automático
              </Label>
              <p className="text-xs text-muted-foreground">
                Toda segunda-feira às 08:00
              </p>
            </div>
          </div>
          <Switch
            id="auto-digest"
            checked={autoDigest}
            onCheckedChange={setAutoDigest}
          />
        </div>

        {/* Send button */}
        <Button 
          className="w-full" 
          onClick={sendDigest}
          disabled={sending}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando resumo...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Gerar Resumo Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
