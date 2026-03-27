

## Fix: Auto-preencher empresa no modal "Nova Atividade" dentro da oportunidade

### Problema
Ao criar atividade de dentro da oportunidade, o contato e a oportunidade são preenchidos automaticamente, mas o campo **Conta/Cliente** fica vazio. Isso ocorre por uma condição de corrida: o `form.setValue('account_id')` é executado, mas o Select não reflete o valor porque as accounts podem ainda não ter carregado, ou o efeito não re-executa após o carregamento.

### Causa raiz
No `CreateActivityModal.tsx`, o useEffect (linha 117) que seta `account_id` depende de `loadingAccounts` e `accounts.length`, mas:
1. Quando `accounts` carrega, o valor pode já ter sido setado e a condição `currentValue !== prefillData.account_id` impede re-setar
2. O `form.setValue` pode rodar antes do Select ter as options disponíveis, fazendo o componente não exibir o nome

### Solução

**Arquivo: `src/components/activities/CreateActivityModal.tsx`**

Refatorar o useEffect de prefill do `account_id` para garantir que:
- Re-sete o valor **após** `accounts` terminar de carregar e conter o account do prefill
- Verificar que o account existe na lista antes de setar
- Forçar o trigger de validação após setar

```typescript
// STEP 1: Pré-preencher account_id - com verificação de existência
useEffect(() => {
  if (!open || !prefillData?.account_id || loadingAccounts) return;
  if (accounts.length === 0) return;
  
  // Verificar que o account existe na lista
  const accountExists = accounts.some(a => a.id === prefillData.account_id);
  if (!accountExists) return;
  
  const currentValue = form.getValues('account_id');
  if (currentValue !== prefillData.account_id) {
    form.setValue('account_id', prefillData.account_id, { shouldValidate: true });
    lastManualAccountRef.current = prefillData.account_id;
  }
}, [open, prefillData?.account_id, loadingAccounts, accounts, form]);
```

A mudança chave é: adicionar `accounts` (o array inteiro) como dependência e verificar `accountExists` antes de setar, garantindo que o Select já tem as options quando o valor é aplicado. Também usar `{ shouldValidate: true }` para forçar o re-render do form.

