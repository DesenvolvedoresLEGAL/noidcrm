import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, History, Trophy, Video, Settings, TrendingUp, 
  Target, Flame, Calendar, Zap, Shield, ArrowRight, Check 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentSeller } from '@/services/roleplay/sellers';
import { getTrainingWindow } from '@/services/roleplay/settings';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Roleplay() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  const { data: seller, isLoading } = useQuery({
    queryKey: ['current-seller'],
    queryFn: getCurrentSeller,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: trainingWindow } = useQuery({
    queryKey: ['training-window', organization?.id],
    queryFn: () => getTrainingWindow(organization!.id),
    enabled: !!organization,
    staleTime: 5 * 60 * 1000,
  });

  const prefetchNewRoleplay = () => {
    queryClient.prefetchQuery({
      queryKey: ['icps'],
      queryFn: async () => {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase.from('icp_profiles').select('*');
        return data || [];
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  const stats = [
    { 
      label: 'Treinos Hoje', 
      value: 0, 
      icon: Target, 
      gradient: 'from-blue-500 to-cyan-500',
      trend: '+2'
    },
    { 
      label: 'Média Geral', 
      value: '-', 
      icon: TrendingUp, 
      gradient: 'from-green-500 to-emerald-500',
      trend: '+0.3'
    },
    { 
      label: 'Sequência', 
      value: '7 dias', 
      icon: Flame, 
      gradient: 'from-orange-500 to-red-500',
      trend: 'Recorde!'
    },
    { 
      label: 'Reuniões Liberadas', 
      value: 0, 
      icon: Calendar, 
      gradient: 'from-purple-500 to-pink-500',
      trend: '+3'
    },
  ];

  const actions = [
    {
      title: 'Novo Treino',
      description: 'Inicie uma simulação com cliente IA',
      icon: Play,
      gradient: 'from-blue-600 to-cyan-600',
      path: '/app/roleplay/new',
      badge: null,
      primary: true
    },
    {
      title: 'Minhas Sessões',
      description: 'Veja histórico e feedbacks',
      icon: History,
      gradient: 'from-purple-600 to-pink-600',
      path: '/app/roleplay/sessions',
      badge: 0
    },
    {
      title: 'Ranking',
      description: 'Compare seu desempenho',
      icon: Trophy,
      gradient: 'from-yellow-600 to-orange-600',
      path: '/app/roleplay/ranking',
      badge: null
    },
    {
      title: 'Biblioteca',
      description: 'Micro-vídeos de treinamento',
      icon: Video,
      gradient: 'from-indigo-600 to-purple-600',
      path: '/app/roleplay/videos',
      badge: null
    },
    {
      title: 'Administração',
      description: 'Configure ICPs e regras',
      icon: Settings,
      gradient: 'from-gray-600 to-slate-600',
      path: '/app/roleplay/admin',
      badge: null
    },
  ];

  const accelerators = [
    { tier: 'Bronze', min_score: 7.0, attendance: 80, multiplier: '1.05', gradient: 'from-amber-600 to-amber-800' },
    { tier: 'Silver', min_score: 7.5, attendance: 85, multiplier: '1.15', gradient: 'from-gray-400 to-gray-600' },
    { tier: 'Gold', min_score: 8.0, attendance: 90, multiplier: '1.25', gradient: 'from-yellow-400 to-yellow-600' },
    { tier: 'Diamond', min_score: 8.5, attendance: 95, multiplier: '1.35', gradient: 'from-cyan-400 to-blue-600' },
  ];

  const currentTier = 'NONE';
  const currentAvgScore = 0;
  const currentAttendance = 0;

  const nextTrainingDate = new Date();
  nextTrainingDate.setDate(nextTrainingDate.getDate() + (nextTrainingDate.getDay() === 0 ? 1 : nextTrainingDate.getDay() === 6 ? 2 : 1));

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-12 animate-gradient">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
          
          <div className="relative z-10 max-w-3xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-white mb-4 tracking-tight"
            >
              Treine com IA. <br />
              <span className="text-white/90">Venda na vida real.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/80 mb-8"
            >
              Simule conversas com clientes gerados por IA e aprimore suas técnicas de vendas
            </motion.p>
            
            {trainingWindow && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 text-white mb-8"
              >
                <Calendar className="h-5 w-5" />
                <span className="font-medium">
                  Próximo treino: {format(nextTrainingDate, "EEEE, dd/MM", { locale: ptBR })} às {trainingWindow.start} BRT
                </span>
              </motion.div>
            )}
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8 py-6 shadow-2xl hover:scale-105 transition-transform"
                onClick={() => navigate('/app/roleplay/new')}
                onMouseEnter={prefetchNewRoleplay}
              >
                <Zap className="mr-2 h-5 w-5" />
                Iniciar Treino Agora
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden backdrop-blur-lg bg-card/50 border-border/20 hover:scale-105 transition-transform">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10`} />
                
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="text-xs">{stat.trend}</Badge>
                  </div>
                  
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                    className="text-3xl font-bold mb-1"
                  >
                    {stat.value}
                  </motion.div>
                  
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card 
                className="relative overflow-hidden cursor-pointer group h-full"
                onClick={() => navigate(action.path)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                
                <div className="absolute inset-0 bg-shimmer bg-[length:1000px_100%] group-hover:animate-shimmer opacity-0 group-hover:opacity-100" />
                
                <CardContent className="p-8 relative z-10">
                  {action.badge !== null && (
                    <Badge className="absolute top-4 right-4">{action.badge}</Badge>
                  )}
                  
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${action.gradient} mb-6 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {action.description}
                  </p>
                  
                  <ArrowRight className="h-5 w-5 absolute bottom-6 right-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Performance Gate Card */}
          <Card className="backdrop-blur-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Gate de Distribuição</h3>
                    <p className="text-sm text-muted-foreground">Condições para liberar reuniões</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Ativo
                </Badge>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nota Mínima Média</span>
                  <span className="text-2xl font-bold">8.0</span>
                </div>
                
                <Progress value={Math.min((currentAvgScore / 8.0) * 100, 100)} className="h-3" />
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <div className="text-sm text-muted-foreground">Janela</div>
                    <div className="text-lg font-bold">5 sessões</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <div className="text-sm text-muted-foreground">Sua Média</div>
                    <div className={`text-lg font-bold ${currentAvgScore >= 8.0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {currentAvgScore.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accelerators Card */}
          <Card className="backdrop-blur-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Aceleradores de Comissão</h3>
                  <p className="text-sm text-muted-foreground">Multiplique seus ganhos com desempenho</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {accelerators.map((acc) => (
                  <div 
                    key={acc.tier}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      currentTier === acc.tier.toUpperCase()
                        ? 'border-primary bg-primary/5 scale-105' 
                        : 'border-muted bg-card/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`bg-gradient-to-r ${acc.gradient} text-white border-0`}>
                          {acc.tier}
                        </Badge>
                        <span className="text-2xl font-bold">{acc.multiplier}x</span>
                      </div>
                      {currentTier === acc.tier.toUpperCase() && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Nota: {acc.min_score}+ | Presença: {acc.attendance}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
