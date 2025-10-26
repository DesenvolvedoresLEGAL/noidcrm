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
import { ChevronLeft, Eye } from 'lucide-react';

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
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Minhas Sessões</h1>
            <p className="text-muted-foreground">Histórico de treinos e avaliações</p>
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