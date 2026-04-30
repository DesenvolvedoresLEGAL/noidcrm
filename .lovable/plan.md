## Problema

Hoje o fluxo Apollo → CRM tem duas falhas:

1. **Os contatos enriquecidos vivem só em `enriched_contact_profiles`** (tabela paralela usada apenas pela aba "Contatos" do drawer do prospect). Eles não aparecem na conta do CRM porque a aba "Contatos" da conta lê da tabela `contacts`.
2. **A RPC `import_prospect_to_pipeline`** (acionada pelo botão "Importar no CRM") cria **um único contato genérico** usando `prospect.email_public` / `prospect.phone_public` — por isso só apareceu "Laticinios Tirolez" com `contabilidade@tirolez.com.br`. Juliana, Otavio e os demais ficam órfãos.

Resultado: o usuário marca "principal" no Apollo, mas Conta → Contatos não recebe nada.

## Como vai funcionar (UX)

1. Após o enriquecimento Apollo, na aba **Contatos** do drawer de prospect:
   - Cada card de contato ganha um **checkbox de seleção** (decisor principal já vem marcado por padrão).
   - Aparece um botão fixo no rodapé da aba: **"Importar selecionados na conta"** com contador (ex: `Importar 3 contatos no CRM`).
2. Clique no botão:
   - Se a conta no CRM ainda não existe (prospect não importado), avisa: "Importe o prospect primeiro" + atalho.
   - Se a conta existe, faz **upsert** dos contatos selecionados em `contacts` daquela `account_id`, com email/telefone/cargo/linkedin populados.
3. Toast de sucesso: `2 contatos criados, 1 atualizado`. A aba Contatos da conta passa a mostrar Juliana com email + telefone.
4. Bônus: ao clicar em "Importar no CRM" pela primeira vez (botão atual no drawer), se já houver contatos enriquecidos com `is_primary=true`, eles entram **automaticamente** junto.

## Mudanças técnicas

### 1. Nova RPC `sync_enriched_contacts_to_account`
`(p_prospect_id uuid, p_account_id uuid, p_contact_ids uuid[])` → SECURITY DEFINER, search_path=public.

- Valida que o usuário pertence à org do prospect.
- Para cada `enriched_contact_profiles` em `p_contact_ids` (filtrando `is_merged=false` e mesma org):
  - Monta `emails` jsonb (`[{value, type:'work', is_primary:true, status}]`) e `telefones` jsonb.
  - **Upsert por email normalizado** dentro da conta:
    - Se existir `contacts` com mesmo `organization_id` + email já presente → UPDATE (merge de telefones, atualiza cargo/linkedin se vazio, marca o decisor como principal).
    - Senão → INSERT novo `contacts` com `account_id=p_account_id`, `nome=full_name`, `primeiro_nome`, `ultimo_nome`, `cargo=role_title`, `departamento`, `linkedin=linkedin_url`.
  - Se for `is_primary=true` no enriquecimento, atualiza `opportunities.contact_id` da última oportunidade da conta para apontar pro novo contato (opcional, melhora UX).
- Retorna `{created: int, updated: int, skipped: int}`.

### 2. Atualizar `import_prospect_to_pipeline`
Após criar conta+oportunidade, ao invés de inserir um único contato com `email_public`:
- Se existirem `enriched_contact_profiles` com `prospect_id` → chamar a mesma lógica de sync para todos com `is_primary=true OR seniority IN (c_level, vp, director, manager)`.
- Mantém fallback atual (`email_public`/`phone_public`) só se não houver nenhum enriquecido.
- Define `opportunities.contact_id` = contato com `is_primary=true` (ou primeiro decisor).

### 3. Frontend — `ProspectContactsTab.tsx`
- Adicionar `useState<Set<string>>` para seleção, default = `[primary.id]` quando carrega.
- Cada `Card` ganha `<Checkbox>` no canto superior esquerdo.
- Rodapé sticky com botão **"Importar N contatos no CRM"** (disabled se `selected.size === 0`).
- Handler chama nova mutation `useSyncEnrichedContacts({ prospectId, accountId, contactIds })`.
- Se `prospect.matched_account_id` for null → mostra hint "Importe o prospect primeiro" com link/botão para o fluxo atual de importação.

### 4. Novo hook `src/hooks/useSyncEnrichedContacts.ts`
- `useMutation` chamando `supabase.rpc('sync_enriched_contacts_to_account', {...})`.
- Em sucesso: invalida `contactKeys.lists()`, `['enriched-contacts', prospectId]`, `accountKeys.detail(accountId)` e mostra toast detalhado.

### 5. Service `src/services/enrichment/apolloService.ts`
- Adicionar helper `syncEnrichedContacts(prospectId, accountId, contactIds)` que encapsula a chamada RPC.

## Arquivos impactados

- **Nova migration**: cria RPC `sync_enriched_contacts_to_account` + atualiza `import_prospect_to_pipeline`.
- `src/components/playbook/ProspectContactsTab.tsx` — checkboxes + botão importar.
- `src/hooks/useSyncEnrichedContacts.ts` — novo.
- `src/services/enrichment/apolloService.ts` — novo helper.
- (Opcional) `src/hooks/useProspectImport.ts` — passar a depender só da RPC atualizada (sem mudanças se a RPC já cuida).

## Riscos

- **Duplicação de contatos**: mitigado pelo upsert por `email_normalized` + `organization_id`.
- **Conflito com índice único `idx_unique_contact_email_org`** em `enriched_contact_profiles`: já existe e protege; a RPC só lê dali.
- **Contato sem e-mail** (vários do print têm score 0 e nenhum email): pulamos e contamos em `skipped` no toast.
- **opportunity.contact_id sobrescrita**: só atualizamos quando o contato sincronizado for o `is_primary` declarado pelo usuário, e somente nas oportunidades sem contato definido manualmente (via campo de auditoria simples).

## Próximos passos (após aprovação)

1. Criar migration com as duas funções SQL.
2. Implementar hook + service helper.
3. Atualizar a aba Contatos com seleção e botão de importação.
4. Testar com a Tirolez: marcar Juliana + Otavio, importar, abrir conta Laticinios Tirolez → ver os 2 contatos com e-mail/telefone na aba Contatos da conta.
