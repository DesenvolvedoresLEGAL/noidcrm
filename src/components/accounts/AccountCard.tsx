import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Mail, 
  Phone, 
  Eye,
  Pencil,
  Trash2,
  User,
  GitBranch,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { FinancialScoreBadge } from '@/components/ui/financial-score-badge';
import { convertAccountType } from '@/services/supabase/account-conversion';
import { toast } from 'sonner';
import { accountKeys } from '@/lib/query-keys';
import { useAccountTagIds } from '@/hooks/useAccountTags';
import { AccountTagsBadges } from './AccountTagsSelector';
import { useOrganizationTags } from '@/hooks/useOrganizationTags';

interface AccountCardProps {
  account: {
    id: string;
    razao_social: string;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    tipo_pessoa?: 'PJ' | 'PF';
    parent_account_id?: string | null;
    segmento?: string | null;
    tamanho?: string | null;
    porte?: string | null;
    origem_principal?: string | null;
    lead_score?: number | null;
    fit_score?: number | null;
    intent_score?: number | null;
    lead_grade?: string | null;
    score_financeiro?: number | null;
    risco_financeiro?: string | null;
    score_fatores?: Record<string, unknown> | null;
  };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountCard({ account, onView, onEdit, onDelete }: AccountCardProps) {
  const queryClient = useQueryClient();

  // Tags da conta
  const { data: tagIds = [] } = useAccountTagIds(account.id);
  const { tags: orgTags } = useOrganizationTags();
  const accountTags = orgTags
    .filter((t) => tagIds.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name, color: t.color }));

  // Mutation para conversão de tipo
  const convertMutation = useMutation({
    mutationFn: ({ accountId, newType }: { accountId: string; newType: 'PJ' | 'PF' }) =>
      convertAccountType(accountId, newType),
    onSuccess: () => {
      toast.success('Tipo de cadastro alterado com sucesso');
      queryClient.invalidateQueries({ queryKey: accountKeys.lists() });
    },
    onError: () => {
      toast.error('Erro ao alterar tipo de cadastro');
    },
  });

  // Buscar preview de contatos
  const { data: contacts = [] } = useQuery({
    queryKey: ['account-contacts-preview', account.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, nome, emails, telefones')
        .eq('account_id', account.id)
        .limit(3);
      return data || [];
    },
  });

  // Buscar métricas rápidas
  const { data: metrics } = useQuery({
    queryKey: ['account-metrics-preview', account.id],
    queryFn: async () => {
      const [
        { count: opportunitiesCount },
        { count: contactsCount },
        { data: pipelineValue }
      ] = await Promise.all([
        supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id)
          .in('status', ['new', 'in_progress']),
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id),
        supabase
          .from('opportunities')
          .select('valor_previsto')
          .eq('account_id', account.id)
          .in('status', ['new', 'in_progress'])
      ]);

      const totalValue = pipelineValue?.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0) || 0;

      return {
        opportunities: opportunitiesCount || 0,
        contacts: contactsCount || 0,
        pipelineValue: totalValue,
      };
    },
  });

  const getPorteColor = (porte?: string | null) => {
    switch (porte) {
      case 'MEI': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ME': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'EPP': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'Médio Porte': return 'bg-green-100 text-green-700 border-green-200';
      case 'Grande Porte': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const isPF = account.tipo_pessoa === 'PF';
  const isFilial = !!account.parent_account_id;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={onView}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isPF ? (
                  <User className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                )}
                <h3 className="font-semibold text-lg truncate">
                  {account.nome_fantasia || account.razao_social}
                </h3>
                {isFilial && (
                  <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                    <GitBranch className="h-3 w-3" />
                    Filial
                  </Badge>
                )}
              </div>
              {account.nome_fantasia && (
                <p className="text-sm text-muted-foreground truncate">
                  {account.razao_social}
                </p>
              )}
              {isPF && account.cpf && (
                <p className="text-xs text-muted-foreground mt-1">
                  CPF: {account.cpf}
                </p>
              )}
              {!isPF && account.cnpj && (
                <p className="text-xs text-muted-foreground mt-1">
                  CNPJ: {account.cnpj}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Lead Score Badge */}
              {account.lead_grade && (
                <LeadScoreCard
                  leadScore={account.lead_score}
                  fitScore={account.fit_score}
                  intentScore={account.intent_score}
                  leadGrade={account.lead_grade}
                  variant="compact"
                />
              )}
              {/* Financial Score Badge */}
              {account.score_financeiro != null && (
                <FinancialScoreBadge
                  score={account.score_financeiro}
                  riskLevel={account.risco_financeiro}
                  factors={account.score_fatores}
                  compact
                />
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => {
                        const newType = isPF ? 'PJ' : 'PF';
                        convertMutation.mutate({ accountId: account.id, newType });
                      }}
                      disabled={convertMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Converter para {isPF ? 'Empresa (PJ)' : 'Pessoa Física (PF)'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {account.porte && (
              <Badge variant="outline" className={getPorteColor(account.porte)}>
                {account.porte}
              </Badge>
            )}
            {account.segmento && (
              <Badge variant="secondary" className="text-xs">
                {account.segmento}
              </Badge>
            )}
            {account.origem_principal && (
              <Badge variant="outline" className="text-xs">
                {account.origem_principal}
              </Badge>
            )}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">{metrics?.opportunities || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">Oportunidades</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <Users className="h-4 w-4" />
                <span className="font-semibold">{metrics?.contacts || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">Contatos</p>
            </div>
            <div className="text-center">
              <div className="text-primary font-semibold text-sm mb-1">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(metrics?.pipelineValue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">Pipeline</p>
            </div>
          </div>

          {/* Preview de Contatos */}
          {contacts.length > 0 && (
            <div className="pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Contatos</p>
              <div className="space-y-2">
                {contacts.slice(0, 2).map((contact) => (
                  <div key={contact.id} className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {contact.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium truncate flex-1">{contact.nome}</span>
                    {contact.emails?.[0] && (
                      <Mail className="h-3 w-3 text-muted-foreground" />
                    )}
                    {contact.telefones?.[0] && (
                      <Phone className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
                {contacts.length > 2 && (
                  <p className="text-xs text-muted-foreground">
                    +{contacts.length - 2} contatos
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <Button 
            variant="outline" 
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
