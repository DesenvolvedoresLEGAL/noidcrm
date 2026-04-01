

# Correção Crítica: Criação de Atividades na Oportunidade

## Problemas Identificados

### 1. Conta não fica travada ao abrir modal pela oportunidade
O `OpportunityActivitiesTab` passa os dados via `prefillData`, mas o `CreateActivityModal` só desabilita o campo conta quando recebe `defaultAccountId` — que nunca é passado neste fluxo. Resultado: campo editável e em branco.

### 2. Horário da IA corrompe o campo
O console mostra `"09:00 (baseado em padrões de sucesso)"` sendo atribuído ao campo `scheduled_time`. A edge function `ai-activity-suggestions` retorna texto descritivo junto ao horário, quebrando a validação do input HTML `time`.

### 3. Erro ao criar atividade
Se o `account_id` não foi preenchido corretamente (race condition do prefill), o insert falha com 400. Além disso, o erro é tratado duas vezes (no `handleSubmit` do modal E no `handleCreateActivity` do tab), causando rejeição silenciosa.

## Alterações

### Arquivo 1: `src/components/opportunity/OpportunityActivitiesTab.tsx`
- Passar `defaultAccountId={opportunity?.account_id}` como prop no `CreateActivityModal`
- Isso garante que o campo conta fique **travado e preenchido** automaticamente
- No `handleCreateActivity`, garantir que `account_id` da oportunidade seja sempre incluído no insert

### Arquivo 2: `src/components/activities/CreateActivityModal.tsx`
- **Sanitizar `suggestedTime`** da IA: extrair apenas o padrão `HH:MM` via regex antes de aplicar ao campo, ignorando texto descritivo
- **Melhorar lógica de disable do campo conta**: desabilitar quando `defaultAccountId` OU quando `prefillData?.opportunity_id` existe (indicando contexto de oportunidade)
- **Corrigir double-throw**: o `handleSubmit` faz `await onSubmit(activityData)` dentro de try/catch — se `onSubmit` (do parent) já trata e re-lança, o modal mostra toast duplicado. Ajustar para propagar o erro corretamente sem duplicação.

### Resultado
- Campo conta **sempre preenchido e travado** ao abrir pela oportunidade
- Horário sugerido pela IA não corrompe o formulário
- Criação de atividades funciona sem erros

