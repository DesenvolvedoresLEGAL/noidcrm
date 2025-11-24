import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Target, Zap } from 'lucide-react';
import { listEnrollments, SequenceEnrollment } from '@/services/crm/sequences-ai';

interface SequenceAnalyticsCardProps {
  sequenceId: string;
}

export function SequenceAnalyticsCard({ sequenceId }: SequenceAnalyticsCardProps) {
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [sequenceId]);

  const loadAnalytics = async () => {
    try {
      const data = await listEnrollments({ sequenceId });
      setEnrollments(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status === 'active').length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    paused: enrollments.filter(e => e.status === 'paused').length,
    completionRate: enrollments.length > 0 
      ? Math.round((enrollments.filter(e => e.status === 'completed').length / enrollments.length) * 100)
      : 0
  };

  // Count A/B variants
  const variantStats = enrollments.reduce((acc, e) => {
    if (e.ab_variant) {
      acc[e.ab_variant] = (acc[e.ab_variant] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Carregando analytics...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Analytics da Cadência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Inscritos
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              Ativos
            </div>
            <p className="text-2xl font-bold text-primary">{stats.active}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Concluídos
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{stats.completed}/{stats.total}</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>

        {/* A/B Test Results */}
        {Object.keys(variantStats).length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Distribuição A/B</p>
            <div className="space-y-2">
              {Object.entries(variantStats).map(([variant, count]) => (
                <div key={variant} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Variante {variant}</Badge>
                  </div>
                  <span className="text-sm font-medium">{count} leads</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Breakdown */}
        <div className="space-y-2 pt-4 border-t">
          <p className="text-sm font-medium mb-3">Status dos Leads</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <Badge variant="secondary">{stats.active}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pausados</span>
              <Badge variant="outline">{stats.paused}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Concluídos</span>
              <Badge className="bg-green-600">{stats.completed}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}