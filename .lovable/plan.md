

## Sprint 2 — Playbook Lista Importada Funcional (Ponta a Ponta)

### Resumo

Tornar o playbook "Lista Importada" totalmente operacional: o usuário cola empresas em um textarea, o backend processa localmente (sem IA para este tipo), normaliza, pontua com regras determinísticas, e exibe resultados para revisão.

---

### 1. Migração SQL — Colunas novas em `prospects`

Adicionar 4 colunas explícitas:

```sql
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS duplicate_candidate boolean DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS review_needed boolean DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS recommended_next_action text;
```

---

### 2. Edge Function `lead-sourcing` — Provider Manual Import

Refatorar o case `import` / `manual_import` para **não usar IA**. Processamento determinístico:

**Fluxo:**
1. Receber `input_payload.import_list` (string com empresas separadas por `\n`)
2. Parse: split por `\n`, trim, filtrar vazias
3. Deduplicar dentro do input (por normalized name)
4. Criar `lead_source` tipo `manual_import`
5. Para cada empresa:
   - `normalizeManualProspect()`: trim, collapse espaços, lowercase para `normalized_company_name`, remover sufixos societários (Ltda, S.A., ME, EIRELI, S/A), extrair domínio se input contém URL
   - `scoreManualProspect()`: scoring determinístico baseado em regras:
     - `company_name` preenchido: +10
     - domínio válido: +10
     - website válido: +5
     - cidade preenchida: +5
     - compatível com segmento ICP: +20
     - compatível com geo ICP: +10
     - confiança média/alta: +10
     - só nome sem dados extras: penalidade -10
   - Gerar sinais: `has_domain`, `has_website`, `name_only_input`, `matched_icp_keyword`, `matched_geo_keyword`
   - Calcular grade: A (>=70), B (>=50), C (>=30), D (<30)
   - Inserir `prospect` + `prospect_scores` + `prospect_signals`
6. Atualizar `playbook_run.stats` com: `raw_items`, `valid_items`, `invalid_items`, `prospects_created`, `duplicates_in_input`
7. Marcar run como `completed`

**Outros playbook types** (event, geo, etc.) continuam usando IA como antes.

---

### 3. Frontend — Melhorias na Tabela e Form

**LeadSearchForm.tsx:**
- Para o tipo `import`: usar o componente `Textarea` do projeto ao invés de `<textarea>` nativo
- Adicionar contador de linhas válidas em tempo real abaixo do textarea

**LeadResultsTable.tsx:**
- Adicionar colunas: `confidence`, `recommended_next_action`
- Adicionar badges de sinais (chips das signals do prospect)
- Mostrar `source_label` na coluna Origem

**LeadSourcingEngine.tsx:**
- Após execução bem-sucedida, mostrar toast com contagem: "X prospects criados, Y duplicados ignorados"
- Loading state claro durante execução

---

### 4. Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint2_prospect_columns.sql` | Adicionar 5 colunas em prospects |
| `supabase/functions/lead-sourcing/index.ts` | Refatorar: provider manual_import determinístico |
| `src/components/playbook/LeadSearchForm.tsx` | Textarea melhorado + contador de linhas |
| `src/components/playbook/LeadResultsTable.tsx` | Novas colunas + sinais + origem |
| `src/components/playbook/LeadSourcingEngine.tsx` | Toast com stats detalhadas |
| `src/hooks/useLeadSourcingV2.ts` | Atualizar tipo Prospect com novos campos |

---

### Critérios de Aceite

- Colar 50 empresas cria prospects corretamente
- Linhas vazias descartadas, duplicados no input ignorados
- Score determinístico calculado e salvo
- Sinais visíveis na tabela
- Stats do run corretas (raw_items, valid_items, duplicates_in_input)
- Runs aparecem na lista de execuções recentes com contadores

