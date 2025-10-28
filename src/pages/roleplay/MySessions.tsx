import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentSeller } from '@/services/roleplay/sellers';
import { listMySessions } from '@/services/roleplay/sessions';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, Eye, History } from 'lucide-react';

export default function MySessions() {
  const navigate = useNavigate();

  const { data: seller } = useQuery({
    queryKey: ['current-seller'],
    queryFn: getCurrentSeller
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['my-sessions', seller?.id],
    queryFn: () => listMySessions(seller!.id),
    enabled: !!seller
  });

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
              <History className="h-8 w-8 text-purple-600" />
              Minhas Sessões
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Histórico de treinos e avaliações
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma sessão realizada ainda</p>
            <Button onClick={() => navigate('/app/roleplay/new')}>
              Iniciar Primeiro Treino
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">
                        {session.simulated_clients?.fake_name || 'Cliente'}
                      </h3>
                      <Badge variant={session.passed ? 'default' : 'destructive'}>
                        {session.score_overall?.toFixed(1) || '-'}/10
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {session.icp_profiles?.name} • {session.client_archetypes?.name}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{format(new Date(session.started_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                      <span>{session.exchanges_count || 0} mensagens</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/app/roleplay/summary/${session.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}