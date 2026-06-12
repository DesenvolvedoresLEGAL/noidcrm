import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  XCircle,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Snowflake,
  RotateCcw,
} from 'lucide-react';
import { EditableField } from './EditableField';
import { HandoffBadge } from './HandoffBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { OwnerSelector } from './OwnerSelector';
import { SidebarDataSection } from './sidebar/SidebarDataSection';
import { QuickIndicators } from './sidebar/QuickIndicators';
import { WinLossRiskAlerts } from '@/components/opportunities/WinLossRiskAlerts';
import { useOpportunityQualificationScore } from '@/hooks/useOpportunityQualificationScore';
import { Target } from 'lucide-react';

interface OpportunitySidebarProps {
  opportunity: any;
  onUpdateField: (field: string, value: any) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onWon: () => void;
  onLost: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReopen?: () => void;
  userRole?: string;
  onNavigateToIntelligence?: () => void;
}

export function OpportunitySidebar({ 
  opportunity, 
  onUpdateField,
  onUpdateTitle,
  onWon,
  onLost,
  onEdit,
  onDelete,
  onReopen,
  userRole,
  onNavigateToIntelligence,
}: OpportunitySidebarProps) {
  // Sprint Active Users SoT: passar o owner atual como extra para que o nome
  // histórico apareça no rótulo mesmo se o usuário estiver inativo. O dropdown
  // continua oferecendo apenas usuários ativos para nova atribuição.
  const { users } = useOrganizationUsers([opportunity.owner?.user_id]);

  const isWon = opportunity.status === 'won';
  const isLost = opportunity.status === 'lost';
  const isClosed = isWon || isLost;
  const canDelete = userRole && ['owner', 'admin', 'manager'].includes(userRole.toLowerCase());

  const temperatureStyles: Record<string, string> = {
    cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    warm: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    hot: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    burning: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const temperatureLabels: Record<string, string> = {
    cold: 'Frio',
    warm: 'Morno',
    hot: 'Quente',
    burning: 'Urgente',
  };

  const temperature = opportunity.temperatura || opportunity.temperature;

  const isQualificationPipeline =
    opportunity.pipeline?.pipeline_type === 'qualification';
  const qualScore = useOpportunityQualificationScore({
    opportunityId: opportunity.id,
    pipelineId: opportunity.pipeline_id,
    account: opportunity.accounts ?? opportunity.account ?? null,
    contact: opportunity.contacts ?? opportunity.contact ?? null,
  });

  return (
    <div className="space-y-3">

      {/* Hero Card - Title, Status, Badges, Actions */}
      <div className="bg-card border rounded-lg p-4 space-y-4">
        {/* Title - Editable */}
        <EditableField
          value={opportunity.title}
          onSave={onUpdateTitle}
          className="text-lg font-semibold leading-tight"
        />

        {/* Status Badge (if closed) */}
        {isClosed && (
          <div>
            {isWon && (
              <Badge className="bg-green-500 text-white text-xs">
                ✓ GANHOU
              </Badge>
            )}
            {isLost && (
              <Badge className="bg-red-500 text-white text-xs">
                ✗ PERDEU
              </Badge>
            )}
          </div>
        )}

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {opportunity.prob || 0}%
          </Badge>
          {opportunity.produto && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
              {opportunity.produto}
            </Badge>
          )}
          {temperature && (
            <Badge className={cn("text-[10px] px-2 py-0.5", temperatureStyles[temperature] || '')}>
              {temperatureLabels[temperature] || temperature}
            </Badge>
          )}
          {isQualificationPipeline && qualScore.hasForm && !qualScore.isLoading && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0.5 gap-1 border',
                qualScore.classification.colorClass
              )}
              title={`${qualScore.classification.label} — ${qualScore.total}/100`}
            >
              <Target className="h-2.5 w-2.5" />
              {qualScore.total}/100
            </Badge>
          )}
          
          {/* Owner Avatar with Dropdown */}
          <OwnerSelector
            currentOwner={opportunity.owner}
            users={users}
            onChangeOwner={(userId) => onUpdateField('owner_user_id', userId)}
            disabled={isClosed}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onWon}
            disabled={isClosed}
            className={cn(
              "gap-1 text-xs h-7 px-2 min-w-0",
              isWon && "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}
          >
            <Trophy className="h-3 w-3 shrink-0" />
            <span className="truncate">Ganhou</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLost}
            disabled={isClosed}
            className={cn(
              "gap-1 text-xs h-7 px-2 min-w-0",
              isLost && "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            <XCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">Perdeu</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px] bg-popover">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Snowflake className="h-4 w-4 mr-2" />
                Congelar
              </DropdownMenuItem>
              
              {/* Reopen option - only for won/lost opportunities */}
              {isClosed && canDelete && onReopen && (
                <DropdownMenuItem onClick={onReopen} className="text-orange-600 focus:text-orange-600">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reabrir Venda
                </DropdownMenuItem>
              )}
              
              {canDelete && (
                <>
                  <DropdownMenuSeparator className="my-2" />
                  <div className="px-2 py-1">
                    <span className="text-xs font-medium text-destructive/70 uppercase tracking-wide">
                      Zona de perigo
                    </span>
                  </div>
                  <DropdownMenuItem 
                    onClick={onDelete} 
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 mt-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir oportunidade
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Handoff Badge */}
      <HandoffBadge
        qualifiedBy={opportunity.qualified_by}
        sourceOpportunity={opportunity.source_opportunity}
        qualifiedAt={opportunity.qualified_at}
      />

      {/* Win/Loss Risk Alerts */}
      {opportunity.status === 'open' && opportunity.pipeline?.pipeline_type === 'sales' && opportunity.organization_id && (
        <WinLossRiskAlerts 
          opportunityId={opportunity.id}
          organizationId={opportunity.organization_id}
        />
      )}

      {/* === SEÇÃO 1: INDICADORES RÁPIDOS (HERO METRICS) === */}
      <QuickIndicators 
        opportunityId={opportunity.id}
        organizationId={opportunity.organization_id}
        onNavigateToIntelligence={onNavigateToIntelligence}
      />

      {/* === SEÇÃO 2: DADOS DO DEAL === */}
      <SidebarDataSection 
        opportunity={opportunity} 
        onUpdateField={onUpdateField} 
        isClosed={isClosed}
      />
    </div>
  );
}
