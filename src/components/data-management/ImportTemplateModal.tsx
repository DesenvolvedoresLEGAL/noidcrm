import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
// xlsx é carregada dinamicamente dentro de handleDownload
import type { EntityType } from "@/services/crm/data-import";

interface ImportTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_DATA = {
  accounts: {
    label: 'Empresas',
    icon: '🏢',
    headers: [
      'razao_social', 'cnpj', 'nome_fantasia', 'segmento', 'tamanho', 'cnae', 'cnaes_secundarios',
      'inscricao_estadual', 'inscricao_municipal', 'capital_social', 'data_fundacao', 'natureza_juridica', 'porte',
      'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
      'emails', 'telefones', 'website', 'linkedin', 'instagram', 'facebook',
      'data_tornou_cliente', 'origem_principal', 'observacoes', 'codigo_externo', 'tipo_empresa',
      'owner_email', 'nome_responsavel_legal', 'email_responsavel_legal', 'whatsapp_responsavel_legal',
      'nome_responsavel_financeiro', 'email_responsavel_financeiro', 'whatsapp_responsavel_financeiro',
      'regioes', 'tags'
    ],
    examples: [
      ['Empresa Exemplo Ltda', '12.345.678/0001-90', 'Empresa Exemplo', 'Tecnologia', 'Médio', '6201-5/00', '6202-3/00;6203-1/00', '123.456.789.012', '98765', '10000', '2015-01-15', 'Sociedade Limitada', 'Médio', 'Av. Paulista', '1000', 'Sala 101', 'Bela Vista', 'São Paulo', 'SP', '01310-100', 'contato@empresa.com', '(11) 98765-4321', 'https://empresa.com.br', 'https://linkedin.com/company/empresa', 'https://instagram.com/empresa', '', '2020-03-10', 'Indicação', 'Cliente estratégico', 'EXT-001', 'Cliente', 'vendedor@crm.com', 'João Silva', 'joao@empresa.com', '(11) 98765-4321', 'Maria Santos', 'maria@empresa.com', '(11) 91234-5678', 'Sudeste;São Paulo Capital', 'VIP;Estratégico;Tecnologia'],
      ['Comércio ABC Ltda', '98.765.432/0001-10', 'ABC Comércio', 'Varejo', 'Pequeno', '4711-3/02', '', '987.654.321.098', '', '5000', '2018-06-20', 'Ltda', 'Pequeno', 'Rua das Flores', '500', '', 'Centro', 'Rio de Janeiro', 'RJ', '20010-020', 'vendas@abc.com.br', '(21) 99999-8888', 'https://abc.com.br', '', '', '', '2021-08-15', 'Google Ads', '', 'ABC-002', 'Lead', '', 'Pedro Oliveira', 'pedro@abc.com.br', '(21) 99999-8888', '', '', '', 'Sudeste;Rio de Janeiro', 'Varejo;PME'],
      ['Indústria XYZ S/A', '11.222.333/0001-44', 'XYZ Industrial', 'Manufatura', 'Grande', '2511-0/00', '2512-8/00', '111.222.333.444', '12345', '500000', '2010-11-05', 'S/A', 'Grande', 'Rod. dos Bandeirantes', 'Km 90', 'Galpão 5', 'Distrito Industrial', 'Campinas', 'SP', '13050-000', 'contato@xyz.com.br', '(11) 3333-4444', 'https://xyz.com.br', 'https://linkedin.com/company/xyz', '', 'https://facebook.com/xyz', '2019-02-20', 'Feiras', 'Indústria de grande porte', 'XYZ-003', 'Cliente', '', 'Carlos Mendes', 'carlos@xyz.com.br', '(11) 3333-4444', 'Ana Costa', 'ana@xyz.com.br', '(11) 91111-2222', 'Sudeste;Interior SP', 'Enterprise;Indústria;Exportador'],
    ],
  },
  contacts: {
    label: 'Contatos',
    icon: '👤',
    headers: ['nome', 'emails', 'telefones', 'cargo', 'company_cnpj'],
    examples: [
      ['João Silva', 'joao.silva@empresa.com', '(11) 98765-4321', 'Gerente Comercial', '12.345.678/0001-90'],
      ['Maria Santos', 'maria@abc.com.br', '(21) 99999-8888', 'Diretora de Compras', '98.765.432/0001-10'],
      ['Pedro Oliveira', 'pedro@xyz.com.br', '(11) 3333-4444', 'CEO', '11.222.333/0001-44'],
    ],
  },
  opportunities: {
    label: 'Oportunidades',
    icon: '💼',
    headers: ['title', 'valor_previsto', 'prob', 'produto', 'temperature', 'close_date_prevista', 'company_cnpj', 'contact_email'],
    examples: [
      ['Venda Software CRM', '50000.00', '75', 'Software CRM', 'hot', '2025-12-31', '12.345.678/0001-90', 'joao.silva@empresa.com'],
      ['Consultoria Transformação Digital', '120000.00', '60', 'Consultoria', 'warm', '2026-02-28', '98.765.432/0001-10', 'maria@abc.com.br'],
      ['Implementação ERP', '250000.00', '85', 'Sistema ERP', 'burning', '2025-11-30', '11.222.333/0001-44', 'pedro@xyz.com.br'],
    ],
  },
  products: {
    label: 'Produtos/Serviços',
    icon: '📦',
    headers: ['name', 'reference', 'type', 'price', 'cost', 'unit', 'description', 'category_name', 'ipi_percent'],
    examples: [
      ['Software CRM Completo', 'CRM-001', 'produto', '5000.00', '1500.00', 'licença', 'Sistema completo de gestão de vendas', 'Software', '0'],
      ['Consultoria Estratégica', 'CONS-001', 'serviço', '8000.00', '3000.00', 'hora', 'Consultoria empresarial especializada', 'Consultoria', '0'],
      ['Treinamento Equipe', 'TREI-001', 'serviço', '2500.00', '800.00', 'dia', 'Capacitação de equipes comerciais', 'Treinamento', '0'],
    ],
  },
  activities: {
    label: 'Atividades',
    icon: '📅',
    headers: ['title', 'type', 'description', 'scheduled_date', 'scheduled_time', 'duration_minutes', 'status', 'account_cnpj', 'contact_email', 'opportunity_title'],
    examples: [
      ['Reunião Apresentação', 'meeting', 'Apresentação da solução CRM', '2025-12-15', '14:00', '60', 'pending', '12.345.678/0001-90', 'joao.silva@empresa.com', 'Venda Software CRM'],
      ['Ligação Follow-up', 'call', 'Acompanhamento pós-proposta', '2025-12-10', '10:30', '30', 'pending', '98.765.432/0001-10', 'maria@abc.com.br', 'Consultoria Transformação Digital'],
      ['Email Proposta', 'email', 'Envio de proposta comercial', '2025-12-08', '09:00', '15', 'completed', '11.222.333/0001-44', 'pedro@xyz.com.br', 'Implementação ERP'],
    ],
  },
  proposals: {
    label: 'Propostas',
    icon: '📄',
    headers: ['title', 'value', 'client_name', 'client_email', 'status', 'opportunity_title', 'expires_at', 'introduction', 'terms'],
    examples: [
      ['Proposta CRM Enterprise', '50000.00', 'João Silva', 'joao.silva@empresa.com', 'draft', 'Venda Software CRM', '2025-12-30', 'Proposta para implementação de CRM', 'Pagamento em 3x'],
      ['Proposta Consultoria Digital', '120000.00', 'Maria Santos', 'maria@abc.com.br', 'sent', 'Consultoria Transformação Digital', '2026-01-15', 'Projeto de transformação digital completa', 'Pagamento 30% entrada'],
      ['Proposta ERP Completo', '250000.00', 'Pedro Oliveira', 'pedro@xyz.com.br', 'accepted', 'Implementação ERP', '2025-11-30', 'Sistema ERP integrado', 'Pagamento em 12x'],
    ],
  },
  loss_reasons: {
    label: 'Motivos de Perda',
    icon: '❌',
    headers: ['name', 'is_active'],
    examples: [
      ['Preço muito alto', 'true'],
      ['Escolheu concorrente', 'true'],
      ['Sem budget aprovado', 'true'],
      ['Timing inadequado', 'true'],
      ['Não atende requisitos técnicos', 'true'],
    ],
  },
  origins: {
    label: 'Origens',
    icon: '🏷️',
    headers: ['name', 'group_name', 'is_active'],
    examples: [
      ['Site Institucional', 'Inbound Marketing', 'true'],
      ['LinkedIn', 'Inbound Marketing', 'true'],
      ['Google Ads', 'Inbound Marketing', 'true'],
      ['Cold Call', 'Outbound Marketing', 'true'],
      ['Indicação Cliente', 'Farmers', 'true'],
    ],
  },
  territories: {
    label: 'Territórios',
    icon: '🗺️',
    headers: ['name', 'type'],
    examples: [
      ['São Paulo', 'geographic'],
      ['Rio de Janeiro', 'geographic'],
      ['Sul', 'geographic'],
      ['Nordeste', 'geographic'],
      ['Enterprise', 'segment'],
      ['SMB', 'segment'],
    ],
  },
};

