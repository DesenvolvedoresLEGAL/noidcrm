

## Problema

O usuário identificou 3 questões:

1. **Análise de Ganhos só aparece no contexto "sales"** (linha 942: `pipelineContext === 'sales'`). Para onboarding e qualification, a seção "Análise de Ganhos" (motivos de ganho, diferenciais, feedbacks) fica completamente oculta. O usuário quer ver motivos de ganho/perda separados em TODOS os contextos.

2. **Aprovação do PENTANE não aparece completa no histórico**. O `audit_log` com `proposal_accepted` já salva dados ricos (valor, nome do aprovador, cargo, documento, IP). O `TimelineEventCard` já renderiza esses dados para eventos do tipo `proposal` com `activity_type === 'accepted'`, mas para eventos do tipo `audit` com `activity_type === 'proposal_accepted'`, só mostra valor e nome (linhas 257-263), faltando: cargo, documento, data da aceitação, link do comprovante, título da proposta, validade.

3. **Win/Loss Hub não mostra motivos de ganho para contextos onboarding/qualification** — precisa funcionar em todos os contextos, não só em "sales".

## Plano

### 1. Mostrar Análise de Ganhos em todos os contextos do Win/Loss Hub

**Arquivo**: `src/pages/intelligence/WinLossHub.tsx`

- Remover a condição `{pipelineContext === 'sales' && (` que envolve a seção "Análise de Ganhos" (linha 942)
- Adaptar os labels dinamicamente conforme o contexto (ex: "Top Motivos de Ativação" para onboarding, "Top Motivos de Qualificação" para qualification)
- Fazer o mesmo para a seção "Feedback das Recusas" (linha 1050) — remover `pipelineContext === 'sales'`

### 2. Enriquecer o evento `proposal_accepted` no histórico (audit type)

**Arquivo**: `src/components/opportunity/TimelineEventCard.tsx`

Na seção que trata `proposal_accepted` em eventos tipo `audit` (linhas 256-264), adicionar todos os campos que já existem no metadata:

- **Título da proposta** (`proposal_title`)
- **Valor** (`proposal_value`) — já existe
- **Aprovado por** (`acceptor_name`) — já existe
- **Cargo** (`acceptor_position`)
- **Documento** (`acceptor_document` — mascarado)
- **Aceita em** (`accepted_at`)
- **Comprovante** (buscar `acceptance_proof_url` da proposta via `proposal_acceptance`)

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/pages/intelligence/WinLossHub.tsx` | Remover restrição `sales` da Análise de Ganhos e Feedback de Recusas; adaptar labels por contexto |
| `src/components/opportunity/TimelineEventCard.tsx` | Adicionar campos completos de aprovação (cargo, documento, data, comprovante) no evento `proposal_accepted` do audit |

