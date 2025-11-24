import { supabase } from '@/integrations/supabase/client';

type EntityType = 'opportunities' | 'accounts' | 'contacts' | 'products' | 'activities';
type ExportFormat = 'csv' | 'json';

interface ExportColumn {
  key: string;
  label: string;
}

const entityColumns: Record<EntityType, ExportColumn[]> = {
  opportunities: [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Título' },
    { key: 'valor_previsto', label: 'Valor Previsto' },
    { key: 'prob', label: 'Probabilidade (%)' },
    { key: 'status', label: 'Status' },
    { key: 'temperature', label: 'Temperatura' },
    { key: 'close_date_prevista', label: 'Data Prevista' },
    { key: 'produto', label: 'Produto' },
    { key: 'origem', label: 'Origem' },
    { key: 'fonte', label: 'Fonte' },
    { key: 'created_at', label: 'Criado Em' },
  ],
  accounts: [
    { key: 'id', label: 'ID' },
    { key: 'razao_social', label: 'Razão Social' },
    { key: 'nome_fantasia', label: 'Nome Fantasia' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'segmento', label: 'Segmento' },
    { key: 'tamanho', label: 'Tamanho' },
    { key: 'cnae', label: 'CNAE' },
    { key: 'origem_principal', label: 'Origem Principal' },
    { key: 'created_at', label: 'Criado Em' },
  ],
  contacts: [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'emails', label: 'E-mails' },
    { key: 'telefones', label: 'Telefones' },
    { key: 'account_id', label: 'ID da Empresa' },
    { key: 'created_at', label: 'Criado Em' },
  ],
  products: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'code', label: 'Código' },
    { key: 'description', label: 'Descrição' },
    { key: 'price', label: 'Preço' },
    { key: 'active', label: 'Ativo' },
    { key: 'created_at', label: 'Criado Em' },
  ],
  activities: [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Título' },
    { key: 'type', label: 'Tipo' },
    { key: 'status', label: 'Status' },
    { key: 'description', label: 'Descrição' },
    { key: 'scheduled_date', label: 'Data Agendada' },
    { key: 'completed_at', label: 'Concluído Em' },
    { key: 'opportunity_id', label: 'ID da Oportunidade' },
    { key: 'account_id', label: 'ID da Empresa' },
    { key: 'contact_id', label: 'ID do Contato' },
    { key: 'created_at', label: 'Criado Em' },
  ],
};

async function fetchEntityData(entityType: EntityType): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from(entityType)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching ${entityType}:`, error);
    throw new Error(`Erro ao buscar ${entityType}: ${error.message}`);
  }

  return data || [];
}

function convertToCSV(data: any[], columns: ExportColumn[]): string {
  if (!data.length) {
    return columns.map(col => col.label).join(',');
  }

  const headers = columns.map(col => col.label).join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      let value = row[col.key];
      
      // Handle arrays (emails, telefones)
      if (Array.isArray(value)) {
        value = value.join('; ');
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Escape commas and quotes in CSV
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportData(entityType: EntityType, format: ExportFormat): Promise<void> {
  try {
    const data = await fetchEntityData(entityType);
    const columns = entityColumns[entityType];
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'csv') {
      const csvContent = convertToCSV(data, columns);
      downloadFile(
        csvContent,
        `${entityType}_${timestamp}.csv`,
        'text/csv;charset=utf-8;'
      );
    } else if (format === 'json') {
      const jsonContent = JSON.stringify(data, null, 2);
      downloadFile(
        jsonContent,
        `${entityType}_${timestamp}.json`,
        'application/json;charset=utf-8;'
      );
    }
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}
