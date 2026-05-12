import { describe, expect, it, vi } from 'vitest';
import { getLoginErrorDescription, isNetworkAuthError, logAuthLoginError } from './authDiagnostics';

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
});
