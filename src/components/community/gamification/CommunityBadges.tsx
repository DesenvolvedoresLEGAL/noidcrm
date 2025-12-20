import { Award, Users, Hammer, Sparkles, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface CommunityBadge {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  criteria: string;
  xp: number;
  unlocked: boolean;
  color: string;
}

const communityBadges: CommunityBadge[] = [
  {
    id: "collaborator",
    name: "Colaborador",
    description: "Membro ativo da comunidade",
    icon: Users,
    criteria: "5 sugestões criadas",
    xp: 50,
    unlocked: false,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "builder",
    name: "Construtor",
    description: "Ajuda a construir o produto",
    icon: Hammer,
    criteria: "20 sugestões aprovadas",
    xp: 150,
    unlocked: false,
    color: "from-purple-500 to-purple-600",
  },
  {
    id: "visionary",
    name: "Visionário",
    description: "Sua ideia virou realidade",
    icon: Sparkles,
    criteria: "1 sugestão lançada",
    xp: 500,
    unlocked: false,
    color: "from-yellow-500 to-orange-500",
  },
];

export function CommunityBadges() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Badges da Comunidade</h2>
        <p className="text-muted-foreground">
          Reconhecimentos especiais para membros ativos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {communityBadges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`relative overflow-hidden ${badge.unlocked ? '' : 'opacity-60'}`}>
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${badge.color} opacity-10`} />
              
              <CardHeader className="relative text-center pb-2">
                <div className="mx-auto mb-2 relative">
                  <div className={`p-4 rounded-full bg-gradient-to-br ${badge.color} shadow-lg`}>
                    <badge.icon className="h-8 w-8 text-white" />
                  </div>
                  {!badge.unlocked && (
                    <div className="absolute -bottom-1 -right-1 bg-muted rounded-full p-1">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg">{badge.name}</CardTitle>
                <CardDescription>{badge.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="relative text-center space-y-2">
                <div className="text-sm text-muted-foreground">
                  {badge.criteria}
                </div>
                <div className="flex items-center justify-center gap-1 text-sm font-medium text-primary">
                  <Award className="h-4 w-4" />
                  +{badge.xp} XP
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            🚧 Sistema de gamificação da comunidade em desenvolvimento. 
            Em breve você poderá desbloquear badges através das suas contribuições!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
