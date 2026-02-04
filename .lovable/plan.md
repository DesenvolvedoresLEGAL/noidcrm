
Contexto do erro (confirmado por logs)
- A exportação está falhando com HTTP 403 porque a Edge Function está tratando o chamador como “não Platform Admin”.
- O motivo real não é permissão do usuário: é um erro na chamada do RPC `is_platform_admin_for_rls`:
  - A função está sendo chamada com o parâmetro `{ p_user_id: callerId }`
  - Mas o backend indica que a assinatura esperada é `is_platform_admin_for_rls(user_id)` (log: PGRST202 “Perhaps you meant to call … (user_id)”).
- Resultado: `adminError` vem preenchido, `isAdmin` vira `null` e a função retorna 403.

Objetivo
- Corrigir urgentemente a validação de Platform Admin na Edge Function `export-forensic-user-logs` para que a exportação volte a funcionar no painel Admin.

Plano de correção (passo a passo)

1) Ajustar a chamada do RPC de Platform Admin
- Arquivo: `supabase/functions/export-forensic-user-logs/index.ts`
- Alterar:
  - De: `supabase.rpc('is_platform_admin_for_rls', { p_user_id: callerId })`
  - Para: `supabase.rpc('is_platform_admin_for_rls', { user_id: callerId })`
- Motivo: o backend está explicitamente dizendo que o parâmetro correto é `user_id`.

2) Melhorar o tratamento de erro para evitar “403 enganoso”
- Hoje qualquer `adminError` cai em “Forbidden”.
- Ajuste proposto:
  - Se `adminError` existir e o código for PGRST202 (função/assinatura não encontrada), retornar 500 com mensagem clara (“Admin check misconfigured”) em vez de 403.
  - Se `adminError` não existir e `isAdmin` for falso, aí sim retornar 403.
- Benefício: se houver qualquer divergência futura na assinatura do RPC, o erro fica diagnosticável imediatamente.

3) (Opcional, mas recomendado) Fallback de compatibilidade
- Para evitar que uma mudança de assinatura volte a quebrar exportações:
  - Tentar primeiro `{ user_id: callerId }`
  - Se retornar PGRST202, tentar `{ p_user_id: callerId }` como fallback (somente nesse caso)
- Observação: isso reduz risco operacional, mas mantém a checagem centralizada no mesmo RPC.

4) Revalidar autenticação do chamador (manter como está)
- Manter `userClient.auth.getUser()` com `Authorization` header para obter `callerId`.
- Isso está correto e mais compatível do que depender de métodos inconsistentes de “claims”.

5) Testes rápidos (para fechar a urgência)
- Teste A (via UI):
  - Acessar Admin → Exportação Forense
  - Selecionar um usuário (ex.: jessica@operadora.legal)
  - Período: 01/01/2026 a 31/01/2026
  - Clicar em “Exportar Excel Forense”
  - Esperado: download do .xlsx e contagem coerente no RESUMO.
- Teste B (via chamada direta):
  - Fazer uma chamada autenticada à função com body `{ user_email, date_start, date_end }`
  - Esperado: HTTP 200, `success: true`, `metadata.integrity_hash_sha256` preenchido.
- Teste C (permissão):
  - Logar com um usuário que NÃO é Platform Admin e repetir exportação
  - Esperado: HTTP 403 “Platform Admin access required”.

6) Verificação de logs para evidência de correção
- Confirmar que não aparece mais:
  - `PGRST202 ... is_platform_admin_for_rls(p_user_id)`
- Confirmar que aparece:
  - `Platform admin check: { isAdmin: true, adminError: null }` para Platform Admin real.

Risco e mitigação
- Risco: o RPC pode ter outra assinatura em algum ambiente.
- Mitigação: fallback (passo 3) + erro 500 explícito quando for misconfiguração (passo 2).

Resultado esperado
- Exportação forense volta a funcionar imediatamente no painel Admin, com checagem de Platform Admin correta e mensagens de erro diagnósticas quando houver misconfiguração.
