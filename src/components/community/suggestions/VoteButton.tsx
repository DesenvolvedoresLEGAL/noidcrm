import { motion } from "framer-motion";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoteButtonProps {
  votesCount: number;
  hasVoted: boolean;
  onVote: () => void;
  disabled?: boolean;
  size?: "sm" | "lg";
}

export function VoteButton({ votesCount, hasVoted, onVote, disabled, size = "sm" }: VoteButtonProps) {
  return (
    <Button
      variant={hasVoted ? "default" : "outline"}
      size={size === "lg" ? "default" : "sm"}
      onClick={onVote}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 min-w-[60px] h-auto py-2",
        hasVoted && "bg-primary text-primary-foreground",
        size === "lg" && "min-w-[80px] py-3"
      )}
    >
      <motion.div
        animate={hasVoted ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <ThumbsUp className={cn("h-4 w-4", size === "lg" && "h-5 w-5")} />
      </motion.div>
      <motion.span 
        key={votesCount}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-sm font-bold", size === "lg" && "text-base")}
      >
        {votesCount}
      </motion.span>
    </Button>
  );
}
