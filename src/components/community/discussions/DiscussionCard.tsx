import { motion } from "framer-motion";
import { MessageSquare, Eye, CheckCircle, Pin, HelpCircle, Lightbulb, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Discussion, DiscussionCategory } from "@/hooks/useDiscussions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DiscussionCardProps {
  discussion: Discussion;
  onClick?: () => void;
}

const categoryConfig: Record<DiscussionCategory, { label: string; icon: React.ElementType; color: string }> = {
  question: { label: "Pergunta", icon: HelpCircle, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  best_practice: { label: "Boa prática", icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  tip: { label: "Dica", icon: Lightbulb, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  discussion: { label: "Discussão", icon: MessageCircle, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
};

export function DiscussionCard({ discussion, onClick }: DiscussionCardProps) {
  const config = categoryConfig[discussion.category];
  const CategoryIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
        onClick={onClick}
      >
        <div className="flex gap-4">
          {/* Icon column */}
          <div className={`p-2 rounded-lg h-fit ${config.color}`}>
            <CategoryIcon className="h-5 w-5" />
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              {discussion.is_pinned && (
                <Pin className="h-4 w-4 text-primary flex-shrink-0" />
              )}
              <h3 className="font-semibold text-foreground line-clamp-2">
                {discussion.title}
              </h3>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {discussion.content}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>

              {discussion.is_answered && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Respondida
                </Badge>
              )}

              {discussion.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}

              <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {discussion.views_count}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {discussion.replies_count}
                </span>
                <span>
                  {formatDistanceToNow(new Date(discussion.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
