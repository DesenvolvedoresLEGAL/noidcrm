import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TeamRankingTable } from "@/components/dashboards/manager/TeamRankingTable";
import { ActivityHeatmap } from "@/components/dashboards/manager/ActivityHeatmap";
import { TeamMemberStats, ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Target,
  DollarSign,
  Activity,
  Eye
} from "lucide-react";
import { formatCurrencyFull } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface TeamMembersSectionProps {
  data: ManagerDashboardData;
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
  if (percentage >= 100) {
    return { label: "Meta Atingida", color: "bg-green-500", textColor: "text-green-600" };
  }
  if (percentage >= 70) {
    return { label: "No Caminho", color: "bg-blue-500", textColor: "text-blue-600" };
  }
  if (percentage >= 50) {
    return { label: "Atenção", color: "bg-amber-500", textColor: "text-amber-600" };
  }
  return { label: "Em Risco", color: "bg-red-500", textColor: "text-red-600" };
}

function MemberCard({ member }: { member: TeamMemberStats }) {
  const status = getPerformanceStatus(member.percentage);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2" style={{ borderColor: status.color.replace('bg-', '') }}>
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback className="text-lg font-semibold">
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold text-sm">{member.name}</h4>
              <Badge 
                variant="secondary" 
                className={cn("text-[10px] px-1.5 py-0", status.color, "text-white")}
              >
                {status.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-muted-foreground">Meta</span>
            <span className={cn("text-sm font-bold", status.textColor)}>
              {member.percentage}%
            </span>
          </div>
          <Progress value={Math.min(member.percentage, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrencyFull(member.achieved)} de {formatCurrencyFull(member.monthlyGoal)}
          </p>
        </div>

        {/* Mini KPIs Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-primary">{member.openOpportunities}</p>
            <p className="text-[10px] text-muted-foreground">Opps</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-green-600">{member.conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground">Conv.</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{member.activitiesThisWeek}</p>
            <p className="text-[10px] text-muted-foreground">Ativid.</p>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            Pipeline
          </div>
          <span className="text-sm font-semibold">
            {formatCurrencyFull(member.pipelineValue)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamMembersSection({ data }: TeamMembersSectionProps) {
  const teamMembers = data.teamMembers || [];
  const totalMembers = teamMembers.length;
  const onTarget = teamMembers.filter(m => m.percentage >= 70).length;
  const atRisk = teamMembers.filter(m => m.percentage < 50).length;

  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Team Summary Header */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Minha Equipe</h3>
                <p className="text-sm text-muted-foreground">
                  {totalMembers} membros • Meta: {formatCurrencyFull(data.teamGoal.goal)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{onTarget}</p>
                <p className="text-xs text-muted-foreground">No Target</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{atRisk}</p>
                <p className="text-xs text-muted-foreground">Em Risco</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Grid */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Membros da Equipe
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teamMembers.map((member) => (
            <MemberCard key={member.userId} member={member} />
          ))}
        </div>
      </div>

      {/* Ranking + Activity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamRankingTable members={teamMembers} />
        <ActivityHeatmap data={data.activityHeatmap} />
      </div>
    </motion.div>
  );
}
