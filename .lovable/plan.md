

## Fix: Dados incorretos na proposta duplicada para OPERACIONAL + Dados vazios de cliente/contato na view pública

### Problema identificado

**Dois bugs críticos independentes:**

**Bug 1 — Proposta duplicada ao OPERACIONAL com dados errados**
Na edge function `generate-acceptance-proof`, quando uma proposta é aceita e duplicada para a oportunidade OPERACIONAL, campos críticos são **omitidos** na cópia:
- **Items**: `billing_type` não é copiado → Speedy (que é `recurring`) fica como `one_time` (padrão)
- **Payment terms**: `contract_duration_months`, `contract_start_date`, `billing_day`, `auto_renewal` não são copiados → contrato de 6 meses vira 12 (padrão)

Confirmado via banco: a proposta OPERACIONAL (`dcbccae1`) tem Speedy como `one_time` e contrato `12 meses`, enquanto a original VENDAS (`2e313929`) tem Speedy como `recurring` e contrato `6 meses`.

**Bug 2 — View pública não exibe dados da empresa/contato**
As tabelas `accounts`, `contacts` e `opportunities` têm RLS que exige `organization_id = get_user_organization_id()`. Usuários anônimos (acessando via link público) não passam nesse filtro, então as joins aninhadas (`proposal → opportunity → account/contact`) retornam `null` silenciosamente. O fallback existente (linhas 547-571) usa o mesmo client e sofre a mesma restrição.

---

### Solução

**1. Edge Function `generate-acceptance-proof/index.ts` — Adicionar campos faltantes**

Na duplicação de items (linha 624), adicionar:
```
billing_type: item.billing_type,
counts_for_commission: item.counts_for_commission,
measurement_unit_id: item.measurement_unit_id,
minimum_contract_months: item.minimum_contract_months,
```

Na duplicação de payment terms (linha 660), adicionar:
```
contract_duration_months: term.contract_duration_months,
contract_start_date: term.contract_start_date,
billing_day: term.billing_day,
auto_renewal: term.auto_renewal,
```

**2. Corrigir dados existentes no banco** — Atualizar a proposta OPERACIONAL do TRISUL para refletir os dados corretos da proposta original (billing_type dos items e contract_duration/start_date dos payment terms).

**3. View pública — Armazenar snapshot de cliente/contato na proposta**

Adicionar colunas à tabela `proposals` para snapshot dos dados do cliente no momento do envio:
- `client_razao_social`, `client_cnpj`, `client_cidade`, `client_uf`  
- `contact_nome`, `contact_cargo`, `contact_email`, `contact_telefone`

Essas colunas são preenchidas quando a proposta é enviada (status → `sent`) e usadas como fonte prioritária na view pública, eliminando a dependência de joins aninhadas que falham para usuários anônimos.

**Alternativa mais simples para Bug 2**: Criar RLS policies nas tabelas `accounts` e `contacts` que permitam SELECT anônimo quando acessados via proposta com `public_token` válido, similar à policy já existente em `proposal_items`.

---

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-acceptance-proof/index.ts` | Adicionar campos faltantes na duplicação |
| Migration SQL | Corrigir dados existentes da proposta OPERACIONAL + (opcionalmente) adicionar RLS para acesso anônimo a accounts/contacts via proposal token |
| `src/services/supabase/proposals.ts` | Ajustar `getProposalByToken` para usar snapshot ou nova RLS |

### Prioridade
Bug 1 é a causa raiz dos dados errados — fix direto na edge function.
Bug 2 é a causa do "Cliente" vazio na view pública — requer RLS ou snapshot.

