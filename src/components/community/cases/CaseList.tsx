import { useState } from "react";
import { Trophy, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCases, CaseCategory } from "@/hooks/useCases";
import { CaseCard } from "./CaseCard";
import { CreateCaseDialog } from "./CreateCaseDialog";
import { Skeleton } from "@/components/ui/skeleton";

const categoryFilters: { value: CaseCategory | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "win_story", label: "Win Stories" },
  { value: "learning", label: "Aprendizados" },
  { value: "tip", label: "Dicas" },
  { value: "process", label: "Processos" },
];

export function CaseList() {
  const [categoryFilter, setCategoryFilter] = useState<CaseCategory | "all">("all");
  const { cases, isLoading } = useCases(
    categoryFilter === "all" ? undefined : categoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Cases e Aprendizados</h2>
          <p className="text-muted-foreground">
            Espaço para usuários compartilharem resultados e experiências
          </p>
        </div>
        <CreateCaseDialog />
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-2">Nenhum case ainda</h3>
          <p className="text-muted-foreground mb-4">
            Seja o primeiro a compartilhar um case!
          </p>
          <CreateCaseDialog />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((caseItem) => (
            <CaseCard
              key={caseItem.id}
              caseItem={caseItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
