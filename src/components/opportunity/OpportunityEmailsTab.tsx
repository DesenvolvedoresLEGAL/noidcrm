import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OpportunityPendingApprovalsCard } from './OpportunityPendingApprovalsCard';
import { useOpportunityApprovals } from '@/hooks/useOpportunityApprovals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Mail, Trash2, Users, Plus, Eye, MousePointerClick, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { EmailComposer } from './EmailComposer';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  listOpportunityEmails,
  deleteOpportunityEmail,
  syncEmailReplies,
  type OpportunityEmail,
} from '@/services/crm/opportunity-emails';
import { initiateGmailOAuth } from '@/services/crm/sync';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OpportunityEmailsTabProps {
  opportunityId: string;
}

function EmailAnalyticsBadges({ email }: { email: OpportunityEmail }) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const clickCount = email.link_clicks?.length || 0;

  // Don't show analytics for inbound emails
  if (email.direction === 'inbound') return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 flex-wrap">
        {email.opened_at ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0 gap-1">
                <Eye className="h-3 w-3" />
                {email.opened_count || 1}x
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>Aberto {email.opened_count || 1}x</p>
              <p className="text-muted-foreground">Primeira vez: {formatDate(email.opened_at)}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0 gap-1">
            <Eye className="h-3 w-3" />
            Não aberto
          </Badge>
        )}

        {email.clicked_at && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 border-blue-500/20 text-[10px] px-1.5 py-0 gap-1">
                <MousePointerClick className="h-3 w-3" />
                {clickCount} clique{clickCount !== 1 ? 's' : ''}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-xs">
              <p>Primeiro clique: {formatDate(email.clicked_at)}</p>
              {email.link_clicks?.slice(0, 3).map((click, i) => (
                <p key={i} className="text-muted-foreground truncate">
                  {new URL(click.url).hostname} — {formatDate(click.clicked_at)}
                </p>
              ))}
              {clickCount > 3 && (
                <p className="text-muted-foreground">+{clickCount - 3} mais</p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function EmailAnalyticsSection({ email }: { email: OpportunityEmail }) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Don't show analytics for inbound emails
  if (email.direction === 'inbound') return null;

  const hasAnyAnalytics = email.opened_at || email.clicked_at;

  if (!hasAnyAnalytics) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <Eye className="h-5 w-5 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Sem dados de engajamento ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Os dados aparecerão quando o destinatário abrir o e-mail
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Engajamento
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Aberturas</p>
          <p className="text-lg font-bold">{email.opened_count || 0}</p>
          {email.opened_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Primeira: {formatDate(email.opened_at)}
            </p>
          )}
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Cliques em links</p>
          <p className="text-lg font-bold">{email.link_clicks?.length || 0}</p>
          {email.clicked_at && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Primeiro: {formatDate(email.clicked_at)}
            </p>
          )}
        </div>
      </div>

      {email.link_clicks && email.link_clicks.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Links clicados:</p>
          {email.link_clicks.map((click, i) => {
            let hostname = click.url;
            try { hostname = new URL(click.url).hostname; } catch {}
            return (
              <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                <span className="truncate flex-1 text-blue-600">{hostname}</span>
                <span className="text-muted-foreground ml-2 whitespace-nowrap">
                  {formatDate(click.clicked_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: 'inbound' | 'outbound' }) {
  if (direction === 'inbound') {
    return (
      <Badge variant="secondary" className="bg-blue-500/15 text-blue-600 border-blue-500/20 text-[10px] px-1.5 py-0 gap-1">
        <ArrowDownLeft className="h-3 w-3" />
        Recebido
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5 py-0 gap-1">
      <ArrowUpRight className="h-3 w-3" />
      Enviado
    </Badge>
  );
}

export function OpportunityEmailsTab({ opportunityId }: OpportunityEmailsTabProps) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<OpportunityEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<OpportunityEmail | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState<string[]>([]);
  const [contactName, setContactName] = useState<string>('');
  const autoSyncStartedRef = useRef(false);
  const [searchParams] = useSearchParams();
  const highlightApprovalId = searchParams.get('approval');
  const {
    data: pendingApprovals = [],
    isLoading: approvalsLoading,
    error: approvalsError,
  } = useOpportunityApprovals(opportunityId);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const data = await listOpportunityEmails(opportunityId);
      setEmails(data);
      setSyncError(null);
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

  useEffect(() => {
    if (loading || syncing || autoSyncStartedRef.current) return;
    const hasPendingEngagement = emails.some(
      (email) =>
        email.direction === 'outbound' &&
        !email.opened_at &&
        !email.clicked_at &&
        !email.gmail_thread_id &&
        !email.gmail_message_id
    );

    if (!hasPendingEngagement) return;

    autoSyncStartedRef.current = true;
    void (async () => {
      try {
        const result = await syncEmailReplies(opportunityId);
        if (result.synced > 0) {
          await loadEmails();
        }
      } catch (error) {
        console.error('Auto-sync de respostas falhou:', error);
      }
    })();
  }, [emails, loading, opportunityId, syncing]);

  // Realtime subscription for new inbound emails
  useEffect(() => {
    const channel = supabase
      .channel(`opp-emails-${opportunityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'opportunity_emails',
          filter: `opportunity_id=eq.${opportunityId}`,
        },
        () => {
          loadEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId]);

  const handleSyncReplies = async () => {
    setSyncing(true);
    try {
      const result = await syncEmailReplies(opportunityId);
      setSyncError(null);
      toast({
        title: 'Sincronização concluída',
        description: result.synced > 0
          ? `${result.synced} nova(s) resposta(s) sincronizada(s).`
          : (result.hint || 'Nenhuma nova resposta encontrada.'),
      });
      if (result.synced > 0) loadEmails();
    } catch (error: any) {
      console.error('Erro ao sincronizar respostas:', error);
      if (error?.reauthRequired) {
        setSyncError(error?.message || 'A conexão com o Gmail precisa ser refeita para sincronizar respostas.');
        toast({
          title: 'Reconexão necessária',
          description: 'A conexão com o Gmail expirou. Vamos reconectar para concluir a sincronização.',
        });
        try {
          await initiateGmailOAuth(window.location.pathname);
          return;
        } catch {
          toast({
            title: 'Erro',
            description: 'Não foi possível iniciar a reconexão do Gmail.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Erro',
          description: error?.message || 'Não foi possível sincronizar respostas.',
          variant: 'destructive',
        });
      }
    } finally {
      setSyncing(false);
    }
  };

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

  return (
    <>
      <div className="space-y-4">
        {syncError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {syncError}
            </CardContent>
          </Card>
        )}
        {/* Pending agent approvals — always render, regardless of email history loading state */}
        {approvalsLoading && pendingApprovals.length === 0 ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3 text-sm text-muted-foreground">
              <LoadingSpinner />
              Verificando aprovações pendentes do agente…
            </CardContent>
          </Card>
        ) : approvalsError ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              Não foi possível carregar aprovações pendentes do agente.
              {approvalsError instanceof Error ? ` (${approvalsError.message})` : ''}
            </CardContent>
          </Card>
        ) : (
          <OpportunityPendingApprovalsCard
            approvals={pendingApprovals}
            highlightApprovalId={highlightApprovalId}
          />
        )}

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <LoadingSpinner />
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Histórico de E-mails
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncReplies}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar respostas'}
                </Button>
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
                  className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                    email.direction === 'inbound' ? 'border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className={`h-10 w-10 mt-1 ${email.direction === 'inbound' ? 'ring-2 ring-blue-500/30' : ''}`}>
                        <AvatarFallback className={`text-sm ${email.direction === 'inbound' ? 'bg-blue-500/10 text-blue-600' : ''}`}>
                          {email.direction === 'inbound' 
                            ? email.from_email.charAt(0).toUpperCase()
                            : (email.sender?.full_name?.charAt(0).toUpperCase() || email.from_email.charAt(0).toUpperCase())
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <DirectionBadge direction={email.direction as 'inbound' | 'outbound'} />
                              <p className="font-semibold text-sm truncate">
                                {email.subject}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {email.direction === 'inbound' 
                                  ? `De: ${email.from_email}`
                                  : (email.sender?.full_name || email.from_email)
                                }
                              </span>
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
                          <span>{email.direction === 'inbound' ? 'Para' : 'Para'}: {email.to_emails.join(', ')}</span>
                        </div>
                        {email.cc_emails.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Users className="h-3 w-3" />
                            <span>CC: {email.cc_emails.join(', ')}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <EmailAnalyticsBadges email={email} />
                        </div>
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
        )}
      </div>

      {/* Email Detail Modal */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedEmail && <DirectionBadge direction={selectedEmail.direction as 'inbound' | 'outbound'} />}
              <DialogTitle>{selectedEmail?.subject}</DialogTitle>
            </div>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className={`h-10 w-10 ${selectedEmail.direction === 'inbound' ? 'ring-2 ring-blue-500/30' : ''}`}>
                  <AvatarFallback className={selectedEmail.direction === 'inbound' ? 'bg-blue-500/10 text-blue-600' : ''}>
                    {selectedEmail.direction === 'inbound'
                      ? selectedEmail.from_email.charAt(0).toUpperCase()
                      : (selectedEmail.sender?.full_name?.charAt(0).toUpperCase() || selectedEmail.from_email.charAt(0).toUpperCase())
                    }
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {selectedEmail.direction === 'inbound'
                      ? selectedEmail.from_email
                      : (selectedEmail.sender?.full_name || selectedEmail.from_email)
                    }
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
                    {selectedEmail.direction === 'inbound' ? 'De:' : 'Para:'}
                  </span>
                  <span className="text-xs">
                    {selectedEmail.direction === 'inbound'
                      ? selectedEmail.from_email
                      : selectedEmail.to_emails.join(', ')
                    }
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-muted-foreground min-w-[40px]">
                    {selectedEmail.direction === 'inbound' ? 'Para:' : 'De:'}
                  </span>
                  <span className="text-xs">
                    {selectedEmail.direction === 'inbound'
                      ? selectedEmail.to_emails.join(', ')
                      : selectedEmail.from_email
                    }
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

              {/* Analytics Section - only for outbound */}
              <EmailAnalyticsSection email={selectedEmail} />

              {selectedEmail.direction === 'outbound' && <Separator />}

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
