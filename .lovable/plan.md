

# Corrigir Duplicação de Oportunidade no Funil OPERACIONAL ao Aceitar Proposta

## Causa Raiz

Quando uma proposta é aceita, **duas fontes distintas** criam oportunidade no OPERACIONAL:

1. **`generate-acceptance-proof`** (Edge Function) — cria automaticamente uma oportunidade `[CS] ...` no pipeline de tipo "onboarding" (OPERACIONAL)
2. **Workflow "Vendas: Ganhamos Opp"** (`e9d15f13`) — dispara ao detectar `opportunity_won` e duplica para o OPERACIONAL no estágio CheckIn

Ambas disparam porque o `generate-acceptance-proof` marca a oportunidade como "won", o que ativa o workflow. Resultado: duas oportunidades no OPERACIONAL (uma com prefixo `[CS]`, outra sem).

## Solução

**Remover a duplicação dentro do `generate-acceptance-proof`**, já que o workflow "Vendas: Ganhamos Opp" já cuida disso corretamente (com stage, responsável e configuração controlada pelo usuário).

### Alterações

1. **`supabase/functions/generate-acceptance-proof/index.ts`**
   - Remover todo o bloco que busca pipeline onboarding/CS e cria a oportunidade duplicada (`[CS] ...`), incluindo cópia de audit_log, custom_field_values e proposta clonada
   - Manter intacto: geração do comprovante PDF, atualização de status da proposta para "accepted", marcação como won, registro de win/loss, criação de contrato, notificações

2. **Limpar a oportunidade `[CS]` duplicada já existente**
   - Soft-delete da oportunidade `2be02e42` (`[CS] PREDIZE NA VTEX 2026`) que foi criada indevidamente

### Resultado
- Aceitar proposta continua funcionando normalmente (comprovante, contrato, notificações)
- A duplicação para o OPERACIONAL fica 100% controlada pelo workflow configurável pelo usuário
- Sem mais oportunidades `[CS]` fantasmas

