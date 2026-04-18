import Papa from 'papaparse';
// xlsx é carregada dinamicamente em parseExcel() para reduzir o bundle inicial
import { supabase } from '@/integrations/supabase/client';

export type EntityType = 
  | 'accounts' 
  | 'contacts' 
  | 'opportunities'
  | 'products'
  | 'activities'
  | 'proposals'
  | 'loss_reasons'
  | 'origins'
  | 'territories';
export type ImportFormat = 'csv' | 'excel';
export type OperationMode = 'insert' | 'upsert';

export interface ParsedData {
  headers: string[];
  rows: any[];
  preview: any[];
}

export interface ColumnMapping {
  [fileColumn: string]: string; // Maps file column to CRM field
}

export interface UpsertSettings {
  mode: OperationMode;
  unique_field: string;
  update_strategy: 'merge' | 'replace';
}

export interface RelationshipHints {
  company_cnpj_column?: string;
  contact_email_column?: string;
  account_name_column?: string;
  opportunity_title_column?: string;
  category_name_column?: string;
}

export interface RelationshipResult {
  success: boolean;
  updated_data: any[];
  relationships_found: number;
  relationships_by_type: Record<string, number>;
  errors: Array<{ row: number; message: string }>;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface DuplicateDetection {
  row: number;
  field: string;
  value: any;
  existingId: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  duplicates: DuplicateDetection[];
  aiSuggestions: any[];
}

export interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  warningCount: number;
  updateCount?: number;
  relationshipCount?: number;
  errors: Array<{ row: number; message: string }>;
  importedIds: string[];
  importLogId?: string;
}

// Parse file (CSV or Excel)
export async function parseFile(file: File): Promise<ParsedData> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (fileExtension === 'csv') {
    return parseCSV(file);
  } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
    return parseExcel(file);
  } else {
    throw new Error('Formato de arquivo não suportado. Use CSV ou Excel.');
  }
}

// Parse CSV using papaparse
async function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data as any[];
        const preview = rows.slice(0, 10);

        resolve({ headers, rows, preview });
      },
      error: (error) => {
        reject(new Error(`Erro ao ler CSV: ${error.message}`));
      },
    });
  });
}

