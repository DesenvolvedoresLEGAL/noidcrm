# Inventory Provider Settings UI — v1

Sprint: `NOID-VERTICAL-1.0-VERT-01.2C`
Data: 2026-07-22
Escopo: UI administrativa canônica de Provider de Inventário. Sem migration, sem alteração de banco, sem publish.

## 1. Contexto

VERT-01.2B entregou a fonte canônica (`inventory_provider_settings`) com RLS tenant-aware e resolver com precedência canonical → legacy → native. Porém, a experiência administrativa ainda expunha "Inventário Eventrix" como se fosse o único modelo possível. Esta sprint entrega a rota e a página canônicas.

## 2. Rota canônica

- Nova rota: `/app/settings/inventory-provider`
- Página: `src/pages/settings/InventoryProviderSettingsPage.tsx`
- Rota legada `/app/settings/eventrix-inventory` foi convertida em `<Navigate>` para `/app/settings/inventory-provider?provider=eventrix` (preserva bookmarks e intenção).
- Rotas legadas de operações (`/app/operations/inventory`, `/app/operations/inventory/*`) também redirecionam para a rota canônica.

## 3. Menu

`SettingsPageV3.tsx` atualizado:

- Label: `Provider de Inventário`
- Descrição: `Configure a origem de categorias, famílias, itens e disponibilidade.`
- Keywords: inventário, provider, eventrix, nativo, estoque, disponibilidade.

## 4. Página

Estrutura:

1. Cabeçalho (Boxes / teal / badge "Configuração da empresa").
2. Card "Provider ativo" — nome, tipo técnico, origem, capacidades.
3. Card "Providers disponíveis" — cards para Native e Eventrix.
4. Card "Configuração Eventrix" — renderizado quando Eventrix estiver ativo ou quando o painel for expandido pelo usuário / query `?provider=eventrix`.

## 5. Providers exibidos

| Provider | Nome              | Capacidades exibidas                             |
| -------- | ----------------- | ------------------------------------------------ |
| native   | Inventário Nativo | (nenhuma) — mensagem explícita de capacidade básica |
| eventrix | Eventrix          | Categorias, Famílias, Requisitos de produtos      |

O provider Native não declara e não anuncia disponibilidade/reservas.

## 6. Capacidades — labels

`categories → Categorias`, `families → Famílias`, `items → Itens`, `availability → Disponibilidade`, `reservations → Reservas`, `kits → Kits`, `serialized_items → Itens serializados`, `quantity_items → Itens por quantidade`, `product_requirements → Requisitos de produtos`, `proposal_demand → Demanda de propostas`.

## 7. Origem da seleção — labels

| Chave                            | Label                                         |
| -------------------------------- | --------------------------------------------- |
| `canonical_provider_settings`    | Configuração da empresa                       |
| `legacy_eventrix_settings`       | Sincronizada com configuração Eventrix        |
| `native_default`                 | Padrão da plataforma                          |
| `manual` (selection_source)      | Configuração da empresa                       |
| `legacy_backfill` (selection)    | Configuração migrada                          |

## 8. Permissões de UI

- Leitura: Owner, Admin, Operacional, Gestor Comercial, Sales Manager.
- Mutação: apenas Owner e Admin. Demais perfis recebem alerta "Somente leitura".
- Backend continua bloqueando mutações via RLS (policies das sprints VERT-01.2B).

## 9. Seleção Native

- Requer confirmação (`AlertDialog`).
- Faz upsert com `provider_type='native'`, `is_enabled=true`, `selection_source='manual'`.
- Invalida `inventory-provider-settings` e `inventory-provider`.
- **Não** apaga `eventrix_inventory_integration_settings`.
- **Não** apaga `eventrix_inventory_sync_cache`.
- **Não** altera Proposal Demand.

## 10. Seleção Eventrix

- Se Eventrix estiver `is_enabled=true` + `base_url` presente + status válido → upsert canônico direto.
- Caso contrário: abre painel específico e atualiza `?provider=eventrix`. A ativação canônica só ocorre depois de o fluxo legado (`useUpsertEventrixInventorySettings`) validar e persistir. O dual-write existente sincroniza a fonte canônica automaticamente.

## 11. Painel Eventrix

- Extraído de `EventrixInventorySettings.tsx` como export nomeado `EventrixInventoryProviderPanel`.
- A página legada `EventrixInventorySettings` foi transformada em wrapper (Layout + PageHeader + painel) para preservar imports legados.
- Sem duplicação de queries, mutations, validação ou dual-write.

## 12. Dual-write

Mantido intacto (VERT-01.2B). Ativar/desativar Eventrix pela UI legada continua sincronizando `inventory_provider_settings` com `selection_source='legacy_eventrix_settings'`.

## 13. UX

- Loading: `LoadingSpinner` no card de provider ativo.
- Vazio: ausência de row canônica → Native como default, sem erro.
- Erro: `Alert` destructive com botão "Tentar novamente".
- Sucesso: `sonner.toast`.
- Somente leitura: `Alert` informativo.
- Responsivo: `grid gap-4 md:grid-cols-2` para cards de providers.

## 14. Testes

- `src/pages/settings/__tests__/InventoryProviderSettingsPage.test.tsx` — smoke: módulos carregam e o painel Eventrix é exportado.
- Os 25 testes VERT-01.2A/B continuam verdes.

## 15. Compatibilidade

- Rota legada preservada como redirect.
- Componente `EventrixInventorySettings` continua exportado como default (wrapper) e como painel nomeado.
- Hooks `useEventrixInventory*` intocados.
- Schemas Eventrix intocados.
- Tabelas `eventrix_inventory_integration_settings` e `eventrix_inventory_sync_cache` intocadas.
- `inventory_provider_settings` intocada.
- Proposal Inventory Demand intocado.
- Product BOM intocado.

## 16. Riscos residuais

- Proposal Inventory Demand ainda consulta estruturas `eventrix_*` diretamente.
- Product BOM permanece legado.
- Rota legada só pode ser removida após inventário de bookmarks e links externos.
- Native ainda não oferece capacidades reais — depende do Pack Conectividade.

## 17. Rollback

Exclusivamente de código:

1. `git revert` do commit da sprint.
2. Restaurar rota `/app/settings/eventrix-inventory` → `EventrixInventorySettings` direto.
3. Menu volta para "Inventário Eventrix".
4. Nenhuma alteração de banco a desfazer.

## 18. Consumidores ainda legados

- `src/hooks/settings/useEventrixInventory.ts`
- `src/schemas/eventrixInventorySettings.ts`
- `src/components/proposals/ProposalInventoryDemand*.tsx`
- `src/lib/proposals/inventoryDemand*.ts`
- `src/services/operations/inventory*.ts`

## 19. Próxima sprint (VERT-01.2D)

1. Migrar Proposal Inventory Demand para o adapter genérico.
2. Rename controlado de colunas `eventrix_*` no snapshot (compat via alias).
3. Iniciar planejamento do Pack Conectividade (equipment profile).
4. Avaliar deprecação definitiva da rota legada.
