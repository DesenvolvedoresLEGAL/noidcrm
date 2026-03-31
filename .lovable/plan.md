

# Reconfigurar Níveis OTE

## Situação atual
Os 10 níveis ainda têm os valores antigos (Starter, Tracer, Connector...). A migration anterior não foi executada.

## Dados dos prints (com correção do usuário)

### BDR/SDR — Meta em LEADS QUALIFICADOS (is_team_target = false)
| Ordem | Nome | Código | Fixo | Variável | Meta (leads) | Descrição |
|-------|------|--------|------|----------|--------------|-----------|
| 1 | Scout | BDR1 | 1.800 | 2.200 | 50 | ≥30% vira oportunidade |
| 2 | Hunter | BDR2 | 2.500 | 3.500 | 75 | ≥35% vira oportunidade |
| 3 | Sniper | BDR3 | 2.500 | 5.500 | 100 | ≥40% vira oportunidade |

### Closers — Meta em R$ (is_team_target = false)
| Ordem | Nome | Código | Fixo | Variável | Meta (R$) |
|-------|------|--------|------|----------|-----------|
| 4 | Closer | CLOSER1 | 3.200 | 4.800 | 60.000 |
| 5 | Executor | CLOSER2 | 3.850 | 7.150 | 80.000 |
| 6 | Rainmaker | CLOSER3 | 4.500 | 10.500 | 110.000 |
| 7 | DealMaker | CLOSER4 | 5.000 | 15.000 | 150.000 |
| 8 | Strategic | CLOSER5 | 5.000 | 20.000 | 200.000 |

### Gerenciais — Meta do time (is_team_target = true)
| Ordem | Nome | Código | Fixo | Variável | Meta |
|-------|------|--------|------|----------|------|
| 9 | Manager | GESTOR1 | 14.300 | 7.700 | 0 (meta do time) |
| 10 | Head | GESTOR2 | 21.000 | 9.000 | 0 (meta global) |

## Execução
Uma única operação UPDATE via insert tool (não migration, pois é atualização de dados, não de schema) para os 10 registros existentes, usando os IDs atuais:

- `5e6b989f` (order 1, Starter) → Scout
- `4e1aa8f0` (order 2, Tracer) → Hunter
- `e53ee589` (order 3, Connector) → Sniper
- `dcedb147` (order 4, Booster) → Closer
- `8c134ef9` (order 5, Closer) → Executor
- `6bb9f514` (order 6, Planner) → Rainmaker
- `5f92fdb6` (order 7, Driver) → DealMaker, **is_team_target = false**
- `7df7d52a` (order 8, Architect) → Strategic, **is_team_target = false**
- `afc73925` (order 9, Strategist) → Manager, **is_team_target = true**
- `5d9fc9d9` (order 10, Visionary) → Head, **is_team_target = true**

IDs preservados para não quebrar referências em `ote_seller_config` e `ote_monthly_results`.

## Observação
A coluna `description` nos BDRs incluirá "Meta: X leads qualificados" para deixar claro o tipo de meta. Nos Closers: "Meta: R$ X em vendas".

