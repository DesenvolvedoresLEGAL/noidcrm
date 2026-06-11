
# KAI.12 — ICP Intelligence Engine + Sourcing Audit

Esta sprint substitui o ICP herdado do Roleplay por clusters reais da base de clientes, audita as fontes de sourcing do Kairós e desabilita as que não têm engine. Sem mudanças em RLS, edge functions financeiras ou regras de receita.

## 1. Eliminar dependência do Roleplay no Kairós

- `LeadSearchForm.tsx` hoje importa `listICPs` de `@/services/roleplay/icps`. Vamos:
  - Criar `src/services/intelligence/icpIntelligence.ts` com tipos próprios (`IntelligenceICP`).
  - Substituir o import em `LeadSearchForm.tsx` (única dependência detectada de roleplay no módulo).
- O Roleplay continua intocado — apenas o Kairós deixa de ler de lá.
- Tabela `icp_profiles` continua existindo (é compartilhada/legacy), mas o Kairós passa a consumir um motor derivado de `accounts` + `opportunities` + `proposals`.

## 2. ICP Intelligence Engine (read-only, client-side)

Novo hook `useIcpIntelligence()` calcula clusters em memória a partir das fontes oficiais (sem novas tabelas, sem edge functions, sem schema novo):

Fontes de verdade já existentes:
- `accounts` (tipo, segmento, cidade, estado)
- `opportunities` (ganhas via `commercial_won_revenue_view` — SSoT de receita)
- `proposals` (ticket, recorrência)
- `contracts` (LTV, recompra)

Métricas por cliente:
- receita líquida acumulada (`valid_revenue_amount`)
- nº de contratações ganhas
- ticket médio
- recompra (≥2 deals ganhos)
- segmento, cidade, estado
- produtos mais recorrentes

Clusterização determinística (sem IA):
- agrupa por `segmento` normalizado
- dentro de cada segmento aplica faixas de ticket (alta/média) e recompra
- gera clusters dinâmicos: `Premium`, `Standard`, `Recorrentes`, `One-shot`, etc.
- nada hardcoded — labels nascem dos dados (ex.: "Expositores Premium" se segmento dominante = Expositores e ticket no top-quartil)

Saída por cluster: `{ id, name, segment, count, avgTicket, totalRevenue, repurchaseRate, topCities, topProducts }`.

## 3. Novo dropdown ICP no LeadSearchForm

Substitui o Select atual:
- placeholder: "ICP Intelligence"
- cada item mostra nome + chips: `N clientes`, `Ticket R$X`, `Recompra Y%`
- ao selecionar, preenche automaticamente `inputPayload.segment`, `inputPayload.city/state` quando aplicável
- card lateral exibe drivers do cluster (segmento dominante, top cidades, produtos)

## 4. Tela `Kairós > ICP Intelligence`

Nova aba dentro de `KairosHub.tsx`:
- Tab adicional `🎯 ICP Intelligence` antes de `Sourcing`
- Componente `IcpIntelligencePanel`:
  - Ranking de clusters (tabela): receita, nº clientes, ticket médio, LTV, recompra %
  - Cards de distribuição: top segmentos, top cidades/UFs
  - Lista de produtos mais contratados por cluster
- Read-only, sem ações de escrita.

## 5. Auditoria das abas de sourcing

Investigar `supabase/functions/lead-sourcing/` e providers para classificar cada tipo (event/directory/geo/seed/import) como `functional | partial | stub`. Resultado consolidado em `src/components/playbook/SOURCING_AUDIT.md` (documento técnico).

Hoje, pela memória do projeto e pelo formulário:
- `event` → funcional (ExpoFP/Firecrawl, provider documentado)
- `directory`, `geo`, `seed` → sem engine confirmada
- `import` → funcional (lista colada)

## 6. Desabilitar fontes não funcionais na UI

No `LeadSearchForm.tsx`:
- Cada item de `SEARCH_TYPES` ganha `status: 'live' | 'wip'`
- Botões `wip` ficam desabilitados, com badge "Em desenvolvimento" e tooltip "Esta fonte de sourcing ainda não possui engine operacional."
- Apenas `event` e `import` ficam ativos por padrão (ajustável após a auditoria do passo 5).

## 7. Matching com base de clientes

Reaproveitar a edge function `kairos-match-company` (já existente, documentada na memória — CNPJ→domínio→nome). Garantir que:
- `LeadResultsTable` exibe o `RelationshipBadge` já existente (🟢 Cliente / 🟡 Conta / 🟠 Oportunidade / ⚪ Novo)
- Verificar se o badge está sendo renderizado em todas as views de prospect (Sourcing results + Drawer)
- Bloquear importação de prospect quando `relationship_status = 'customer'` (já documentado, validar)

## Arquivos impactados

Criados:
- `src/services/intelligence/icpIntelligence.ts`
- `src/hooks/intelligence/useIcpIntelligence.ts`
- `src/components/intelligence/icp/IcpIntelligencePanel.tsx`
- `src/components/intelligence/icp/IcpClusterCard.tsx`
- `src/components/playbook/SOURCING_AUDIT.md`

Editados:
- `src/components/playbook/LeadSearchForm.tsx` (drop roleplay, novo dropdown, desabilitar wip)
- `src/pages/intelligence/KairosHub.tsx` (nova tab + tab order)
- `src/components/playbook/LeadResultsTable.tsx` (garantir badge — somente se faltar)

## Riscos

- Cálculo client-side de clusters pode ficar lento para bases >5k accounts; mitigar com `useMemo` + limite de 2000 contas por query (configurable).
- Roleplay continua usando `icp_profiles` — não tocar nessa tabela.
- Nenhuma alteração de RLS, schema, edge function financeira ou regra de receita.

## Próximos passos (fora do escopo desta sprint)
- Persistir clusters em `icp_intelligence_snapshots` para histórico.
- Implementar engines reais para directory/geo/seed.
- Job noturno recalculando clusters.