// Parse Excel using xlsx
async function parseExcel(file: File): Promise<ParsedData> {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          reject(new Error('Arquivo Excel vazio'));
          return;
        }

        const headers = (jsonData[0] as any[]).map(h => String(h));
        const rows = jsonData.slice(1).map((row: any) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });

        const preview = rows.slice(0, 10);

        resolve({ headers, rows, preview });
      } catch (error: any) {
        reject(new Error(`Erro ao ler Excel: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Auto-detect column mapping
export function autoMapColumns(fileHeaders: string[], entityType: EntityType): ColumnMapping {
  const mapping: ColumnMapping = {};

  const fieldMappings: Record<EntityType, Record<string, string[]>> = {
    accounts: {
      razao_social: ['razao social', 'razão social', 'company name', 'nome empresa', 'empresa'],
      cnpj: ['cnpj', 'tax id', 'ein'],
      nome_fantasia: ['nome fantasia', 'trade name', 'fantasy name'],
      segmento: ['segmento', 'segment', 'setor', 'sector', 'industry', 'ramo / segmento'],
      tamanho: ['tamanho', 'size', 'porte'],
      cnae: ['cnae', 'cnae principal', 'activity code'],
      cnaes_secundarios: ['cnaes secundários', 'cnaes secundarios', 'cnae secundário', 'secondary cnae'],
      inscricao_estadual: ['inscrição estadual', 'inscricao estadual', 'ie', 'state registration'],
      inscricao_municipal: ['inscrição municipal', 'inscricao municipal', 'im', 'municipal registration'],
      capital_social: ['capital social', 'share capital', 'capital'],
      data_fundacao: ['data de fundação', 'data fundação', 'foundation date', 'founding date'],
      natureza_juridica: ['natureza jurídica', 'natureza juridica', 'legal nature'],
      porte: ['porte', 'company size', 'size'],
      logradouro: ['endereço - logradouro', 'logradouro', 'street', 'address'],
      numero: ['endereço - número', 'endereço - numero', 'numero', 'número', 'number'],
      complemento: ['endereço - complemento', 'complemento', 'complement'],
      bairro: ['endereço - bairro', 'bairro', 'neighborhood', 'district'],
      cidade: ['endereço - cidade', 'cidade', 'city'],
      uf: ['endereço - estado (uf)', 'endereço - estado', 'uf', 'state', 'estado'],
      cep: ['endereço - cep', 'cep', 'zip code', 'postal code'],
      emails: ['e-mail de contato', 'email', 'emails', 'e-mail', 'email address'],
      telefones: ['telefones', 'telefone', 'phone', 'phones', 'celular', 'fone'],
      website: ['website', 'site', 'url', 'homepage'],
      linkedin: ['linkedin', 'linkedin url', 'perfil linkedin'],
      instagram: ['instagram', 'instagram url', 'perfil instagram'],
      facebook: ['facebook', 'facebook url', 'perfil facebook'],
      data_tornou_cliente: ['cliente desde', 'data tornou cliente', 'customer since', 'client since'],
      origem_principal: ['como nos conheceu', 'origem', 'source', 'origin'],
      observacoes: ['observações', 'observacoes', 'notes', 'comments', 'remarks'],
      codigo_externo: ['id legal', 'id externo', 'external id', 'código externo'],
      tipo_empresa: ['tipo', 'tipo empresa', 'type', 'company type', 'categoria'],
      owner_email: ['responsável pela conta', 'owner email', 'dono', 'responsável'],
      nome_responsavel_legal: ['nome do responsável legal', 'responsável legal', 'legal representative'],
      email_responsavel_legal: ['email do responsável legal', 'email responsável legal'],
      whatsapp_responsavel_legal: ['whatsapp do responsável legal', 'whatsapp responsável legal', 'celular responsável legal'],
      nome_responsavel_financeiro: ['nome do responsável financeiro', 'responsável financeiro', 'financial contact'],
      email_responsavel_financeiro: ['email do responsável financeiro', 'email responsável financeiro'],
      whatsapp_responsavel_financeiro: ['whatsapp do responsável financeiro', 'whatsapp responsável financeiro', 'celular responsável financeiro'],
      regioes: ['regiões', 'microregiões', 'regions', 'território', 'territorios'],
      tags: ['tags', 'etiquetas', 'labels', 'categorias'],
    },
    contacts: {
      nome: ['nome', 'name', 'contact name', 'full name'],
      emails: ['email', 'emails', 'e-mail', 'email address'],
      telefones: ['telefone', 'telefones', 'phone', 'phones', 'celular'],
      cargo: ['cargo', 'position', 'job title', 'role'],
      account_id: ['account id', 'empresa id', 'company id'],
    },
    opportunities: {
      title: ['title', 'titulo', 'título', 'nome', 'opportunity name'],
      valor_previsto: ['valor', 'value', 'valor previsto', 'amount', 'deal value'],
      prob: ['probabilidade', 'prob', 'probability', 'chance'],
      account_id: ['account id', 'empresa id', 'company id'],
      contact_id: ['contact id', 'contato id'],
      produto: ['produto', 'product', 'service', 'serviço'],
      temperature: ['temperatura', 'temperature', 'heat', 'urgency'],
      close_date_prevista: ['close date', 'data fechamento', 'expected close'],
    },
    products: {
      name: ['nome', 'name', 'produto', 'product', 'descrição', 'description'],
      reference: ['codigo', 'código', 'code', 'sku', 'referencia', 'referência'],
      type: ['tipo', 'type'],
      price: ['preço', 'preco', 'price', 'valor'],
      cost: ['custo', 'cost'],
      unit: ['unidade', 'unit', 'un'],
      description: ['descrição', 'descricao', 'description', 'detalhes'],
      category_id: ['categoria', 'category'],
    },
    activities: {
      title: ['titulo', 'título', 'title', 'assunto', 'subject'],
      type: ['tipo', 'type'],
      description: ['descrição', 'descricao', 'description', 'detalhes', 'notes'],
      scheduled_date: ['data', 'date', 'data agendamento', 'scheduled date'],
      scheduled_time: ['hora', 'time', 'horario', 'horário'],
      duration_minutes: ['duração', 'duracao', 'duration', 'minutos'],
      status: ['status', 'estado'],
      account_cnpj: ['cnpj empresa', 'cnpj', 'company cnpj'],
      contact_email: ['email contato', 'contact email', 'email'],
      opportunity_title: ['oportunidade', 'opportunity', 'deal'],
    },
    proposals: {
      title: ['titulo', 'título', 'title', 'nome'],
      value: ['valor', 'value', 'amount'],
      client_name: ['cliente', 'client', 'client name', 'nome cliente'],
      client_email: ['email cliente', 'client email', 'email'],
      status: ['status', 'estado'],
      opportunity_title: ['oportunidade', 'opportunity', 'deal'],
      expires_at: ['validade', 'expira em', 'expires at', 'valid until'],
      introduction: ['introdução', 'introducao', 'introduction'],
      terms: ['termos', 'terms', 'condições', 'condicoes'],
    },
    loss_reasons: {
      name: ['nome', 'name', 'motivo', 'reason'],
      is_active: ['ativo', 'active', 'ativa'],
    },
    origins: {
      name: ['nome', 'name', 'origem', 'origin', 'source'],
      group_name: ['grupo', 'group', 'grupo origem'],
      is_active: ['ativo', 'active', 'ativa'],
    },
    territories: {
      name: ['nome', 'name', 'território', 'territorio', 'region', 'região', 'regiao'],
      type: ['tipo', 'type'],
    },
  };

  const entityFields = fieldMappings[entityType];

  fileHeaders.forEach((fileHeader) => {
    const normalizedFileHeader = fileHeader.toLowerCase().trim();

    for (const [crmField, variations] of Object.entries(entityFields)) {
      if (variations.some(v => normalizedFileHeader.includes(v))) {
        mapping[fileHeader] = crmField;
        break;
      }
    }
  });

  return mapping;
}

// Convert Excel serial date to YYYY-MM-DD format
function excelSerialToDate(serial: number): string | null {
  if (!serial || isNaN(serial) || typeof serial !== 'number') return null;
  // Excel serial: days since 01/01/1900 (with bug treating 1900 as leap year)
  const utcDays = Math.floor(serial - 25569); // Convert to Unix epoch
  const date = new Date(utcDays * 86400 * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse Brazilian date format DD/MM/YY or DD/MM/YYYY
function parseBrazilianDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const match = dateStr.toString().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  let [, day, month, year] = match;

  // Se ano tem 2 dígitos, converter para 4 (assume 19XX se >= 50, senão 20XX)
  if (year.length === 2) {
    const yearNum = parseInt(year);
    year = yearNum >= 50 ? `19${year}` : `20${year}`;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Broader date parsing to handle variations like DD-MM-YYYY or MM/DD/YYYY
function normalizeDate(value: any): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Allow different separators by normalizing to slash
    const normalized = trimmed.replace(/[.-]/g, '/');

    const brazilianDate = parseBrazilianDate(normalized);
    if (brazilianDate) return brazilianDate;

    // ISO-like formats (YYYY-MM-DD or YYYY/MM/DD)
    const isoLike = normalized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoLike) {
      const [, year, month, day] = isoLike;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Fallback to Date parsing when not ambiguous
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function normalizePhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  // Keep DDI/DDDs but ensure consistent formatting
  if (digits.length === 10) return `55${digits}`; // Add Brazil country code when missing DDI
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

// Parse telefones robustly - supports multiple formats
function parseTelefones(value: any): string[] {
  if (!value) return [];

  const toPhones = (items: any[]): string[] =>
    items
      .map(item => normalizePhoneNumber(typeof item === 'object' ? item.telefone : String(item)))
      .filter((phone): phone is string => Boolean(phone));

  // Already an array of strings
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
    return Array.from(new Set(toPhones(value)));
  }

  // String format
  if (typeof value === 'string') {
    try {
      // Try parsing as JSON first (PIPERUN format: [{"telefone":"11999999999"}])
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(toPhones(parsed)));
      }
    } catch {
      // Not JSON, try comma or semicolon-separated
      const separated = value.split(/[;,]/).map(t => t.trim()).filter(Boolean);
      return Array.from(new Set(toPhones(separated)));
    }
  }

  // Array of objects (already parsed JSON)
  if (Array.isArray(value)) {
    return Array.from(new Set(toPhones(value)));
  }

  return [];
}

// Parse emails robustly - supports multiple formats
function parseEmails(value: any): string[] {
  if (!value) return [];

  const isValidEmail = (email: string) => /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);
  const toEmails = (items: any[]): string[] =>
    items
      .map(item => (typeof item === 'object' ? item.email : String(item)).trim().toLowerCase())
      .filter(email => email && isValidEmail(email));

  // Already an array of strings
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
    return Array.from(new Set(toEmails(value)));
  }

  // String format
  if (typeof value === 'string') {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(toEmails(parsed)));
      }
    } catch {
      // Not JSON, try comma or semicolon-separated
      const separated = value.split(/[;,]/).map(e => e.trim());
      return Array.from(new Set(toEmails(separated)));
    }
  }

  // Array of objects (already parsed JSON)
  if (Array.isArray(value)) {
    return Array.from(new Set(toEmails(value)));
  }

  return [];
}

// Transform data according to mapping
export function transformData(rows: any[], columnMapping: ColumnMapping): any[] {
  // Date fields that need Excel serial conversion
  const dateFields = [
    'data_fundacao',
    'data_situacao_cadastral', 
    'data_tornou_cliente',
    'close_date_prevista',
    'scheduled_date',
    'expires_at',
    'start_date',
    'end_date'
  ];

  return rows.map(row => {
    const transformed: any = {};
    
    Object.entries(columnMapping).forEach(([fileColumn, crmField]) => {
      // Ignorar campos vazios ou inválidos
      if (!crmField || crmField === '') return;
      let value = row[fileColumn];

      // Handle special transformations
      if (crmField === 'telefones') {
        value = parseTelefones(value);
      } else if (crmField === 'emails') {
        value = parseEmails(value);
      }

      // Handle date fields - support Brazilian format DD/MM/YY and Excel serial
      if (dateFields.includes(crmField)) {
        value = normalizeDate(value);
      } else if (typeof value === 'number') {
        // Avoid supabase validation errors by converting numeric strings to text when not date fields
        value = value.toString();
      }

      if (value !== undefined && value !== null && value !== '') {
        transformed[crmField] = value;
      }
    });

    return transformed;
  });
}

// Validate import data via edge function
export async function validateImportData(
  entityType: EntityType,
  data: any[],
  columnMapping: ColumnMapping
): Promise<ValidationResult> {
  try {
    const { data: result, error } = await supabase.functions.invoke('validate-import-data', {
      body: {
        entity_type: entityType,
        data,
        column_mapping: columnMapping,
      },
    });

    if (error) {
      console.error('Validation error:', error);
      
      // Create import log with validation_failed status
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: orgId } = await supabase.rpc('get_user_organization_id');
        if (orgId) {
          await supabase.from('import_logs').insert({
            organization_id: orgId,
            user_id: userData.user.id,
            entity_type: entityType,
            file_name: 'validation_failed.csv',
            total_rows: data.length,
            status: 'validation_failed',
            error_details: [{ row: 0, message: 'Validação IA indisponível' }],
          });
        }
      }
      
      throw new Error('Falha ao validar dados');
    }

    return result as ValidationResult;
  } catch (error) {
    console.error('Validation exception:', error);
    throw error;
  }
}

export interface ImportProgress {
  current: number;
  total: number;
  successCount: number;
  errorCount: number;
  currentBatch: number;
  totalBatches: number;
}

// Execute import via edge function with batch processing
export async function executeImport(
  entityType: EntityType,
  data: any[],
  fileName: string,
  operationMode: OperationMode = 'insert',
  upsertSettings?: UpsertSettings,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const BATCH_SIZE = 100; // Tamanho seguro para edge function
  
  // Create import log
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('Organização não encontrada');
  }

  // Dividir dados em batches
  const batches: any[][] = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    batches.push(data.slice(i, i + BATCH_SIZE));
  }

  // Criar import log único
  const { data: importLog, error: logError } = await supabase
    .from('import_logs')
    .insert({
      organization_id: orgId,
      user_id: userData.user.id,
      entity_type: entityType,
      file_name: fileName,
      total_rows: data.length,
      status: 'processing',
      operation_mode: operationMode,
      upsert_settings: upsertSettings || {},
    })
    .select('id')
    .single();

  if (logError || !importLog) {
    throw new Error('Falha ao criar log de importação');
  }

  // Processar cada batch sequencialmente
  const aggregatedResult: ImportResult = {
    success: true,
    successCount: 0,
    errorCount: 0,
    warningCount: 0,
    updateCount: 0,
    errors: [],
    importedIds: [],
    importLogId: importLog.id,
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    try {
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);
      
      const { data: result, error } = await supabase.functions.invoke('execute-import', {
        body: {
          entity_type: entityType,
          data: batch,
          import_log_id: importLog.id,
          operation_mode: operationMode,
          upsert_settings: upsertSettings,
          batch_index: i,
          total_batches: batches.length,
        },
      });

      if (error) {
        console.error(`Batch ${i + 1} error:`, error);
        aggregatedResult.errorCount += batch.length;
        aggregatedResult.errors.push({
          row: i * BATCH_SIZE,
          message: `Erro no lote ${i + 1}/${batches.length}: ${error.message}`,
        });
      } else if (result) {
        // Agregar resultados
        aggregatedResult.successCount += result.successCount || 0;
        aggregatedResult.errorCount += result.errorCount || 0;
        aggregatedResult.warningCount += result.warningCount || 0;
        aggregatedResult.updateCount += result.updateCount || 0;
        aggregatedResult.errors.push(...(result.errors || []));
        aggregatedResult.importedIds.push(...(result.importedIds || []));
      }

      // Reportar progresso
      onProgress?.({
        current: Math.min((i + 1) * BATCH_SIZE, data.length),
        total: data.length,
        successCount: aggregatedResult.successCount,
        errorCount: aggregatedResult.errorCount,
        currentBatch: i + 1,
        totalBatches: batches.length,
      });

    } catch (batchError: any) {
      console.error(`Batch ${i + 1} exception:`, batchError);
      aggregatedResult.errorCount += batch.length;
      aggregatedResult.errors.push({
        row: i * BATCH_SIZE,
        message: `Erro no lote ${i + 1}/${batches.length}: ${batchError.message}`,
      });
    }
  }

  // Determinar sucesso geral
  aggregatedResult.success = aggregatedResult.errorCount === 0;

  // Atualizar log final
  await supabase.from('import_logs').update({
    status: aggregatedResult.errorCount === 0 ? 'completed' : 'failed',
    success_count: aggregatedResult.successCount,
    error_count: aggregatedResult.errorCount,
    warning_count: aggregatedResult.warningCount,
    update_count: aggregatedResult.updateCount,
    error_details: aggregatedResult.errors.slice(0, 100), // Limitar a 100 erros
    completed_at: new Date().toISOString(),
  }).eq('id', importLog.id);

  return aggregatedResult;
}

// Detect and create automatic relationships
export async function detectRelationships(
  entityType: EntityType,
  data: any[],
  relationshipHints: RelationshipHints = {},
  autoCreateMissing: boolean = false
): Promise<RelationshipResult> {
  const { data: result, error } = await supabase.functions.invoke('execute-auto-relationship', {
    body: {
      entity_type: entityType,
      data,
      relationship_hints: relationshipHints,
      auto_create_missing: autoCreateMissing,
    },
  });

  if (error) {
    console.error('Relationship detection error:', error);
    throw new Error('Falha ao detectar relacionamentos');
  }

  return result as RelationshipResult;
}

// Get import logs
export async function getImportLogs(limit: number = 10) {
  const { data, error } = await supabase
    .from('import_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch import logs:', error);
    throw error;
  }

  return data;
}

// Get import statistics by entity type
export async function getImportStats() {
  const { data, error } = await supabase
    .from('import_logs')
    .select('*')
    .eq('status', 'completed');

  if (error) {
    console.error('Failed to fetch import stats:', error);
    throw error;
  }

  return data;
}
