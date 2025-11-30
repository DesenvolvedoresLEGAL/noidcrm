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
  Thermometer,
} from 'lucide-react';
import { InfoCard } from './InfoCard';
import { FieldRow } from './FieldRow';
import { EditableField } from './EditableField';
import { Badge } from '@/components/ui/badge';
import { formatDateBR } from '@/lib/dateUtils';

interface OpportunitySidebarProps {
  opportunity: any;
  onUpdateField: (field: string, value: any) => Promise<void>;
}

export function OpportunitySidebar({ opportunity, onUpdateField }: OpportunitySidebarProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const formatDate = (dateStr?: string) => {
    return formatDateBR(dateStr);
  };

  return (
    <div className="space-y-4">
      {/* Dados da Oportunidade */}
      <InfoCard title="Dados da Oportunidade" icon={<FileText className="h-4 w-4" />} collapsible defaultOpen>
        <FieldRow
          label="ID"
          value={<span className="text-xs font-mono">{opportunity.id.slice(0, 8)}...</span>}
          icon={<FileText className="h-4 w-4" />}
        />

        <EditableField
          label="Valor P&S"
          value={opportunity.valor_previsto || 0}
          onSave={(val) => onUpdateField('valor_previsto', parseFloat(val))}
          type="currency"
          icon={<DollarSign className="h-4 w-4" />}
          displayFormatter={formatCurrency}
        />

        {opportunity.meta?.mrr !== undefined && (
          <EditableField
            label="Valor MRR"
            value={opportunity.meta.mrr || 0}
            onSave={(val) => onUpdateField('meta.mrr', parseFloat(val))}
            type="currency"
            icon={<DollarSign className="h-4 w-4" />}
            displayFormatter={formatCurrency}
          />
        )}

        <EditableField
          label="Previsão de Fechamento"
          value={opportunity.close_date_prevista || ''}
          onSave={(val) => onUpdateField('close_date_prevista', val)}
          type="date"
          icon={<Calendar className="h-4 w-4" />}
          displayFormatter={formatDate}
        />

        <FieldRow
          label="Data de Criação"
          value={formatDate(opportunity.created_at)}
          icon={<Clock className="h-4 w-4" />}
        />

        {opportunity.origem && (
          <FieldRow
            label="Origem"
            value={opportunity.origem}
            icon={<Building2 className="h-4 w-4" />}
          />
        )}

        {(opportunity.temperatura || opportunity.temperature) && (
          <FieldRow
            label="Temperatura"
            value={(opportunity.temperatura || opportunity.temperature).toUpperCase()}
            icon={<Thermometer className="h-4 w-4" />}
          />
        )}

        {opportunity.meta?.cidade && (
          <FieldRow
            label="Localização"
            value={`${opportunity.meta.cidade}, ${opportunity.meta.uf}`}
            icon={<MapPin className="h-4 w-4" />}
          />
        )}

        {opportunity.meta?.observacoes && (
          <EditableField
            label="Observações"
            value={opportunity.meta.observacoes}
            onSave={(val) => onUpdateField('meta.observacoes', val)}
            type="textarea"
          />
        )}
      </InfoCard>

      {/* Empresa */}
      {opportunity.account_name && (
        <InfoCard title="Empresa" icon={<Building2 className="h-4 w-4" />} collapsible defaultOpen>
          <FieldRow
            label="Nome Fantasia"
            value={
              <a href="#" className="text-primary hover:underline font-semibold">
                {opportunity.account_name}
              </a>
            }
          />

          {opportunity.account?.razao_social && (
            <FieldRow label="Razão Social" value={opportunity.account.razao_social} />
          )}

          {opportunity.account?.cnpj && (
            <FieldRow label="CNPJ" value={opportunity.account.cnpj} />
          )}

          {opportunity.account?.telefones && opportunity.account.telefones.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Telefones</span>
              <div className="space-y-1 mt-1">
                {opportunity.account.telefones.map((tel: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <a href={`tel:${tel}`} className="text-sm hover:text-primary">
                      {tel}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {opportunity.account?.emails && opportunity.account.emails.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">E-mails</span>
              <div className="space-y-1 mt-1">
                {opportunity.account.emails.map((email: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <a href={`mailto:${email}`} className="text-sm hover:text-primary break-all">
                      {email}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </InfoCard>
      )}

      {/* Contato */}
      {opportunity.contact_name && (
        <InfoCard title="Contato" icon={<User className="h-4 w-4" />} collapsible defaultOpen>
          <FieldRow
            label="Nome"
            value={
              <a href="#" className="text-primary hover:underline font-semibold">
                {opportunity.contact_name}
              </a>
            }
          />

          {opportunity.contact?.cargo && (
            <FieldRow label="Cargo" value={opportunity.contact.cargo} />
          )}

          {opportunity.contact_phone && (
            <FieldRow
              label="Telefone"
              value={
                <a href={`tel:${opportunity.contact_phone}`} className="hover:text-primary">
                  {opportunity.contact_phone}
                </a>
              }
              icon={<Phone className="h-4 w-4" />}
            />
          )}

          {opportunity.contact_email && (
            <FieldRow
              label="E-mail"
              value={
                <a href={`mailto:${opportunity.contact_email}`} className="hover:text-primary break-all">
                  {opportunity.contact_email}
                </a>
              }
              icon={<Mail className="h-4 w-4" />}
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
                  Ver perfil
                </a>
              }
              icon={<Globe className="h-4 w-4" />}
            />
          )}
        </InfoCard>
      )}
    </div>
  );
}
