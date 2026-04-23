

# Plano — Enriquecimento via CNPJ + Migração Tamanho → Porte

## Diagnóstico

**Lookup CNPJ hoje preenche:** razão social, nome fantasia, natureza jurídica, **porte**, capital social, CNAE principal, CEP/endereço, telefones, email, QSA.

**O que NÃO preenche (mas a edge function já retorna):**
- `cnaes_secundarios` (somente AccountModalTabs preenche; AccountEditor — a tela "Editar conta" do print — ignora)
- `segmento` (nunca derivado do CNAE em nenhum dos dois fluxos)

**Tamanho vs Porte (dados reais no banco):**
- `porte` populado: 228 contas (Médio Porte, ME, EPP, Grande Porte, MEI) — vem da Receita.
- `tamanho` populado: apenas **18 contas** com valores caóticos ("2-5 pessoas", "1-10", "Grande", "Média"). Praticamente vazio.
- Conclusão: **`tamanho` deve ser substituído por `porte`** nas telas de Lead Score, AccountCard, filtros e analytics. `tamanho` permanece no schema apenas para compatibilidade (legacy).

## Mudanças

### 1. CNAE → Segmento (mapeamento determinístico)
Criar `src/lib/cnae-to-segmento.ts` mapeando o **primeiro dígito da divisão CNAE** ao segmento canônico já normalizado (`segment-normalizer.ts`):

```text
01-03  → Agronegócio
05-09  → Indústria (extrativa)
10-33  → Indústria
35-39  → Indústria (utilities)
41-43  → Construção
45-47  → Comércio / Varejo (47=Varejo, 45-46=Comércio)
49-53  → Logística
55-56  → Eventos (56=alimentação/eventos quando combinado com 823)
58-63  → Tecnologia
64-66  → Financeiro
68     → Imobiliário
69-75  → Serviços (consultoria/jurídico)
73     → Marketing  (73.1=publicidade, 73.2=pesquisa)
80-82  → Serviços (82.30=eventos)
85     → Educação
86-88  → Saúde
90-93  → Eventos / Cultura
94-96  → Serviços
```
Função `cnaeToSegmento(codigo: string): string | null` com regras especiais (73.1x = Marketing, 82.30 = Eventos, 56 = quando combinado com eventos).

### 2. AccountEditor.tsx (lupa CNPJ — print do usuário)
No `handleCNPJLookup`, adicionar:
```ts
setValue('cnaes_secundarios', data.cnaes_secundarios?.map(c => String(c.codigo)) || [], { shouldDirty: true });
const segmentoInferido = cnaeToSegmento(data.cnae_principal?.codigo);
if (segmentoInferido && !watch('segmento')) {
  setValue('segmento', segmentoInferido, { shouldDirty: true });
}
```

### 3. AccountModalTabs.tsx (modal "Nova Conta")
Já preenche `cnaes_secundarios`. Adicionar inferência de `segmento` (mesma lógica acima).

### 4. Migração Tamanho → Porte na UI

| Arquivo | Antes | Depois |
|---|---|---|
| `LeadScoreTable.tsx` | filtro/coluna "Tamanho" usando `tamanho` | filtro/coluna **"Porte"** usando `porte` |
| `useLeadScoreAnalytics.ts` | `filterOptions.sizes` por `tamanho` | por `porte` |
| `LeadScoreFilters` | `size` | `porte` |
| `AccountCard.tsx` | badge `account.tamanho` com `getTamanhoColor` | badge `account.porte` com cores ME/EPP/Médio/Grande/MEI |
| `Accounts.tsx` | filtro "Tamanho" | filtro "Porte" + cards de stats já usam `porte` (mantém) |
| `LeadScoreFormulaInfo.tsx` | "Tamanho da empresa (Grande=20...)" | "Porte (Grande Porte=20, Médio=15, EPP=10, ME/MEI=5)" |
| `AccountEditor.tsx` | label "Tamanho da Empresa" no select de funcionários | manter como **"Faixa de Funcionários"** (campo `tamanho` continua existindo, mas passa a ser opcional/secundário) |
| `AccountModalTabs.tsx` | igual acima | igual |
| `LeadWithScore` interface | inclui `tamanho` | incluir também `porte` |

### 5. calculate-account-scores (edge function)
Trocar bloco `account.tamanho` por `account.porte`:
```ts
const portePoints: Record<string, number> = {
  'Grande Porte': 20,
  'Médio Porte': 15,
  'EPP': 10,
  'ME': 5,
  'MEI': 3,
};
```
Mantém fallback para `tamanho` legacy se `porte` for nulo.

### 6. AI Analysis (ai-lead-score-analyze)
Atualizar `buildAccountContext` para incluir `porte`, `cnae`, `cnaes_secundarios` no prompt do GPT-5-mini — enriquece o RAG.

## Arquivos Impactados

**Novos:**
- `src/lib/cnae-to-segmento.ts`

**Editados:**
- `src/pages/AccountEditor.tsx` (lookup + label)
- `src/components/accounts/AccountModalTabs.tsx` (lookup + inferência)
- `src/components/accounts/AccountCard.tsx` (badge porte)
- `src/pages/Accounts.tsx` (filtro porte)
- `src/components/scoring/lead/LeadScoreTable.tsx`
- `src/components/scoring/lead/LeadScoreFormulaInfo.tsx`
- `src/hooks/useLeadScoreAnalytics.ts` (filterOptions.portes)
- `supabase/functions/calculate-account-scores/index.ts`
- `supabase/functions/ai-lead-score-analyze/index.ts`

## Riscos

- **Mapeamento CNAE→Segmento** é heurístico; em casos limítrofes (ex.: CNAE 56 — restaurante vs. buffet de eventos) a inferência pode errar. Mitigação: só preenche se segmento estiver vazio; usuário pode sobrescrever.
- **Campo `tamanho` legacy** permanece no schema para não quebrar imports/exports antigos. Apenas a UI passa a priorizar `porte`.
- **Recálculo retroativo:** após o deploy, sugiro rodar "Recalcular Scores" para que as 228 contas com porte preenchido recebam pontos novos no FIT.

## Próximo Passo

Implementar tudo numa única passada. Após deploy, você roda **Recalcular Scores** + **Enriquecer com IA (Top 200)** para ver o impacto real do enriquecimento.

