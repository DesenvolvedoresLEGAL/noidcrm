import { Building2, User, FileText, Phone, Mail, MapPin, Calendar, Hash, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDateBR } from '@/lib/dateUtils';
import { formatPhoneDisplay, extractEmail } from '@/lib/contactFormat';

interface ProposalContextCardsProps {
  account?: {
    razao_social?: string;
    nome_fantasia?: string;
    cnpj?: string;
    telefones?: any;
    emails?: string[];
    cidade?: string;
    uf?: string;
    logo_url?: string;
  };
  contact?: {
    nome?: string;
    cargo?: string;
    telefones?: Array<{ value?: string; is_primary?: boolean; type?: string }>;
    emails?: Array<{ value?: string; is_primary?: boolean; type?: string }>;
  };
  proposalData?: {
    currency?: string;
    expires_at?: string;
    proposalNumber?: string;
    ownerName?: string;
    ownerAvatar?: string;
    isNew?: boolean;
    version?: number;
    status?: string;
  };
}

export function ProposalContextCards({ account, contact, proposalData }: ProposalContextCardsProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };


  // Removed formatDate - using imported formatDateBR instead

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-4">
      {/* Account Card */}
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {account ? (
            <>
              <div className="flex items-center gap-3">
                {account.logo_url ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={account.logo_url} />
                    <AvatarFallback>{getInitials(account.razao_social)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {account.nome_fantasia || account.razao_social || '-'}
                  </p>
                  {account.cnpj && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {account.cnpj}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(() => {
                  const phoneDisplay = formatPhoneDisplay(account.telefones);
                  if (!phoneDisplay) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{phoneDisplay}</span>
                    </div>
                  );
                })()}
                {account.emails?.[0] && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{account.emails[0]}</span>
                  </div>
                )}
                {(account.cidade || account.uf) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    <span>{[account.cidade, account.uf].filter(Boolean).join(' - ')}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada</p>
          )}
        </CardContent>
      </Card>

      {/* Contact Card */}
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {contact ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    {getInitials(contact.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{contact.nome || '-'}</p>
                  {contact.cargo && (
                    <p className="text-xs text-muted-foreground">{contact.cargo}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {(() => {
                  const phoneDisplay = formatPhoneDisplay(contact.telefones);
                  if (!phoneDisplay) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{phoneDisplay}</span>
                    </div>
                  );
                })()}
                {(() => {
                  const email = extractEmail(contact.emails);
                  if (!email) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{email}</span>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum contato vinculado</p>
          )}
        </CardContent>
      </Card>

      {/* Proposal Data Card (replaces empty Vendedor card) */}
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            Dados da Proposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Proposal Number + Version + Status Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span>Número</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {proposalData?.proposalNumber || (proposalData?.isNew ? '(próximo)' : '-')}
              </Badge>
              {proposalData?.version && (
                <Badge variant="outline" className="text-xs">
                  v{proposalData.version}
                </Badge>
              )}
            </div>
          </div>

          {/* Status */}
          {proposalData?.status && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>Status</span>
              </div>
              <Badge 
                variant={
                  proposalData.status === 'accepted' ? 'default' :
                  proposalData.status === 'sent' ? 'secondary' :
                  proposalData.status === 'rejected' ? 'destructive' :
                  'outline'
                }
                className="text-xs"
              >
                {proposalData.status === 'draft' ? 'Rascunho' :
                 proposalData.status === 'sent' ? 'Aberta' :
                 proposalData.status === 'viewed' ? 'Aberta · Visualizada' :
                 proposalData.status === 'accepted' ? 'Aceita' :
                 proposalData.status === 'rejected' ? 'Recusada' :
                 proposalData.status}
              </Badge>
            </div>
          )}

          {/* Currency */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>Moeda</span>
            </div>
            <span className="text-sm font-medium">
              {getCurrencySymbol(proposalData?.currency)} {proposalData?.currency || 'BRL'}
            </span>
          </div>

          {/* Expiry Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Validade</span>
            </div>
            <span className="text-sm">
              {formatDateBR(proposalData?.expires_at)}
            </span>
          </div>

          {/* Owner/Salesperson */}
          {proposalData?.ownerName && (
            <div className="flex items-center justify-between pt-1 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Vendedor</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  {proposalData.ownerAvatar && <AvatarImage src={proposalData.ownerAvatar} />}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(proposalData.ownerName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate max-w-24">{proposalData.ownerName}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
