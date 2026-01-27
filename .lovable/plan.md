
# Plano: Funcionalidade de Reabertura de Oportunidades e Propostas

## Contexto do Caso Atual

A oportunidade **MX3 GROUP na ciosp 26** (ID: `9ee85733-a13f-45fe-a9be-3acc55445124`) foi marcada como **GANHA** em 13/01/2026, mas o cliente desistiu e não quer mais contratar o serviço.

**Dados Atuais:**
| Campo | Valor |
|-------|-------|
| Status Oportunidade | `won` |
| Stage atual | `Ganhamos` (order_index: 7) |
| closed_at | 13/01/2026 15:29 |
| Proposta Aceita | PROP-2026-00345 (status: `accepted`) |
| Win/Loss Record | `c227a195-b0c3-4626-b188-5936b3295e19` (outcome: `won`) |

## Solução Proposta

Implementar uma funcionalidade de **"Reabrir Oportunidade"** que permite:

1. Reverter o status de `won` para `open`
2. Cancelar propostas aceitas associadas
3. Registrar histórico da reabertura
4. Permitir marcar como PERDIDA posteriormente

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE REABERTURA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [1] UI: Botão "Reabrir" no menu de ações (...)                        │
│           ↓                                                             │
│  [2] Modal de Confirmação com motivo (obrigatório)                     │
│           ↓                                                             │
│  [3] Backend: reopenOpportunity()                                      │
│       ├── Atualiza opportunity: status → 'open', closed_at → null      │
│       ├── Move para stage anterior (Pré-Aprovação ou Negociação)       │
│       ├── Cancela propostas aceitas → status: 'cancelled'              │
│       ├── Atualiza win_loss_record → outcome: 'reopened'               │
│       └── Registra no audit_log                                         │
│           ↓                                                             │
│  [4] Usuário pode agora marcar como PERDIDA normalmente                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação

### 1. Nova Função de Serviço (Backend)

Criar `reopenOpportunity()` em `src/services/supabase/opportunities.ts`:

```text
Parâmetros:
- opportunityId: string
- reason: string (motivo da reabertura - obrigatório)
- targetStageId?: string (opcional - padrão: última etapa antes de "Ganhamos")

Ações:
1. Validar que oportunidade está com status 'won'
2. Buscar etapa anterior (order_index - 1 da etapa "Ganhamos")
3. UPDATE opportunities:
   - status: 'open'
   - closed_at: NULL
   - stage_id: targetStageId (ex: Pré-Aprovação)
4. UPDATE proposals WHERE opportunity_id AND status='accepted':
   - status: 'cancelled'
   - cancelled_at: NOW()
   - cancelled_reason: 'Venda reaberta: {reason}'
5. UPDATE win_loss_records:
   - outcome: 'reopened'
   - reopened_at: NOW()
   - reopen_reason: reason
6. INSERT audit_log (ação: 'opportunity_reopened')
```

### 2. Nova Coluna no Banco (Opcional)

Para propostas, adicionar campo `cancelled_at` se não existir, ou usar o campo existente de recusa.

### 3. Componente UI

#### A. Novo Modal: `ReopenOpportunityModal.tsx`

- Campo obrigatório: Motivo da reabertura
- Selector: Etapa de destino (padrão: Pré-Aprovação ou última etapa de negociação)
- Aviso: "Esta ação cancelará todas as propostas aceitas"

#### B. Atualização do `OpportunitySidebar.tsx`

Adicionar item no DropdownMenu (quando status === 'won'):

```text
<DropdownMenuItem onClick={onReopen}>
  <RotateCcw className="h-4 w-4 mr-2" />
  Reabrir Venda
</DropdownMenuItem>
```

#### C. Atualização do `OpportunityDetail.tsx`

- Adicionar estado e mutation para reabertura
- Passar `onReopen` para o sidebar
- Incluir o novo modal

---

## Correção Imediata do Caso Atual

Enquanto a funcionalidade não está implementada, executar SQL para corrigir manualmente:

```text
-- 1. Reabrir oportunidade
UPDATE opportunities 
SET 
  status = 'open',
  closed_at = NULL,
  stage_id = 'fee549f1-354e-41bc-b088-3fdf5040837a'  -- Pré-Aprovação
WHERE id = '9ee85733-a13f-45fe-a9be-3acc55445124';

-- 2. Cancelar proposta aceita
UPDATE proposals 
SET 
  status = 'rejected',
  declined_at = NOW(),
  declined_reason = 'Venda cancelada - cliente desistiu'
WHERE id = '7b415545-b896-4224-986d-628972df0210';

-- 3. Atualizar registro de win/loss
UPDATE win_loss_records 
SET 
  outcome = 'lost',
  reason_seller = 'Cliente desistiu após aprovação inicial'
WHERE id = 'c227a195-b0c3-4626-b188-5936b3295e19';
```

Depois da correção de dados, o usuário poderá marcar como PERDIDA usando o fluxo normal (botão "Perdeu").

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/services/supabase/opportunities.ts` | Modificar | Adicionar `reopenOpportunity()` |
| `src/services/crm/opportunities.ts` | Modificar | Re-exportar `reopenOpportunity` |
| `src/components/opportunity/ReopenOpportunityModal.tsx` | Criar | Modal com motivo e seleção de etapa |
| `src/components/opportunity/OpportunitySidebar.tsx` | Modificar | Adicionar item "Reabrir Venda" no menu |
| `src/pages/OpportunityDetail.tsx` | Modificar | Adicionar estado e mutation para reabertura |

---

## Considerações de Segurança

1. **Permissões**: Apenas `owner`, `admin` e `manager` podem reabrir
2. **Auditoria**: Registrar motivo, usuário e timestamp no audit_log
3. **Integridade**: Cascatear cancelamento para propostas e win_loss_records

---

## Próximos Passos após Implementação

1. **Correção imediata**: Executar SQL para reabrir o caso MX3 GROUP
2. **Implementar funcionalidade**: Criar a feature completa
3. **Marcar como perdida**: Após reabertura, usar fluxo normal de perda

