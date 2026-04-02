import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Sparkles, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { listEmailTemplates, renderEmailTemplate, type EmailTemplate } from '@/services/crm/email-templates';
import { generatePublicToken } from '@/services/crm/proposals';
import { buildProposalPublicUrl } from '@/lib/proposalUrl';
import { formatDateBR } from '@/lib/dateUtils';

interface ProposalEmailComposerProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  proposalId: string;
  opportunityId: string;
}

export function ProposalEmailComposer({
  open,
  onClose,
  onSent,
  proposalId,
  opportunityId,
}: ProposalEmailComposerProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');

  const [toEmails, setToEmails] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    if (open) {
      loadAll();
    }
  }, [open, proposalId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [smtpData, proposalData, contactData, templatesData] = await Promise.all([
        loadSmtp(),
        loadProposal(),
        loadPrimaryContact(),
        listEmailTemplates('proposal').catch(() => [] as EmailTemplate[]),
      ]);

      // Set SMTP
      if (smtpData) {
        setSmtpConfigured(true);
        setFromEmail(smtpData.from_email);
        setFromName(smtpData.from_name || '');
      } else {
        setSmtpConfigured(false);
      }

      // Set templates
      setTemplates(templatesData);

      // Set recipient from contact
      const contactName = contactData?.nome || '';
      const contactEmail = contactData?.email || '';
      setToEmails(contactEmail);

      // Build default body
      if (proposalData) {
        const title = proposalData.title || 'Proposta Comercial';
        setSubject(`Proposta Comercial: ${title}`);

        // Ensure public token
        let publicUrl = '';
        if (proposalData.public_token) {
          publicUrl = buildProposalPublicUrl(proposalData.public_token);
        } else {
          try {
            const token = await generatePublicToken(proposalId);
            publicUrl = buildProposalPublicUrl(token);
          } catch {}
        }

        const valueStr = proposalData.total_amount
          ? `R$ ${Number(proposalData.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : '';
        const validityStr = proposalData.expires_at ? formatDateBR(proposalData.expires_at) : '';

        const lines = [
          `Oi${contactName ? ` ${contactName}` : ''}, tudo bem?`,
          '',
          `Segue a proposta comercial "<strong>${title}</strong>" para sua análise.`,
          '',
        ];
        if (publicUrl) {
          lines.push(`<p><a href="${publicUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">📄 Visualizar Proposta</a></p>`);
          lines.push('');
        }
        if (valueStr) lines.push(`<strong>Valor:</strong> ${valueStr}`);
        if (validityStr) lines.push(`<strong>Validade:</strong> ${validityStr}`);
        if (valueStr || validityStr) lines.push('');
        lines.push('Qualquer dúvida, estou à disposição!');

        setBody(lines.map(l => l ? `<p>${l}</p>` : '<br/>').join('\n'));
      }
    } catch (error) {
      console.error('Error loading composer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSmtp = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_smtp_configs')
      .select('from_email, from_name, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    return data;
  };

  const loadProposal = async () => {
    const { data } = await supabase
      .from('proposals')
      .select('title, public_token, total_amount, expires_at')
      .eq('id', proposalId)
      .single();
    return data;
  };

  const loadPrimaryContact = async (): Promise<{ nome: string; email: string } | null> => {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('account_id, contact_id')
      .eq('id', opportunityId)
      .single();
    if (!opp) return null;

    const extractEmail = (contact: { nome: string; emails: any } | null): { nome: string; email: string } | null => {
      if (!contact) return null;
      const emails = contact.emails;
      if (Array.isArray(emails) && emails.length > 0) {
        const primary = emails.find((e: any) => e.principal || e.primary) || emails[0];
        const addr = typeof primary === 'string' ? primary : primary?.email || primary?.endereco || '';
        if (addr) return { nome: contact.nome, email: addr };
      }
      if (typeof emails === 'string') return { nome: contact.nome, email: emails };
      return null;
    };

    if (opp.contact_id) {
      const { data } = await supabase
        .from('contacts')
        .select('nome, emails')
        .eq('id', opp.contact_id)
        .single();
      const result = extractEmail(data);
      if (result) return result;
    }

    if (opp.account_id) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('nome, emails')
        .eq('account_id', opp.account_id)
        .not('emails', 'is', null)
        .limit(5);
      if (contacts) {
        for (const c of contacts) {
          const result = extractEmail(c);
          if (result) return result;
        }
      }
    }

    return null;
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const rendered = renderEmailTemplate(template, { nome_contato: '', empresa: '' });
      setSubject(rendered.subject);
      setBody(rendered.body);
    }
  };

  const handleGenerateWithAI = async () => {
    try {
      setGeneratingAi(true);
      const { data, error } = await supabase.functions.invoke('ai-email-assist', {
        body: {
          opportunityId,
          context: `Contexto: envio de proposta comercial (proposal_id: ${proposalId})`,
        },
      });
      if (error) throw error;
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
      toast.success('E-mail gerado com IA!');
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Erro ao gerar e-mail com IA');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSend = async () => {
    if (!toEmails.trim()) return toast.error('Informe o destinatário');
    if (!subject.trim()) return toast.error('Informe o assunto');
    if (!body.trim()) return toast.error('Informe o corpo do e-mail');

    try {
      setSending(true);
      const toList = toEmails.split(',').map(e => e.trim()).filter(Boolean);
      const ccList = ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean) : [];

      const { data, error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to_emails: toList,
          cc_emails: ccList,
          subject,
          html_body: body,
          opportunity_id: opportunityId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');

      // Update proposal status to sent
      await supabase
        .from('proposals')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', proposalId);

      toast.success('Proposta enviada por e-mail!');
      onSent();
      onClose();
    } catch (error: any) {
      console.error('Error sending proposal email:', error);
      toast.error(error.message || 'Erro ao enviar e-mail');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Proposta por E-mail
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner />
          </div>
        ) : !smtpConfigured ? (
          <div className="text-center py-8 text-muted-foreground space-y-3">
            <Send className="h-12 w-12 mx-auto opacity-30" />
            <p className="font-medium">SMTP não configurado</p>
            <p className="text-sm">
              Configure seu servidor SMTP em{' '}
              <strong>Configurações → Editar Usuário → E-mails</strong>{' '}
              para enviar e-mails pelo CRM.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* From */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium min-w-[40px]">De:</span>
              <Badge variant="secondary">
                {fromName ? `${fromName} <${fromEmail}>` : fromEmail}
              </Badge>
            </div>

            <Separator />

            {/* To */}
            <div className="space-y-2">
              <Label htmlFor="proposal-to">Para *</Label>
              <Input
                id="proposal-to"
                value={toEmails}
                onChange={(e) => setToEmails(e.target.value)}
                placeholder="email@cliente.com"
              />
            </div>

            {/* CC */}
            <div className="space-y-2">
              <Label htmlFor="proposal-cc">CC</Label>
              <Input
                id="proposal-cc"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="copia@empresa.com"
              />
            </div>

            {/* Template + AI */}
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-[200px]">
                    <FileText className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Usar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={generatingAi}
              >
                {generatingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Gerar com IA
              </Button>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="proposal-subject">Assunto *</Label>
              <Input
                id="proposal-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="proposal-body">Corpo do E-mail *</Label>
              <textarea
                id="proposal-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva o conteúdo do e-mail aqui..."
                rows={12}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar Proposta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
