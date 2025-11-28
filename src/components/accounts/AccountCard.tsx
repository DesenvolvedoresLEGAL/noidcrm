import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Mail, 
  Phone, 
  Eye,
  Pencil,
  Trash2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AccountCardProps {
  account: {
    id: string;
    razao_social: string;
    nome_fantasia?: string;
    cnpj?: string;
    segmento?: string;
    tamanho?: string;
    origem_principal?: string;
  };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountCard({ account, onView, onEdit, onDelete }: AccountCardProps) {
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

  const getTamanhoColor = (tamanho?: string) => {
    switch (tamanho) {
      case 'Pequeno': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Médio': return 'bg-green-100 text-green-700 border-green-200';
      case 'Grande': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Enterprise': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={onView}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-semibold text-lg truncate">
                  {account.nome_fantasia || account.razao_social}
                </h3>
              </div>
              {account.nome_fantasia && (
                <p className="text-sm text-muted-foreground truncate">
                  {account.razao_social}
                </p>
              )}
              {account.cnpj && (
                <p className="text-xs text-muted-foreground mt-1">
                  CNPJ: {account.cnpj}
                </p>
              )}
            </div>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {account.tamanho && (
              <Badge variant="outline" className={getTamanhoColor(account.tamanho)}>
                {account.tamanho}
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
