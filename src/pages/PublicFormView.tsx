import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { PublicFormSettings, DEFAULT_PUBLIC_SETTINGS } from '@/components/custom-forms/PublicFormPreview';
import { extractEmail, extractPhone } from '@/lib/contactFormat';

interface FormField {
  id: string;
  source: 'native' | 'custom';
  field_key: string;
  entity_source: string;
  is_required: boolean;
  display_order: number;
  label?: string;
  type?: string;
}

interface OrganizationData {
  name: string;
  logo_url: string | null;
}

interface OpportunityData {
  id: string;
  account?: Record<string, any>;
  contact?: Record<string, any>;
}

interface PublicFormData {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  fields: FormField[];
  organization_id: string;
  public_settings: PublicFormSettings;
}

export default function PublicFormView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PublicFormData | null>(null);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (token) {
      fetchFormData();
    }
  }, [token]);

  const fetchFormData = async () => {
    try {
      setLoading(true);

      const response = await supabase.functions.invoke('get-public-form', {
        body: { token },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Formulário não encontrado');
      }

      if (!response.data?.form) {
        throw new Error('Formulário não encontrado ou não está público');
      }

      const form = response.data.form;
      const opp = response.data.opportunity || null;

      setFormData(form);
      setOrganization(response.data.organization || null);
      setOpportunity(opp);

      // Pre-fill values from opportunity data (account and contact)
      if (form?.fields && opp) {
        const initialValues: Record<string, any> = {};

        form.fields.forEach((field: FormField) => {
          let prefillValue: any = null;

          // Map entity_source to the correct data object
          if (field.entity_source === 'account' && opp.account) {
            prefillValue = opp.account[field.field_key];
          } else if (field.entity_source === 'contact' && opp.contact) {
            const contact = opp.contact;
            const key = field.field_key;

            // Handle field aliases and extract from arrays correctly
            if (key === 'telefone_principal' || key === 'primary_phone') {
              // Use extracted primary_phone from edge function, or extract from array
              prefillValue = contact.primary_phone || extractPhone(contact.telefones);
            } else if (key === 'email_principal' || key === 'primary_email') {
              // Use extracted primary_email from edge function, or extract from array
              prefillValue = contact.primary_email || extractEmail(contact.emails);
            } else if (key === 'telefones') {
              // Direct telefones field - extract first value
              prefillValue = extractPhone(contact.telefones);
            } else if (key === 'emails') {
              // Direct emails field - extract first value
              prefillValue = extractEmail(contact.emails);
            } else {
              // Direct field access
              prefillValue = contact[key];
            }
          }

          // Only set if we have a valid value
          if (prefillValue !== null && prefillValue !== undefined && prefillValue !== '') {
            initialValues[field.id] = prefillValue;
          }
        });

        // 🆕 BUSCAR CONTATOS ADICIONAIS (Responsáveis Legal e Financeiro)
        const accountId = opp.account?.id || opp.account_id;
        if (accountId) {
          try {
            const { data: extraContacts } = await supabase
              .from('contacts')
              .select('cargo, nome, emails, telefones')
              .eq('account_id', accountId)
              .in('cargo', ['Responsável Legal', 'Responsável Financeiro']);

            if (extraContacts && extraContacts.length > 0) {
              console.log('📞 Contatos adicionais encontrados:', extraContacts);

              extraContacts.forEach(contact => {
                const isLegal = contact.cargo === 'Responsável Legal';
                const labelPrefix = isLegal ? 'responsável legal' : 'responsável financeiro';

                // Buscar os IDs dos campos customizados correspondentes
                form.fields.forEach((field: FormField) => {
                  const label = field.label?.toLowerCase() || '';

                  if (label.includes(labelPrefix)) {
                    if (label.includes('nome')) {
                      initialValues[field.id] = contact.nome;
                    } else if (label.includes('whatsapp') || label.includes('telefone')) {
                      // Extract phone from JSONB array using helper
                      const phone = extractPhone(contact.telefones as any);
                      if (phone) {
                        initialValues[field.id] = phone;
                      }
                    } else if (label.includes('email') || label.includes('e-mail')) {
                      // Extract email from JSONB array using helper
                      const email = extractEmail(contact.emails as any);
                      if (email) {
                        initialValues[field.id] = email;
                      }
                    }
                  }
                });
              });
            }
          } catch (contactErr) {
            console.warn('Erro ao buscar contatos adicionais:', contactErr);
          }
        }

        setValues(initialValues);
        console.log('Pre-filled values:', initialValues);
      }
    } catch (err: any) {
      console.error('Error fetching form:', err);
      setError(err.message || 'Erro ao carregar formulário');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData) return;

    // Validate required fields
    const missingFields = formData.fields
      .filter(f => f.is_required && !values[f.id])
      .map(f => f.label);

    if (missingFields.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setSubmitting(true);

      console.log('🚀 [DEBUG] Enviando formulário...');
      console.log('Token:', token);
      console.log('Form ID:', formData.id);
      console.log('Org ID:', formData.organization_id);
      console.log('Values:', values);

      // 🔧 FILTRAR campos dos Responsáveis se estiverem vazios ou não modificados
      const filteredValues: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        // Se for campo de Responsável e estiver vazio, não enviar
        const field = formData.fields.find((f: any) => f.id === key);
        const label = field?.label?.toLowerCase() || '';
        const isResponsavelField = label.includes('responsável legal') || label.includes('responsável financeiro');

        // Incluir apenas se: NÃO for campo de responsável OU se tiver valor preenchido
        if (!isResponsavelField || (value && value.trim && value.trim() !== '')) {
          filteredValues[key] = value;
        }
      });

      console.log('📤 [DEBUG] Values filtrados (sem responsáveis vazios):', filteredValues);

      const response = await supabase.functions.invoke('submit-public-form', {
        body: {
          token,
          formId: formData.id,
          organizationId: formData.organization_id,
          values: filteredValues,
        },
      });

      console.log('📦 [DEBUG] Resposta recebida:', response);
      console.log('Erro?:', response.error);
      console.log('Data:', response.data);

      if (response.error) {
        console.error('❌ [DEBUG] Erro na resposta:', response.error);
        throw new Error(response.error.message || 'Erro ao enviar formulário');
      }

      setSubmitted(true);
      toast.success('Formulário enviado com sucesso!');

      // 🔄 RECARREGAR DADOS ATUALIZADOS DO BANCO
      console.log('🔄 [DEBUG] Recarregando dados atualizados...');
      setTimeout(() => {
        fetchFormData();
      }, 500);
    } catch (err: any) {
      console.error('💥 [DEBUG] Exceção capturada:', err);
      console.error('Error submitting form:', err);
      toast.error(err.message || 'Erro ao enviar formulário');
    } finally {
      setSubmitting(false);
    }
  };

  const settings: PublicFormSettings = formData?.public_settings || DEFAULT_PUBLIC_SETTINGS;
  const logoUrl = settings.logo_url || organization?.logo_url;
  const borderRadius = settings.use_rounded_borders ? '0.75rem' : '0';
  const inputRadius = settings.use_rounded_borders ? '0.375rem' : '0';

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: settings.page_bg_color }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: settings.page_text_color }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: settings.page_bg_color }}
      >
        <div
          className="max-w-md w-full p-6 text-center shadow-lg"
          style={{
            backgroundColor: settings.form_bg_color,
            borderRadius,
            color: settings.form_text_color,
          }}
        >
          <h2 className="text-xl font-semibold mb-2">Formulário não disponível</h2>
          <p className="opacity-70">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: settings.page_bg_color }}
      >
        <div
          className="max-w-md w-full p-8 text-center shadow-lg"
          style={{
            backgroundColor: settings.form_bg_color,
            borderRadius,
            color: settings.form_text_color,
          }}
        >
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: settings.button_color }}
          >
            <Check className="h-8 w-8" style={{ color: settings.button_text_color }} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Enviado com sucesso!</h2>
          <p className="opacity-70">
            Obrigado por preencher o formulário. Entraremos em contato em breve.
          </p>
        </div>
      </div>
    );
  }

  const renderField = (field: FormField) => {
    const value = values[field.id] || '';
    const fieldType = field.type || 'text';

    switch (fieldType) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={`Digite ${field.label?.toLowerCase()}...`}
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!value}
              onCheckedChange={(checked) => handleChange(field.id, checked)}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={`Digite ${field.label?.toLowerCase()}...`}
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      case 'email':
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder="email@exemplo.com"
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      case 'phone':
        return (
          <Input
            type="tel"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder="(00) 00000-0000"
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      case 'url':
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder="https://..."
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.id, e.target.value)}
            placeholder={`Digite ${field.label?.toLowerCase()}...`}
            style={{ borderRadius: inputRadius }}
            className="bg-white/10"
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{
        backgroundColor: settings.page_bg_color,
        color: settings.page_text_color,
      }}
    >
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        {logoUrl && (
          <div className="flex justify-center mb-8">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-32 max-h-40 w-auto object-contain"
            />
          </div>
        )}

        {/* Title */}
        <h1
          className="text-2xl font-bold text-center mb-6"
          style={{ color: settings.page_text_color }}
        >
          {settings.page_title || formData?.name}
        </h1>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="p-6 shadow-xl"
          style={{
            backgroundColor: settings.form_bg_color,
            color: settings.form_text_color,
            borderRadius,
          }}
        >
          {formData?.description && (
            <p className="mb-6 opacity-80 text-center">
              {formData.description}
            </p>
          )}

          <div className="space-y-4">
            {formData?.fields
              .sort((a, b) => a.display_order - b.display_order)
              .map((field) => (
                <div key={field.id} className="space-y-1.5">
                  {field.type !== 'boolean' && (
                    <label
                      className="block text-sm font-medium"
                      style={{ color: settings.form_text_color }}
                    >
                      {field.label}
                      {field.is_required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full mt-6"
            style={{
              backgroundColor: settings.button_color,
              color: settings.button_text_color,
              borderRadius: inputRadius,
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {settings.button_text || 'Enviar'}
          </Button>
        </form>

        <p
          className="text-xs text-center mt-6 opacity-50"
          style={{ color: settings.page_text_color }}
        >
          Powered by NoiD CRM
        </p>
      </div>
    </div>
  );
}
