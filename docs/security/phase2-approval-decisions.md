# Fase 2 — Decisões aprovadas (2026-07-11)

Registro formal das decisões humanas que destravam o avanço para staging.
Nenhuma delas será aplicada em produção antes do provisionamento do projeto
Supabase de staging e da execução end-to-end da suíte tenant-isolation com 0
falhas.

## 1. `proposal-layouts` — privatização aprovada

Sequência obrigatória antes de virar a chave:

1. Inventariar todos os consumidores (emails já enviados, exports, propostas
   públicas, PDFs, materiais renderizados por edge functions).
2. Substituir persistência de URL pública por `storage_path` estável
   (colunas já criadas em `01_add_storage_path_columns.sql` +
   backfill em `02_backfill_storage_paths.sql`).
3. Gerar signed URL **somente no momento do uso**, via edge function
   com service_role. TTL 5–15 min (default 10 min).
4. Manter compatibilidade temporária para objetos legados: bucket
   continua servindo os arquivos até que todos os consumidores estejam
   apontando para o novo fluxo.
5. **Não remover URLs antigas** de `terms_pdf_url` / `file_url` até o
   fluxo completo ser validado em staging e por 1 sprint em produção.

## 2. `proposals.pdf_url` — rollout em 2 etapas

Substitui o antigo `07_deprecate_pdf_url_persistence.sql` (removido) por dois
arquivos:

- **`07a_pdf_url_write_audit.sql`** — Etapa 1: observabilidade. Trigger
  registra em `system_events` cada write, sem bloquear. Payload contém
  `role`, `actor_user_id`, `TG_OP`, `url_len`, `url_fingerprint` (12
  primeiros chars do md5). **Nunca** registra a URL completa, JWT ou
  service_role secreto.
- **`07b_pdf_url_enforcement.sql`** — Etapa 2: enforcement. Só aplicar
  em staging depois de:
  - executar os fluxos completos (criar/atualizar/enviar/visualizar);
  - consultar `system_events` para confirmar que apenas
    `role='service_role'` escreve na coluna;
  - adicionar teste de regressão em `tenant-isolation/data-api.test.ts`
    validando que um usuário `authenticated` comum não consegue alterar
    `pdf_url` (deve falhar com erro `P0001`).

Rollback: `DROP TRIGGER trg_block_pdf_url_persistence ON public.proposals;`

## 3. Buckets e logos — reclassificação

### `product-images` — mantido PUBLIC_APPROVED, com restrições

- Restrito a imagens genéricas de catálogo.
- Proibido: PII, preços personalizados, propostas, documentos, contratos,
  materiais específicos de clientes.
- Enforcement: revisão manual + limite de MIME (`image/*`) + limite de
  tamanho (5 MB) via bucket config, sem indexação de listagem.

### `accounts.logo_url` — reclassificado para PRIVATE_ORG_SCOPED

- **Não é mais público por padrão.**
- Se o cliente quiser exibir logo em página pública (proposta, portal),
  o upload precisa passar por fluxo deliberado que marque o objeto como
  público.
- Tecnicamente: manter em bucket privado `organization-logos` e servir
  via signed URL. Se o cliente ativar "publicar externamente", copiar
  para bucket `public-branding` (a criar em fase futura) — não incluído
  no rollout desta fase.
- Impacto: código atual que renderiza logo em propostas públicas via
  URL pública precisa ser adaptado — trabalho listado em
  `phase2-followups.md` (a criar quando o item for programado).

## 4. Propostas públicas — fluxo obrigatório

Nenhuma signed URL longa/permanente vira link principal. Sequência:

1. Cliente acessa rota pública `/p/<token>` — `token` é opaco e não
   enumerável (`gen_random_bytes(24)`, base64url).
2. Backend (edge function `og-proposal-meta` + `get-proposal-by-token`)
   valida: token existe, proposta não está deletada, `expires_at > now()`,
   `status IN ('sent','viewed','accepted','declined')`, organização
   ativa, token não revogado (`proposals.public_token_revoked_at IS NULL`).
3. Só depois de validado, chama `storage.sign()` para o PDF/layout com
   TTL entre 5 e 15 min (default 10 min).
4. Token público pode ser revogado a qualquer momento por membro ativo
   da organização — RPC `revoke_proposal_public_token(proposal_id)`
   (a implementar em migration futura).
5. Rate limiting: 30 requests / IP / 5 min por token, via
   `rate_limit_log` (tabela já existente) + edge function guard.
6. **Não armazenar signed URL no banco.**
7. Token e path **nunca** contêm PII (nome cliente, email, CPF, CNPJ,
   telefone, nome do evento).

