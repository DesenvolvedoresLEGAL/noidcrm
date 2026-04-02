

# Módulo de E-mail Completo para o CRM

## Contexto Atual
- Já existe a tabela `opportunity_emails` com tracking (opened_at, clicked_at, link_clicks)
- Já existe a tabela `email_templates` com categorias e variáveis
- Já existe `OpportunityEmailsTab` que mostra histórico mas **não permite compor/enviar emails**
- Já existe `ai-email-assist` edge function para gerar emails com IA
- Já existe `send-proposal-email` usando Resend
- Tab de emails no EditUser.tsx mostra placeholder "disponível em breve"
- Já existe `email_sync_config` e `sync-emails` para Gmail OAuth
- **Não existe** tabela de SMTP por usuário nem lógica de envio via SMTP customizado

## Escopo da Implantação

### 1. Tabela `user_smtp_configs` (nova migração)
Criar tabela para armazenar configuração SMTP por usuário:
- `user_id`, `organization_id`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password_encrypted`, `from_email`, `from_name`, `signature_html`, `is_active`, `is_verified`
- RLS: apenas o próprio usuário pode ler/editar sua config

### 2. Configuração SMTP na Tab de E-mails do Usuário (`EditUser.tsx`)
Substituir o placeholder por formulário funcional:
- Campos: Host SMTP, Porta, Usuário, Senha, E-mail remetente, Nome remetente
- Botão "Testar Conexão" que chama edge function de teste
- Editor de assinatura HTML (textarea com preview)
- Toggle para ativar/desativar

### 3. Edge Function `send-smtp-email` (nova)
Função que envia email via SMTP do usuário:
- Recebe `userId`, `to`, `cc`, `subject`, `body`, `opportunityId` (opcional)
- Busca config SMTP do usuário no banco
- Envia via SMTP usando Deno smtp client
- Registra o envio na tabela `opportunity_emails` se `opportunityId` fornecido
- Suporta tracking pixel para abertura

### 4. Edge Function `test-smtp-connection` (nova)
Função para testar configuração SMTP:
- Recebe dados SMTP, tenta conectar e enviar email de teste
- Retorna sucesso/erro para o frontend

### 5. Composer de E-mail na Oportunidade (`OpportunityEmailsTab`)
Adicionar botão "Novo E-mail" que abre modal de composição:
- Campos: De (auto-preenchido com SMTP do usuário), Para, CC, Assunto, Corpo (rich text)
- Botão "Gerar com IA" que chama `ai-email-assist`
- Seletor de templates (`email_templates`)
- Inserção automática de assinatura
- Envio via `send-smtp-email`

### 6. Envio de Proposta via SMTP do Usuário
Atualizar lógica de "Enviar por E-mail" da proposta para usar o SMTP do usuário (quando configurado), em vez do Resend:
- Se o usuário tem SMTP configurado, usa `send-smtp-email`
- Se não, fallback para o `send-proposal-email` existente (Resend)

### 7. Automação de E-mails via Atividades
Adicionar lógica no `activity-reminders` e/ou criar nova edge function:
- Quando uma atividade do tipo "email" é agendada, na data/hora agendada, enviar automaticamente o email configurado na atividade
- Novo campo na atividade: `email_subject`, `email_body`, `email_to` (ou inferir do contato da oportunidade)
- Registrar no histórico de emails da oportunidade

### 8. Formulário de Atividade — Tipo E-mail
Atualizar o formulário de criação de atividade para, quando tipo = "email":
- Mostrar campos de composição de email (assunto, corpo, destinatário)
- Opção de envio imediato ou agendado
- Usar templates de email

## Ordem de Implementação
1. Migração: tabela `user_smtp_configs`
2. Edge Functions: `test-smtp-connection` e `send-smtp-email`
3. UI: Configuração SMTP no EditUser
4. UI: Composer de email na OpportunityEmailsTab
5. Integração: envio de proposta via SMTP
6. Automação: envio automático por atividades agendadas

## Resultado
- Cada vendedor configura seu SMTP pessoal
- Emails são enviados e registrados no histórico da oportunidade
- Propostas podem ser enviadas via SMTP do vendedor
- Atividades de email podem ser agendadas e enviadas automaticamente
- IA auxilia na geração do conteúdo dos emails

