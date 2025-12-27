import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, User, Pencil, Trash2 } from 'lucide-react';
import { Contact, getPrimaryEmail, getPrimaryPhone } from '@/services/supabase/contacts';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
  onEmail: (email: string) => void;
  onCall: (phone: string) => void;
  onSchedule: (contact: Contact) => void;
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  onEmail,
  onCall,
  onSchedule,
}: ContactCardProps) {
  const primaryEmail = getPrimaryEmail(contact);
  const primaryPhone = getPrimaryPhone(contact);
  const initials = contact.nome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">{initials}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {contact.nome}
                </h3>
                {contact.cargo && (
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.cargo}
                  </p>
                )}
              </div>

              {/* Action Buttons - Desktop */}
              <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(contact)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(contact.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("truncate", primaryEmail ? "text-muted-foreground" : "text-muted-foreground/50 italic")}>
                  {primaryEmail || 'Sem email'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("", primaryPhone ? "text-muted-foreground" : "text-muted-foreground/50 italic")}>
                  {primaryPhone || 'Sem telefone'}
                </span>
              </div>
            </div>

            {/* Additional Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {contact.emails && contact.emails.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  +{contact.emails.length - 1} email{contact.emails.length - 1 > 1 ? 's' : ''}
                </Badge>
              )}
              {contact.telefones && contact.telefones.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  +{contact.telefones.length - 1} telefone{contact.telefones.length - 1 > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {primaryEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onEmail(primaryEmail)}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </Button>
              )}
              {primaryPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onCall(primaryPhone)}
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Ligar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onSchedule(contact)}
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Agendar
              </Button>

              {/* Mobile Action Buttons */}
              <div className="flex md:hidden gap-1 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(contact)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onDelete(contact.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
