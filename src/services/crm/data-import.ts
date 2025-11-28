import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export type EntityType = 'accounts' | 'contacts' | 'opportunities';
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
      segmento: ['segmento', 'segment', 'setor', 'sector', 'industry'],
      tamanho: ['tamanho', 'size', 'porte'],
      cnae: ['cnae', 'activity code'],
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

// Transform data according to mapping
export function transformData(rows: any[], columnMapping: ColumnMapping): any[] {
  return rows.map(row => {
    const transformed: any = {};

    Object.entries(columnMapping).forEach(([fileColumn, crmField]) => {
      let value = row[fileColumn];

      // Handle special transformations
      if (crmField === 'emails' || crmField === 'telefones') {
        // Convert to array if single value
        if (value && !Array.isArray(value)) {
          value = [value];
        }
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
  const { data: result, error } = await supabase.functions.invoke('validate-import-data', {
    body: {
      entity_type: entityType,
      data,
      column_mapping: columnMapping,
    },
  });

  if (error) {
    console.error('Validation error:', error);
    throw new Error('Falha ao validar dados');
  }

  return result as ValidationResult;
}

// Execute import via edge function
export async function executeImport(
  entityType: EntityType,
  data: any[],
  fileName: string,
  operationMode: OperationMode = 'insert',
  upsertSettings?: UpsertSettings
): Promise<ImportResult> {
  // Create import log
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Usuário não autenticado');
  }

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('Organização não encontrada');
  }

  const { data: importLog, error: logError } = await supabase
    .from('import_logs')
    .insert({
      organization_id: orgId,
      user_id: userData.user.id,
      entity_type: entityType,
      file_name: fileName,
      total_rows: data.length,
      status: 'pending',
      operation_mode: operationMode,
      upsert_settings: upsertSettings || {},
    })
    .select('id')
    .single();

  if (logError || !importLog) {
    throw new Error('Falha ao criar log de importação');
  }

  // Execute import
  const { data: result, error } = await supabase.functions.invoke('execute-import', {
    body: {
      entity_type: entityType,
      data,
      import_log_id: importLog.id,
      operation_mode: operationMode,
      upsert_settings: upsertSettings,
    },
  });

  if (error) {
    console.error('Import execution error:', error);
    throw new Error('Falha ao executar importação');
  }

  return { ...result, importLogId: importLog.id } as ImportResult;
}

// Detect and create automatic relationships
export async function detectRelationships(
  entityType: EntityType,
  data: any[],
  relationshipHints: RelationshipHints = {}
): Promise<RelationshipResult> {
  const { data: result, error } = await supabase.functions.invoke('execute-auto-relationship', {
    body: {
      entity_type: entityType,
      data,
      relationship_hints: relationshipHints,
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
