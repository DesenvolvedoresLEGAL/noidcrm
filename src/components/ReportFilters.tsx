import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

interface ReportFiltersProps {
  filters: {
    reportType: string;
    pipeline: string;
    startDate: string;
    endDate: string;
  };
  onFiltersChange: (filters: any) => void;
  onGenerate: () => void;
  onClear: () => void;
}

export function ReportFilters({
  filters,
  onFiltersChange,
  onGenerate,
  onClear,
}: ReportFiltersProps) {
  const reportTypes = [
    { value: 'opportunities-processed', label: 'Oportunidades processadas' },
    { value: 'funnel-balance', label: 'Balanceamento do funil' },
    { value: 'conversion-rate', label: 'Taxa de conversão' },
    { value: 'forecast', label: 'Forecast' },
    { value: 'new-opportunities', label: 'Novas oportunidades por origem' },
  ];

  const pipelines = [
    { value: 'all', label: 'Todos os funis' },
    { value: 'pipe-pre-vendas', label: 'PRÉ-VENDAS' },
    { value: 'pipe-alugue', label: 'ALUGUE: VENDAS' },
    { value: 'pipe-humanoid', label: 'HUMANOID: VENDAS' },
  ];

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Filtros do Relatório</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reportType">Tipo de Relatório</Label>
            <Select
              value={filters.reportType}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, reportType: value })
              }
            >
              <SelectTrigger id="reportType">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline">Funil</Label>
            <Select
              value={filters.pipeline}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, pipeline: value })
              }
            >
              <SelectTrigger id="pipeline">
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipe) => (
                  <SelectItem key={pipe.value} value={pipe.value}>
                    {pipe.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Data Inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                onFiltersChange({ ...filters, startDate: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Data Final</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                onFiltersChange({ ...filters, endDate: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button onClick={onGenerate} className="flex-1">
            Gerar Relatório
          </Button>
          <Button onClick={onClear} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
