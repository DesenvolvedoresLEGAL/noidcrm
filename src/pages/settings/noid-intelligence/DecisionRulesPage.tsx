import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useDecisionRules,
  useUpdateDecisionRule,
  useDeleteDecisionRule,
} from "@/hooks/useDecisionEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Flame, Zap, Snowflake } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const labelIcon = {
  hot: <Flame className="h-3 w-3" />,
  warm: <Zap className="h-3 w-3" />,
  cold: <Snowflake className="h-3 w-3" />,
};

export default function DecisionRulesPage() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  const { data: rules, isLoading } = useDecisionRules(orgId);
  const update = useUpdateDecisionRule();
  const remove = useDeleteDecisionRule(orgId);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Decision Engine — Regras</h1>
        <p className="text-sm text-muted-foreground">
          Regras que transformam scores enriquecidos em ações automáticas no CRM.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma regra configurada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    {rule.priority_label && (
                      <Badge variant="outline" className="gap-1">
                        {labelIcon[rule.priority_label]} {rule.priority_label}
                      </Badge>
                    )}
                    <Badge variant="secondary">prioridade {rule.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) =>
                        update.mutate({ id: rule.id, input: { is_active: v } })
                      }
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(rule.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {rule.description && <p className="text-muted-foreground">{rule.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {rule.min_score != null && <Badge variant="outline">score ≥ {rule.min_score}</Badge>}
                  {rule.max_score != null && <Badge variant="outline">score ≤ {rule.max_score}</Badge>}
                  {rule.min_confidence != null && (
                    <Badge variant="outline">confiança ≥ {rule.min_confidence}%</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs pt-1">
                  {rule.action_create_opportunity && <Badge>Criar oportunidade</Badge>}
                  {rule.action_assign_owner && <Badge>Atribuir owner</Badge>}
                  {rule.action_create_task && <Badge>Criar task</Badge>}
                  {rule.action_enroll_sequence && <Badge>Iniciar sequência</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
