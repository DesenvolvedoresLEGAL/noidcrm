

## Plano: Copiar Todos os Dados na Duplicação de Oportunidade

### Diagnóstico

A duplicação atual no `execute-workflow/index.ts` já copia: histórico (audit_log), campos customizados, propostas (com itens e termos de pagamento), arquivos, equipe (deal_participants), tags e contratos.

**Faltam 6 tabelas:**

| Tabela | Aba |
|---|---|
| `opportunity_notes` | Notas |
| `activities` | Atividades |
| `opportunity_emails` | E-mails |
| `interactions` | Analytics / Rede |
| `lead_emotional_memory` | Inteligência (Memórias) |
| `vibe_alerts` | Inteligência (Alertas) |
| `opportunity_public_forms` | Formulários |

### Alterações

**Arquivo: `supabase/functions/execute-workflow/index.ts`**

Adicionar 7 blocos de cópia após os blocos existentes (antes do log consolidado), seguindo o mesmo padrão try/catch + copyResults:

1. **opportunity_notes** — Copiar todas as notas, mantendo `created_by` e timestamps originais
2. **activities** — Copiar todas as atividades (exceto `id`, `created_at`, `updated_at`), apontar para nova oportunidade. Manter `completed_at`, `status`, `owner_user_id`
3. **opportunity_emails** — Copiar todos os e-mails (inbound + outbound), preservar `sent_at`, `direction`, tracking data
4. **interactions** — Copiar todas as interações, preservar `channel`, `sentiment`, `engagement_score`, timestamps
5. **lead_emotional_memory** — Copiar registro emocional, apontar `opportunity_id` para novo deal
6. **vibe_alerts** — Copiar alertas existentes para novo deal
7. **opportunity_public_forms** — Copiar formulários públicos vinculados

Cada bloco registra sucesso/falha no `copyResults` para auditoria consolidada no log final.

### Impacto
- Apenas duplicações futuras serão afetadas
- Nenhuma mudança de schema necessária
- Um único arquivo editado

