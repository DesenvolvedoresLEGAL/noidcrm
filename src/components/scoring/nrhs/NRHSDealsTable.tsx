// NRHS Deals Table - Tabela principal de deals

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Wrench, AlertTriangle, X, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NRHSDeal, getTierLabel } from '@/services/crm/nrhs-analytics';
import { NRHSTier, getNRHSTierConfig } from '@/services/crm/nrhs-calculator';
import { NRHSBadge } from '@/components/nrhs/NRHSBadge';
import { FixHygieneWizardModal } from '@/components/nrhs/FixHygieneWizardModal';
import { NRHS_ISSUES } from '@/services/crm/nrhs-issues';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NRHSDealsTableProps {
  deals: NRHSDeal[];
  filteredDeals: NRHSDeal[];
  isLoading: boolean;
  filters: {
    tier?: NRHSTier;
    ownerId?: string;
    stageId?: string;
    hasBlocker?: boolean;
    search?: string;
  };
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
  organizationId: string;
}

export function NRHSDealsTable({
  deals,
  filteredDeals,
  isLoading,
  filters,
  onFiltersChange,
  onClearFilters,
  organizationId,
}: NRHSDealsTableProps) {
  const navigate = useNavigate();
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<NRHSDeal | null>(null);

  // Get unique owners and stages for filters
  const uniqueOwners = [...new Map(deals.map(d => [d.ownerUserId, { id: d.ownerUserId, name: d.ownerName }])).values()];
  const uniqueStages = [...new Map(deals.map(d => [d.stageId, { id: d.stageId, name: d.stageName }])).values()];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleOpenDeal = (dealId: string) => {
    navigate(`/app/opportunities/${dealId}`);
  };

  const handleFixHygiene = (deal: NRHSDeal) => {
    setSelectedDeal(deal);
    setFixModalOpen(true);
  };

  const hasActiveFilters = filters.tier || filters.ownerId || filters.stageId || filters.hasBlocker !== undefined || filters.search;

  const getBlockerIssues = (blockers: string[]) => {
    return blockers.map(b => NRHS_ISSUES[b]).filter(Boolean);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Deals por Higiene de Receita
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredDeals.length} de {deals.length})
              </span>
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar deal ou empresa..."
                value={filters.search || ''}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
                className="pl-9"
              />
            </div>
            
            <Select
              value={filters.tier || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, tier: v === 'all' ? undefined : v as NRHSTier })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Faixa NRHS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas faixas</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
                <SelectItem value="healthy">Saudável</SelectItem>
                <SelectItem value="risk">Em Risco</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="insalubrious">Insalubre</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.ownerId || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, ownerId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos owners</SelectItem>
                {uniqueOwners.map(owner => (
                  <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.stageId || 'all'}
              onValueChange={(v) => onFiltersChange({ ...filters, stageId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estágios</SelectItem>
                {uniqueStages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.hasBlocker === undefined ? 'all' : filters.hasBlocker ? 'yes' : 'no'}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                hasBlocker: v === 'all' ? undefined : v === 'yes' 
              })}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Blockers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Com blockers</SelectItem>
                <SelectItem value="no">Sem blockers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Deal</TableHead>
                  <TableHead className="font-medium">Empresa</TableHead>
                  <TableHead className="font-medium">Owner</TableHead>
                  <TableHead className="font-medium text-right">Valor</TableHead>
                  <TableHead className="font-medium">Estágio</TableHead>
                  <TableHead className="font-medium text-center">NRHS</TableHead>
                  <TableHead className="font-medium text-center">Faixa</TableHead>
                  <TableHead className="font-medium text-center">Lacunas</TableHead>
                  <TableHead className="font-medium">Blockers</TableHead>
                  <TableHead className="font-medium">Última Revisão</TableHead>
                  <TableHead className="font-medium text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters 
                        ? 'Nenhum deal encontrado com os filtros aplicados'
                        : 'Nenhum deal encontrado'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeals.slice(0, 50).map((deal) => {
                    const tierConfig = deal.nrhsTier ? getNRHSTierConfig(deal.nrhsTier) : null;
                    const blockerIssues = getBlockerIssues(deal.nrhsBlockers);
                    
                    return (
                      <TableRow key={deal.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-[180px] truncate">
                          {deal.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate">
                          {deal.accountName}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[120px] truncate">
                          {deal.ownerName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(deal.value)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {deal.stageName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <NRHSBadge 
                            score={deal.nrhsScore} 
                            tier={deal.nrhsTier} 
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {tierConfig && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ 
                                borderColor: tierConfig.color,
                                color: tierConfig.color,
                              }}
                            >
                              {getTierLabel(deal.nrhsTier!)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {deal.nrhsIssuesCount > 0 ? (
                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                              {deal.nrhsIssuesCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {blockerIssues.length > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    <span className="text-xs text-muted-foreground">
                                      {blockerIssues.length}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <ul className="text-sm space-y-1">
                                    {blockerIssues.slice(0, 3).map((issue, i) => (
                                      <li key={i}>• {issue.title}</li>
                                    ))}
                                    {blockerIssues.length > 3 && (
                                      <li className="text-muted-foreground">
                                        +{blockerIssues.length - 3} mais...
                                      </li>
                                    )}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {deal.lastReviewedAt 
                            ? formatDistanceToNow(new Date(deal.lastReviewedAt), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleFixHygiene(deal)}
                                  >
                                    <Wrench className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Corrigir Higiene</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleOpenDeal(deal.id)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir Deal</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredDeals.length > 50 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Mostrando 50 de {filteredDeals.length} deals. Aplique filtros para refinar a busca.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fix Hygiene Modal */}
      {selectedDeal && (
        <FixHygieneWizardModal
          open={fixModalOpen}
          onOpenChange={setFixModalOpen}
          opportunityId={selectedDeal.id}
          organizationId={organizationId}
          issues={getBlockerIssues(selectedDeal.nrhsBlockers).map(issue => ({
            id: issue.id,
            title: issue.title,
            severity: issue.severity,
            cta: issue.cta,
          }))}
          onComplete={() => {
            setFixModalOpen(false);
            setSelectedDeal(null);
          }}
        />
      )}
    </>
  );
}
