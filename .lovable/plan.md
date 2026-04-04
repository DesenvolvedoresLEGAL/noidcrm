

## Auditoria de Segurança NOID — Relatório Completo

---

### 1. VULNERABILIDADES CRÍTICAS ENCONTRADAS

#### 🔴 CRÍTICO-01: Edge Functions Admin sem Autenticação
**Funções afetadas:** `admin-cleanup-data`, `admin-reset-password`, `export-full-dump`, `export-full-backup`
**Cenário de ataque:** Qualquer pessoa com a URL do Supabase + anon key pode chamar `admin-cleanup-data` com `action: delete_organization` e apagar uma organização inteira. Pode chamar `admin-reset-password` para resetar a senha de qualquer usuário. `export-full-dump` usa `verify_jwt=false` e apenas verifica se `Authorization` header existe — não valida o JWT. Aceita qualquer string como token e usa `service_role` para exportar todas as tabelas.
**Impacto:** Exclusão total de dados, takeover de qualquer conta, exfiltração completa do banco.
**Correção:** Adicionar `getClaims()` + verificação de role admin/owner em todas essas funções. Para `admin-cleanup-data` e `admin-reset-password`, exigir que o chamador seja `owner` ou `admin` da organização.

#### 🔴 CRÍTICO-02: `ingest-lead` sem Autenticação
**Cenário:** Função com `verify_jwt=false` que cria contas, contatos e oportunidades. Aceita qualquer `organization_id` sem validar quem chama. Um atacante pode injetar leads falsos em qualquer organização, poluir o funil e consumir recursos.
**Correção:** Validar API key (já existe campo `api_key` no body mas nunca é verificado!) contra tabela `api_keys` usando hash SHA-256.

#### 🔴 CRÍTICO-03: `export-full-backup` — IDOR (Insecure Direct Object Reference)
**Cenário:** Aceita `organization_id` no body sem verificar se o usuário pertence àquela organização. Qualquer usuário autenticado pode exportar dados de qualquer org.
**Correção:** Validar JWT, extrair user_id, verificar pertencimento à org via `organization_members`.

#### 🔴 CRÍTICO-04: `bulk-create-users` Admin Bypass via LOVABLE_API_KEY
**Cenário:** O campo `adminSecret` no body permite bypass total de autenticação. Se esse secret vazar (logs, rede), qualquer pessoa pode criar usuários em qualquer organização com role `owner`.
**Correção:** Remover admin bypass ou restringir a chamadas internas com `x-internal-secret` + IP allowlist.

---

### 2. VULNERABILIDADES ALTAS

#### 🟠 ALTO-01: RLS Policies com `WITH CHECK (true)` em tabelas de escrita
**Tabelas:** `public_form_submissions` (INSERT true), `scheduled_demos` (INSERT true)
**Cenário:** `public_form_submissions` permite qualquer anon inserir com qualquer `organization_id`/`opportunity_id`. Possível flood/spam.
**Correção:** Para `public_form_submissions` — validar via trigger que o token do form existe. Para `scheduled_demos` — adicionar rate limiting por IP.

#### 🟠 ALTO-02: 5 Funções SECURITY DEFINER sem `search_path` fixo
**Cenário:** Funções sem `SET search_path` podem ser exploradas via schema poisoning se um atacante conseguir criar objetos no schema público.
**Correção:** Adicionar `SET search_path = public` a todas as funções afetadas (identificadas pelo linter).

#### 🟠 ALTO-03: Funções CRON/batch sem autenticação adequada
**Funções afetadas:** `daily-briefing-generator`, `auto-task-creator`, `sales-coach-notifications`, `daily-scoring-cron`, `process-pending-workflows`, `auto-apply-ai-suggestions`, `detect-stale-opportunities`, `activity-reminders`, `run-autonomous-sequences`, `generate-ai-alerts`, `mastermind-daily-hook`
**Todas** com `verify_jwt=false` e muitas sem verificação de `x-internal-secret`.
**Cenário:** Atacante pode disparar CRON functions manualmente, gerando spam de notificações, execuções duplicadas, ou consumo de créditos de IA.
**Correção:** Cada CRON function deve validar `x-internal-secret` ou um header CRON-specific.

#### 🟠 ALTO-04: `SmtpSettings.tsx` — dangerouslySetInnerHTML sem sanitização
**Linha 318:** Renderiza `signatureHtml` sem `sanitizeHtml()`.
**Cenário:** Admin configura assinatura SMTP com XSS payload → todos os emails enviados pelo sistema carregam o script.
**Correção:** Aplicar `sanitizeHtml()` ao `signatureHtml`.

---

### 3. VULNERABILIDADES MÉDIAS

#### 🟡 MÉDIO-01: CORS `Access-Control-Allow-Origin: '*'` em todas as Edge Functions
**Impacto:** Qualquer domínio pode chamar as APIs. Para funções autenticadas isso é atenuado pelo JWT, mas para funções públicas (ingest-lead, track-proposal-view) permite abuse cross-origin.
**Correção:** Restringir CORS para domínios conhecidos (`noid-crm.lovable.app`, `crm.humanoid-os.ai`) nas funções sensíveis.

#### 🟡 MÉDIO-02: Ausência de Rate Limiting na maioria das funções
Apenas `check-org-slug`, `track-proposal-view` e `process-email-queue` implementam rate limiting.
**Funções sem proteção:** Todas as funções AI (`ai-score-deal`, `ai-meeting-prep`, etc.), `ingest-lead`, `admin-*`, `export-*`.
**Correção:** Implementar rate limiting por IP/user nas funções de alto custo (AI) e sensíveis (admin).

