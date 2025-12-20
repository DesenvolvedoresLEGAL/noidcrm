import { motion } from "framer-motion";
import { MessageSquare, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Suggestion } from "@/hooks/useSuggestions";
import { SuggestionStatusBadge } from "./SuggestionStatusBadge";
import { VoteButton } from "./VoteButton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onVote: () => void;
  onClick?: () => void;
}

const impactAreaLabels: Record<string, string> = {
  sales: "Vendas",
  ai: "IA",
  cs: "CS",
  ux: "UX",
  other: "Outro",
};

export function SuggestionCard({ suggestion, onVote, onClick }: SuggestionCardProps) {
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
          {/* Vote column */}
          <div onClick={(e) => e.stopPropagation()}>
            <VoteButton
              votesCount={suggestion.votes_count}
              hasVoted={suggestion.has_voted || false}
              onVote={onVote}
            />
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
              {suggestion.title}
            </h3>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {suggestion.description}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <SuggestionStatusBadge status={suggestion.status} />
              
              <Badge variant="outline" className="text-xs">
                {impactAreaLabels[suggestion.impact_area]}
              </Badge>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {suggestion.comments_count}
              </div>

              <span className="text-xs text-muted-foreground ml-auto">
                {formatDistanceToNow(new Date(suggestion.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
