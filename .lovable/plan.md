
Objetivo

- Corrigir a conexão do Gmail para que o OAuth finalize de verdade e o usuário não volte silenciosamente para a tela inicial.

Diagnóstico encontrado

- O começo do fluxo está funcionando: `generate-oauth-state` está gerando o estado corretamente.
- A falha acontece no callback `gmail-oauth-callback`, na etapa de trocar o `code` do Google pelos tokens.
- Os logs mostram o erro real: `invalid_client` / `The provided client secret is invalid`.
- Por isso, depois do consentimento no Google, o sistema redireciona de volta para a tela de integrações com `status=error`, mas a interface não mostra esse erro. Para o usuário, parece apenas que “voltou para refazer o processo”.

Plano

1. Corrigir a credencial OAuth do Google
- Atualizar a credencial privada do Google para combinar com o client ID já configurado.
- Confirmar que a redirect URI usada no código continua autorizada no cliente OAuth do Google.

2. Melhorar o retorno do fluxo na interface
- Fazer a tela de Integrações e o card do Gmail lerem os parâmetros `sync`, `status` e `message` da URL.
- Exibir mensagens claras de sucesso e erro, em vez de simplesmente mostrar novamente o botão “Conectar Gmail”.

3. Ajustar o redirecionamento pós-callback
- Preservar de onde o usuário iniciou a conexão e devolver para o lugar certo após o callback.
- Se a conexão foi iniciada pela aba de E-mails do perfil, voltar para essa aba; se foi iniciada por Integrações, voltar para Integrações.

4. Atualizar o estado visual após sucesso
- Recarregar automaticamente `email_sync_config` ao retornar do Google.
- Mostrar imediatamente o e-mail conectado, status “Conectado” e ações disponíveis sem exigir refresh manual.

5. Validar ponta a ponta
- Testar: iniciar conexão, passar pelo Google, concluir callback, salvar em `email_sync_config`, voltar para a tela correta e exibir o Gmail conectado.

Detalhes técnicos

- Arquivos principais:
  - `supabase/functions/gmail-oauth-callback/index.ts`
  - `supabase/functions/generate-oauth-state/index.ts`
  - `src/services/crm/sync.ts`
  - `src/components/settings/GmailSyncSettings.tsx`
  - `src/components/settings/EmailSyncCard.tsx`
  - `src/pages/settings/Integrations.tsx`
- O aviso “Google não verificou este app” não é o bloqueio principal neste caso. Pelos logs, o bloqueio atual é a credencial privada inválida no callback.
