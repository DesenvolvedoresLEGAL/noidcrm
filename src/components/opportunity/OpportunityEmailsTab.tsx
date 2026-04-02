import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Mail, Trash2, Users, Plus } from 'lucide-react';
import { EmailComposer } from './EmailComposer';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  listOpportunityEmails,
  deleteOpportunityEmail,
  type OpportunityEmail,
} from '@/services/crm/opportunity-emails';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { supabase } from '@/integrations/supabase/client';

interface OpportunityEmailsTabProps {
  opportunityId: string;
}

export function OpportunityEmailsTab({ opportunityId }: OpportunityEmailsTabProps) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<OpportunityEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<OpportunityEmail | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState<string[]>([]);
  const [contactName, setContactName] = useState<string>('');

  const loadEmails = async () => {
    try {
      setLoading(true);
      const data = await listOpportunityEmails(opportunityId);
      setEmails(data);
    } catch (error) {
      console.error('Erro ao carregar e-mails:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os e-mails.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadContact = async () => {
    try {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('contact:contacts(nome, emails)')
        .eq('id', opportunityId)
        .single();

      if (opp?.contact) {
        const contact = opp.contact as any;
        setContactName(contact.nome || '');
        const emailsList = contact.emails as any[];
        if (emailsList?.length) {
          const primary = emailsList.find((e: any) => e.is_primary);
          const email = primary?.email || emailsList[0]?.email || '';
          if (email) setContactEmail([email]);
        }
      }
    } catch (err) {
      console.error('Error loading contact:', err);
    }
  };

  useEffect(() => {
    loadEmails();
    loadContact();
  }, [opportunityId]);

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm('Tem certeza que deseja excluir este e-mail do histórico?')) return;

    try {
      await deleteOpportunityEmail(emailId);
      toast({
        title: 'Sucesso',
        description: 'E-mail excluído com sucesso!',
      });
      loadEmails();
    } catch (error) {
      console.error('Erro ao excluir e-mail:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o e-mail.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Histórico de E-mails
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setComposerOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Novo E-mail
                </Button>
                <Badge variant="secondary">{emails.length} e-mail(s)</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {emails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum e-mail encontrado</p>
                <p className="text-sm mt-2">
                  O histórico de e-mails enviados para esta oportunidade aparecerá aqui.
                </p>
              </div>
            ) : (
              emails.map((email) => (
                <Card 
                  key={email.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedEmail(email)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10 mt-1">
                        <AvatarFallback className="text-sm">
                          {email.sender?.full_name?.charAt(0).toUpperCase() || 
                           email.from_email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {email.subject}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>{email.sender?.full_name || email.from_email}</span>
                              <span>•</span>
                              <span>{formatDate(email.sent_at)}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmail(email.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>Para: {email.to_emails.join(', ')}</span>
                        </div>
                        {email.cc_emails.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Users className="h-3 w-3" />
                            <span>CC: {email.cc_emails.join(', ')}</span>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {email.body.replace(/<[^>]*>/g, '')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Detail Modal */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject}</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedEmail.sender?.full_name?.charAt(0).toUpperCase() || 
                     selectedEmail.from_email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {selectedEmail.sender?.full_name || selectedEmail.from_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmail.from_email}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedEmail.sent_at)}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-muted-foreground min-w-[40px]">
                    Para:
                  </span>
                  <span className="text-xs">
                    {selectedEmail.to_emails.join(', ')}
                  </span>
                </div>
                {selectedEmail.cc_emails.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground min-w-[40px]">
                      CC:
                    </span>
                    <span className="text-xs">
                      {selectedEmail.cc_emails.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedEmail.body) }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Email Composer */}
      <EmailComposer
        opportunityId={opportunityId}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSent={loadEmails}
        defaultTo={contactEmail}
        contactName={contactName}
      />
    </>
  );
}
