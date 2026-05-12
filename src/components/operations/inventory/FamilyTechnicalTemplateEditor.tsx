import { useFieldArray, type Control, type UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FAMILY_SPEC_FIELD_TYPES,
  FAMILY_SPEC_FIELD_TYPE_LABEL,
  MAX_FAMILY_TEMPLATE_FIELDS,
  parseOptionsString,
  type FamilySpecFieldType,
} from '@/lib/operations/inventoryFamilyTemplate';
import { normalizeSpecKey } from '@/lib/operations/inventoryTechnicalSpecs';

interface Props {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  errors?: any;
  name?: string;
}

export function FamilyTechnicalTemplateEditor({
  control,
  setValue,
  errors,
  name = 'technical_spec_template',
}: Props) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const atLimit = fields.length >= MAX_FAMILY_TEMPLATE_FIELDS;

  const handleLabelChange = (idx: number, value: string) => {
    setValue(`${name}.${idx}.label`, value, { shouldDirty: true });
    setValue(`${name}.${idx}.key`, normalizeSpecKey(value), { shouldDirty: true });
  };

  const addRow = () =>
    append({
      key: '',
      label: '',
      type: 'text' as FamilySpecFieldType,
      required: false,
      placeholder: '',
      help_text: '',
      sort_order: fields.length,
      is_active: true,
      options: [] as string[],
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Campos técnicos da família</CardTitle>
        <p className="text-xs text-muted-foreground">
          Defina quais campos técnicos deverão aparecer automaticamente nos itens desta família.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center space-y-1">
            <p className="text-sm font-medium">Nenhum campo técnico configurado</p>
            <p className="text-xs text-muted-foreground">
              Adicione campos como ICCID, número da linha, senha de fábrica, MAC Address, firmware
              ou qualquer dado técnico necessário para esta família.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, idx) => {
              const rowErrors = errors?.[idx];
              const type = (field as any).type as FamilySpecFieldType;
              const optionsArr: string[] = Array.isArray((field as any).options)
                ? (field as any).options
                : [];
              return (
                <div
                  key={field.id}
                  className="rounded-md border p-3 space-y-3 bg-muted/30"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="space-y-1 sm:col-span-5">
                      <Label className="text-xs">Nome do campo</Label>
                      <Input
                        placeholder="Ex: ICCID"
                        defaultValue={(field as any).label}
                        onChange={(e) => handleLabelChange(idx, e.target.value)}
                      />
                      {rowErrors?.label?.message && (
                        <p className="text-xs text-destructive">{rowErrors.label.message}</p>
                      )}
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        defaultValue={type ?? 'text'}
                        onValueChange={(v) => {
                          setValue(`${name}.${idx}.type`, v, { shouldDirty: true });
                          if (v !== 'select') {
                            setValue(`${name}.${idx}.options`, [], { shouldDirty: true });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FAMILY_SPEC_FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {FAMILY_SPEC_FIELD_TYPE_LABEL[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Ordem</Label>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={(field as any).sort_order ?? idx}
                        onChange={(e) =>
                          setValue(`${name}.${idx}.sort_order`, Number(e.target.value), {
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-end justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        aria-label="Remover campo"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        placeholder="Ex: 895505..."
                        defaultValue={(field as any).placeholder ?? ''}
                        onChange={(e) =>
                          setValue(`${name}.${idx}.placeholder`, e.target.value, {
                            shouldDirty: true,
                          })
                        }
                      />
                      {rowErrors?.placeholder?.message && (
                        <p className="text-xs text-destructive">{rowErrors.placeholder.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Texto auxiliar</Label>
                      <Input
                        placeholder="Ex: Código único do chip."
                        defaultValue={(field as any).help_text ?? ''}
                        onChange={(e) =>
                          setValue(`${name}.${idx}.help_text`, e.target.value, {
                            shouldDirty: true,
                          })
                        }
                      />
                      {rowErrors?.help_text?.message && (
                        <p className="text-xs text-destructive">{rowErrors.help_text.message}</p>
                      )}
                    </div>
                  </div>

                  {type === 'select' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Opções (separadas por vírgula)</Label>
                      <Input
                        placeholder="Ex: Claro, Vivo, TIM"
                        defaultValue={optionsArr.join(', ')}
                        onChange={(e) =>
                          setValue(
                            `${name}.${idx}.options`,
                            parseOptionsString(e.target.value),
                            { shouldDirty: true },
                          )
                        }
                      />
                      {rowErrors?.options?.message && (
                        <p className="text-xs text-destructive">{rowErrors.options.message}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-6 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        defaultChecked={Boolean((field as any).required)}
                        onCheckedChange={(v) =>
                          setValue(`${name}.${idx}.required`, v, { shouldDirty: true })
                        }
                      />
                      <Label className="text-xs">Obrigatório</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        defaultChecked={(field as any).is_active !== false}
                        onCheckedChange={(v) =>
                          setValue(`${name}.${idx}.is_active`, v, { shouldDirty: true })
                        }
                      />
                      <Label className="text-xs">Ativo</Label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={atLimit}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Adicionar campo técnico
          </Button>
          <p className="text-xs text-muted-foreground">
            {fields.length}/{MAX_FAMILY_TEMPLATE_FIELDS} campos técnicos
          </p>
        </div>
        {atLimit && (
          <p className="text-xs text-destructive">
            Limite de {MAX_FAMILY_TEMPLATE_FIELDS} campos técnicos por família.
          </p>
        )}
        {typeof errors?.message === 'string' && (
          <p className="text-xs text-destructive">{errors.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
