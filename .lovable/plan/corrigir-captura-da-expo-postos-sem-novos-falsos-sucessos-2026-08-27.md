# Corrigir captura da Expo Postos sem novos falsos sucessos

## Diagnóstico confirmado

A execução de **27/08/2026 às 16:07 (BRT)** chamou o provider dedicado, mas a API oficial respondeu **HTTP 403 dentro da função Cloud**. O fluxo então caiu no provider genérico `logo-wall`, persistiu os 49 cards iniciais e marcou a execução como concluída. Fora do runtime Cloud, a mesma API responde com **210 registros em 5 páginas**.

## Implementação

1. **Tornar o provider Expo Postos resiliente ao bloqueio do runtime**
   - Manter a chamada direta como primeira tentativa.
   - Em 403/429/5xx ou falha de rede, buscar cada página da API por proxy já disponível no projeto, preservando a paginação `next`.
   - Aplicar timeout, retries limitados, deduplicação e logs com método usado, páginas e total recebido.

2. **Impedir falso sucesso com 49 registros**
   - Quando o domínio Expo Postos for detectado, não permitir fallback silencioso para `logo-wall`.
   - Validar completude contra o campo `count` da API; só aceitar a execução quando todas as páginas forem obtidas e o total deduplicado for consistente.
   - Se os dois meios falharem, encerrar como erro claro e não persistir uma lista truncada como “Concluída”.

3. **Validar antes de gastar outra busca do usuário**
   - Testar o provider isoladamente e confirmar **210 registros / 5 páginas**.
   - Publicar a função e executar um teste direto no ambiente Cloud, verificando logs e payload antes de pedir nova busca pela interface.
   - Só então executar uma busca controlada e confirmar no banco/UI que o run usa `provider=expopostos`, não `logo-wall`, e persiste o conjunto completo.

## Arquivos impactados

- `supabase/functions/lead-sourcing/providers/expopostos.ts`
- `supabase/functions/lead-sourcing/index.ts`
- Teste focado do provider, seguindo o padrão existente do projeto

## Critérios de aceite

- A captura retorna **210 marcas em 5 páginas** no ambiente Cloud.
- Nenhuma execução Expo Postos pode concluir com os 49 cards do HTML inicial.
- Os logs registram provider, estratégia de acesso, páginas, total anunciado e total persistido.
- Falha de completude gera erro explícito, sem consumir IA e sem salvar resultado parcial como sucesso.
