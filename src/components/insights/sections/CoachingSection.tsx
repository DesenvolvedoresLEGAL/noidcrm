import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ManagerSmartLists } from "@/components/dashboards/manager/ManagerSmartLists";
import { BehaviorMonitor } from "@/components/dashboards/manager/BehaviorMonitor";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Trophy,
  Loader2,
  ChevronRight,
  Calendar,
  Bell,
  Target,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { formatCurrencyFull } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CoachingSectionProps {
  data: ManagerDashboardData;
}

interface CoachingData {
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  priority_actions: string[];
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  },
};

function getPerformanceStatus(percentage: number) {
  if (percentage >= 100) return { label: 'Meta Atingida', color: 'bg-green-500', icon: Trophy };
  if (percentage >= 70) return { label: 'No Caminho', color: 'bg-blue-500', icon: TrendingUp };
  if (percentage >= 50) return { label: 'Atenção', color: 'bg-amber-500', icon: AlertTriangle };
  return { label: 'Crítico', color: 'bg-red-500', icon: TrendingDown };
}

export function CoachingSection({ data }: CoachingSectionProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [coachingData, setCoachingData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(false);

  const teamMembers = data.teamMembers || [];
  const atRiskSellers = data.atRiskSellers || [];
  const aiRecommendations = data.aiRecommendations || [];

  const fetchCoaching = async (memberId: string) => {
    const member = teamMembers.find(m => m.userId === memberId);
    if (!member) return;

    setSelectedMemberId(memberId);
    setLoading(true);
    setCoachingData(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('ai-team-coaching', {
        body: {
          sellerId: memberId,
          sellerName: member.name,
          metrics: {
            opportunities_count: member.openOpportunities,
            pipeline_value: member.pipelineValue,
            won_value: member.achieved,
            activities_count: member.activitiesThisWeek,
            conversion_rate: member.conversionRate,
            goal_progress: member.percentage,
            team_goal: data.teamGoal.goal
          }
        }
      });

      if (error) throw error;
      setCoachingData(result);
    } catch (error) {
      console.error('Error fetching coaching:', error);
      toast.error('Erro ao gerar coaching');
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = teamMembers.find(m => m.userId === selectedMemberId);

  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* AI Recommendations Summary */}
      {aiRecommendations.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recomendações da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiRecommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                <div className={cn(
                  "p-1.5 rounded-full shrink-0",
                  rec.priority === 'high' ? 'bg-red-100' : 'bg-amber-100'
                )}>
                  <Target className={cn(
                    "h-3.5 w-3.5",
                    rec.priority === 'high' ? 'text-red-600' : 'text-amber-600'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{rec.userName}</span>
                    {' - '}{rec.action}
                  </p>
                  {rec.deals > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rec.deals} deals afetados
                    </p>
                  )}
                </div>
                <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {rec.priority === 'high' ? 'Urgente' : 'Moderado'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Team Members for Coaching */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Coaching Individual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teamMembers.map((member) => {
                const status = getPerformanceStatus(member.percentage);
                const StatusIcon = status.icon;
                const isSelected = selectedMemberId === member.userId;

                return (
                  <div
                    key={member.userId}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => fetchCoaching(member.userId)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatarUrl || undefined} />
                        <AvatarFallback>
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Progress value={Math.min(member.percentage, 100)} className="w-16 h-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {member.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={cn(status.color, "text-white text-xs")}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Performance Alerts */}
          {atRiskSellers.length > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas de Performance
                  <Badge variant="destructive" className="ml-auto">{atRiskSellers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {atRiskSellers.map((seller) => (
                  <div key={seller.userId} className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-100">
                    <div>
                      <p className="font-medium text-sm">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Gap: {formatCurrencyFull(seller.gap)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600">
                        {Math.round((seller.achieved / seller.goal) * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">da meta</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Coaching Details */}
        <div className="space-y-4">
          {selectedMember && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedMember.avatarUrl || undefined} />
                    <AvatarFallback>
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{selectedMember.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Coaching personalizado via IA
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analisando performance...</p>
                  </div>
                ) : coachingData ? (
                  <div className="space-y-4">
                    {/* Strengths */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        Pontos Fortes
                      </h4>
                      <ul className="space-y-1">
                        {coachingData.strengths.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Gaps */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        Gaps Identificados
                      </h4>
                      <ul className="space-y-1">
                        {coachingData.gaps.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Priority Actions */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2 text-primary">
                        <Target className="h-4 w-4" />
                        Ações Prioritárias
                      </h4>
                      <div className="space-y-1">
                        {coachingData.priority_actions.map((action, i) => (
                          <div 
                            key={i} 
                            className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm flex items-start gap-2"
                          >
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              P{i + 1}
                            </Badge>
                            <span className="text-muted-foreground">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Clique em gerar coaching</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Smart Lists */}
          <ManagerSmartLists data={data} />
        </div>
      </div>

      {/* Behavior Monitor */}
      <BehaviorMonitor data={data.behaviorMonitor} />
    </motion.div>
  );
}
