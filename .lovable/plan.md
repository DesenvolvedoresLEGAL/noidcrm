

## Plano: Corrigir Dados Incompletos da Landing Page

### Problemas Identificados

1. **Email e telefone do contato** estão sendo salvos como strings simples (`["email@x.com"]`) ao invés do formato estruturado com `is_primary: true` (`[{value, type, is_primary}]`)
2. **Data do evento** não está sendo usada como previsão de fechamento (campo `close_date_prevista`) com D-1
3. **Nome do contato** não está sendo separado em `primeiro_nome` e `ultimo_nome`

### Correções

**Arquivo: `supabase/functions/ingest-lead/index.ts`**

Na criação do contato (linha 155-166), mudar o formato de `emails` e `telefones` para o formato estruturado:

```typescript
// ANTES
emails: [leadData.contact_email],
telefones: leadData.contact_telefone ? [leadData.contact_telefone] : [],

// DEPOIS
emails: [{ value: leadData.contact_email, type: 'work', is_primary: true }],
telefones: leadData.contact_telefone 
  ? [{ value: leadData.contact_telefone, type: 'whatsapp', is_primary: true }] 
  : [],
```

Separar `contact_nome` em `primeiro_nome` e `ultimo_nome`:

```typescript
primeiro_nome: leadData.contact_nome.split(' ')[0],
ultimo_nome: leadData.contact_nome.includes(' ') 
  ? leadData.contact_nome.substring(leadData.contact_nome.indexOf(' ') + 1) 
  : '',
```

Na criação da oportunidade (linha 379-397), adicionar `close_date_prevista` quando disponível via novo campo `close_date_prevista` no `LeadData`.

**Arquivo: `supabase/functions/ingest-landing-lead/index.ts`**

Calcular D-1 da data do evento e passar como `close_date_prevista`:

```typescript
// Calcular D-1
let closeDatePrevista: string | undefined;
if (dataEvento) {
  const eventDate = new Date(dataEvento);
  eventDate.setDate(eventDate.getDate() - 1);
  closeDatePrevista = eventDate.toISOString().split('T')[0];
}
```

Adicionar ao payload: `close_date_prevista: closeDatePrevista`

### Arquivos Afetados
- **Editar:** `supabase/functions/ingest-lead/index.ts` — formato de emails/telefones + primeiro_nome/ultimo_nome + close_date_prevista
- **Editar:** `supabase/functions/ingest-landing-lead/index.ts` — calcular D-1 e enviar close_date_prevista

### Impacto
Apenas leads novos serão afetados. Leads já existentes permanecem como estão. A lógica de busca por contato existente via `contains('emails', ...)` precisa ser ajustada para buscar pelo formato novo.

