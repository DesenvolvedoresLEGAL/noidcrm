## Diagnóstico

Após inspeção do banco e do hook `useWinLossData`, identifiquei a causa raiz de cada problema:

### 1. "Top Motivos de Perda" mostra o diagnóstico (texto longo) em vez do motivo
No hook (`useWinLossData.ts` L243-247), a agregação faz:
```ts
const reason = l.reason_seller || l.reason?.name || 'Não informado';
```
`reason_seller` está populado com o **texto livre do diagnóstico** ("Cliente não retorna os contatos…"), então ele vence. Por isso vemos o diagnóstico no card.

### 2. "Top Motivos de Ganho" sempre "Não informado"
Há **60 records** com `win_reason_id` preenchido, mas o hook na linha 229 hardcoda `win_reason_name: undefined` ("win_reason join removed for stability"). Resultado: 100% cai em "Não informado".

### 3. "Diferenciais Decisivos" vazio na UI
Há **36 records** com `key_differentiator`. O hook agrega corretamente, mas armazena códigos crus (`price`, `service`, `relationship`). Provavelmente está renderizando, só que com labels feios — confirmar e aplicar `WIN_CATEGORY_LABELS`.

### 4. "Feedback dos Clientes" parece vazio
Filtro exige `recorded_by_customer = true` E `customer_feedback != null`. No banco só **7 records** atendem. Funciona, só tem pouco volume — vou relaxar para mostrar feedback mesmo quando `recorded_by_customer` é null mas o texto existe.

### 5. Sem rastreabilidade de aprovações/reprovações de propostas
A tabela `proposals` já guarda tudo: `acceptor_name`, `acceptor_email`, `acceptor_position`, `accepted_at`, `declined_at`, `declined_reason`, `acceptor_ip`. Não existe view consolidando isso no Hub.

---

## Plano (apenas frontend + 1 hook novo, sem alterar schema)

### Passo 1 — Corrigir agregações em `src/hooks/useWinLossData.ts`

**a) Top Motivos de Perda (macro + específico):**
- Buscar o nome do motivo via join (`loss_reasons!reason_id(name, category)`) no select de `win_loss_records`.
- Trocar a fonte da agregação para: `record.loss_reason.name` (específico) com fallback para `opportunity.loss_reason.name`. **Nunca usar `reason_seller`** (que é diagnóstico).
- Adicionar nova série `lossReasonsByMacro: Array<{ category, label, count, specifics: Array<{ name, count }> }>` agrupando por `category` (Concorrência, Preço, Timing…) com expansão de motivos específicos.

**b) Top Motivos de Ganho:**
- Adicionar fetch de `win_reasons` (id, name) para os IDs presentes nos records.
- Popular `win_reason_name` no merge (linha ~229), eliminando o `undefined` hardcoded.

**c) Diferenciais Decisivos:**
- Manter agregação, mas expor o código bruto. A renderização aplicará `WIN_CATEGORY_LABELS`.

**d) Feedback dos Clientes:**
- Relaxar filtro: incluir feedbacks com `customer_feedback` não vazio mesmo se `recorded_by_customer` for null (com badge "via vendedor" vs "via cliente").

### Passo 2 — Atualizar UI

**`LossAnalysisSection.tsx`:**
- Card "Top Motivos de Perda" passa a mostrar **macro motivo** como cabeçalho colapsável e **motivos específicos** como sub-itens (com contagem). Quando macro = "Concorrência", listar concorrentes daquele macro inline.

**`WinAnalysisSection.tsx`:**
- "Top Motivos de Ganho" agora exibirá os nomes reais (Indicação, Custo-benefício, Timing…).
- "Diferenciais Decisivos" aplica `WIN_CATEGORY_LABELS` aos códigos.
- "Feedback dos Clientes" mostra fonte (cliente/vendedor) e remove limite de 5 (scroll interno até 20).

### Passo 3 — Nova aba **"Aprovações"** no `WinLossHub.tsx`

Criar `src/components/intelligence/winloss/tabs/ProposalApprovalsTab.tsx`:

- Hook novo `useProposalApprovalsHistory(orgId, dateRange, pipelineId)` que busca em `proposals`:
  ```ts
  status in ('accepted','declined','expired'), 
  joins: opportunity (title, value, owner_name), 
  win_loss_records (key_differentiator, customer_feedback, win_reason_name)
  ```
- UI tipo timeline/tabela com filtro **Aprovadas | Recusadas | Expiradas**:
  - **Coluna 1 — Quem:** `acceptor_name` + `acceptor_position` + `acceptor_email` + IP.
  - **Coluna 2 — Quando:** `accepted_at` / `declined_at` (data + hora).
  - **Coluna 3 — Oportunidade:** título + valor + vendedor responsável.
  - **Coluna 4 — Motivo + Diferenciais (ganho):** badges de `key_differentiator` traduzidos + `win_reason_name`.
  - **Coluna 5 — Feedback / Motivo (perda):** texto do `customer_feedback` (ganho) ou `declined_reason` + categoria de perda (recusa).
- Botão "Abrir oportunidade" (link para `/opportunity/:id`).
- Export CSV opcional (botão).

Adicionar tab `"Aprovações"` (ícone `FileCheck`) na lista de abas do `WinLossHub`.

### Passo 4 — Verificação

- Rodar a tela com o filtro "Mês" e validar:
  - Card de Perda passa a mostrar "Concorrência (3) → Starlink, Expo Telecom, …" em vez do diagnóstico bruto.
  - Card de Ganho passa a listar "Indicação (X)", "Custo-benefício (Y)" etc.
  - Diferenciais mostram labels PT-BR.
  - Aba Aprovações lista as propostas aceitas/recusadas com quem/quando/motivo.

---

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `src/hooks/useWinLossData.ts` | join com `win_reasons`+`loss_reasons`, nova série macro→específico, relaxar filtro de feedback |
| `src/components/intelligence/winloss/tabs/LossAnalysisSection.tsx` | card macro+específico+concorrentes |
| `src/components/intelligence/winloss/tabs/WinAnalysisSection.tsx` | usar nomes reais + labels PT-BR |
| `src/hooks/useProposalApprovalsHistory.ts` | **novo** |
| `src/components/intelligence/winloss/tabs/ProposalApprovalsTab.tsx` | **novo** |
| `src/pages/intelligence/WinLossHub.tsx` | registrar nova tab "Aprovações" |

## Riscos
- Baixo. Sem alteração de schema, só leitura.
- O join novo em `win_loss_records` adiciona ~1 query (`win_reasons` por IDs) — cacheada via React Query.

## Não está no escopo
- Mudar o modal "Marcar como Perdida" (já captura macro+específico corretamente).
- Alterar como o `reason_seller` é gravado (mantém como diagnóstico textual).

Posso seguir com a implementação?
