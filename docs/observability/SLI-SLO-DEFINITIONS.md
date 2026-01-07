# SLI/SLO Definitions

> **Ref:** Grandfather Guardrail - Seção 5.5 (Observabilidade)

Este documento define os Service Level Indicators (SLIs) e Service Level Objectives (SLOs) para o sistema NOID CRM.

---

## Definições

| Termo | Significado |
|-------|-------------|
| **SLI** | Service Level Indicator - métrica que mede comportamento do sistema |
| **SLO** | Service Level Objective - target de qualidade para um SLI |
| **SLA** | Service Level Agreement - contrato formal com consequências |
| **Error Budget** | Quantidade de erros permitidos dentro do SLO |

---

## SLIs Obrigatórios

### 1. Availability (Disponibilidade)

| Métrica | Fórmula | Target SLO |
|---------|---------|------------|
| API Availability | `(total_requests - 5xx_errors) / total_requests * 100` | 99.9% |
| Frontend Availability | `(successful_page_loads) / (total_page_loads) * 100` | 99.5% |
| Database Availability | `(successful_queries) / (total_queries) * 100` | 99.9% |

### 2. Latency (Latência)

| Endpoint | p50 Target | p95 Target | p99 Target | Crítico |
|----------|------------|------------|------------|---------|
| **API Core** | < 100ms | < 500ms | < 2s | > 5s = incidente |
| **Login/Auth** | < 200ms | < 500ms | < 1s | > 2s = incidente |
| **Dashboard Load** | < 1s | < 2s | < 4s | > 10s = incidente |
| **Database Queries** | < 50ms | < 100ms | < 500ms | > 1s = investigar |
| **Edge Functions** | < 500ms | < 2s | < 5s | > 10s = incidente |

### 3. Error Rate (Taxa de Erros)

| Área | Target SLO | Crítico |
|------|------------|---------|
| API Endpoints | < 0.1% | > 1% = incidente |
| Auth Operations | < 0.05% | > 0.5% = incidente |
| Database Operations | < 0.01% | > 0.1% = investigar |
| Edge Functions | < 1% | > 5% = incidente |

### 4. Throughput (Capacidade)

| Recurso | Target | Alerta |
|---------|--------|--------|
| API Requests/min | Baseline + 20% | > 150% baseline |
| DB Connections | < 80% pool | > 90% = alerta |
| Edge Function Invocations | No limit | Cost monitoring |

---

## Error Budget

**Cálculo de Error Budget Mensal (SLO 99.9%):**

```
Minutos no mês: 30 dias × 24h × 60min = 43,200 minutos
Error Budget (0.1%): 43.2 minutos de downtime permitido

Se budget < 25%: PARE features, foque em reliability
Se budget esgotado: Freeze de deploy até próximo mês
```

### Error Budget por Área

| Área | SLO | Budget Mensal | Status |
|------|-----|---------------|--------|
| API Core | 99.9% | 43.2 min | 🟢 Monitorar |
| Auth | 99.95% | 21.6 min | 🟢 Monitorar |
| Database | 99.9% | 43.2 min | 🟢 Monitorar |
| Edge Functions | 99% | 432 min | 🟢 Monitorar |

---

## Alertas Configurados

### Alertas Imediatos (P0)

| Condição | Ação |
|----------|------|
| API 5xx > 5% por 1 min | Página de plantão |
| Auth failures > 10% por 1 min | Página de plantão |
| Database down | Página imediata |
| Edge function timeout > 50% | Alerta Slack |

### Alertas de Threshold (P1)

| Condição | Ação |
|----------|------|
| Latency p95 > 1s por 5 min | Alerta Slack |
| Error rate > 0.5% por 10 min | Alerta Slack |
| DB queries p95 > 200ms | Alerta Slack |

### Alertas de Anomalia (P2)

| Condição | Ação |
|----------|------|
| Traffic > 200% baseline | Alerta Slack |
| New error type detected | Alerta Slack |
| Cost spike > 50% | Alerta email |

---

## Dashboards

### Dashboard Principal

Métricas exibidas:
- Request rate (RPM)
- Error rate (%)
- Latency p50/p95/p99
- Active users
- Database connections

### Dashboard por Área

| Área | Métricas Chave |
|------|----------------|
| **Auth** | Login success rate, signup rate, session duration |
| **CRM** | Opportunities created, accounts viewed, activities logged |
| **AI** | Volts consumed, latency, success rate |
| **Performance** | Core Web Vitals (LCP, FID, CLS) |

---

## Instrumentação Obrigatória

### Para Novas Features

Ao criar/modificar áreas críticas, OBRIGATÓRIO adicionar:

```typescript
// 1. Métrica de latência
const startTime = performance.now();
// ... operação
const latency = performance.now() - startTime;
console.log(`[METRIC] operation_name latency_ms=${latency}`);

// 2. Contador de erros
try {
  // ... operação
} catch (error) {
  console.error(`[METRIC] operation_name error=true message=${error.message}`);
  throw error;
}

// 3. Log estruturado com contexto
console.log(JSON.stringify({
  type: 'operation',
  name: 'operation_name',
  user_id: userId,
  tenant_id: orgId,
  request_id: requestId,
  latency_ms: latency,
  success: true,
}));
```

### Áreas que EXIGEM Instrumentação

- ✅ Autenticação/Autorização
- ✅ Operações de dados em massa
- ✅ Integrações externas (APIs de terceiros)
- ✅ Webhooks
- ✅ Background jobs
- ✅ Queries complexas (> 3 JOINs ou agregações)
- ✅ Edge functions
- ✅ AI/LLM calls

---

## Runbooks

### RB-001: API Error Rate Alto

```
Trigger: Error rate > 1% por 5 min
Ações:
1. Verificar logs de erro no Supabase Analytics
2. Identificar endpoint(s) afetado(s)
3. Verificar se há deploy recente
4. Se sim, considerar rollback
5. Se não, investigar causa raiz
6. Comunicar status no Slack #incidents
```

### RB-002: Latência Alta

```
Trigger: p95 > 2s por 10 min
Ações:
1. Verificar carga do banco de dados
2. Identificar queries lentas (EXPLAIN ANALYZE)
3. Verificar se há lock contention
4. Considerar adicionar índice ou otimizar query
5. Se persistir, escalar para DBA
```

### RB-003: Auth Failures

```
Trigger: Auth failure rate > 5%
Ações:
1. Verificar se Supabase Auth está operacional
2. Verificar logs de auth no Supabase
3. Verificar se há ataque de força bruta (rate limit)
4. Verificar configurações de CORS/redirect
5. Comunicar status aos usuários se necessário
```

---

## Revisão e Manutenção

| Item | Frequência |
|------|------------|
| Revisão de SLOs | Trimestral |
| Revisão de alertas | Mensal |
| Teste de runbooks | Trimestral |
| Atualização de dashboards | Sob demanda |

---

**Última atualização:** 2025-01-07
**Responsável:** Engineering Team