export default function ImportTemplateModal({ open, onOpenChange }: ImportTemplateModalProps) {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('accounts');
  const [includeExamples, setIncludeExamples] = useState(true);
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');

  const handleDownload = async () => {
    try {
      const template = TEMPLATE_DATA[selectedEntity];
      if (!template) {
        console.error('Template not found for entity:', selectedEntity);
        return;
      }

      const data = includeExamples 
        ? [template.headers, ...template.examples]
        : [template.headers];

      if (format === 'csv') {
        // CSV Download with proper escaping
        const escapeCSV = (value: string | number) => {
          const str = String(value || '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const csvContent = data.map(row => 
          row.map(cell => escapeCSV(cell)).join(',')
        ).join('\n');
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `template_${selectedEntity}_${includeExamples ? 'com_exemplos' : 'vazio'}_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Excel Download (lazy load XLSX)
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Auto-size columns
        const colWidths = template.headers.map((_, i) => {
          const maxLength = Math.max(
            template.headers[i].length,
            ...(includeExamples ? template.examples.map(row => String(row[i] || '').length) : [])
          );
          return { wch: Math.min(maxLength + 2, 50) };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, template.label);
        XLSX.writeFile(wb, `template_${selectedEntity}_${includeExamples ? 'com_exemplos' : 'vazio'}_${Date.now()}.xlsx`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const entities = Object.entries(TEMPLATE_DATA) as [EntityType, typeof TEMPLATE_DATA[EntityType]][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Baixar Template de Importação</DialogTitle>
          <DialogDescription>
            Escolha a entidade e configure o template que deseja baixar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Entity Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Selecione a Entidade</Label>
            <div className="grid grid-cols-3 gap-3">
              {entities.map(([key, entity]) => (
                <button
                  key={key}
                  onClick={() => setSelectedEntity(key)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                    selectedEntity === key
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="text-2xl mb-1">{entity.icon}</div>
                  <div className="text-xs font-medium">{entity.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Preview do Template</Label>
            <div className="border rounded-lg p-4 bg-muted/50 overflow-x-auto">
              <div className="text-xs font-mono space-y-1">
                <div className="font-bold text-primary">
                  {TEMPLATE_DATA[selectedEntity].headers.join(' | ')}
                </div>
                {includeExamples && TEMPLATE_DATA[selectedEntity].examples.slice(0, 2).map((row, i) => (
                  <div key={i} className="text-muted-foreground">
                    {row.join(' | ')}
                  </div>
                ))}
                {includeExamples && TEMPLATE_DATA[selectedEntity].examples.length > 2 && (
                  <div className="text-muted-foreground italic">
                    ... e mais {TEMPLATE_DATA[selectedEntity].examples.length - 2} exemplo(s)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {/* Include Examples */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Incluir Dados de Exemplo</Label>
                <p className="text-xs text-muted-foreground">
                  Template virá com {TEMPLATE_DATA[selectedEntity].examples.length} linhas de exemplo para referência
                </p>
              </div>
              <Switch
                checked={includeExamples}
                onCheckedChange={setIncludeExamples}
              />
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Formato do Arquivo</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'excel')}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setFormat('csv')}>
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium text-sm">CSV</div>
                      <div className="text-xs text-muted-foreground">Compatível com Excel e outros editores</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent" onClick={() => setFormat('excel')}>
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer flex-1">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-medium text-sm">Excel (.xlsx)</div>
                      <div className="text-xs text-muted-foreground">Formato nativo do Microsoft Excel</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <FileDown className="h-4 w-4" />
            Baixar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
