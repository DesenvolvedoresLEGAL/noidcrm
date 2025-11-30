/**
 * Biblioteca de utilitários para manipulação de datas
 * Resolve problemas de timezone ao lidar com campos DATE (sem hora)
 */

/**
 * Converte string YYYY-MM-DD para Date no timezone local
 * Evita interpretação como UTC que causa mudança de dia
 */
export function parseDateOnly(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Se já é uma string YYYY-MM-DD, parsear como data local
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Se tem timestamp completo, usar Date normal
  return new Date(dateString);
}

/**
 * Formata data para exibição em pt-BR (DD/MM/YYYY)
 * Usa timezone local para evitar mudança de dia
 */
export function formatDateBR(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  
  try {
    let date: Date;
    
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // String YYYY-MM-DD - parsear como data local
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      // Timestamp completo ou Date object
      date = new Date(dateString);
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateString);
  }
}

/**
 * Formata data e hora para exibição em pt-BR (DD/MM/YYYY às HH:mm)
 */
export function formatDateTimeBR(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    const dateFormatted = formatDateBR(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${dateFormatted} às ${hours}:${minutes}`;
  } catch {
    return String(dateString);
  }
}

/**
 * Converte Date para formato YYYY-MM-DD para inputs type="date"
 * Usa timezone local para evitar mudança de dia
 */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Converte data para string ISO (YYYY-MM-DD) preservando o dia selecionado
 * Não faz conversão UTC, mantém a data local
 */
export function toISODateString(date: Date | string): string {
  if (!date) return '';
  
  try {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Já está no formato correto
      return date;
    }
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}
