import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Circle, Save, Loader2, Asterisk } from 'lucide-react';
import { CustomForm, CustomFormField } from '@/hooks/useCustomForms';
import { useCustomFormValues, useCustomFormValueMutations } from '@/hooks/useCustomFormValues';
import { NATIVE_FIELDS } from '@/services/crm/native-fields';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CustomFormRendererProps {
  form: CustomForm;
  entityId: string;
  entityType: string;
  entityData?: {
    opportunity?: any;
    account?: any;
    contact?: any;
  };
  readOnly?: boolean;
}

interface CustomFieldMeta {
  id: string;
  field_key: string;
  options: Array<{ value: string; label: string }>;
}

export function CustomFormRenderer({
  form,
  entityId,
  entityType,
  entityData,
  readOnly = false,
}: CustomFormRendererProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedValues, isLoading } = useCustomFormValues(form.id, entityId);
  const { saveValues, isSaving } = useCustomFormValueMutations();

  // Fetch metadata (options, semantic field_key) for custom fields used by this form.
  const customFieldIds = useMemo(
    () => form.fields.filter(f => f.source === 'custom').map(f => f.field_key).filter(Boolean),
    [form.fields],
  );

  const { data: customFieldsMeta } = useQuery({
    queryKey: ['custom-fields-meta', customFieldIds.sort().join(',')],
    enabled: customFieldIds.length > 0,
    queryFn: async (): Promise<Record<string, CustomFieldMeta>> => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id, field_key, options')
        .in('id', customFieldIds);
      if (error) throw error;
      const map: Record<string, CustomFieldMeta> = {};
      (data || []).forEach((row: any) => {
        map[row.id] = {
          id: row.id,
          field_key: row.field_key,
          options: Array.isArray(row.options) ? row.options : [],
        };
      });
      return map;
    },
  });

  // Map fieldId -> semantic key (e.g. "proximo_passo", "permissao_proposta") to drive conditional logic.
  const semanticKeyByFieldId = useMemo(() => {
    const map: Record<string, string> = {};
    form.fields.forEach(f => {
      if (f.source === 'custom') {
        const meta = customFieldsMeta?.[f.field_key];
        if (meta) map[f.id] = meta.field_key;
      } else {
        map[f.id] = f.field_key;
      }
    });
    return map;
  }, [form.fields, customFieldsMeta]);

  // Initialize values from saved data or entity data
  useEffect(() => {
    if (savedValues) {
      setValues(savedValues.values || {});
    } else {
      const initialValues: Record<string, any> = {};
      form.fields.forEach(field => {
        const sourceData = entityData?.[field.entity_source as keyof typeof entityData];
        if (sourceData && field.source === 'native') {
          initialValues[field.id] = sourceData[field.field_key] ?? '';
        }
      });
      setValues(initialValues);
    }
  }, [savedValues, form.fields, entityData]);

  const handleChange = (fieldId: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    setHasChanges(true);
  };

  const getFieldValue = (field: CustomFormField) => {
    if (values[field.id] !== undefined) return values[field.id];
    const sourceData = entityData?.[field.entity_source as keyof typeof entityData];
    if (sourceData && field.source === 'native') {
      return sourceData[field.field_key] ?? '';
    }
    return '';
  };

  // Conditional requirement: when "Próximo passo" = "enviar_proposta", "Permissão real para proposta" is required.
  const proximoPassoFieldId = useMemo(
    () => Object.entries(semanticKeyByFieldId).find(([, k]) => k === 'proximo_passo')?.[0],
    [semanticKeyByFieldId],
  );
  const proximoPassoValue = proximoPassoFieldId ? values[proximoPassoFieldId] : undefined;
  const isPermissaoConditional = proximoPassoValue === 'enviar_proposta';

  const isFieldRequired = (field: CustomFormField) => {
    if (semanticKeyByFieldId[field.id] === 'permissao_proposta' && isPermissaoConditional) {
      return true;
    }
    return !!field.is_required;
  };

  const isEmpty = (v: any) =>
    v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  const handleSave = async () => {
    // Validate required fields including conditional permissao_proposta
    const missing = form.fields.filter(f => isFieldRequired(f) && isEmpty(getFieldValue(f)));
    if (missing.length > 0) {
      toast.error(
        `Preencha os campos obrigatórios: ${missing.map(m => m.label).join(', ')}`,
      );
      return;
    }
    await saveValues.mutateAsync({
      formId: form.id,
      entityId,
      entityType,
      values,
    });
    setHasChanges(false);
  };

  const renderField = (field: CustomFormField) => {
    const value = getFieldValue(field);
    const fieldId = field.id;

    const nativeField = field.source === 'native'
      ? NATIVE_FIELDS[field.entity_source]?.find(f => f.key === field.field_key)
      : null;

    const fieldType = field.type || nativeField?.type || 'text';

    if (readOnly) {
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      return (
        <div className="text-sm">
          {displayValue || <span className="text-muted-foreground">-</span>}
        </div>
      );
    }

    // Options come from native definition OR from custom_fields metadata.
    const customMeta = field.source === 'custom' ? customFieldsMeta?.[field.field_key] : undefined;
    const options =
      (customMeta?.options as Array<{ value: string; label: string }> | undefined) ||
      nativeField?.options ||
      [];

    switch (fieldType) {
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
            rows={3}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={(v) => handleChange(fieldId, v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select': {
        const selected: string[] = Array.isArray(value) ? value : [];
        const toggle = (val: string) => {
          const next = selected.includes(val)
            ? selected.filter(v => v !== val)
            : [...selected, val];
          handleChange(fieldId, next);
        };
        return (
          <div className="flex flex-wrap gap-2 rounded-md border p-2">
            {options.length === 0 && (
              <span className="text-xs text-muted-foreground">Sem opções configuradas.</span>
            )}
            {options.map(opt => {
              const active = selected.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={`text-xs rounded-full border px-3 py-1 transition ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!value}
              onCheckedChange={(checked) => handleChange(fieldId, checked)}
            />
            <span className="text-sm">{value ? 'Sim' : 'Não'}</span>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value ? format(new Date(value), 'yyyy-MM-dd') : ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      case 'currency':
        return (
          <Input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
            className="font-mono"
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleChange(fieldId, e.target.value)}
          />
        );
    }
  };

  // Completion uses dynamic required (includes conditional permissao_proposta).
  const requiredFields = form.fields.filter(f => isFieldRequired(f));
  const filledRequired = requiredFields.filter(f => !isEmpty(getFieldValue(f)));
  const completionPct = requiredFields.length > 0
    ? Math.round((filledRequired.length / requiredFields.length) * 100)
    : 100;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{form.name}</CardTitle>
            {completionPct === 100 ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completo
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Circle className="h-3 w-3 mr-1" />
                {completionPct}%
              </Badge>
            )}
          </div>
          {!readOnly && hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          )}
        </div>
        {form.description && (
          <p className="text-sm text-muted-foreground">{form.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {form.fields.map((field) => {
          const required = isFieldRequired(field);
          return (
            <div key={field.id} className="space-y-1.5">
              <Label className="flex items-center gap-1">
                {field.label}
                {required && <Asterisk className="h-3 w-3 text-destructive" />}
              </Label>
              {renderField(field)}
              {semanticKeyByFieldId[field.id] === 'permissao_proposta' && isPermissaoConditional && (
                <p className="text-xs text-muted-foreground">
                  Obrigatório porque o próximo passo é "Enviar proposta".
                </p>
              )}
            </div>
          );
        })}

        {form.fields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Este formulário não possui campos configurados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
