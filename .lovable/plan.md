# Sprint NOID-INV-CONNECT 0.1 — Reposicionar Inventário como Consulta Eventrix

## Objetivo
Tirar o Inventário da posição de módulo operacional do NOID e reposicioná-lo como camada de consulta/configuração comercial dentro de **Configurações > Propostas > Inventário Eventrix**. Nenhuma integração real, nenhuma exclusão de dados, nenhuma alteração destrutiva.

---

## 1. Investigação prévia (antes de codar)

Preciso mapear com precisão para não quebrar nada:

- `src/components/Layout.tsx` / sidebar → onde está o item **Operações > Inventário**
- `src/App.tsx` / router → rota `/app/operations/inventory`
- `src/pages/operations/Inventory.tsx` → página atual (já vista)
- Estrutura de **Configurações > Propostas** (procurar `settings/proposals` em `src/pages`)
- Produto: bloco **Composição técnica (BOM)** — procurar `BOM` / `product-bom` no código
- `src/hooks/usePermissions.ts` → roles disponíveis (`operations`, `commercial_manager`, etc.)

Ferramentas: `rg` em paralelo antes de qualquer edit.

## 2. Remoção do menu (não-destrutiva)

- Remover/comentar o item **Operações > Inventário** do menu lateral.
- Manter os arquivos de página e componentes existentes intactos (podem servir de fallback futuro).

## 3. Rota antiga `/app/operations/inventory`

- Substituir o componente da rota por um `<Navigate>` (redirect) para a nova rota de Configurações > Propostas > Inventário Eventrix.
- Manter os componentes internos (`InventoryItemsTab`, `InventoryCategoriesTab`, etc.) no repo mas não renderizados.

## 4. Nova página `Inventário conectado ao Eventrix`

Local: dentro do padrão atual de **Configurações > Propostas** (aba nova ou sub-rota; decidir após investigar a estrutura existente).

Rota alvo: `/app/settings/proposals/eventrix-inventory` (ou aba `?tab=eventrix-inventory`, o que casar com o padrão).

Conteúdo (todos read-only, sem chamadas de rede):

1. **Header** — Título "Inventário conectado ao Eventrix", subtítulo explicativo, badge "Eventrix master".
2. **Status da integração** — Card "Aguardando conexão com Eventrix", badge "Em preparação".
3. **Responsabilidades dos sistemas** — Tabela Eventrix / NOID CRM / ERP.
4. **Dados consumidos do Eventrix** — Cards: Categorias, Famílias, Disponibilidade, Ocupação, Alertas comerciais (com badges "Futuro sync" / "Futura API").
5. **Composição de Inventário dos Produtos** — Explicação + tabela exemplo (LEGAL Core Indoor etc.).
6. **Fator de demanda por ocupação** — Tabela de faixas (<50%, 50-75%, 76-90%, >90%).
7. **Fluxo futuro na proposta** — Lista numerada 1-6.
8. **Endpoints planejados** — Lista com badge "Planejado" em cada.

Componentização: uma página `EventrixInventorySettings.tsx` com sub-componentes/cards internos. Usar `SettingCard`, `PageContainer`, `PageHeader` já existentes.

## 5. Permissões

Reutilizar `SettingsGate` ou `usePermissions` seguindo padrão de Configurações > Propostas:
- **Full**: owner, admin, operations
- **Read-only** (se o padrão de Configurações > Propostas já permitir): commercial_manager, sales_manager
- **Bloqueado**: seller, sdr, viewer, finance

## 6. Renomear BOM → "Composição de Inventário"

- Procurar componentes/telas de produto que renderizam "Composição técnica (BOM)" ou "BOM".
- Trocar labels visíveis por **Composição de Inventário**.
- Atualizar subtexto conforme o brief.
- Substituir texto "Reserva total = pontos x quantidade aqui" (se existir) pelo novo texto.
- Manter nomes técnicos internos (`product_bom_items`, `product-bom.ts`) — nenhuma mudança de schema.
- Badge auxiliar "Fonte futura: Eventrix" nos selects de categoria/família se aplicável.

## 7. NÃO fazer

- Nenhuma migração SQL.
- Nenhuma edge function.
- Nenhum drop de tabela ou dado.
- Nenhuma chamada de API externa.
- Nenhuma alteração em Dashboard, Pipeline, Propostas, tabela dinâmica.

## 8. Verificação

- Confirmar que sidebar não mostra mais Operações > Inventário.
- Navegar `/app/operations/inventory` → redireciona para nova área.
- Nova área carrega sem erros de rede.
- Produto abre e salva normalmente; rótulo BOM sumiu do título principal.
- `tsgo` limpo.

## Riscos

- **Baixo**: mudanças são só de UI/rotas/labels; não toca banco.
- **Atenção**: preciso confirmar o padrão de Configurações > Propostas antes de escolher entre "aba" vs "sub-rota" para não destoar do resto do app.

## Arquivos que provavelmente serão tocados

- Sidebar/menu do Layout (1 arquivo)
- `src/App.tsx` (rota antiga vira redirect)
- Nova página `src/pages/settings/proposals/EventrixInventorySettings.tsx` + sub-componentes
- Página/rota de Configurações > Propostas (adicionar entrada de navegação)
- Componentes de Produto (renomear BOM → Composição de Inventário)

Nenhum dos arquivos de `src/pages/operations/Inventory.tsx`, `InventoryItemsTab.tsx` etc. será apagado.
