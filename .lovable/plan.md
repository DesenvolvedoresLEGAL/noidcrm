## Objetivo
Reformular a experiência de edição de produto/serviço: sair do modal estreito, padronizar campos de Custo e Imposto (renomear IPI), corrigir cálculo de margem para ponto-dia e recorrente, e garantir persistência de todas as configurações ao salvar.

## Mudanças propostas

### 1. Edição em página dedicada (substitui modal)
- Criar rotas:
  - `/produtos/novo` → `ProductEditorPage` (modo create)
  - `/produtos/:id/editar` → `ProductEditorPage` (modo edit)
- A página usa o `Layout` padrão (sidebar + breadcrumb), com largura confortável (`max-w-5xl` central) e seções em cards ao invés de tudo espremido num diálogo.
- Em `Products.tsx`, os botões "Novo produto" e o ícone de editar passam a navegar para essas rotas (em vez de abrir `ProductModal`).
- `ProductModal.tsx` fica deprecated (mantido apenas se algum outro fluxo usar; remover imports órfãos).
- Layout da página em colunas:
  - **Coluna esquerda (principal):** Identidade (nome, código, categoria, tipo, descrição rica), Imagem, Configuração de Preço (com sub-modos), BOM.
  - **Coluna direita (sticky):** Resumo (preço efetivo, custo, imposto, margem), Status, Contabiliza na Meta, botões Salvar/Cancelar.

### 2. Padronização Custo + Imposto em TODOS os modos
- Renomear rótulo "IPI (%)" → **"Imposto (%)"** na UI (manter coluna `ipi_percent` no banco — só muda label e helper text). Adicionar tooltip: "Imposto incidente (IPI/ISS/etc) usado no cálculo de margem".
- Adicionar campos **Custo (R$)** e **Imposto (%)** ao bloco de **Ponto-dia** (hoje só existem em Avulso/Recorrente).
- Garantir que esses campos estão no `defaultValues`, no `reset()` ao abrir produto existente, e no `onSubmit` para todos os 3 modos.

### 3. Cálculo de margem unificado
- Criar helper `computeMargin({ billing_type, price, monthly_price, point_day_price, points, days, cost, tax_percent })` em `src/lib/products/margin.ts`.
- Regra:
  - `revenue` = preço efetivo do modo (avulso: `price`; recorrente: `monthly_price`; ponto-dia: `unit_price_point_day × points × days`).
  - `tax_amount = revenue × (tax_percent/100)`
  - `net_revenue = revenue − tax_amount`
  - `margin% = (net_revenue − cost) / net_revenue × 100` (quando `net_revenue > 0`).
- O componente de Resumo mostra: Preço, Imposto, Custo, Margem (R$ e %).
- Hoje em Recorrente o card só mostra margem se `monthlyPrice > 0` mas o cálculo ignora imposto e em Ponto-dia não existe — corrigir ambos.

### 4. Persistência completa ao salvar
- Auditar `onSubmit` em `ProductEditorPage`:
  - Garantir que campos específicos do modo selecionado são enviados (`monthly_price`, `billing_cycle`, `minimum_contract_months` para recorrente; `default_unit_price_point_day`, `default_billing_days`, `default_quantity_points` para ponto-dia).
  - Garantir que `cost` e `ipi_percent` (Imposto) sempre sejam enviados, independente do modo.
  - BOM (`product_bom_items`) é salvo via `replaceProductBomItems` após `createProduct`/`updateProduct` — confirmar ordem e tratamento de erro (toast separado se BOM falhar mas produto salvar).
- Confirmar Zod schema em `src/services/supabase/products.ts` aceita todos os campos (já aceita).
- Após salvar em modo create, navegar para `/produtos/:id/editar` (mantém usuário no produto recém-criado).

### 5. Limpezas e detalhes UX
- Hint visual mostrando o "modo de cobrança ativo" no topo (badge).
- Manter `ProductBOMEditor` exatamente como hoje, só dentro da nova página.
- Mobile: colunas viram stack vertical; resumo desce para o final (sem `sticky`).

## Arquivos impactados
- **Novo:** `src/pages/ProductEditorPage.tsx`
- **Novo:** `src/lib/products/margin.ts`
- **Edit:** `src/App.tsx` (rotas)
- **Edit:** `src/pages/Products.tsx` (navegação ao invés de modal)
- **Edit:** `src/components/products/ProductModal.tsx` (manter como wrapper opcional ou remover usos)
- (Sem migração de banco — `ipi_percent` permanece, só muda label.)

## Riscos
- Outros pontos do app que abrem `ProductModal` diretamente (busca rápida de produto?) — verificar com `rg "ProductModal"` antes de remover.
- Recalcular margem com imposto pode mudar números exibidos historicamente; deixar claro no tooltip do card.

## Próximos passos
Após aprovação: implemento a página, rotas, helper de margem, atualizo `Products.tsx` e adiciono Custo/Imposto ao bloco Ponto-dia.