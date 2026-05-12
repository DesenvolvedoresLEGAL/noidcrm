import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getActiveTemplateFields,
  type FamilySpecTemplateField,
} from '@/lib/operations/inventoryFamilyTemplate';
import type { TechnicalSpec } from '@/lib/operations/inventoryTechnicalSpecs';

interface Props {
  template: FamilySpecTemplateField[] | null | undefined;
  /** Current template specs (source = family_template). */
  value: TechnicalSpec[];
  onChange: (next: TechnicalSpec[]) => void;
  errorByKey?: Record<string, string>;
}

function PasswordField({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar' : 'Mostrar'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function FamilyTemplateSpecsFields({ template, value, onChange, errorByKey }: Props) {
  const active = getActiveTemplateFields(template);

  if (active.length === 0) {
    return null;
  }

  const valueByKey = new Map<string, TechnicalSpec>();
  value.forEach((s) => {
    if (s?.key) valueByKey.set(s.key, s);
  });

  const setFieldValue = (field: FamilySpecTemplateField, raw: string) => {
    const next: TechnicalSpec[] = active.map((f) => {
      const existing = valueByKey.get(f.key);
      const v = f.key === field.key ? raw : (existing?.value ?? '');
      return {
        key: f.key,
        label: f.label,
        value: v,
        type: f.type === 'password' || f.type === 'select' ? 'text' : (f.type as any),
        notes: existing?.notes ?? null,
        source: 'family_template',
      };
    });
    onChange(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados técnicos da família</CardTitle>
        <p className="text-xs text-muted-foreground">
          Campos definidos pela família selecionada.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.map((field) => {
            const current = valueByKey.get(field.key)?.value ?? '';
            const fieldId = `tpl-${field.key}`;
            const err = errorByKey?.[field.key];

            const labelEl = (
              <Label htmlFor={fieldId} className="text-xs">
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
            );

            let input: JSX.Element;
            if (field.type === 'select') {
              input = (
                <Select value={current || undefined} onValueChange={(v) => setFieldValue(field, v)}>
                  <SelectTrigger id={fieldId}>
                    <SelectValue placeholder={field.placeholder ?? 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            } else if (field.type === 'boolean') {
              input = (
                <Select value={current || undefined} onValueChange={(v) => setFieldValue(field, v)}>
                  <SelectTrigger id={fieldId}>
                    <SelectValue placeholder={field.placeholder ?? 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              );
            } else if (field.type === 'password') {
              input = (
                <PasswordField
                  id={fieldId}
                  value={current}
                  onChange={(v) => setFieldValue(field, v)}
                  placeholder={field.placeholder ?? ''}
                />
              );
            } else {
              const htmlType =
                field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : field.type === 'url'
                      ? 'url'
                      : 'text';
              input = (
                <Input
                  id={fieldId}
                  type={htmlType}
                  inputMode={field.type === 'number' ? 'decimal' : undefined}
                  placeholder={field.placeholder ?? ''}
                  value={current}
                  onChange={(e) => setFieldValue(field, e.target.value)}
                />
              );
            }

            return (
              <div key={field.key} className={cn('space-y-1', field.type === 'url' && 'sm:col-span-2')}>
                {labelEl}
                {input}
                {field.help_text && (
                  <p className="text-xs text-muted-foreground">{field.help_text}</p>
                )}
                {err && <p className="text-xs text-destructive">{err}</p>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
