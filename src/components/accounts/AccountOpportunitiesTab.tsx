import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateOpportunityModal } from '@/components/CreateOpportunityModal';

import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { createOpportunity } from '@/services/crm/opportunities';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';


interface AccountOpportunitiesTabProps {
  accountId: string;
  accountName: string;
}

export function AccountOpportunitiesTab({ accountId, accountName }: AccountOpportunitiesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { pipelines } = useOrganizationPipelines();

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['account-opportunities', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          accounts!inner(id, razao_social, nome_fantasia),
          contacts(id, nome),
          stages(id, name, order_index),
          pipelines(id, name, type:pipeline_type)
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const createMutation = useMutation({
    mutationFn: createOpportunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-opportunities', accountId] });
      queryClient.invalidateQueries({ queryKey: ['account-details', accountId] });
      toast({ title: 'Oportunidade criada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar oportunidade',
        description: error.message,
      });
    },
  });

  // Calcular estatísticas - "Ganhas" considera apenas pipeline de vendas
  const salesWon = opportunities.filter(o => 
    o.status === 'won' && 
    ((o.pipelines as any)?.type === 'sales' || (o.pipelines as any)?.name?.toUpperCase() === 'VENDAS')
  );
  
  const stats = {
    total: opportunities.length,
    active: opportunities.filter(o => o.status === 'in_progress' || o.status === 'new').length,
    won: salesWon.length,
    lost: opportunities.filter(o => o.status === 'lost').length,
    totalValue: opportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
    pipelineValue: opportunities
      .filter(o => o.status === 'in_progress' || o.status === 'new')
      .reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
    conversionRate: opportunities.length > 0 
      ? (salesWon.length / opportunities.length) * 100 
      : 0,
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
              <TrendingUp className="h-5 w-5" />
              {stats.won}
            </div>
            <p className="text-xs text-muted-foreground">Ganhas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground flex items-center gap-1">
              <DollarSign className="h-5 w-5" />
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
              }).format(stats.pipelineValue)}
            </div>
            <p className="text-xs text-muted-foreground">Pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {stats.conversionRate.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Oportunidades */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Oportunidades</CardTitle>
          <Button onClick={() => setCreateModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Oportunidade
          </Button>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma oportunidade</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Crie a primeira oportunidade para {accountName}
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Oportunidade
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opportunity) => (
                <Card
                  key={opportunity.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/app/opportunities/${opportunity.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{opportunity.title}</h4>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {opportunity.pipelines && (
                            <span className="bg-muted px-2 py-0.5 rounded">
                              {opportunity.pipelines.name}
                            </span>
                          )}
                          {opportunity.stages && (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {opportunity.stages.name}
                            </span>
                          )}
                          {opportunity.produto && (
                            <span className="bg-secondary px-2 py-0.5 rounded">
                              {opportunity.produto}
                            </span>
                          )}
                        </div>
                        {opportunity.contacts && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Contato: {opportunity.contacts.nome}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          }).format(opportunity.valor_previsto || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {opportunity.prob}% prob.
                        </div>
                        {opportunity.status === 'won' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                            <TrendingUp className="h-3 w-3" />
                            Ganha
                          </span>
                        )}
                        {opportunity.status === 'lost' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 mt-1">
                            <TrendingDown className="h-3 w-3" />
                            Perdida
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateOpportunityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        pipelines={pipelines}
        onCreateOpportunity={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        defaultAccountId={accountId}
      />
    </div>
  );
}
