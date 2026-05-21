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
} from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { FieldRow } from '../FieldRow';
import { EditableField } from '../EditableField';
import { CustomFieldsSection } from '@/components/custom-fields/CustomFieldsSection';
import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { FinancialScoreBadge } from '@/components/ui/financial-score-badge';
import { Button } from '@/components/ui/button';
import { formatDateBR } from '@/lib/dateUtils';
import { formatPhoneDisplay, extractPhone, extractEmail } from '@/lib/contactFormat';
import { useAccountScore } from '@/hooks/useAccountScoring';
import { useAccountTagsBulk } from '@/hooks/useAccountTags';
import { AccountTagsBadges } from '@/components/accounts/AccountTagsSelector';
import { useApprovedCommercialAmount } from '@/hooks/useApprovedCommercialAmount';

interface SidebarDataSectionProps {
  opportunity: any;
  onUpdateField: (field: string, value: any) => Promise<void>;
  isClosed: boolean;
}

export function SidebarDataSection({ opportunity, onUpdateField, isClosed }: SidebarDataSectionProps) {
  const navigate = useNavigate();
  // Always-fresh score data so the badge stays fixed next to the company name
  const { data: liveScore } = useAccountScore(opportunity.account?.id);
  const leadGrade = liveScore?.lead_grade ?? opportunity.account?.lead_grade ?? null;
  const leadScore = liveScore?.lead_score ?? opportunity.account?.lead_score ?? null;
  const fitScore = liveScore?.fit_score ?? opportunity.account?.fit_score ?? null;
  const intentScore = liveScore?.intent_score ?? opportunity.account?.intent_score ?? null;

  // Tags da conta vinculada à oportunidade
  const accountIdsForTags = opportunity.account?.id ? [opportunity.account.id] : [];
  const { data: tagsByAccount } = useAccountTagsBulk(accountIdsForTags);
  const accountTags = (opportunity.account?.id && tagsByAccount?.[opportunity.account.id]) || [];

  // Fonte única do valor comercial aprovado. Quando a oportunidade tem
  // accepted_proposal_id, o valor exibido é o approved_amount da proposta
  // aprovada (não o valor_previsto/total_amount/snapshot).
  const approvedResolution = useApprovedCommercialAmount({
    id: opportunity?.id,
    accepted_proposal_id: opportunity?.accepted_proposal_id ?? null,
    valor_previsto: opportunity?.valor_previsto ?? null,
  });
  const hasApprovedOverride =
    approvedResolution.isInherited &&
    approvedResolution.is_final_approved_value &&
    approvedResolution.approved_commercial_amount > 0;
  const legacyValuePrevisto = Number(opportunity?.valor_previsto ?? 0);
  const showLegacyHint =
    hasApprovedOverride &&
    legacyValuePrevisto > 0 &&
    Math.abs(legacyValuePrevisto - approvedResolution.approved_commercial_amount) > 0.01;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const formatDate = (dateStr?: string) => formatDateBR(dateStr);

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

  return (
    <Accordion type="single" collapsible defaultValue="data">
      <AccordionItem value="data" className="border-none">
        <AccordionTrigger className="bg-card border rounded-t-lg px-3 py-2 hover:no-underline [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-blue-500" />
            <span>Dados do Deal</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-card border border-t-0 rounded-b-lg px-3 pb-3">
          <div className="space-y-3 pt-1">
            {/* Dados da Oportunidade */}
            <div className="border rounded-md p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <DollarSign className="h-3 w-3" />
                Valores
              </div>
              <div className="space-y-2">
                {hasApprovedOverride ? (
                  <>
                    <FieldRow
                      label="Valor Total"
                      value={
                        <span className="font-semibold text-success" title="Valor aprovado pela proposta vencedora">
                          {formatCurrency(approvedResolution.approved_commercial_amount)}
                        </span>
                      }
                      icon={<DollarSign className="h-3 w-3" />}
                    />
                    {showLegacyHint && (
                      <p className="text-[10px] text-muted-foreground pl-5 -mt-1">
                        Valor original/legado: {formatCurrency(legacyValuePrevisto)}
                      </p>
                    )}
                  </>
                ) : (
                  <EditableField
                    label="Valor Total"
                    value={opportunity.valor_previsto || 0}
                    onSave={(val) => onUpdateField('valor_previsto', parseFloat(val))}
                    type="currency"
                    icon={<DollarSign className="h-3 w-3" />}
                    displayFormatter={formatCurrency}
                  />
                )}

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

                <CustomFieldsSection
                  entityId={opportunity.id}
                  entityType="opportunity"
                  location="detail_sidebar"
                  mode="edit"
                  variant="sidebar"
                  showGroupHeaders={false}
                  className="mt-2 pt-2 border-t border-border"
                />
              </div>
            </div>

            {/* Empresa */}
            {opportunity.account_name && (
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    Empresa
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={handleEditAccount}
                    title="Editar empresa"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-2">
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
                    {opportunity.account?.id && (
                      <LeadScoreCard
                        leadGrade={leadGrade}
                        leadScore={leadScore}
                        fitScore={fitScore}
                        intentScore={intentScore}
                        variant="inline"
                      />
                    )}
                  </div>

                  {opportunity.account?.cnpj && (
                    <FieldRow label="CNPJ" value={opportunity.account.cnpj} />
                  )}

                  {(() => {
                    const phoneDisplay = formatPhoneDisplay(opportunity.account?.telefones);
                    if (!phoneDisplay) return null;
                    return (
                      <FieldRow
                        label="Telefone"
                        value={
                          <a href={`tel:${phoneDisplay.replace(/\D/g, '')}`} className="hover:text-primary">
                            {phoneDisplay}
                          </a>
                        }
                        icon={<Phone className="h-3 w-3" />}
                      />
                    );
                  })()}

                  {/* Score Financeiro */}
                  {opportunity.account && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <FieldRow
                        label="Score Financeiro"
                        value={
                          <FinancialScoreBadge
                            score={opportunity.account.score_financeiro}
                            riskLevel={opportunity.account.risco_financeiro}
                            factors={opportunity.account.score_fatores}
                            compact
                          />
                        }
                      />
                    </div>
                  )}

                  {/* Tags da Conta */}
                  {accountTags.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <FieldRow
                        label="Tags"
                        value={<AccountTagsBadges tags={accountTags} max={4} />}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contato */}
            {opportunity.contact_name && (
              <div className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <User className="h-3 w-3" />
                    Contato
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={handleEditContact}
                    title="Editar contato"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-2">
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

                  {(() => {
                    const phoneStr = extractPhone(opportunity.contact_phone) 
                      || extractPhone(opportunity.contact?.telefones?.[0])
                      || extractPhone(opportunity.contact?.telefones);
                    if (!phoneStr) return null;
                    return (
                      <FieldRow
                        label="Tel"
                        value={
                          <a href={`tel:${phoneStr.replace(/\D/g, '')}`} className="hover:text-primary">
                            {phoneStr}
                          </a>
                        }
                        icon={<Phone className="h-3 w-3" />}
                      />
                    );
                  })()}

                  {(() => {
                    const emailStr = extractEmail(opportunity.contact_email)
                      || extractEmail(opportunity.contact?.emails?.[0])
                      || extractEmail(opportunity.contact?.emails);
                    if (!emailStr) return null;
                    return (
                      <FieldRow
                        label="Email"
                        value={
                          <a
                            href={`mailto:${emailStr}`}
                            className="hover:text-primary block truncate"
                            title={emailStr}
                          >
                            {emailStr}
                          </a>
                        }
                        icon={<Mail className="h-3 w-3" />}
                      />
                    );
                  })()}

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
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
