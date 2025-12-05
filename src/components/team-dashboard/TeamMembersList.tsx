import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TeamMemberMetrics } from '@/hooks/useTeamDashboard';
import { 
  Users, TrendingUp, TrendingDown, Activity, Target, 
  ChevronDown, ChevronUp, Sparkles, Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamMembersListProps {
  members: TeamMemberMetrics[];
}

interface CoachingRecommendation {
  user_id: string;
  recommendations: string[];
  strengths: string[];
  improvement_areas: string[];
}

export function TeamMembersList({ members }: TeamMembersListProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [coaching, setCoaching] = useState<Record<string, CoachingRecommendation>>({});
  const [loadingCoaching, setLoadingCoaching] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: value >= 100000 ? 'compact' : 'standard',
      maximumFractionDigits: value >= 100000 ? 1 : 0,
    }).format(value);
  };

  const getPerformanceLevel = (member: TeamMemberMetrics) => {
    if (member.conversion_rate >= 50) return { label: 'Excelente', color: 'text-green-500', bg: 'bg-green-500/10' };
    if (member.conversion_rate >= 30) return { label: 'Bom', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (member.conversion_rate >= 15) return { label: 'Regular', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    return { label: 'Atenção', color: 'text-red-500', bg: 'bg-red-500/10' };
  };

  const handleGetCoaching = async (member: TeamMemberMetrics) => {
    if (coaching[member.user_id]) {
      setExpandedMember(expandedMember === member.user_id ? null : member.user_id);
      return;
    }

    setLoadingCoaching(member.user_id);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-team-coaching', {
        body: {
          member: {
            name: member.full_name,
            opportunities_count: member.opportunities_count,
            won_count: member.won_count,
            lost_count: member.lost_count,
            conversion_rate: member.conversion_rate,
            activities_pending: member.activities_pending,
            activities_completed: member.activities_completed,
            pipeline_value: member.opportunities_value,
            won_value: member.won_value,
          }
        }
      });

      if (error) throw error;

      setCoaching(prev => ({
        ...prev,
        [member.user_id]: {
          user_id: member.user_id,
          ...data
        }
      }));
      setExpandedMember(member.user_id);
    } catch (err) {
      console.error('Error getting coaching:', err);
      toast.error('Erro ao gerar recomendações de coaching');
    } finally {
      setLoadingCoaching(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Membros do Time ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum membro no time
          </p>
        ) : (
          <div className="space-y-4">
            {members.map((member) => {
              const performance = getPerformanceLevel(member);
              const isExpanded = expandedMember === member.user_id;
              const memberCoaching = coaching[member.user_id];

              return (
                <div
                  key={member.user_id}
                  className="border rounded-lg overflow-hidden transition-all"
                >
                  {/* Main row */}
                  <div className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="font-medium">
                        {member.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{member.full_name}</p>
                        <Badge variant="outline" className={`${performance.color} ${performance.bg} text-xs`}>
                          {performance.label}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {member.opportunities_count} opps
                        </span>
                        <span className="flex items-center gap-1 text-green-600">
                          <TrendingUp className="h-3 w-3" />
                          {member.won_count} ganhas
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <TrendingDown className="h-3 w-3" />
                          {member.lost_count} perdidas
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {member.activities_pending} pendentes
                        </span>
                      </div>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">Pipeline</p>
                      <p className="font-bold">{formatCurrency(member.opportunities_value)}</p>
                    </div>

                    <div className="text-right hidden md:block">
                      <p className="text-sm text-muted-foreground">Conversão</p>
                      <p className="font-bold">{member.conversion_rate.toFixed(1)}%</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGetCoaching(member)}
                      disabled={loadingCoaching === member.user_id}
                      className="flex items-center gap-1"
                    >
                      {loadingCoaching === member.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span className="hidden sm:inline">Coaching</span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Expanded coaching section */}
                  {isExpanded && memberCoaching && (
                    <div className="border-t bg-muted/30 p-4 space-y-4">
                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Taxa de Conversão</span>
                          <span className="font-medium">{member.conversion_rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={member.conversion_rate} className="h-2" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Strengths */}
                        <div>
                          <p className="text-sm font-semibold text-green-600 mb-2">Pontos Fortes</p>
                          <ul className="space-y-1">
                            {memberCoaching.strengths.map((s, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <span className="text-green-500">✓</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Improvement areas */}
                        <div>
                          <p className="text-sm font-semibold text-amber-600 mb-2">Áreas de Melhoria</p>
                          <ul className="space-y-1">
                            {memberCoaching.improvement_areas.map((a, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <span className="text-amber-500">!</span>
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Recommendations */}
                        <div>
                          <p className="text-sm font-semibold text-primary mb-2">Recomendações</p>
                          <ul className="space-y-1">
                            {memberCoaching.recommendations.map((r, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <span className="text-primary">→</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
