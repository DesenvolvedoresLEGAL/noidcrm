import { Building2, User, Briefcase, Target, Phone, Mail, MapPin, DollarSign, Calendar, Hash, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateBR } from '@/lib/dateUtils';
import { Link } from 'react-router-dom';

interface ProposalContextSummaryProps {
  account?: {
    id?: string;
    razao_social?: string;
    nome_fantasia?: string;
    cnpj?: string;
    telefones?: any;
    emails?: string[];
    cidade?: string;
    uf?: string;
    logo_url?: string;
    segmento?: string;
    porte?: string;
  };
  contact?: {
    id?: string;
    nome?: string;
    cargo?: string;
    telefones?: string[];
    emails?: string[];
  };
  owner?: {
    full_name?: string;
    avatar_url?: string;
    email?: string;
  };
  opportunity?: {
    id?: string;
    title?: string;
    valor_previsto?: number;
    close_date_prevista?: string;
    stage_name?: string;
    pipeline_name?: string;
  };
  className?: string;
}

const getInitials = (name?: string) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
};

const formatPhone = (phones: any): string => {
  if (!phones) return '-';
  
  // Handle array of objects like [{numero: '...', tipo: '...'}]
  if (Array.isArray(phones)) {
    const first = phones.find(Boolean);
    if (!first) return '-';
    if (typeof first === 'string') return first;
    if (typeof first === 'object') {
      // Support 'numero' key from DFS-style JSONB
      return first.numero ?? first.phone ?? first.value ?? first.number ?? '-';
    }
    return '-';
  }
  
  // Handle single object like {numero: '...', tipo: '...'}
  if (typeof phones === 'object') {
    return phones.numero ?? phones.phone ?? phones.value ?? phones.number ?? '-';
  }
  
  return phones;
};

const formatCurrency = (value?: number) => {
  if (!value) return '-';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

export function ProposalContextSummary({ account, contact, owner, opportunity, className }: ProposalContextSummaryProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Card */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa
              </div>
              {account?.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                  <Link to={`/app/accounts/${account.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {account ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {account.logo_url ? (
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={account.logo_url} />
                      <AvatarFallback className="text-xs">{getInitials(account.razao_social)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-foreground">
                      {account.nome_fantasia || account.razao_social || '-'}
                    </p>
                    {account.cnpj && (
                      <p className="text-xs text-muted-foreground font-mono">{account.cnpj}</p>
                    )}
                    {(account.segmento || account.porte) && (
                      <div className="flex gap-1.5 mt-1">
                        {account.segmento && <Badge variant="secondary" className="text-[10px]">{account.segmento}</Badge>}
                        {account.porte && <Badge variant="outline" className="text-[10px]">{account.porte}</Badge>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {account.telefones && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground/60" />
                      <span>{formatPhone(account.telefones)}</span>
                    </div>
                  )}
                  {account.emails?.[0] && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground/60" />
                      <span className="truncate">{account.emails[0]}</span>
                    </div>
                  )}
                  {(account.cidade || account.uf) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-muted-foreground/60" />
                      <span>{[account.cidade, account.uf].filter(Boolean).join(' - ')}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada</p>
            )}
          </CardContent>
        </Card>

        {/* Contact Card */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contact ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {getInitials(contact.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-foreground">{contact.nome || '-'}</p>
                    {contact.cargo && (
                      <p className="text-xs text-muted-foreground">{contact.cargo}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {contact.telefones?.[0] && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground/60" />
                      <span>{contact.telefones[0]}</span>
                    </div>
                  )}
                  {contact.emails?.[0] && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground/60" />
                      <span className="truncate">{contact.emails[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum contato vinculado</p>
            )}
          </CardContent>
        </Card>

        {/* Owner/Salesperson Card */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Vendedor Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            {owner ? (
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {owner.avatar_url && <AvatarImage src={owner.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-foreground">{owner.full_name || '-'}</p>
                  {owner.email && (
                    <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum vendedor atribuído</p>
            )}
          </CardContent>
        </Card>

        {/* Opportunity Card */}
        <Card className="bg-card/80 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Oportunidade
              </div>
              {opportunity?.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                  <Link to={`/app/opportunities/${opportunity.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opportunity ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-foreground line-clamp-2">{opportunity.title || '-'}</p>
                  {(opportunity.pipeline_name || opportunity.stage_name) && (
                    <div className="flex items-center gap-1.5 mt-1">
                      {opportunity.pipeline_name && (
                        <Badge variant="outline" className="text-[10px]">{opportunity.pipeline_name}</Badge>
                      )}
                      {opportunity.stage_name && (
                        <Badge variant="secondary" className="text-[10px]">{opportunity.stage_name}</Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-3 w-3 text-muted-foreground/60" />
                    <span className="font-medium text-foreground">{formatCurrency(opportunity.valor_previsto)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3 text-muted-foreground/60" />
                    <span>{formatDateBR(opportunity.close_date_prevista)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade vinculada</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
