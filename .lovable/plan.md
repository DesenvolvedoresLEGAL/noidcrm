
## Sprint 8 — Automação Avançada, Distribuição e Aprendizado Operacional

### Resumo

Conectar o motor de Lead Sourcing ao pipeline operacional: auto-import por threshold, distribuição de owner via round robin, feedback loop quando oportunidades avançam/são perdidas, e KPIs de conversão por playbook na aba Performance.

---

### 1. Edge Function — Auto-import no `lead-sourcing`

Atualmente o `lead-sourcing` ignora os `import_rules` enviados pelo frontend. Implementar:

**No final do fluxo de cada handler** (após criação de prospects e scoring):
1. Ler `import_rules` do `input_payload`
2. Se `autoImport === true`: filtrar prospects com `priority_score >= scoreThreshold` e `confidence >= 0.6`
3. Para cada prospect elegível:
   - Executar lógica de dedupe (mesma do `importSingleProspect`)
   - Criar account (ou vincular existente)
   - Criar contact (se dados disponíveis)
   - Criar opportunity com `source_metadata`
   - Marcar prospect como `imported`
4. Se `autoAssignOwner === true`: buscar próximo SDR via round robin (mesma lógica do `ingest-lead`)
5. Registrar `run_events` com contagem de auto-imports
6. Atualizar `stats` do run com `auto_imported_count`

Isso reutiliza a lógica existente do `ingest-lead` para round robin entre SDRs.

---

### 2. Feedback Loop — Trigger de estágio/perda

**Novo trigger SQL** em `opportunities`:
- Quando `stage_id` muda ou `status` muda para `won`/`lost`
- Se a opportunity tem `prospect_id` e `playbook_run_id`
- Inserir registro em `run_events` com `level: 'feedback'` e payload contendo novo estágio/status

Isso alimenta o histórico de cada run com o resultado comercial real.

**Migração:**
```sql
CREATE OR REPLACE FUNCTION track_opportunity_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.prospect_id IS NOT NULL AND NEW.playbook_run_id IS NOT NULL THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO run_events (workspace_id, playbook_run_id, level, message, payload)
      VALUES (
        NEW.organization_id,
        NEW.playbook_run_id,
        'feedback',
        CASE
          WHEN NEW.status = 'won' THEN 'Oportunidade ganha'
          WHEN NEW.status = 'lost' THEN 'Oportunidade perdida'
          ELSE 'Oportunidade avançou de estágio'
        END,
        jsonb_build_object(
          'opportunity_id', NEW.id,
          'old_stage_id', OLD.stage_id,
          'new_stage_id', NEW.stage_id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'valor_previsto', NEW.valor_previsto
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_feedback
  AFTER UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION track_opportunity_feedback();
```

---

### 3. Performance Stats — Conversão por playbook

Expandir `usePlaybookPerformanceStats` para incluir:
- Oportunidades criadas (count de opportunities com `prospect_id` vinculado)
- Oportunidades ganhas / perdidas
- Valor total gerado (soma de `valor_previsto` onde `status = 'won'`)
- Taxa de conversão por tipo de playbook (imported → won)

Query adicional de `opportunities` filtrando por `source_metadata->>'source' = 'lead_sourcing'`.

---

### 4. SDR Command Center — Leads do Caramelo

Adicionar na query de leads priorizados do `SDRCommandCenter.tsx`:
- Incluir opportunities com `origem = 'lead_sourcing'` 
- Mostrar badge "🐕 Caramelo" e `priority_score` nos cards
- Sem mudanças estruturais — os leads já aparecem automaticamente se auto-import criar opportunities com `owner_user_id`

---

### 5. PlaybookPerformance — Novos KPIs

Adicionar cards na aba Performance:
- **Oportunidades Geradas** — count
- **Valor em Pipeline** — soma de `valor_previsto`
- **Taxa de Conversão** — won / total
- **Distribuição por Owner** — tabela com nome do vendedor e count de leads recebidos

---

### 6. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint8_feedback_trigger.sql` | Trigger de feedback + nenhuma coluna nova |
| `supabase/functions/lead-sourcing/index.ts` | Auto-import + auto-assign no final dos handlers |
| `src/hooks/useLeadSourcingV2.ts` | Expandir performance stats com dados de opportunities |
| `src/components/playbook/PlaybookPerformance.tsx` | Novos KPIs: oportunidades, valor, conversão, distribuição |
| `src/pages/gtm/SDRCommandCenter.tsx` | Badge Caramelo nos leads com origem lead_sourcing |

---

### Critérios de aceite

- Prospects acima do threshold são auto-importados quando `autoImport = true`
- Owner é atribuído via round robin SDR quando `autoAssignOwner = true`
- Oportunidades que avançam/são perdidas geram `run_events` de feedback
- Performance tab mostra oportunidades geradas, valor em pipeline e taxa de conversão
- SDR Command Center exibe badge de origem para leads do Caramelo
