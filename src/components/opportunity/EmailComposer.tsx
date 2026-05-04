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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Sparkles, Loader2, FileText, AlertTriangle, Info, Thermometer, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { listEmailTemplates, renderEmailTemplate, type EmailTemplate } from '@/services/crm/email-templates';

interface EmailContext {
  pipeline_name: string;
  pipeline_type: string;
  stage_name: string;
  stage_probability: number;
  temperature: string;
  days_in_stage: number;
  has_proposal: boolean;
  proposal_status: string | null;
  recent_emails_count: number;
}

interface EmailComposerProps {
  opportunityId: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  defaultTo?: string[];
  contactName?: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  qualification: ['qualification_discovery', 'qualification_handoff'],
  sales_no_proposal: ['proposal_presentation'],
  sales_with_proposal: ['proposal_followup', 'negotiation', 'closing'],
  onboarding: ['onboarding_welcome', 'onboarding_followup'],
  reengagement: ['reengagement'],
};

function getTemperatureColor(temp: string): string {
  switch (temp) {
    case 'burning': return 'text-red-600 bg-red-50 border-red-200';
    case 'hot': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'warm': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'cold': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

export function EmailComposer({
  opportunityId,
  open,
  onClose,
  onSent,
  defaultTo = [],
  contactName,
}: EmailComposerProps) {
  const [sending, setSending] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');

  const [toEmails, setToEmails] = useState(defaultTo.join(', '));
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Context-aware state
  const [emailType, setEmailType] = useState<string>('');
  const [emailTypeLabel, setEmailTypeLabel] = useState<string>('');
  const [emailContext, setEmailContext] = useState<EmailContext | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      checkSmtpConfig();
      loadTemplates();
      setToEmails(defaultTo.join(', '));
      // Reset context
      setEmailType('');
      setEmailTypeLabel('');
      setEmailContext(null);
      setWarnings([]);
    }
  }, [open]);

  const checkSmtpConfig = async () => {
    setLoadingSmtp(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_smtp_configs')
        .select('from_email, from_name, is_active, is_verified')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setSmtpConfigured(true);
        setFromEmail(data.from_email);
        setFromName(data.from_name || '');
      } else {
        setSmtpConfigured(false);
      }
    } catch (error) {
      console.error('Error checking SMTP:', error);
    } finally {
      setLoadingSmtp(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await listEmailTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // Filter templates based on inferred context
  const filteredTemplates = templates.filter(t => {
    if (!emailType || !t.category) return true;
    // Find which category group the emailType belongs to
    for (const [cat, types] of Object.entries(CATEGORY_MAP)) {
      if (types.includes(emailType) && t.category === cat) return true;
    }
    // Also show templates with matching category or 'other'
    return t.category === 'other';
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const variables: Record<string, string> = {
        nome_contato: contactName || '',
        empresa: '',
      };
      const rendered = renderEmailTemplate(template, variables);
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
          context: '',
        },
      });

      if (error) throw error;

      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
      if (data?.emailType) setEmailType(data.emailType);
      if (data?.emailTypeLabel) setEmailTypeLabel(data.emailTypeLabel);
      if (data?.context) setEmailContext(data.context);
      if (data?.warnings) setWarnings(data.warnings || []);

      toast.success('E-mail gerado com IA!');
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Erro ao gerar e-mail com IA');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSend = async () => {
    if (!toEmails.trim()) {
      toast.error('Informe pelo menos um destinatário');
      return;
    }
    if (!subject.trim()) {
      toast.error('Informe o assunto do e-mail');
      return;
    }
    if (!body.trim()) {
      toast.error('Informe o corpo do e-mail');
      return;
    }

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

      if (data?.success) {
        toast.success('E-mail enviado com sucesso!');
        setSubject('');
        setBody('');
        setCcEmails('');
        setSelectedTemplate('');
        setWarnings([]);
        onSent();
        onClose();
      } else {
        toast.error(data?.error || 'Erro ao enviar e-mail');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Erro ao enviar e-mail');
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
            Novo E-mail
            {emailTypeLabel && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {emailTypeLabel}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loadingSmtp ? (
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
            {/* Context Info Bar */}
            {emailContext && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-xs">
                  {emailContext.pipeline_name}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {emailContext.stage_name} ({emailContext.stage_probability}%)
                </Badge>
                {emailContext.temperature && (
                  <Badge className={`text-xs border ${getTemperatureColor(emailContext.temperature)}`}>
                    <Thermometer className="h-3 w-3 mr-1" />
                    {emailContext.temperature}
                  </Badge>
                )}
                {emailContext.has_proposal && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Proposta: {emailContext.proposal_status}
                  </Badge>
                )}
                {emailContext.days_in_stage > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {emailContext.days_in_stage}d na etapa
                  </span>
                )}
                {emailContext.recent_emails_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    • {emailContext.recent_emails_count} emails enviados
                  </span>
                )}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <Alert key={i} variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{w}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

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
              <Label htmlFor="to-emails">Para *</Label>
              <Input
                id="to-emails"
                value={toEmails}
                onChange={(e) => setToEmails(e.target.value)}
                placeholder="email@empresa.com, outro@empresa.com"
              />
            </div>

            {/* CC */}
            <div className="space-y-2">
              <Label htmlFor="cc-emails">CC</Label>
              <Input
                id="cc-emails"
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="copia@empresa.com"
              />
            </div>

            {/* Template + AI */}
            <div className="flex items-center gap-2">
              {filteredTemplates.length > 0 && (
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-[200px]">
                    <FileText className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Usar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTemplates.map((t) => (
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
              <Label htmlFor="subject">Assunto *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Corpo do E-mail *</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva o conteúdo do e-mail aqui..."
                rows={10}
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
                Enviar E-mail
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
