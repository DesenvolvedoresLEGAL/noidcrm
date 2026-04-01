

# Correção Completa do Módulo Roleplay

## Problemas Encontrados

### 1. Erro Principal (400 no meio da conversa)
Os logs confirmam: **"Seller message too long (max 2000 chars)"**. O limite de 2000 caracteres no `ai-simulate-client` é restritivo demais para mensagens longas que vendedores podem escrever (apresentações, propostas detalhadas, etc.). Aumentar para 5000 chars resolve sem risco.

### 2. CORS quebrado em 4 Edge Functions do pipeline de finalização
As seguintes functions ainda usam CORS **antigos** (sem os headers do SDK), o que pode causar falha no fluxo de encerramento/avaliação:
- `ai-generate-insights` — linha 11: falta `x-supabase-client-platform*`
- `ai-recommend-videos` — linha 12: falta `x-supabase-client-platform*`
- `gamification-engine` — linha 6: falta `x-supabase-client-platform*`
- `missions-engine` — linha 6: falta `x-supabase-client-platform*`

Essas 4 functions são chamadas em sequência no `endMutation` do ChatView (linhas 449, 461, 472, 487). Se qualquer uma falhar por CORS, o fluxo completo de finalização quebra.

## Alterações

### Arquivo 1: `supabase/functions/ai-simulate-client/index.ts`
- Aumentar limite de `sellerMessage` de **2000** para **5000** caracteres (linha 27)

### Arquivo 2: `supabase/functions/ai-generate-insights/index.ts`
- Atualizar `corsHeaders` (linha 11) para incluir headers completos do SDK

### Arquivo 3: `supabase/functions/ai-recommend-videos/index.ts`
- Atualizar `corsHeaders` (linha 12) para incluir headers completos do SDK

### Arquivo 4: `supabase/functions/gamification-engine/index.ts`
- Atualizar `corsHeaders` (linha 6) para incluir headers completos do SDK

### Arquivo 5: `supabase/functions/missions-engine/index.ts`
- Atualizar `corsHeaders` (linha 6) para incluir headers completos do SDK

### Deploy
Redeployar as 5 functions após as alterações.

## Resultado
- Vendedores podem enviar mensagens mais longas sem erro 400
- Fluxo completo de finalização (avaliação → insights → vídeos → gamificação → missões) funciona sem bloqueio CORS
- Todo o pipeline do roleplay fica consistente

