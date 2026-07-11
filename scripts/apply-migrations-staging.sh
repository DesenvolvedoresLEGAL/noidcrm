#!/usr/bin/env bash
# Aplica migrations ao Supabase de STAGING.
# Recusa executar contra o project ref de produção.
# Nunca imprime service_role.
set -Eeuo pipefail

PROD_REF="urihdqturaebhiefwjnw"

log()  { printf "\033[1;34m[staging]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[erro]\033[0m %s\n" "$*" >&2; exit 1; }

# --- 1. Validações --------------------------------------------------------------
: "${TEST_SUPABASE_URL:?TEST_SUPABASE_URL não definido (URL do projeto staging)}"
: "${TEST_SUPABASE_ANON_KEY:?TEST_SUPABASE_ANON_KEY não definido}"
: "${TEST_SUPABASE_SERVICE_ROLE_KEY:?TEST_SUPABASE_SERVICE_ROLE_KEY não definido}"
: "${TEST_SUPABASE_DB_URL:?TEST_SUPABASE_DB_URL não definido (postgres://...)}"

if [[ "$TEST_SUPABASE_URL" == *"$PROD_REF"* ]]; then
  err "TEST_SUPABASE_URL aponta para o project ref de produção ($PROD_REF). Abortando."
fi
if [[ "$TEST_SUPABASE_DB_URL" == *"$PROD_REF"* ]]; then
  err "TEST_SUPABASE_DB_URL aponta para o project ref de produção. Abortando."
fi

# --- 2. Confirmação explícita ---------------------------------------------------
if [[ "${CI:-false}" != "true" ]]; then
  echo "Este script aplicará migrations em: $TEST_SUPABASE_URL"
  read -r -p "Digite 'aplicar staging' para continuar: " CONFIRM
  [[ "$CONFIRM" == "aplicar staging" ]] || err "Confirmação inválida. Abortando."
fi

# --- 3. Aplicar migrations existentes ------------------------------------------
log "Aplicando supabase/migrations/*.sql via psql"
for f in supabase/migrations/*.sql; do
  log "→ $(basename "$f")"
  psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
done

# --- 4. (Opcional) migrations staged de storage --------------------------------
if [[ "${APPLY_STAGED_STORAGE:-false}" == "true" ]]; then
  log "Aplicando migrations-staged/storage/*.sql"
  for f in supabase/migrations-staged/storage/*.sql; do
    log "→ $(basename "$f")"
    psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null
  done
fi

# --- 5. Smoke checks -----------------------------------------------------------
log "Smoke: contando tables no schema public"
COUNT=$(psql "$TEST_SUPABASE_DB_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[[ "$COUNT" -gt 100 ]] || err "Smoke falhou: apenas $COUNT tabelas em public"
log "Smoke OK ($COUNT tabelas)."

log "Smoke: buckets"
psql "$TEST_SUPABASE_DB_URL" -tAc "SELECT id, public FROM storage.buckets ORDER BY id"

log "Concluído com sucesso."
