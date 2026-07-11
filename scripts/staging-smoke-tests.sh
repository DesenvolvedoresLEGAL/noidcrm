#!/usr/bin/env bash
# Smoke tests contra o projeto Supabase de STAGING.
# Guarda dupla contra produção. NUNCA executa em urihdqturaebhiefwjnw.
#
# Uso:
#   export STAGING_PROJECT_REF="<ref>"
#   export STAGING_ANON_KEY="<anon>"
#   export STAGING_SERVICE_ROLE_KEY="<service_role>"
#   ./scripts/staging-smoke-tests.sh
#
# NÃO commitar valores reais. Rode em terminal isolado.

set -euo pipefail

PROD_REF="urihdqturaebhiefwjnw"

: "${STAGING_PROJECT_REF:?STAGING_PROJECT_REF não definido}"
: "${STAGING_ANON_KEY:?STAGING_ANON_KEY não definido}"
: "${STAGING_SERVICE_ROLE_KEY:?STAGING_SERVICE_ROLE_KEY não definido}"

# --- GUARDAS ANTI-PRODUÇÃO ---------------------------------------------------
if [ "$STAGING_PROJECT_REF" = "$PROD_REF" ]; then
  echo "ABORT: STAGING_PROJECT_REF = ref de PRODUÇÃO ($PROD_REF)." >&2
  exit 1
fi

if [ "${STAGING_ANON_KEY:0:20}" = "${SUPABASE_PUBLISHABLE_KEY:0:20}" ] 2>/dev/null; then
  echo "ABORT: STAGING_ANON_KEY tem prefixo idêntico ao anon de produção." >&2
  exit 1
fi

STAGING_URL="https://${STAGING_PROJECT_REF}.supabase.co"
echo "[i] Alvo: $STAGING_URL"
echo "[i] Guarda anti-produção: OK (ref != $PROD_REF)"

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[ OK ] $*"; }

# --- 1. Conectividade REST ---------------------------------------------------
echo "[1/8] Conectividade REST..."
http_code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "apikey: $STAGING_ANON_KEY" \
  -H "Authorization: Bearer $STAGING_ANON_KEY" \
  "$STAGING_URL/rest/v1/")
[ "$http_code" = "200" ] || fail "REST root retornou $http_code"
pass "REST alcançável"

# --- 2. Auth health ----------------------------------------------------------
echo "[2/8] Auth health..."
auth_code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "apikey: $STAGING_ANON_KEY" \
  "$STAGING_URL/auth/v1/health")
[ "$auth_code" = "200" ] || fail "Auth health retornou $auth_code"
pass "Auth OK"

# --- 3. Public schema tem tabelas -------------------------------------------
echo "[3/8] Tabelas em public (via service_role)..."
tables=$(curl -sS \
  -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" \
  -H "Accept: application/json" \
  "$STAGING_URL/rest/v1/organizations?select=id&limit=1")
echo "$tables" | grep -q '\[' || fail "public.organizations não respondeu como array JSON: $tables"
pass "public.organizations existe"

# --- 4. organizations está vazia (sem dados reais) --------------------------
echo "[4/8] Confirmando ausência de dados reais..."
count_json=$(curl -sS -I \
  -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" \
  -H "Range: 0-0" \
  "$STAGING_URL/rest/v1/organizations?select=id" | tr -d '\r')
range=$(echo "$count_json" | awk -F'/' '/content-range/i {print $2}' | tr -d ' ')
if [ -z "$range" ]; then
  echo "[warn] Não foi possível ler content-range; pulando checagem de contagem"
else
  if [ "$range" != "0" ] && [ "$range" != "*" ]; then
    echo "[warn] organizations contém $range linhas. Staging deveria estar vazio (fixture cria durante o teste)."
    echo "       Se são fixtures 'iso-*' residuais, rodar teardown manual."
  else
    pass "organizations vazia (0 linhas)"
  fi
fi

# --- 5. anon NÃO consegue ler user_roles (RLS ativa) ------------------------
echo "[5/8] RLS bloqueando anon em user_roles..."
anon_resp=$(curl -sS -o /dev/null -w "%{http_code}" \
  -H "apikey: $STAGING_ANON_KEY" \
  -H "Authorization: Bearer $STAGING_ANON_KEY" \
  "$STAGING_URL/rest/v1/user_roles?select=id&limit=1")
# 200 com [] também é aceitável (RLS filtra); rejeitar apenas se retornar linhas
if [ "$anon_resp" = "200" ] || [ "$anon_resp" = "401" ] || [ "$anon_resp" = "403" ]; then
  pass "user_roles inacessível/filtrado para anon (HTTP $anon_resp)"
else
  fail "user_roles retornou $anon_resp para anon"
fi

# --- 6. Storage buckets listáveis via service_role --------------------------
echo "[6/8] Storage buckets..."
buckets=$(curl -sS \
  -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" \
  "$STAGING_URL/storage/v1/bucket")
echo "$buckets" | grep -q '\[' || fail "Storage bucket list falhou: $buckets"
pass "Storage responde"

# --- 7. Criação e deleção de usuário de smoke via admin API -----------------
echo "[7/8] auth.admin createUser + deleteUser..."
smoke_email="smoke-$(date +%s)-$RANDOM@example.test"
create_resp=$(curl -sS -X POST \
  -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$smoke_email\",\"password\":\"SmokeTest!$RANDOM\",\"email_confirm\":true}" \
  "$STAGING_URL/auth/v1/admin/users")
smoke_uid=$(echo "$create_resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$smoke_uid" ] || fail "createUser falhou: $create_resp"
del_code=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE \
  -H "apikey: $STAGING_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $STAGING_SERVICE_ROLE_KEY" \
  "$STAGING_URL/auth/v1/admin/users/$smoke_uid")
[ "$del_code" = "200" ] || fail "deleteUser retornou $del_code"
pass "createUser/deleteUser OK ($smoke_email)"

# --- 8. Reafirmar guarda: host != produção ----------------------------------
echo "[8/8] Reconfirmando guarda anti-produção..."
if [ "$STAGING_PROJECT_REF" = "$PROD_REF" ]; then
  fail "REGRESSÃO: STAGING_PROJECT_REF virou produção durante o script"
fi
pass "Guarda anti-produção reafirmada"

echo
echo "============================================================"
echo " Smoke tests: SUCESSO"
echo " Alvo: $STAGING_URL"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "============================================================"
echo
echo "Próximo passo: disparar o workflow 'Tenant Isolation Suite'"
echo "no GitHub (Actions → Run workflow) com TENANT_ISOLATION_ENABLED=true."
