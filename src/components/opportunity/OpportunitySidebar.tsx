import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Calendar,
  Clock,
  MapPin,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  FileText,
  Pencil,
  Trophy,
  XCircle,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Snowflake,
  Gauge,
} from 'lucide-react';
import { InfoCard } from './InfoCard';
import { FieldRow } from './FieldRow';
import { EditableField } from './EditableField';
import { CustomFieldsSection } from '@/components/custom-fields/CustomFieldsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatDateBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { useOpportunityScoring } from '@/hooks/useOpportunityScoring';

interface OpportunitySidebarProps {
  opportunity: any;
  onUpdateField: (field: string, value: any) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onWon: () => void;
  onLost: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function OpportunitySidebar({ 
  opportunity, 
  onUpdateField,
  onUpdateTitle,
  onWon,
  onLost,
  onEdit,
  onDelete,
}: OpportunitySidebarProps) {
  const navigate = useNavigate();
  const { scoring, recalculate, isRecalculating } = useOpportunityScoring(opportunity.id);

  const isWon = opportunity.status === 'won';
  const isLost = opportunity.status === 'lost';
  const isClosed = isWon || isLost;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const formatDate = (dateStr?: string) => {
    return formatDateBR(dateStr);
  };

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

  const handleAccountClick = () => {
    if (opportunity.account?.id) {
      navigate(`/app/accounts/${opportunity.account.id}`);
    }
  };

  const handleEditAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunity.account?.id) {
      const returnTo = encodeURIComponent(`/app/opportunities/${opportunity.id}`);
      navigate(`/app/accounts/${opportunity.account.id}?returnTo=${returnTo}`);
    }
  };

  const handleEditContact = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opportunity.account?.id) {
      const returnTo = encodeURIComponent(`/app/opportunities/${opportunity.id}`);
      navigate(`/app/accounts/${opportunity.account.id}?tab=contacts&returnTo=${returnTo}`);
    }
  };

  const temperature = opportunity.temperatura || opportunity.temperature;

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
        <div className="flex flex-wrap gap-1.5">
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
            <DropdownMenuContent align="end">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Opportunity Score Card */}
      <InfoCard title="Score" icon={<Gauge className="h-3.5 w-3.5" />} collapsible defaultOpen>
        <OpportunityScoreCard
          opportunityId={opportunity.id}
          opportunityName={opportunity.title}
          opportunityScore={scoring?.opportunity_score ?? opportunity.opportunity_score}
          engagementScore={scoring?.engagement_score ?? opportunity.engagement_score}
          velocityScore={scoring?.velocity_score ?? opportunity.velocity_score}
          riskScore={scoring?.risk_score ?? opportunity.risk_score}
          winProbabilityAi={scoring?.win_probability_ai ?? opportunity.win_probability_ai}
          variant="compact"
          onRecalculate={recalculate}
          isRecalculating={isRecalculating}
        />
      </InfoCard>

      {/* Dados da Oportunidade */}
      <InfoCard title="Dados" icon={<FileText className="h-3.5 w-3.5" />} collapsible defaultOpen>
        <EditableField
          label="Valor Avulso"
          value={opportunity.valor_previsto || 0}
          onSave={(val) => onUpdateField('valor_previsto', parseFloat(val))}
          type="currency"
          icon={<DollarSign className="h-3 w-3" />}
          displayFormatter={formatCurrency}
        />

        <EditableField
          label="Previsão"
          value={opportunity.close_date_prevista || ''}
          onSave={(val) => onUpdateField('close_date_prevista', val)}
          type="date"
          icon={<Calendar className="h-3 w-3" />}
          displayFormatter={formatDate}
        />

        <FieldRow
          label="Criação"
          value={formatDate(opportunity.created_at)}
          icon={<Clock className="h-3 w-3" />}
        />

        {opportunity.origem && (
          <FieldRow
            label="Origem"
            value={opportunity.origem}
            icon={<Building2 className="h-3 w-3" />}
          />
        )}

        {opportunity.meta?.cidade && (
          <FieldRow
            label="Local"
            value={`${opportunity.meta.cidade}, ${opportunity.meta.uf}`}
            icon={<MapPin className="h-3 w-3" />}
          />
        )}

        {/* Custom Fields */}
        <CustomFieldsSection
          entityId={opportunity.id}
          entityType="opportunity"
          location="detail_sidebar"
          mode="edit"
          variant="sidebar"
          showGroupHeaders={false}
          className="mt-2 pt-2 border-t border-border"
        />
      </InfoCard>

      {/* Empresa */}
      {opportunity.account_name && (
        <InfoCard 
          title="Empresa" 
          icon={<Building2 className="h-3.5 w-3.5" />} 
          collapsible 
          defaultOpen
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleEditAccount}
              title="Editar empresa"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <FieldRow
              label="Nome"
              value={
                <button 
                  onClick={handleAccountClick}
                  className="text-primary hover:underline font-semibold text-left"
                >
                  {opportunity.account_name}
                </button>
              }
            />
            {/* Lead Score Badge */}
            {opportunity.account?.lead_grade && (
              <LeadScoreCard
                leadGrade={opportunity.account.lead_grade}
                leadScore={opportunity.account.lead_score}
                fitScore={opportunity.account.fit_score}
                intentScore={opportunity.account.intent_score}
                variant="inline"
              />
            )}
          </div>

          {opportunity.account?.cnpj && (
            <FieldRow label="CNPJ" value={opportunity.account.cnpj} />
          )}

          {opportunity.account?.telefones && opportunity.account.telefones.length > 0 && (
            <FieldRow
              label="Telefone"
              value={
                <a href={`tel:${opportunity.account.telefones[0]}`} className="hover:text-primary">
                  {opportunity.account.telefones[0]}
                </a>
              }
              icon={<Phone className="h-3 w-3" />}
            />
          )}
        </InfoCard>
      )}

      {/* Contato */}
      {opportunity.contact_name && (
        <InfoCard 
          title="Contato" 
          icon={<User className="h-3.5 w-3.5" />} 
          collapsible 
          defaultOpen
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleEditContact}
              title="Editar contato"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          }
        >
          <FieldRow
            label="Nome"
            value={
              <span className="text-primary font-semibold">
                {opportunity.contact_name}
              </span>
            }
          />

          {opportunity.contact?.cargo && (
            <FieldRow label="Cargo" value={opportunity.contact.cargo} />
          )}

          {opportunity.contact_phone && (
            <FieldRow
              label="Tel"
              value={
                <a href={`tel:${opportunity.contact_phone}`} className="hover:text-primary">
                  {opportunity.contact_phone}
                </a>
              }
              icon={<Phone className="h-3 w-3" />}
            />
          )}

          {opportunity.contact_email && (
            <FieldRow
              label="Email"
              value={
                <a href={`mailto:${opportunity.contact_email}`} className="hover:text-primary block truncate" title={opportunity.contact_email}>
                  {opportunity.contact_email}
                </a>
              }
              icon={<Mail className="h-3 w-3" />}
            />
          )}

          {opportunity.contact_linkedin && (
            <FieldRow
              label="LinkedIn"
              value={
                <a
                  href={opportunity.contact_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Ver
                </a>
              }
              icon={<Globe className="h-3 w-3" />}
            />
          )}
        </InfoCard>
      )}
    </div>
  );
}
