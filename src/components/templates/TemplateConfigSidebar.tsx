import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Layout, DollarSign, Calendar, Hash, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listLayouts } from '@/services/crm/proposal-layouts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TemplateConfigSidebarProps {
  layoutId?: string;
  currency: string;
  validityDays: number;
  controlPrefix: string;
  isDefault: boolean;
  description: string;
  onLayoutChange: (value: string | undefined) => void;
  onCurrencyChange: (value: string) => void;
  onValidityChange: (value: number) => void;
  onPrefixChange: (value: string) => void;
  onDefaultChange: (value: boolean) => void;
  onDescriptionChange: (value: string) => void;
}

const CURRENCIES = [
  { value: 'BRL', label: 'R$ - Real Brasileiro' },
  { value: 'USD', label: '$ - Dólar Americano' },
  { value: 'EUR', label: '€ - Euro' },
];

export function TemplateConfigSidebar({
  layoutId,
  currency,
  validityDays,
  controlPrefix,
  isDefault,
  description,
  onLayoutChange,
  onCurrencyChange,
  onValidityChange,
  onPrefixChange,
  onDefaultChange,
  onDescriptionChange,
}: TemplateConfigSidebarProps) {
  const { data: layouts = [] } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
  });

  return (
    <div className="w-80 border-l bg-muted/30 p-6 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Configurações</h3>
      </div>

      <div className="space-y-6">
        {/* Description */}
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Descrição do template..."
            rows={3}
          />
        </div>

        <Separator />

        {/* Visual Layout */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4 text-muted-foreground" />
            <Label>Modelo Visual (PDFs)</Label>
          </div>
          <Select
            value={layoutId || 'none'}
            onValueChange={(value) => onLayoutChange(value === 'none' ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem modelo visual</SelectItem>
              {layouts.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                  {layout.pages?.length ? ` (${layout.pages.length} páginas)` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Modelo com PDFs que serão anexados às propostas
          </p>
        </div>

        <Separator />

        {/* Currency */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <Label>Moeda Padrão</Label>
          </div>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Validity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label>Validade (dias)</Label>
          </div>
          <Input
            type="number"
            min={1}
            max={365}
            value={validityDays}
            onChange={(e) => onValidityChange(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Dias de validade padrão das propostas
          </p>
        </div>

        {/* Control Prefix */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <Label>Sigla de Controle</Label>
          </div>
          <Input
            value={controlPrefix}
            onChange={(e) => onPrefixChange(e.target.value.toUpperCase())}
            placeholder="Ex: ALU, VND"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            Prefixo para numeração automática (ex: ALU-2025-00001)
          </p>
        </div>

        <Separator />

        {/* Default Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <Label>Template Padrão</Label>
          </div>
          <Switch
            checked={isDefault}
            onCheckedChange={onDefaultChange}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Se ativado, este template será selecionado automaticamente ao criar novas propostas
        </p>
      </div>
    </div>
  );
}