## 5. `opportunity-files` — renomeação gradual

### Formato alvo

```
{organization_id}/{resource_type}/{resource_id}/{random_uuid}.{extension}
```

Onde `resource_type` ∈ {`opportunity`, `contract`, `attachment`,
`proposal`, `financial`} e `random_uuid = gen_random_uuid()`.

### Regras

- Nome original preservado apenas em `opportunity_files.file_name`
  (coluna já protegida por RLS).
- Nenhum path novo contém: nome, empresa, evento, email, telefone, CPF,
  CNPJ ou qualquer PII.
- Backfill idempotente: tabela auxiliar `storage_path_migration`
  (`old_path`, `new_path`, `bucket`, `status`, `checksum_old`,
  `checksum_new`, `size_bytes`, `copied_at`, `verified_at`,
  `deleted_old_at`).
- Sequência por objeto: copiar → validar checksum + tamanho + acesso →
  atualizar `opportunity_files.file_path` → aguardar janela segura →
  deletar objeto antigo.
- Nunca deletar objetos antigos antes de validação em staging + janela
  de 7 dias em produção.
- Migration da tabela + backfill em arquivo futuro
  `08_opportunity_files_rename.sql` (não incluído nesta batch —
  requer aprovação separada de janela de execução).

## 6. Auditoria de acesso a storage

Registrar em `system_events` (event_type `storage_signed_url_issued`
ou `storage_access_denied`) **apenas**:

| Campo                | Fonte                                  |
| -------------------- | -------------------------------------- |
| `organization_id`    | contexto do request                    |
| `actor_user_id`      | `auth.uid()` ou NULL se público        |
| `actor_kind`         | `authenticated` \| `public_token`      |
| `resource_type`      | ex. `proposal_pdf`, `opportunity_file` |
| `resource_id`        | uuid do recurso                        |
| `storage_path`       | path lógico (**sem** query string)     |
| `bucket`             | nome do bucket                         |
| `action`             | `sign` \| `download` \| `denied`       |
| `outcome`            | `allowed` \| `denied`                  |
| `deny_reason`        | enum sanitizado                        |
| `ip_hash`            | SHA-256 truncado (16 chars)            |
| `user_agent_family`  | apenas família (Chrome / Safari / …)   |
| `correlation_id`     | uuid do request                        |
| `ttl_seconds`        | TTL do signed URL emitido              |
| `created_at`         | now()                                  |

**Proibido registrar:**

- Signed URL completa.
- JWT ou access token.
- Service role key.
- Token público da proposta (registrar apenas hash truncado se
  necessário).
- Query string / parâmetros de assinatura.
- Conteúdo do arquivo.

Throttling: no máximo 1 evento `sign` por (user_id, resource_id) a cada
30 s. Denies sempre registrados sem throttle.

## 7. Teste S11 — obrigatório

Em staging, após `proposal-layouts` estar privado:

- `TEST_PROPOSAL_LAYOUTS_PRIVATIZED=true` obrigatório no CI.
- Suíte executa S11 sem skip.
- Critério de aceite: URL pública antiga **falha** (400/404) e acesso
  autenticado por membro ativo ou via token público validado **sucede**.
- Nenhum skip restante no relatório final, exceto limitações externas
  documentadas formalmente (ex.: bucket de terceiros).

## 8. Critério de promoção

Só mover de `supabase/migrations-staged/` para `supabase/migrations/`
após todos os itens abaixo estarem ✔ e evidências arquivadas em
`docs/security/evidence/phase2/`:

- [ ] Staging Supabase provisionado com secrets exclusivos.
- [ ] Migrations 01–06 + 07a aplicadas com sucesso em staging.
- [ ] Suíte `tenant-isolation` executada com 0 falhas.
- [ ] 0 acessos cross-org registrados.
- [ ] S11 executado com `TEST_PROPOSAL_LAYOUTS_PRIVATIZED=true`.
- [ ] Rollback testado (bucket público restaurado + trigger dropado).
- [ ] Fluxo end-to-end validado: criar proposta → enviar → cliente
      abre link público → PDF renderiza via signed URL de 10 min.
- [ ] PDFs e layouts legados continuam funcionando.
- [ ] Nenhuma signed URL persistida no banco após execução.
- [ ] Nenhum dado sensível permanece em bucket público.
- [ ] Etapa 2 (`07b_pdf_url_enforcement.sql`) só é promovida depois
      que a Etapa 1 confirmar que somente `service_role` escreve em
      `pdf_url`.
- [ ] Evidências (logs, screenshots, output de vitest) salvas em
      `docs/security/evidence/phase2/`.

Até lá, nada disso vai para produção.
