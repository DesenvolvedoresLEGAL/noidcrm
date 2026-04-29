## Diagnóstico forense

A falha atual do Pipeline não é mais um problema genérico de cache/chunk. O print mostra erro real de runtime:

```text
TypeError: Cannot read properties of undefined (reading 'bgColor')
at NRHSBadge
```

Causa raiz confirmada:

1. A Sprint Scoring 1.3 passou a gravar `nrhs_tier` com novos valores:
   - `healthy`
   - `attention`
   - `critical`

2. O frontend antigo do NRHS só reconhece estes valores:
   - `elite`
   - `healthy`
   - `risk`
   - `critical`
   - `insalubrious`

3. O banco já tem oportunidades com `nrhs_tier = 'attention'`:

```text
attention: 33 oportunidades
critical: 102
healthy: 43
```

4. Quando o Pipeline tenta renderizar um card com `nrhs_tier = 'attention'`, `getNRHSTierConfig('attention')` retorna `undefined`; em seguida o componente tenta acessar `tierConfig.bgColor` e derruba a página inteira via ErrorBoundary.

## Fix imediato

Vou aplicar uma correção pequena e segura em duas camadas:

### 1. Blindar o componente que derruba o Pipeline

Arquivo:

```text
src/components/nrhs/NRHSBadge.tsx
```

Mudanças:
- Aceitar tiers legados e novos sem quebrar a UI.
- Normalizar `attention` para o visual equivalente a `risk`/atenção.
- Se vier qualquer valor desconhecido no futuro, usar fallback seguro em vez de lançar erro.
- Nunca acessar `tierConfig.bgColor` quando `tierConfig` estiver indefinido.

Resultado: o Pipeline volta a abrir imediatamente mesmo com dados mistos no banco.

### 2. Corrigir a origem da inconsistência no cálculo novo

Arquivo:

```text
supabase/functions/calculate-opportunity-indicators/index.ts
```

Mudança:
- Trocar a geração de `nrhs_tier = 'attention'` para o vocabulário oficial existente:

```text
>= 90  elite
>= 75  healthy
>= 60  risk
>= 40  critical
< 40   insalubrious
```

Resultado: novos recálculos não continuarão gravando valores incompatíveis.

## Correção opcional de dados existentes

Como já existem registros com `attention`, vou incluir migração para normalizar dados atuais:

```sql
update public.opportunities
set nrhs_tier = 'risk'
where nrhs_tier = 'attention';
```

Essa atualização é segura porque `attention` era o mesmo conceito operacional de “atenção / risco moderado”.

## Arquivos impactados

```text
src/components/nrhs/NRHSBadge.tsx
supabase/functions/calculate-opportunity-indicators/index.ts
supabase/migrations/<nova_migration>_normalize_nrhs_attention_tier.sql
```

## Validação após o fix

Vou verificar:

1. Que não existe mais acesso direto a `tierConfig.bgColor` sem fallback.
2. Que o cálculo novo não grava mais `attention`.
3. Que o banco não mantém `nrhs_tier = 'attention'` após a migração.
4. Que o Pipeline não pode mais cair por tier NRHS desconhecido.

## Riscos

Baixo risco. A alteração é localizada e não mexe em RLS, permissões, filtros comerciais, nem fluxo de pipeline. O único efeito visual é que oportunidades que estavam como `attention` aparecerão como “Em Risco”/atenção, sem quebrar a tela.