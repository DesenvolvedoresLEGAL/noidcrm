

## Plano: Integrar Landing Page com Ingestão de Leads no CRM

### Contexto
A landing page em `alugue.operadora.legal` coleta: Nome, Empresa, WhatsApp, E-mail, Nome do Evento e Data do Evento. Queremos que ao submeter o formulário, uma oportunidade seja criada automaticamente no funil **PRÉ VENDAS** da organização **OPERADORA LEGAL**.

### Solução
Criar uma nova Edge Function pública (`ingest-landing-lead`) que recebe os dados do formulário e chama internamente a lógica de ingestão existente (`ingest-lead`). A landing page fará um POST direto para essa função.

A edge function `ingest-lead` já existe e faz tudo: cria conta, contato, calcula scores, atribui vendedor via round-robin, e cria a oportunidade no pipeline correto. Só precisamos de um wrapper público que:
1. Receba os campos do formulário da landing page
2. Mapeie para o formato esperado pela `ingest-lead`
3. Fixe o `organization_id` da OPERADORA LEGAL

### Alterações

**1. Criar Edge Function `ingest-landing-lead`**
- Recebe: `nome`, `empresa`, `whatsapp`, `email`, `nome_evento`, `data_evento`
- Valida campos obrigatórios
- Separa `nome` em `primeiro_nome` e `ultimo_nome`
- Chama `ingest-lead` internamente passando:
  - `razao_social` = empresa
  - `contact_nome` = nome completo
  - `contact_email` = email
  - `contact_telefone` = whatsapp
  - `titulo` = "DIAGNÓSTICO - {nome_evento}" (uppercase pelo trigger)
  - `origem` = "Landing Page - Alugue"
  - `notas` = "Evento: {nome_evento} | Data: {data_evento}"
  - `organization_id` = `d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d`

**2. Código da Landing Page (instrução para o usuário)**
- Adicionar um `fetch()` no submit do formulário apontando para a URL da edge function
- Exemplo de integração será fornecido

### Segurança
- A function usará service role key internamente (server-side)
- Rate limiting básico por IP
- Validação de campos com Zod
- Org ID fixo no código (não exposto ao cliente)

### Arquivos
- **Criar:** `supabase/functions/ingest-landing-lead/index.ts`

