# Auth/Login Checklist (produção)

1. Login válido em `/Entrar` com usuário ativo deve redirecionar para `/app/dashboard`.
2. Login inválido deve retornar erro de credencial (`Invalid login credentials`) e **não** erro de rede.
3. Após login válido, atualizar a página (`refresh`) deve manter sessão autenticada.
4. Console deve ficar limpo de `AuthRetryableFetchError`, `ERR_FAILED 522`, `CORS policy blocked`, `Failed to fetch` durante fluxo normal.
5. Verificar rota técnica `/status/auth`:
   - `Supabase URL` preenchida.
   - `hasAnonKey` true.
   - `auth health` e `rest health` com status HTTP válido.
6. Em falha transitória de rede, não deve ocorrer `signOut` automático do usuário autenticado.
