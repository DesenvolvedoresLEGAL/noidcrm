import { describe, expect, it, vi } from 'vitest';
import {
  getLastAuthAuditWarning,
  getLoginErrorDescription,
  isNetworkAuthError,
  logAuthAuditBestEffortFailed,
  logAuthLoginError,
  safeMaskUserId,
} from './authDiagnostics';

describe('authDiagnostics', () => {
  it('classifica falhas de rede/CORS/522 sem expor credenciais', () => {
    expect(isNetworkAuthError({ name: 'TypeError', message: 'Failed to fetch' })).toBe(true);
    expect(isNetworkAuthError({ status: 522, message: 'Connection timed out' })).toBe(true);
    expect(getLoginErrorDescription({ message: 'Failed to fetch' })).toBe(
      'Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes ou acione o suporte.'
    );
  });

  it('mantém erro inválido como credencial controlada', () => {
    expect(getLoginErrorDescription({ message: 'Invalid login credentials' })).toBe(
      'Email ou senha incorretos.'
    );
  });

  it('loga apenas metadados seguros do erro de login', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logAuthLoginError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 });
    expect(spy).toHaveBeenCalledWith('[AUTH_LOGIN_ERROR]', {
      name: 'AuthRetryableFetchError',
      message: 'Failed to fetch',
      status: 0,
    });
    spy.mockRestore();
  });

  it('persiste warning de auth audit best effort para /status/auth', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.clear();

    logAuthAuditBestEffortFailed({
      status: 522,
      message: 'Unexpected HTML response',
      isHtmlResponse: true,
    });

    const warning = getLastAuthAuditWarning();
    expect(warning?.status).toBe(522);
    expect(warning?.isHtmlResponse).toBe(true);
    expect(warning?.message).toContain('HTML');
    warnSpy.mockRestore();
  });

  it('mascara userId em logs sensíveis', () => {
    expect(safeMaskUserId('12345678-90ab-cdef-1234-567890abcdef')).toContain('***');
    expect(safeMaskUserId('')).toBe('unknown');
  });
});
