import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, PlayCircle, Trophy, Video, Settings, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentSeller } from '@/services/roleplay/sellers';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Roleplay() {
  const navigate = useNavigate();

  const { data: seller, isLoading } = useQuery({
    queryKey: ['current-seller'],
    queryFn: getCurrentSeller
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">NOID Roleplay</h1>
          <p className="text-muted-foreground">
            Treine suas habilidades de vendas com simulações realistas de clientes B2B
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <PlayCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Treinos esta semana</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">Nota média</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Trophy className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">Presença %</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Video className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Vídeos recomendados</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Treino de Hoje */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary rounded-lg">
                  <PlayCircle className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Treino de Hoje</h3>
                  <p className="text-sm text-muted-foreground">09:00 - 09:30 BRT</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Inicie uma simulação de vendas com cliente IA personalizado
              </p>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => navigate('/app/roleplay/new')}
              >
                Iniciar Treino
              </Button>
            </div>
          </Card>

          {/* Minhas Sessões */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/app/roleplay/sessions')}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary rounded-lg">
                  <Users className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Minhas Sessões</h3>
                  <p className="text-sm text-muted-foreground">Ver histórico</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Revise suas conversas, notas e feedbacks anteriores
              </p>
            </div>
          </Card>

          {/* Ranking */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/app/roleplay/ranking')}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-warning/20 rounded-lg">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Ranking</h3>
                  <p className="text-sm text-muted-foreground">Ver posição</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Compare seu desempenho com o time e veja os top performers
              </p>
            </div>
          </Card>

          {/* Biblioteca de Vídeos */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/app/roleplay/videos')}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-accent/20 rounded-lg">
                  <Video className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Biblioteca</h3>
                  <p className="text-sm text-muted-foreground">Micro-vídeos</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Acesse vídeos de treinamento sobre técnicas de vendas
              </p>
            </div>
          </Card>

          {/* Admin (se for gestor) */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate('/app/roleplay/admin')}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Administração</h3>
                  <p className="text-sm text-muted-foreground">Configurações</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie ICPs, arquétipos, rubricas e políticas
              </p>
            </div>
          </Card>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 bg-gradient-to-br from-success/10 to-transparent">
            <h3 className="font-semibold mb-3 text-success">Gate de Desempenho</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Mantenha nota média ≥ 8.0 nas últimas 5 sessões para receber distribuição de reuniões.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span>Nota atual: -</span>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-warning/10 to-transparent">
            <h3 className="font-semibold mb-3 text-warning">Aceleradores</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Frequência e desempenho desbloqueiam multiplicadores de comissão (1.05x - 1.35x).
            </p>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-muted" />
              <span>Tier atual: NONE</span>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}