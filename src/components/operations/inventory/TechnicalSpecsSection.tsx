import { useFieldArray, type Control, type UseFormSetValue } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MAX_TECHNICAL_SPECS,
  TECHNICAL_SPEC_TYPES,
  TECHNICAL_SPEC_TYPE_LABEL,
  normalizeSpecKey,
  type TechnicalSpecType,
} from '@/lib/operations/inventoryTechnicalSpecs';

interface Props {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  errors?: any;
  name?: string;
}

export function TechnicalSpecsSection({
  control,
  setValue,
  errors,
  name = 'technical_specs',
}: Props) {
  const { fields, append, remove } = useFieldArray({ control, name });

  const atLimit = fields.length >= MAX_TECHNICAL_SPECS;

  const handleLabelChange = (idx: number, value: string) => {
    setValue(`${name}.${idx}.label`, value, { shouldDirty: true, shouldValidate: false });
    setValue(`${name}.${idx}.key`, normalizeSpecKey(value), {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  const addRow = () =>
    append({ key: '', label: '', value: '', type: 'text' as TechnicalSpecType, notes: '' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Especificações Técnicas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Adicione dados técnicos flexíveis do item, como IMEI, MAC Address, ICCID, firmware,
          protocolo, bateria, compatibilidade ou qualquer atributo relevante.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma especificação técnica adicionada.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, idx) => {
              const rowErrors = errors?.[idx];
              return (
                <div
                  key={field.id}
                  className="rounded-md border p-3 space-y-2 bg-muted/30"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs">Campo</Label>
                      <Input
                        placeholder="Ex: MAC Address"
                        defaultValue={(field as any).label}
                        onChange={(e) => handleLabelChange(idx, e.target.value)}
                      />
                      {rowErrors?.label?.message && (
                        <p className="text-xs text-destructive">{rowErrors.label.message}</p>
                      )}
                      {rowErrors?.key?.message && (
                        <p className="text-xs text-destructive">{rowErrors.key.message}</p>
                      )}
                    </div>
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs">Valor</Label>
                      <Input
                        placeholder="Ex: AA:BB:CC:DD:EE:FF"
                        defaultValue={(field as any).value}
                        onChange={(e) =>
                          setValue(`${name}.${idx}.value`, e.target.value, {
                            shouldDirty: true,
                          })
                        }
                      />
                      {rowErrors?.value?.message && (
                        <p className="text-xs text-destructive">{rowErrors.value.message}</p>
                      )}
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        defaultValue={(field as any).type ?? 'text'}
                        onValueChange={(v) =>
                          setValue(`${name}.${idx}.type`, v, { shouldDirty: true })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TECHNICAL_SPEC_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {TECHNICAL_SPEC_TYPE_LABEL[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-1 flex sm:justify-end items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        aria-label="Remover especificação"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observação</Label>
                    <Input
                      placeholder="Opcional"
                      defaultValue={(field as any).notes ?? ''}
                      onChange={(e) =>
                        setValue(`${name}.${idx}.notes`, e.target.value, { shouldDirty: true })
                      }
                    />
                    {rowErrors?.notes?.message && (
                      <p className="text-xs text-destructive">{rowErrors.notes.message}</p>
                    )}
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
            <Plus className="h-4 w-4" /> Adicionar especificação
          </Button>
          <p className="text-xs text-muted-foreground">
            {fields.length}/{MAX_TECHNICAL_SPECS} especificações
          </p>
        </div>
        {atLimit && (
          <p className="text-xs text-destructive">
            Limite de {MAX_TECHNICAL_SPECS} especificações técnicas por item.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
