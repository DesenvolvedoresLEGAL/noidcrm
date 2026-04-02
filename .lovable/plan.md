

# Transformar Modal de Envio de Proposta em Compositor Completo de Email

## Problema Atual

O modal "Enviar Proposta por E-mail" e apenas dois campos (nome e email do destinatario) com um botao. Nao puxa dados automaticos, nao tem template, nao tem IA, nao tem remetente visivel.

## Solucao

Substituir o dialog simples por um compositor completo de email (estilo Gmail) reutilizando a logica do `EmailComposer` existente, adaptado para propostas.

## Alteracoes

### 1. `src/components/proposals/ProposalEmailComposer.tsx` (NOVO)

Componente dedicado para envio de proposta por email:
- **Remetente**: Puxa automaticamente do SMTP configurado (`user_smtp_configs`)
- **Destinatario**: Pre-preenche com nome e email primario do contato da oportunidade
- **Assunto**: Pre-preenche com "Proposta Comercial: [titulo]"
- **Corpo**: Pre-preenche com template padrao contendo link da proposta (`public_token`)
- **Botao IA**: Gera email contextualizado usando `ai-email-assist` com contexto de proposta
- **Templates**: Permite selecionar templates de email existentes (categoria `proposal`)
- **CC**: Campo opcional
- **Envia via**: `send-smtp-email` Edge Function (mesmo do EmailComposer)
- **Pos-envio**: Atualiza status da proposta para `sent` + `sent_at`

Campos do modal:
```
De: [nome] <email@remetente.com>  (readonly, do SMTP)
Para: [email primario do contato]  (editavel)
CC: [opcional]
Assunto: Proposta Comercial: [titulo proposta]
[Botao: Gerar com IA] [Select: Template]
Corpo: [textarea com template pre-preenchido incluindo link da proposta]
[Botao: Enviar]
```

Template padrao do corpo:
```
Oi [Nome do Contato], tudo bem?

Segue a proposta comercial "[Titulo]" para sua analise.

[Botao: Visualizar Proposta] (link publico)

Valor: R$ X.XXX,XX
Validade: DD/MM/AAAA

Qualquer duvida, estou a disposicao!

[Assinatura SMTP do usuario]
```

### 2. `src/components/opportunity/OpportunityProposalsTab.tsx` (EDITAR)

- Remover o dialog simples de email (linhas 597-641)
- Remover states `recipientEmail`, `recipientName`, `sendEmailMutation`
- Importar e usar `ProposalEmailComposer` passando `proposalId`, `opportunityId`
- O novo componente busca dados sozinho (contato, proposta, SMTP)

### 3. `src/components/proposals/ProposalViewModal.tsx` (EDITAR)

- Substituir a secao "Enviar por Email" pelo mesmo `ProposalEmailComposer`

## Fluxo

1. Usuario clica "Enviar por E-mail" no dropdown da proposta
2. Abre modal completo tipo Gmail
3. Campos ja preenchidos (remetente SMTP, destinatario do contato, assunto, corpo com link)
4. Usuario pode editar, usar template, ou gerar com IA
5. Clica "Enviar" → envia via SMTP → atualiza proposta para `sent`

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/proposals/ProposalEmailComposer.tsx` | Novo componente compositor completo |
| `src/components/opportunity/OpportunityProposalsTab.tsx` | Substituir dialog simples pelo novo compositor |
| `src/components/proposals/ProposalViewModal.tsx` | Substituir secao de email pelo novo compositor |

