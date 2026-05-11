## Diagnóstico

Investiguei o fluxo de criação de item do inventário e encontrei **dois problemas combinados** que explicam o que aconteceu:

### 1. A categoria "Roteadores" está com perfil `generic` (não `router`)

```
inventory_categories → Roteadores | equipment_profile = generic
```

Como o perfil é `generic`, os campos dedicados de roteador (SSID de fábrica, Senha Wi‑Fi, Usuário admin, Senha admin, IMEI) **não aparecem** no formulário. Por isso o time recorreu a "Especificações técnicas" como gambiarra para cadastrar nome de rede, senha, interface etc. Isso não é o caminho previsto.

### 2. O botão "Criar" falha em silêncio quando há erro de validação

O formulário usa `react-hook-form + zod`. Quando algum campo obrigatório (Local, Categoria, Nome) não está preenchido, o `handleSubmit` **bloqueia** o envio mas **não dá nenhum feedback visível** — a mensagem de erro vermelha aparece junto do campo, que está fora do viewport (o usuário está rolado no fim, no bloco de Especificações técnicas).

Resultado: para o usuário, "o botão CRIAR simplesmente não funciona". Não há toast, não há scroll, não há request HTTP.

A RLS de `inventory_items` está OK (`inv_insert` com `WITH CHECK`), então o problema **não é backend** — é UX de validação.

---

## Plano de correção (somente frontend, sem migração)

### A. Feedback claro quando a validação falha

Em `src/components/operations/inventory/InventoryItemFormDialog.tsx`:

1. Passar um callback `onError` para `form.handleSubmit(onSubmit, onError)`.
2. No `onError`, exibir `toast.error("Revise os campos destacados antes de criar.")` listando os 1‑2 primeiros campos com problema (ex: "Local atual obrigatório").
3. Rolar a `DialogContent` até o primeiro campo com erro (via `scrollIntoView({ block: 'center' })` no elemento referenciado pela chave do erro).
4. Garantir que o botão Criar **nunca** fique bloqueado silenciosamente: se `noCategories` ou `noLocations`, mostrar um banner amarelo no topo do diálogo explicando o que precisa ser cadastrado antes (com link/atalho para "Categorias" e "Locais").

Aplicar o mesmo padrão no `InventoryQuantityItemFormDialog` (item por quantidade) para evitar a mesma armadilha.

### B. Tornar o perfil do roteador detectável e ajustável direto do formulário

Quando o usuário escolher uma categoria cujo `equipment_profile = generic` mas cujo nome dê indício de roteador/chip (ex.: contém "rote", "wifi", "chip", "sim"), exibir um **callout informativo** logo abaixo do select de Categoria:

> "Esta categoria está marcada como **Genérica**. Para abrir os campos específicos de Roteador (SSID, Senha, IMEI), edite a categoria e selecione o perfil 'Roteador'."

Adicionar botão "Editar categoria" que abre o `InventoryCategoryFormDialog` já existente, pré‑selecionado naquela categoria. Ao salvar, o callout some e os `RouterFactoryFields` aparecem automaticamente (a lógica já existe via `onCategoryProfileChange`).

### C. Não perder o que já foi digitado em "Especificações técnicas"

Como o time já preencheu "Nome da Rede / Senha / Interface" em Tech Specs, adicionar um **botão de migração** dentro do callout: "Mover dados para campos do Roteador" — copia automaticamente specs com chaves conhecidas (`nome rede` → `ssid_factory`, `senha` → `wifi_password_factory`, `interface` → `admin_user`, `senha interface` → `admin_password`) para `router_factory` quando o perfil virar `router`, e remove essas linhas do `technical_specs`.

### D. Verificação

1. Reproduzir: abrir o diálogo, deixar Local em branco, clicar Criar → deve mostrar toast + rolar até o campo Local.
2. Abrir a categoria "Roteadores" e mudar o perfil para "Roteador" no dialog de categorias → o formulário de item deve passar a renderizar `RouterFactoryFields` automaticamente.
3. Preencher SSID, Wi‑Fi pass, admin user/pass, IMEI + Local + Nome → request `INSERT inventory_items` deve retornar 201 e o item aparecer na listagem.

---

## Arquivos impactados

- `src/components/operations/inventory/InventoryItemFormDialog.tsx` (onError + callout + banner + migração de specs)
- `src/components/operations/inventory/InventoryQuantityItemFormDialog.tsx` (mesmo padrão de onError)
- `src/components/operations/inventory/InventoryClassificationFields.tsx` (expor nome da categoria selecionada para o callout)

Sem mudanças em backend, RLS, migrações ou tipos do Supabase.

## Riscos

Baixo. As mudanças são puramente de UX/validação no frontend. A migração opcional de Tech Specs → router_factory roda só com confirmação explícita do usuário, então não há risco de perda de dados.

## Próximos passos sugeridos (fora deste plano)

- Marcar a categoria "Roteadores" como `equipment_profile = router` direto (uma linha de UPDATE) para destravar o time imediatamente. Posso fazer junto se você autorizar.
