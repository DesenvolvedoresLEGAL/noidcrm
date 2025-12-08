import { useState, useEffect } from 'react';
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
import { format } from 'date-fns';

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

  // Initialize values from saved data or entity data
  useEffect(() => {
    if (savedValues) {
      setValues(savedValues.values || {});
    } else {
      // Pre-fill from entity data if available
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

  const handleSave = async () => {
    await saveValues.mutateAsync({
      formId: form.id,
      entityId,
      entityType,
      values,
    });
    setHasChanges(false);
  };

  const getFieldValue = (field: CustomFormField) => {
    // First check if we have a saved/modified value
    if (values[field.id] !== undefined) {
      return values[field.id];
    }
    // Then try to get from entity data
    const sourceData = entityData?.[field.entity_source as keyof typeof entityData];
    if (sourceData && field.source === 'native') {
      return sourceData[field.field_key] ?? '';
    }
    return '';
  };

  const renderField = (field: CustomFormField) => {
    const value = getFieldValue(field);
    const fieldId = field.id;
    
    // Get native field definition if applicable
    const nativeField = field.source === 'native' 
      ? NATIVE_FIELDS[field.entity_source]?.find(f => f.key === field.field_key)
      : null;

    const fieldType = field.type || nativeField?.type || 'text';

    if (readOnly) {
      return (
        <div className="text-sm">
          {value || <span className="text-muted-foreground">-</span>}
        </div>
      );
    }

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
        const options = nativeField?.options || [];
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

  // Calculate completion percentage
  const requiredFields = form.fields.filter(f => f.is_required);
  const filledRequired = requiredFields.filter(f => {
    const val = getFieldValue(f);
    return val !== undefined && val !== null && val !== '';
  });
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
        {form.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label className="flex items-center gap-1">
              {field.label}
              {field.is_required && (
                <Asterisk className="h-3 w-3 text-destructive" />
              )}
            </Label>
            {renderField(field)}
          </div>
        ))}

        {form.fields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Este formulário não possui campos configurados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
