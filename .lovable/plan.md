

# Corrigir CORS do Módulo Roleplay

## Problema
O módulo Roleplay está inacessível porque a edge function `ai-simulate-client` rejeita requisições CORS. O Supabase JS SDK envia headers extras (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`) que não estão na lista `Access-Control-Allow-Headers` da function, causando bloqueio no preflight.

## Solução
Atualizar os CORS headers nas edge functions do roleplay para incluir todos os headers enviados pelo SDK.

### Arquivos a alterar

**1. `supabase/functions/ai-simulate-client/index.ts`** — Atualizar `corsHeaders`:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

**2. `supabase/functions/ai-generate-client/index.ts`** — Mesma atualização de CORS headers (usado na criação de sessões).

**3. `supabase/functions/ai-evaluate-session/index.ts`** — Mesma atualização (usado na avaliação pós-sessão).

### Resultado
As 3 edge functions do roleplay passarão a aceitar as requisições do SDK sem bloqueio CORS, restaurando o módulo para todos os usuários.

