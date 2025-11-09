/**
 * Utilitário para logging centralizado do fluxo de autenticação
 * Facilita debug e troubleshooting de problemas de login
 */

export const authLogger = {
  /**
   * Log de sucesso com emoji verde
   */
  success: (context: string, data?: any) => {
    console.log(`✅ [Auth] ${context}`, data || '');
  },

  /**
   * Log de erro com emoji vermelho
   */
  error: (context: string, error?: any) => {
    console.error(`❌ [Auth] ${context}`, error || '');
  },

  /**
   * Log de aviso com emoji amarelo
   */
  warn: (context: string, data?: any) => {
    console.warn(`⚠️ [Auth] ${context}`, data || '');
  },

  /**
   * Log informativo com emoji azul
   */
  info: (context: string, data?: any) => {
    console.info(`ℹ️ [Auth] ${context}`, data || '');
  },

  /**
   * Log de redirecionamento com emoji de seta
   */
  redirect: (from: string, to: string, reason?: string) => {
    console.log(`➡️ [Auth] Redirecionando: ${from} → ${to}`, reason ? `(${reason})` : '');
  },

  /**
   * Log de loading com emoji de relógio
   */
  loading: (context: string) => {
    console.log(`⏳ [Auth] Loading: ${context}`);
  },

  /**
   * Log de fluxo completo para troubleshooting
   */
  flowLog: (step: string, data: Record<string, any>) => {
    console.group(`🔍 [Auth Flow] ${step}`);
    Object.entries(data).forEach(([key, value]) => {
      console.log(`  ${key}:`, value);
    });
    console.groupEnd();
  },

  /**
   * Log de performance/timing
   */
  timing: (label: string, startTime: number) => {
    const duration = Date.now() - startTime;
    console.log(`⏱️ [Auth] ${label}: ${duration}ms`);
  },
};
