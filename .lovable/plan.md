

## Plano: Alerta de Propostas Vencendo na Dashboard

### Objetivo
Adicionar um novo card "Propostas Vencendo" na aba **Alertas & Riscos** da Dashboard, mostrando propostas que já venceram, vencem hoje ou vencem nos próximos 7 dias. Visível para admins, managers e sellers (closer/farmer).

### Alterações

**1. Hook `src/hooks/useOwnerDashboard.ts`**
- Adicionar nova query no `Promise.all` buscando propostas com `expires_at` definido, status `sent` ou `viewed` (não aceitas/rejeitadas), da organização
- Criar novo campo `expiringProposals` no `OwnerDashboardData` com estrutura:
  ```
  { id, title, client_name, expires_at, status, opportunity_id, total_amount, urgency: 'expired' | 'today' | 'expiring' }
  ```
- Classificar cada proposta: `expired` (vencida), `today` (vence hoje), `expiring` (vence em até 7 dias)

**2. Componente `src/components/dashboards/owner/OwnerSmartLists.tsx`**
- Adicionar um 4o card "Propostas Vencendo" com ícone `FileWarning` em vermelho
- Listar propostas agrupadas por urgência (vencidas primeiro, depois hoje, depois próximos dias)
- Cada item mostra: título, cliente, data de validade, valor, e badge de urgência (Vencida/Hoje/Em X dias)
- Botão para navegar direto à oportunidade vinculada
- Ajustar grid para `lg:grid-cols-4` (ou manter 3 cols com o novo card numa segunda linha)

**3. Resumo de Alertas no `OwnerDashboard.tsx`**
- Adicionar um 4o bloco no grid de resumo para "Propostas Vencendo" com contagem e valor total
- Adicionar ação recomendada quando há propostas vencendo

### Arquivos Afetados
- **Editar:** `src/hooks/useOwnerDashboard.ts` — nova query + campo no interface
- **Editar:** `src/components/dashboards/owner/OwnerSmartLists.tsx` — novo card
- **Editar:** `src/components/dashboards/owner/OwnerDashboard.tsx` — bloco no resumo de alertas

