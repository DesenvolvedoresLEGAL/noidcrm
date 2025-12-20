import { useState } from "react";
import { MessageSquare, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDiscussions, DiscussionCategory } from "@/hooks/useDiscussions";
import { DiscussionCard } from "./DiscussionCard";
import { CreateDiscussionDialog } from "./CreateDiscussionDialog";
import { Skeleton } from "@/components/ui/skeleton";

const categoryFilters: { value: DiscussionCategory | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "question", label: "Perguntas" },
  { value: "best_practice", label: "Boas práticas" },
  { value: "tip", label: "Dicas" },
  { value: "discussion", label: "Discussões" },
];

export function DiscussionList() {
  const [categoryFilter, setCategoryFilter] = useState<DiscussionCategory | "all">("all");
  const { discussions, isLoading } = useDiscussions(
    categoryFilter === "all" ? undefined : categoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Discussões</h2>
          <p className="text-muted-foreground">
            Perguntas, respostas e boas práticas de vendas, CRM e IA
          </p>
        </div>
        <CreateDiscussionDialog />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {categoryFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={categoryFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(filter.value)}
            className="flex-shrink-0"
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))
        ) : discussions.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma discussão ainda</h3>
            <p className="text-muted-foreground mb-4">
              Seja o primeiro a iniciar uma discussão!
            </p>
            <CreateDiscussionDialog />
          </Card>
        ) : (
          discussions.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
            />
          ))
        )}
      </div>
    </div>
  );
}
