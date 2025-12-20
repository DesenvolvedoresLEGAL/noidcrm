import { motion } from "framer-motion";
import { Heart, Eye, Star, Trophy, Lightbulb, BookOpen, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommunityCase, CaseCategory } from "@/hooks/useCases";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CaseCardProps {
  caseItem: CommunityCase;
  onClick?: () => void;
}

const categoryConfig: Record<CaseCategory, { label: string; icon: React.ElementType; color: string }> = {
  win_story: { label: "Win Story", icon: Trophy, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  learning: { label: "Aprendizado", icon: BookOpen, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  tip: { label: "Dica", icon: Lightbulb, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  process: { label: "Processo", icon: Workflow, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
};

export function CaseCard({ caseItem, onClick }: CaseCardProps) {
  const config = categoryConfig[caseItem.category];
  const CategoryIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="hover:border-primary/30 transition-colors cursor-pointer h-full"
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          {caseItem.is_featured && (
            <div className="flex items-center gap-1 text-primary mb-2">
              <Star className="h-4 w-4 fill-primary" />
              <span className="text-xs font-medium">Featured</span>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <CategoryIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">
                {caseItem.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {formatDistanceToNow(new Date(caseItem.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground line-clamp-3 mb-4">
            {caseItem.summary}
          </p>
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {caseItem.likes_count}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {caseItem.views_count}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
