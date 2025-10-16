import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Mail, Phone, Linkedin } from 'lucide-react';
import { Opportunity } from '@/services/crm/types';

interface OpportunityCardProps {
  opportunity: Opportunity & {
    account_name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_linkedin?: string;
  };
  onClick: () => void;
}

export function OpportunityCard({ opportunity, onClick }: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const valorPS = opportunity.valor_previsto || 0;
  const mrr = opportunity.meta?.mrr || 0;
  const prob = (opportunity.prob || 0) * 100;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-all duration-200 hover:scale-[1.02] animate-fade-in"
        onClick={onClick}
      >
        <div className="space-y-3">
          {/* Título e Badges */}
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2">
              {opportunity.account_name || `Oportunidade ${opportunity.id}`}
            </h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">
                {opportunity.produto}
              </Badge>
              {opportunity.meta?.status && (
                <Badge variant="outline" className="text-xs">
                  {opportunity.meta.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Contato */}
          {opportunity.contact_name && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{opportunity.contact_name}</span>
            </div>
          )}

          {/* Informações de contato */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {opportunity.contact_email && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{opportunity.contact_email}</span>
              </div>
            )}
            {opportunity.contact_phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <span>{opportunity.contact_phone}</span>
              </div>
            )}
            {opportunity.contact_linkedin && (
              <div className="flex items-center gap-1">
                <Linkedin className="h-3 w-3" />
              </div>
            )}
          </div>

          {/* Valores */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-primary font-semibold">
              <DollarSign className="h-4 w-4" />
              <span>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(valorPS)}
              </span>
            </div>
            {mrr > 0 && (
              <div className="text-xs text-muted-foreground">
                MRR: {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(mrr)}
              </div>
            )}
          </div>

          {/* Barra de progresso e data */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{prob}% probabilidade</span>
              {opportunity.close_date_prevista && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(opportunity.close_date_prevista).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${prob}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
