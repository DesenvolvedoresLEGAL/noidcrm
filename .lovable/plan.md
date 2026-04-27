## Diagnóstico

Investiguei direto no banco e na lógica do filtro. Tem 3 problemas misturados.

### 1. As 3 listas existentes JÁ estão pontuadas — mas com scoring V1/V2 (sem learning)

Os ajustes do **Score V3** (learning_adjustment vindo dos sinais aprendidos) só são aplicados quando `run-enrichment` roda. Os 1.484 prospects das 3 buscas (ABRINT, FEIMEC, BETT) foram pontuados nos dias 24-25/04, antes do learning loop existir — e o sistema nunca tinha 20 ocorrências de sinal nenhum, então mesmo se rodasse de novo, `learning_adjustment = 0` hoje.

**Distribuição real no banco (não está tudo igual, é o filtro que mente):**

```text
ABRINT 2026   → 242 com score 201 (B), 2 com 229 (A)
FEIMEC 2026   → 511 com 287 (A), 235 com 277 (A), 30 com 307 (A), 14 com ~141 (C), 2 com 201 (B)
BETT BRASIL   → 357 com 260 (A), 35 com 175 (C), 27 com 163 (C), 15 com 201 (B), + 13 outros variando 203–316
```

Ou seja: **dentro de cada busca os scores variam pouco** porque o ICP fit está saturando em 100 e os sinais detectados são quase sempre os mesmos 3 (`markdown pattern`, `participates in events`, `listed in official directory`). Isso é limitação do enrichment atual, não do filtro.

### 2. O filtro "Score Alto" está quebrado conceitualmente

Código atual em `LeadResultsTable.tsx:104-107`:
```ts
case 'high_score':
  return s.priority_score >= 70 || (icp+quality+trust-penalty) >= 70;
```

O threshold `>= 70` é absurdamente baixo — **todo prospect com score >= 70 passa**, e como o menor score real é 141, **literalmente todos os 1.484 leads aparecem como "Score Alto"**. Por isso você vê a lista inteira.

### 3. A coluna "Confiança" mostra 60 fixo na UI mas no banco varia (96, 88, 60)

Bug de exibição/origem do dado — `prospect.confidence` na imagem está mostrando o mesmo valor para todos da mesma run, provavelmente porque é a confiança da extração do scraper (por página), não a confiança do scoring.

---

## Como priorizar suas 3 listas HOJE (sem esperar Sprint D)

Como o ICP fit saturou em 100 para a maioria, a única dimensão que ainda discrimina é **priority_score absoluto + grade + signal_score**. Proposta:

**Tier S (atacar primeiro)** — `priority_score >= 280` OU `signal_score >= 80`
→ FEIMEC: ~778 leads / BETT: ~12 leads / ABRINT: 0

**Tier A** — `priority_score 230–279` E `grade = A`
→ BETT: ~357 / ABRINT: 2

**Tier B (segunda onda)** — `priority_score 180–229`, `grade B`
→ ABRINT: 242 / BETT: 15 / FEIMEC: 2

**Tier C (descartar ou enrichment manual)** — `priority_score < 180` ou `grade C`
→ resto, ~95 leads, normalmente `icp_fit ~15` (não bateram ICP)

ABRINT está praticamente todo empilhado em B porque o enrichment dela achou menos sinais por lead. Recomendo **rodar re-enrichment do ABRINT** com a versão atual para tentar separar melhor.

---

## Plano de correção (Sprint mini, antes da Sprint D)

### Mudança 1 — Redefinir "Score Alto" com threshold real
`src/components/playbook/LeadResultsTable.tsx`:
- Trocar `>= 70` por `>= 250` (ou tornar configurável por org).
- Adicionar 4 sub-filtros: **Tier S (≥280)**, **Tier A (230–279)**, **Tier B (180–229)**, **Tier C (<180)**.
- Default do filtro "Score Alto" = Tier S + Tier A.

### Mudança 2 — Corrigir coluna "Confiança"
- Investigar se `prospect.confidence` está vindo da extração (página) ou do scoring. Se for da extração, renomear coluna na UI para **"Confiança Extração"** e adicionar coluna **"Confiança Score"** vinda de `prospect_scores` (a calcular).

### Mudança 3 — Botão "Re-pontuar lista" nas Execuções Recentes
Adicionar ação por run que dispara `run-enrichment` em modo `rescore-only` para os prospects daquela run. Assim, conforme o learning loop acumula sinais (>= 20 ocorrências), você consegue trazer as listas antigas para o V3 sem reprocessar scraping.
- Edge function: novo modo `rescore_existing` em `run-enrichment` que pula scraping/AI e só recalcula `prospect_scores` aplicando `learning_adjustment` atual.

### Mudança 4 — Documentar regra do "Score Alto" na UI
Tooltip no chip "Score Alto" explicando: *"Inclui Tier S e Tier A (priority_score ≥ 230). Considera ICP fit, qualidade dos dados, sinais positivos detectados e ajuste do learning loop."*

---

## Resposta direta às suas perguntas

1. **Os ajustes valem para as listas existentes?** Não. Foram pontuadas antes do learning loop. Para aproveitar, precisa do botão "Re-pontuar" da Mudança 3.
2. **Como priorizar as 3 listas hoje?** Use os Tiers S/A/B/C acima. **FEIMEC tem o melhor pool (778 leads tier S)**, BETT tem volume médio com qualidade, ABRINT precisa re-enrichment porque está empilhado em B.
3. **O que é "Score Alto"?** Hoje é um filtro quebrado (tudo passa). Depois da correção será: Tier S + Tier A = `priority_score >= 230` com grade A.

---

## Risks
- Mudar o threshold do filtro pode "esconder" leads que SDRs já estavam trabalhando — precisa avisar o time antes do deploy.
- Re-pontuar listas antigas pode mudar a ordenação que os SDRs já memorizaram.

## Next steps
Aguardo seu OK para implementar as Mudanças 1, 2, 3 e 4. Sprint D (learning loop em ação real) continua na sequência depois disso.