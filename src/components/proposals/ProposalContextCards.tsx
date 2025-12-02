import { Building2, User, Briefcase, Phone, Mail, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    telefones?: string[];
    emails?: string[];
  };
  owner?: {
    full_name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  };
}

export function ProposalContextCards({ account, contact, owner }: ProposalContextCardsProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatPhone = (phones: any): string => {
    if (!phones) return '-';
    if (Array.isArray(phones)) return phones[0] || '-';
    if (typeof phones === 'object') {
      const values = Object.values(phones).filter(Boolean);
      return values[0] as string || '-';
    }
    return phones;
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
                {account.telefones && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{formatPhone(account.telefones)}</span>
                  </div>
                )}
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
                {contact.telefones?.[0] && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{contact.telefones[0]}</span>
                  </div>
                )}
                {contact.emails?.[0] && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{contact.emails[0]}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum contato vinculado</p>
          )}
        </CardContent>
      </Card>

      {/* Owner/Salesperson Card */}
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {owner ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={owner.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(owner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{owner.full_name || '-'}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {owner.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{owner.phone}</span>
                  </div>
                )}
                {owner.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{owner.email}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum vendedor vinculado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