#### 🟡 MÉDIO-03: Logs expondo dados sensíveis
**`ingest-lead`:** Log completo de org name, seller names.
**`admin-reset-password`:** Log do email do usuário (`data.user?.email`).
**`bulk-create-users`:** Log do org ID.
**Correção:** Remover PII dos logs. Logar apenas IDs ofuscados.

---

### 4. CHECKLIST DE HARDENING

#### 🔴 RESOLVER HOJE (Crítico)
- [ ] **admin-cleanup-data:** Adicionar autenticação JWT + verificar role owner/admin
- [ ] **admin-reset-password:** Adicionar autenticação JWT + verificar role owner/admin
- [ ] **export-full-dump:** Validar JWT (não apenas presença de header) + verificar role admin
- [ ] **export-full-backup:** Validar JWT + verificar user pertence à org do `organization_id`
- [ ] **ingest-lead:** Implementar validação de API key contra tabela `api_keys`

#### 🟠 RESOLVER ESSA SEMANA (Alto)
- [ ] Adicionar `x-internal-secret` em todas as 11 CRON functions listadas
- [ ] Fixar `search_path` nas 5 SECURITY DEFINER functions identificadas
- [ ] Sanitizar `signatureHtml` no SmtpSettings.tsx
- [ ] Remover admin bypass do `bulk-create-users` ou migrar para `x-internal-secret`
- [ ] Adicionar rate limiting nas funções AI (implementar middleware reutilizável)

#### 🟡 RESOLVER ESSA SPRINT (Médio)
- [ ] Restringir CORS para domínios autorizados
- [ ] Remover PII dos logs de Edge Functions
- [ ] Adicionar rate limiting no `ingest-lead` por IP
- [ ] Auditar todas as `WITH CHECK (true)` e adicionar validações

---

### 5. SIMULAÇÃO DE ATAQUES

**Ataque 1 — Takeover de conta via admin-reset-password:**
```bash
curl -X POST https://[supabase-url]/functions/v1/admin-reset-password \
  -H "Content-Type: application/json" \
  -d '{"userId":"<target-uuid>","newPassword":"hacked123"}'
```
Resultado: Senha alterada. Sem auth necessário. **Sistema quebra aqui.**

**Ataque 2 — Exfiltração total via export-full-dump:**
```bash
curl -X POST https://[supabase-url]/functions/v1/export-full-dump \
  -H "Authorization: Bearer fake-token" \
  -H "Content-Type: application/json"
```
Resultado: Dump JSON de todas as tabelas. Token fake aceito. **Sistema quebra aqui.**

**Ataque 3 — Data poisoning via ingest-lead:**
```bash
curl -X POST https://[supabase-url]/functions/v1/ingest-lead \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"<victim-org>","lead":{"razao_social":"SPAM","contact_email":"attacker@evil.com"}}'
```
Resultado: Lead criado na org alvo. Vendedor notificado. **Sistema quebra aqui.**

**Ataque 4 — Escalada de privilégio via bulk-create-users:**
```bash
curl -X POST https://[supabase-url]/functions/v1/bulk-create-users \
  -H "Content-Type: application/json" \
  -d '{"adminSecret":"<leaked-key>","orgId":"<target-org>","users":[{"fullName":"Hacker","email":"h@evil.com","password":"Abc123!!","role":"Manager","orgRole":"owner"}]}'
```
Resultado: Atacante cria conta owner em qualquer org. **Sistema quebra aqui.**

---

### 6. LGPD — PONTOS DE ATENÇÃO

- **Soft delete implementado** (OK) — mas precisa garantir hard delete real após 90 dias conforme política declarada
- **`export-full-dump`** exporta TODOS os dados sem filtro de org — viola princípio de minimização
- **Logs de auth** (`auth_audit_log`) capturam IP e fingerprint — base legal necessária (legítimo interesse documentado)
- **Direito de exclusão:** `admin-cleanup-data` faz hard delete mas sem auditoria. Precisa registrar quem solicitou e quando

---

### 7. PLANO DE IMPLEMENTAÇÃO

**Arquivo por arquivo, o que fazer:**

| Arquivo | Ação |
|---------|------|
| `supabase/functions/admin-cleanup-data/index.ts` | Adicionar JWT validation + role check (owner/admin) |
| `supabase/functions/admin-reset-password/index.ts` | Adicionar JWT validation + role check (owner/admin) |
| `supabase/functions/export-full-dump/index.ts` | Validar JWT via getClaims() + check admin role + filtrar por org |
| `supabase/functions/export-full-backup/index.ts` | Validar JWT via getClaims() + verificar membership na org |
| `supabase/functions/ingest-lead/index.ts` | Validar `api_key` contra tabela `api_keys` (hash SHA-256) |
| `supabase/functions/bulk-create-users/index.ts` | Substituir `adminSecret` por `x-internal-secret` |
| `src/components/settings/SmtpSettings.tsx` | Aplicar `sanitizeHtml()` na renderização de `signatureHtml` |
| 11 CRON functions | Adicionar validação `x-internal-secret` no início |
| Migration SQL | Fixar `search_path` nas 5 funções SECURITY DEFINER |

**Nenhuma feature existente será quebrada.** Links públicos de propostas, formulários e tracking continuam funcionando — apenas endpoints admin/export recebem autenticação.

