import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Unlock, Calendar, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";
import { ExtendTrialDialog } from "./dialogs/ExtendTrialDialog";

interface TrialInfoCardProps {
  organization: {
    id: string;
    name: string;
    status: string | null;
    trial_ends_at: string | null;
  };
}

export function TrialInfoCard({ organization }: TrialInfoCardProps) {
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: trialBlock } = useQuery({
    queryKey: ["trial-block", organization.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_blocks")
        .select("*")
        .eq("organization_id", organization.id)
        .is("unblocked_at", null)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('unblock_trial', {
        org_id: organization.id,
        by_user_id: userData.user?.id,
        reason: 'admin_manual_unblock'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Trial desbloqueado com sucesso');
      queryClient.invalidateQueries({ queryKey: ["trial-block", organization.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-organization", organization.id] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao desbloquear: ${error.message}`);
    },
  });

  const trialEndsAt = organization.trial_ends_at ? new Date(organization.trial_ends_at) : null;
  const daysRemaining = trialEndsAt ? differenceInDays(trialEndsAt, new Date()) : null;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiring = daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
  const isBlocked = !!trialBlock || organization.status === 'suspended';

  const getStatusBadge = () => {
    if (isBlocked) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (organization.status === 'active') {
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativo (Pago)</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Trial Expirado</Badge>;
    }
    if (isExpiring) {
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Expirando</Badge>;
    }
    return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Em Trial</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Status do Trial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            {getStatusBadge()}
          </div>

          {organization.status === 'trial' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expira em</span>
                <span className={isExpired || isExpiring ? "text-destructive font-semibold" : ""}>
                  {trialEndsAt 
                    ? format(trialEndsAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "—"
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias restantes</span>
                <span className={`font-mono ${isExpired ? "text-destructive" : isExpiring ? "text-amber-500" : ""}`}>
                  {daysRemaining !== null 
                    ? daysRemaining <= 0 
                      ? `${Math.abs(daysRemaining)}d atrás`
                      : `${daysRemaining} dias`
                    : "—"
                  }
                </span>
              </div>
            </>
          )}

          {isBlocked && trialBlock && (
            <div className="p-3 bg-destructive/10 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                Trial Bloqueado
              </div>
              <div className="text-sm text-muted-foreground">
                Bloqueado {trialBlock.blocked_at && formatDistanceToNow(new Date(trialBlock.blocked_at), { addSuffix: true, locale: ptBR })}
              </div>
              {trialBlock.grace_period_ends_at && (
                <div className="text-sm text-muted-foreground">
                  Período de graça: {format(new Date(trialBlock.grace_period_ends_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-2"
              onClick={() => setShowExtendDialog(true)}
            >
              <Calendar className="h-4 w-4" />
              Estender Trial
            </Button>
            {isBlocked && (
              <Button 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => unblockMutation.mutate()}
                disabled={unblockMutation.isPending}
              >
                <Unlock className="h-4 w-4" />
                Desbloquear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ExtendTrialDialog
        open={showExtendDialog}
        onOpenChange={setShowExtendDialog}
        organization={organization}
      />
    </>
  );
}
