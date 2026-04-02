import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Loader2, CheckCircle, XCircle, Send, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface SmtpSettingsProps {
  userId: string;
}

export function SmtpSettings({ userId }: SmtpSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [userId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_smtp_configs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setSmtpHost(data.smtp_host);
        setSmtpPort(String(data.smtp_port));
        setSmtpUser(data.smtp_user);
        setSmtpPassword(data.smtp_password_encrypted);
        setFromEmail(data.from_email);
        setFromName(data.from_name);
        setSignatureHtml(data.signature_html || '');
        setIsActive(data.is_active);
        setIsVerified(data.is_verified);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração SMTP:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);

      const { data: orgData } = await supabase.rpc('get_user_organization_id');

      const configData = {
        user_id: userId,
        organization_id: orgData,
        smtp_host: smtpHost,
        smtp_port: Number(smtpPort),
        smtp_user: smtpUser,
        smtp_password_encrypted: smtpPassword,
        from_email: fromEmail,
        from_name: fromName,
        signature_html: signatureHtml,
        is_active: isActive,
      };

      if (configId) {
        const { error } = await supabase
          .from('user_smtp_configs')
          .update(configData)
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('user_smtp_configs')
          .insert(configData)
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success('Configuração SMTP salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração SMTP');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      toast.error('Preencha todos os campos antes de testar');
      return;
    }

    try {
      setTesting(true);

      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          smtp_host: smtpHost,
          smtp_port: Number(smtpPort),
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
          from_email: fromEmail,
          from_name: fromName,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setIsVerified(true);
        // Update verified status in DB
        if (configId) {
          await supabase
            .from('user_smtp_configs')
            .update({ is_verified: true })
            .eq('id', configId);
        }
        toast.success('Conexão SMTP verificada com sucesso! Verifique seu e-mail.');
      } else {
        setIsVerified(false);
        toast.error(data?.error || 'Falha ao testar conexão SMTP');
      }
    } catch (error) {
      console.error('Erro ao testar SMTP:', error);
      setIsVerified(false);
      toast.error('Erro ao testar conexão SMTP');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Configuração SMTP</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              {isVerified ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" /> Verificado
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" /> Não verificado
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Label htmlFor="smtp-active" className="text-sm">Ativo</Label>
                <Switch
                  id="smtp-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>
          <CardDescription>
            Configure seu servidor SMTP para enviar e-mails diretamente pelo CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Server settings */}
          <div>
            <h4 className="text-sm font-medium mb-3">Servidor SMTP</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="smtp-host">Host SMTP *</Label>
                <Input
                  id="smtp-host"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Porta *</Label>
                <Input
                  id="smtp-port"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  type="number"
                />
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div>
            <h4 className="text-sm font-medium mb-3">Credenciais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-user">Usuário SMTP *</Label>
                <Input
                  id="smtp-user"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password">Senha SMTP *</Label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Sender info */}
          <div>
            <h4 className="text-sm font-medium mb-3">Informações do Remetente</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-email">E-mail Remetente *</Label>
                <Input
                  id="from-email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="vendas@suaempresa.com"
                  type="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-name">Nome do Remetente</Label>
                <Input
                  id="from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="João da Silva"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Signature */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Assinatura de E-mail (HTML)</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSignaturePreview(!showSignaturePreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showSignaturePreview ? 'Editar' : 'Preview'}
              </Button>
            </div>
            {showSignaturePreview ? (
              <div 
                className="border rounded-md p-4 min-h-[120px] prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: signatureHtml || '<p style="color: #999;">Nenhuma assinatura configurada</p>' }}
              />
            ) : (
              <Textarea
                value={signatureHtml}
                onChange={(e) => setSignatureHtml(e.target.value)}
                placeholder='<p><strong>João da Silva</strong><br/>Executivo de Vendas<br/>+55 11 99999-9999</p>'
                rows={5}
                className="font-mono text-xs"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Dica: Para Gmail, use smtp.gmail.com na porta 587 com uma <strong>Senha de App</strong> (não sua senha normal).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
