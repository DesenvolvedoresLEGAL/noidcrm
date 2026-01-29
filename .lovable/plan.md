

## Diagnóstico do Problema

Após análise detalhada do código e do comportamento relatado, identifiquei a causa raiz do problema:

### Problema Principal: Validação Zod falha silenciosamente com campos numéricos

Quando os campos numéricos (`cost`, `monthly_price`, `ipi_percent`, etc.) estão vazios ou têm formato inválido:

1. O `valueAsNumber: true` do react-hook-form retorna `NaN` para campos vazios
2. A validação Zod `z.number().min(0).optional()` falha com `NaN` porque:
   - `typeof NaN === 'number'` é true, então passa a verificação de tipo
   - Mas `NaN >= 0` é false, então falha na validação `min(0)`
3. O formulário não exibe erros de validação para esses campos (só mostra erro para o campo `name`)
4. O botão "Criar" não faz nada porque a validação falha silenciosamente

### Por que Avulso funciona e MRR não

No modo **Avulso**, o campo `price` provavelmente está sendo preenchido pelo usuário, e os campos opcionais (`cost`, `ipi_percent`) podem estar vazios mas não causam problema porque não são usados no fluxo de submit.

No modo **MRR (Recorrente)**, o campo `monthly_price` é essencial para o cálculo, e se houver qualquer problema de parsing (vírgula ao invés de ponto, espaços, etc.), retorna `NaN` e falha.

---

## Solução Proposta

### 1. Corrigir Schema Zod para tratar NaN como undefined

Modificar o schema para aceitar `NaN` como `undefined`:

```typescript
const parseNumber = (val: unknown) => {
  if (val === '' || val === undefined || val === null) return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};

const productSchema = z.object({
  // ... outros campos ...
  cost: z.preprocess(parseNumber, z.number().min(0).optional()),
  price: z.preprocess(parseNumber, z.number().min(0).optional()),
  ipi_percent: z.preprocess(parseNumber, z.number().min(0).max(100).optional()),
  monthly_price: z.preprocess(parseNumber, z.number().min(0).optional()),
  minimum_contract_months: z.preprocess(parseNumber, z.number().int().min(1).optional()),
});
```

### 2. Adicionar exibição de erros de validação para todos os campos

Atualmente só o campo `name` mostra erro. Adicionar feedback visual para todos os campos obrigatórios e numéricos.

### 3. Usar setValueAs no register para tratar NaN

Alternativa mais simples: usar `setValueAs` ao invés de `valueAsNumber`:

```typescript
{...form.register('monthly_price', { 
  setValueAs: (v) => v === '' ? undefined : parseFloat(v)
})}
```

---

## Alterações Necessárias

### Arquivo: `src/components/products/ProductModal.tsx`

1. **Adicionar função helper para parse de números** (linha ~20):
```typescript
const parseNumber = (val: unknown) => {
  if (val === '' || val === undefined || val === null) return undefined;
  const parsed = Number(val);
  return isNaN(parsed) ? undefined : parsed;
};
```

2. **Modificar schema Zod** para usar `z.preprocess`:
```typescript
cost: z.preprocess(parseNumber, z.number().min(0, 'Custo deve ser positivo').optional()),
price: z.preprocess(parseNumber, z.number().min(0, 'Preço deve ser positivo').optional()),
ipi_percent: z.preprocess(parseNumber, z.number().min(0).max(100).optional()),
monthly_price: z.preprocess(parseNumber, z.number().min(0, 'Preço mensal deve ser positivo').optional()),
minimum_contract_months: z.preprocess(parseNumber, z.number().int().min(1).optional()),
```

3. **Remover `valueAsNumber: true`** de todos os inputs numéricos e usar apenas o preprocess do Zod para conversão

4. **Adicionar mensagens de erro** para campos críticos (monthly_price quando billing_type é recurring)

---

## Validação Condicional (Opcional, mas recomendado)

Adicionar refinamento Zod para exigir `monthly_price` quando `billing_type === 'recurring'`:

```typescript
const productSchema = z.object({
  // ... campos ...
}).refine(
  (data) => data.billing_type !== 'recurring' || (data.monthly_price !== undefined && data.monthly_price > 0),
  {
    message: 'Preço mensal é obrigatório para produtos recorrentes',
    path: ['monthly_price'],
  }
);
```

---

## Resultado Esperado

- Formulário submete corretamente para produtos MRR
- Campos vazios são tratados como `undefined` (válido)
- Erros de validação são exibidos ao usuário
- Tanto Avulso quanto MRR funcionam consistentemente

