import { supabase } from '@/integrations/supabase/client';
// xlsx, jspdf e jspdf-autotable são pesadas (~600KB). Carregadas
// dinamicamente apenas quando o usuário exporta dados.

type EntityType = 'opportunities' | 'accounts' | 'contacts' | 'products' | 'activities';
type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf';

export interface ExportTemplate {
  id?: string;
  name: string;
  description?: string;
  entity_type: EntityType;
  format: ExportFormat;
  columns: string[];
  filters?: Record<string, any>;
  is_active?: boolean;
}

export interface ScheduledExport {
  id?: string;
  template_id?: string;
  name: string;
  description?: string;
  cron_expression: string;
  email_recipients: string[];
  is_active?: boolean;
}

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

/**
 * Fetches entity data with optional team visibility filtering
 */
async function fetchEntityData(
  entityType: EntityType,
  visibleUserIds?: string[] | null
): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Usuário não autenticado');
  }

  // Entities that support owner_user_id filtering
  const ownerFilterableEntities: EntityType[] = ['opportunities', 'activities'];
  const canFilterByOwner = ownerFilterableEntities.includes(entityType);

  let data: any[] | null = null;
  let error: any = null;

  // Build query based on entity type and visibility
  if (canFilterByOwner && visibleUserIds && visibleUserIds.length > 0) {
    if (entityType === 'opportunities') {
      const result = await supabase
        .from('opportunities')
        .select('*')
        .in('owner_user_id', visibleUserIds)
        .order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    } else if (entityType === 'activities') {
      const result = await supabase
        .from('activities')
        .select('*')
        .in('owner_user_id', visibleUserIds)
        .order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    }
  } else {
    // No filter - fetch all
    if (entityType === 'opportunities') {
      const result = await supabase.from('opportunities').select('*').order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    } else if (entityType === 'activities') {
      const result = await supabase.from('activities').select('*').order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    } else if (entityType === 'accounts') {
      const result = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    } else if (entityType === 'contacts') {
      const result = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    } else if (entityType === 'products') {
      const result = await supabase.from('products').select('*').order('created_at', { ascending: false });
      data = result.data;
      error = result.error;
    }
  }

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

/**
 * Export data with optional team visibility filtering
 */
export async function exportData(
  entityType: EntityType, 
  format: ExportFormat,
  selectedColumns?: string[],
  filters?: Record<string, any>,
  visibleUserIds?: string[] | null
): Promise<void> {
  try {
    const data = await fetchEntityData(entityType, visibleUserIds);
    const allColumns = entityColumns[entityType];
    const columns = selectedColumns 
      ? allColumns.filter(col => selectedColumns.includes(col.key))
      : allColumns;
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
    } else if (format === 'excel') {
      await exportToExcel(data, columns, entityType, timestamp);
    } else if (format === 'pdf') {
      await exportToPDFFromData(data, columns, entityType, timestamp);
    }
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

async function exportToExcel(data: any[], columns: ExportColumn[], entityType: string, timestamp: string) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(
    data.map(row => {
      const mappedRow: any = {};
      columns.forEach(col => {
        let value = row[col.key];
        if (Array.isArray(value)) {
          value = value.join('; ');
        }
        mappedRow[col.label] = value ?? '';
      });
      return mappedRow;
    })
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, entityType);
  XLSX.writeFile(workbook, `${entityType}_${timestamp}.xlsx`);
}

async function exportToPDFFromData(data: any[], columns: ExportColumn[], entityType: string, timestamp: string) {
  // Lazy load PDF libs
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // Create PDF
  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(entityType.toUpperCase(), 14, 20);
  
  // Add metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
  doc.text(`Total de registros: ${data.length}`, 14, 33);

  // Prepare table data
  const tableHeaders = columns.map(col => col.label);
  const tableRows = data.map(row => 
    columns.map(col => {
      let value = row[col.key];
      if (Array.isArray(value)) return value.join(', ');
      if (value === null || value === undefined) return '-';
      return String(value);
    })
  );

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: 40,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: Object.fromEntries(
      columns.map((_, i) => [i, { cellWidth: 'auto' }])
    ),
  });

  // Save PDF
  doc.save(`${entityType}_${timestamp}.pdf`);
}

async function exportToPDF(
  entityType: EntityType, 
  columns: string[], 
  filters?: Record<string, any>,
  visibleUserIds?: string[] | null
) {
  try {
    const data = await fetchEntityData(entityType, visibleUserIds);
    const allColumns = entityColumns[entityType];
    const selectedCols = columns.length > 0 
      ? allColumns.filter(col => columns.includes(col.key))
      : allColumns;
    const timestamp = new Date().toISOString().split('T')[0];

    await exportToPDFFromData(data, selectedCols, entityType, timestamp);
  } catch (error) {
    console.error('PDF export error:', error);
    throw error;
  }
}

// Template Management
export async function saveExportTemplate(template: ExportTemplate): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) throw new Error('No organization found');

  const { data, error } = await supabase
    .from('export_templates')
    .insert({
      ...template,
      organization_id: orgId,
      created_by: userData.user.id,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getExportTemplates(): Promise<ExportTemplate[]> {
  const { data, error } = await supabase
    .from('export_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ExportTemplate[];
}

export async function deleteExportTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('export_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Scheduled Export Management
export async function saveScheduledExport(scheduledExport: ScheduledExport): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) throw new Error('No organization found');

  const { data, error } = await supabase
    .from('scheduled_exports')
    .insert({
      ...scheduledExport,
      organization_id: orgId,
      created_by: userData.user.id,
      next_run_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getScheduledExports(): Promise<ScheduledExport[]> {
  const { data, error } = await supabase
    .from('scheduled_exports')
    .select('*, template:template_id(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ScheduledExport[];
}

export async function deleteScheduledExport(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_exports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export { entityColumns };
export type { EntityType, ExportFormat, ExportColumn };
