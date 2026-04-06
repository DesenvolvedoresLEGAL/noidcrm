
Correção imediata proposta:

1. Confirmar a causa real do 401
- O código do `api-deals` continua exigindo `X-API-Key` válido via hash SHA-256 na tabela `api_keys`.
- O `verify_jwt = false` já está correto no `config.toml`, então o 401 agora não vem mais do gateway.
- Isso indica que o problema mais provável é a chave usada pelo ERP estar inválida, revogada, expirada, ou não corresponder ao hash salvo no CRM.

2. Aplicar correção no fluxo de leitura do ERP
- Auditar e ajustar `supabase/functions/api-deals/index.ts` para:
  - logar com segurança o motivo exato do 401 (`missing header`, `invalid key`, `inactive`, `expired`);
  - aceitar também variações de header usadas por integrações externas, se necessário (`X-API-Key` / `x-api-key`);
  - manter o filtro de negócios ganhos mapeando `status=won` para propostas `accepted`.

3. Aplicar correção no fluxo de envio automático
- Revisar `supabase/functions/notify-deal-won/index.ts` porque o envio automático usa `UMMA_ERP_API_KEY`, enquanto o erro citado menciona `NOID_CRM_API_KEY`.
- Isso sugere desalinhamento entre:
  - chave que o ERP usa para consultar o CRM;
  - chave que o CRM usa para enviar ao ERP.
- Vou alinhar os nomes/uso dos secrets e documentar claramente qual chave autentica cada lado.

4. Corrigir o ponto mais provável de quebra operacional
- Ajustar a gestão de API keys para o ERP:
  - revisar `api-keys-manage` + tela `ApiKeysSettings`;
  - garantir que exista uma chave ativa específica para o ERP;
  - conferir se scopes vazios realmente liberam leitura de deals;
  - se necessário, adicionar scopes explícitos para `deals:read`.

5. Adicionar diagnóstico visível para evitar novo apagão
- Melhorar logs nas funções:
  - `api-deals`
  - `notify-deal-won`
- Objetivo: quando falhar novamente, saber imediatamente se foi:
  - chave ausente
  - chave inválida
  - chave expirada
  - organização sem propostas aceitas
  - erro no ERP externo

6. Validação final
- Testar os dois fluxos afetados:
  - busca de oportunidades ganhas (`status=won` e `status=accepted` se o ERP tentar ambos)
  - envio automático da proposta aprovada
- Confirmar especificamente o caso da Adaptive.

Detalhes técnicos
- Arquivos principais:
  - `supabase/functions/api-deals/index.ts`
  - `supabase/functions/notify-deal-won/index.ts`
  - `supabase/functions/api-keys-manage/index.ts`
  - `src/pages/settings/ApiKeysSettings.tsx`
- Hipótese principal:
  - o hardening não quebrou o mapeamento de “won”;
  - ele expôs uma dependência operacional: a API key do ERP usada contra `api-deals` não está mais válida no modelo novo com hash+active+expires_at.
- Sinal forte disso:
  - `api-deals` hoje só retorna 401 por autenticação de API key;
  - o filtro de `accepted` para `won` permanece implementado no código.
