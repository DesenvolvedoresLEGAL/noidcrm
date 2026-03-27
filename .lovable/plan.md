
## Correção imediata: proposta pública retornando “Proposta não encontrada”

### Causa raiz confirmada
O lookup público hoje usa apenas:

```ts
.eq('public_token', token)
```

em `getProposalByToken()`.

Isso falha quando o cliente abre um link/token em formato hash/legado diferente do valor salvo no banco. Como resultado, a query volta `null` mesmo para proposta válida, com status aberto e dentro da validade, e a tela mostra “Proposta não encontrada”.

### O que vou corrigir
1. **Tornar a busca pública tolerante a token bruto e token hash**
   - Em `src/services/supabase/proposals.ts`, criar um helper para montar os candidatos do token:
     - usar o token recebido
     - se ele não estiver no formato esperado, gerar também o SHA-256 correspondente
     - se ele já for hex de 64 chars, consultar de forma compatível sem assumir que é inválido
   - Trocar a busca atual por uma busca com `or(...)` para aceitar ambos.

2. **Manter a regra de acesso segura**
   - A busca continuará retornando apenas propostas:
     - com `public_token`
     - em status público permitido
     - **não expiradas**
   - Ou seja: corrigir o bug sem abrir propostas vencidas ou inválidas.

3. **Aplicar a mesma lógica nos pontos públicos relacionados**
   - Ajustar também o fluxo de:
     - visualização OG/social em `supabase/functions/og-proposal-meta/index.ts`
     - qualquer lookup público adicional baseado em token, para evitar inconsistência entre abrir no navegador, WhatsApp/e-mail e preview social

4. **Evitar regressão na tela pública**
   - Preservar `maybeSingle()` no fetch público
   - Não quebrar a renderização mesmo quando relações opcionais vierem nulas
   - Garantir que propostas abertas e válidas carreguem normalmente

### Arquivos impactados
- `src/services/supabase/proposals.ts`
- `supabase/functions/og-proposal-meta/index.ts`

### Detalhes técnicos
- Criar helper centralizado, por exemplo:
  - `buildPublicTokenCandidates(token)`
  - ou `resolvePublicProposalToken(token)`
- Substituir:
  ```ts
  .eq('public_token', token)
  ```
  por algo no formato:
  ```ts
  .or(`public_token.eq.${token},public_token.eq.${tokenHash}`)
  ```
- Manter filtros de validade/status junto da query pública
- Reusar a mesma estratégia no endpoint OG para que o link compartilhado e a página pública resolvam o mesmo token

### Validação após a correção
1. Abrir uma proposta pública válida em `/p/:token`
2. Validar que proposta `sent/viewed` dentro da validade abre normalmente
3. Confirmar que proposta expirada continua bloqueada
4. Confirmar que link vindo de compartilhamento/e-mail/WhatsApp também abre
5. Testar o fluxo fim a fim para garantir que cliente consegue visualizar a proposta sem erro
