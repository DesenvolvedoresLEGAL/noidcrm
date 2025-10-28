import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Trophy, TrendingUp, Users, Target } from 'lucide-react';
import { getRanking } from '@/services/roleplay/sellers';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Ranking() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['ranking', period],
    queryFn: () => getRanking(period)
  });

  const currentUser = ranking.find(r => r.is_current_user);
  const totalSellers = ranking.length;
  const avgScore = ranking.length > 0 
    ? ranking.reduce((acc, r) => acc + r.avg_score, 0) / ranking.length 
    : 0;
  const totalTrainings = ranking.reduce((acc, r) => acc + r.total_sessions, 0);

  const getPositionBadge = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
              <Trophy className="h-8 w-8 text-warning" />
              Ranking de Performance
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Compare seu desempenho com o time
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        {/* Period Filter */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="year">Ano</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedores Ativos</p>
                    <p className="text-2xl font-bold">{totalSellers}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/10 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Média Geral</p>
                    <p className="text-2xl font-bold">{avgScore.toFixed(1)}/10</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Treinos</p>
                    <p className="text-2xl font-bold">{totalTrainings}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Current User Card */}
            {currentUser && (
              <Card className="p-6 bg-primary/5 border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{getPositionBadge(currentUser.position)}</div>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={currentUser.avatar_url} />
                      <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg">{currentUser.name} (Você)</p>
                      <p className="text-sm text-muted-foreground">
                        Posição #{currentUser.position} de {totalSellers}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${getScoreColor(currentUser.avg_score)}`}>
                      {currentUser.avg_score}
                    </p>
                    <p className="text-sm text-muted-foreground">Nota Média</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Ranking Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Posição</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Treinos</TableHead>
                    <TableHead>Nota Média</TableHead>
                    <TableHead className="text-center">Aprovação</TableHead>
                    <TableHead>Último Treino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((seller) => (
                    <TableRow 
                      key={seller.id}
                      className={seller.is_current_user ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <div className="text-xl font-bold">
                          {getPositionBadge(seller.position)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={seller.avatar_url} />
                            <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {seller.name}
                              {seller.is_current_user && (
                                <Badge variant="secondary" className="ml-2">Você</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{seller.total_sessions}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${getScoreColor(seller.avg_score)}`}>
                              {seller.avg_score}
                            </span>
                            <span className="text-sm text-muted-foreground">/10</span>
                          </div>
                          <Progress 
                            value={seller.avg_score * 10} 
                            className="h-2"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <p className="font-semibold">{seller.approval_rate}%</p>
                          <p className="text-xs text-muted-foreground">
                            {seller.passed_sessions}/{seller.total_sessions}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {seller.last_session ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(seller.last_session), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {ranking.length === 0 && (
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 mx-auto mb-4 text-muted" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum treino registrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Seja o primeiro a aparecer no ranking!
                  </p>
                  <Button onClick={() => navigate('/app/roleplay/new')}>
                    Iniciar Primeiro Treino
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
