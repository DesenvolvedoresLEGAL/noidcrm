import { useState } from "react";
import { Lightbulb, Loader2, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSuggestions, SuggestionStatus } from "@/hooks/useSuggestions";
import { SuggestionCard } from "./SuggestionCard";
import { CreateSuggestionDialog } from "./CreateSuggestionDialog";
import { Skeleton } from "@/components/ui/skeleton";

const statusFilters: { value: SuggestionStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "under_review", label: "Em análise" },
  { value: "planned", label: "Planejadas" },
  { value: "in_development", label: "Em desenvolvimento" },
  { value: "launched", label: "Lançadas" },
];

export function SuggestionList() {
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | "all">("all");
  const { suggestions, isLoading, voteSuggestion } = useSuggestions(
    statusFilter === "all" ? undefined : statusFilter
  );

  const handleVote = (suggestionId: string, hasVoted: boolean) => {
    voteSuggestion.mutate({ suggestionId, hasVoted });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Sugira melhorias para o NOID</CardTitle>
                <CardDescription className="text-base mt-1">
                  Sua ideia pode virar a próxima funcionalidade
                </CardDescription>
              </div>
            </div>
            <CreateSuggestionDialog />
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={statusFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(filter.value)}
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
            <Skeleton key={i} className="h-32 w-full" />
          ))
        ) : suggestions.length === 0 ? (
          <Card className="p-8 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma sugestão ainda</h3>
            <p className="text-muted-foreground mb-4">
              Seja o primeiro a sugerir uma melhoria!
            </p>
            <CreateSuggestionDialog />
          </Card>
        ) : (
          suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onVote={() => handleVote(suggestion.id, suggestion.has_voted || false)}
            />
          ))
        )}
      </div>
    </div>
  );
}
