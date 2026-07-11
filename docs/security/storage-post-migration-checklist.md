# Checklist manual pós-migração de Storage

Executar **após** aplicar as migrations em staging e antes de promover para produção.

## Buckets

- [ ] `proposal-layouts` está com `public=false` em `storage.buckets`.
- [ ] `opportunity-files` continua `public=false`.
- [ ] `proposal-pdfs` continua `public=false`.
- [ ] `avatars`, `organization-logos`, `product-images` continuam `public=true` (aprovado).

## Policies

- [ ] Não existem policies `USING (true)` em `storage.objects`.
- [ ] Toda policy que filtra por `storage.foldername(name)[1]` faz cast para `uuid` e valida contra `organization_members.status = 'active'`.
- [ ] Não há policy `FOR ALL` sem `WITH CHECK`.

## Colunas

- [ ] `proposal_layouts.storage_path` populado onde `terms_pdf_url` existia.
- [ ] `proposal_layout_pages.storage_path` idem.
- [ ] `proposals.pdf_storage_path` populado para todas as propostas com `pdf_url` legado.

## Aplicação

- [ ] Editor de propostas abre layout sem erro.
- [ ] Download de anexo em `OpportunityFilesTab` continua funcionando para membros ativos.
- [ ] Link público de proposta (`/p/<token>`) carrega o PDF via signed URL curto (verificar Network: URL contém `/object/sign/`).
- [ ] Upload de logo da organização continua funcionando.
- [ ] Upload de imagem de produto continua funcionando.

## Testes negativos manuais

- [ ] Logout: tentar abrir `https://<staging>/storage/v1/object/public/proposal-layouts/<org>/<file>` retorna 400/404.
- [ ] Usuário `sales` de ORG_A tenta baixar arquivo de ORG_B via URL direta → falha.
- [ ] Desativar membership de um usuário → download falha em <30s.

## Findings a confirmar antes do go/no-go

- [ ] P-01 corrigido: `proposals.pdf_url` não recebe mais UPDATEs (trigger ativo).
- [ ] P-02 mitigado: leituras de layout usam `resolve_proposal_layout_path` + signed URL.
- [ ] P-06 endereçado: existe utilitário único `getSignedUrl()`.
