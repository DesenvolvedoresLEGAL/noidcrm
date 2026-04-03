

## Plano: Dividir Nome do Contato em Primeiro Nome e Ultimo Nome

### Contexto
O campo `nome` na tabela `contacts` armazena o nome completo. Precisamos dividir em `primeiro_nome` e `ultimo_nome` para permitir comunicações automatizadas mais naturais (ex: "Oi João" ao invés de "Oi João da Silva").

### 1. Migration: Adicionar colunas e migrar dados

```sql
-- Adicionar novas colunas
ALTER TABLE contacts ADD COLUMN primeiro_nome text;
ALTER TABLE contacts ADD COLUMN ultimo_nome text;

-- Migrar dados existentes: primeira palavra → primeiro_nome, restante → ultimo_nome
UPDATE contacts SET
  primeiro_nome = split_part(nome, ' ', 1),
  ultimo_nome = CASE 
    WHEN position(' ' in nome) > 0 
    THEN substring(nome from position(' ' in nome) + 1)
    ELSE ''
  END;

-- Tornar primeiro_nome obrigatório
ALTER TABLE contacts ALTER COLUMN primeiro_nome SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN primeiro_nome SET DEFAULT '';
ALTER TABLE contacts ALTER COLUMN ultimo_nome SET DEFAULT '';
```

A coluna `nome` será mantida como campo computado/virtual para retrocompatibilidade. Vamos criar um trigger que atualiza `nome` automaticamente:

```sql
CREATE OR REPLACE FUNCTION update_contact_nome()
RETURNS trigger AS $$
BEGIN
  NEW.nome := trim(NEW.primeiro_nome || ' ' || coalesce(NEW.ultimo_nome, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_nome
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_contact_nome();
```

Isso garante que `nome` sempre reflita a concatenacao e **nenhum código existente quebra**.

### 2. Atualizar Interface de Contato

**`src/components/contacts/ContactModal.tsx`**
- Trocar campo "Nome" por dois campos lado a lado: "Primeiro Nome *" e "Ultimo Nome"
- Atualizar schema zod: `primeiro_nome` (obrigatório) e `ultimo_nome` (opcional)
- Payload envia `primeiro_nome` e `ultimo_nome` (trigger cuida do `nome`)

**`src/components/opportunity/ContactCombobox.tsx`**
- Formulário inline de criação: trocar campo "Nome" por "Primeiro Nome" e "Ultimo Nome"
- Enviar `primeiro_nome` e `ultimo_nome` no insert

### 3. Atualizar Services

**`src/services/supabase/contacts.ts`**
- Adicionar `primeiro_nome` e `ultimo_nome` ao tipo `Contact`
- Atualizar `contactSchema` zod com os novos campos
- `createContact` e `updateContact`: enviar os novos campos

**`src/hooks/useOrganizationContacts.ts`**
- Incluir `primeiro_nome` e `ultimo_nome` no select

### 4. Atualizar Variáveis de Template (Propostas e E-mails)

**`supabase/functions/generate-proposal-pdf/replaceVariables.ts`**
- Adicionar variáveis: `{{contato_primeiro_nome}}`, `{{contato_ultimo_nome}}`
- Manter `{{contato_nome}}` existente (nome completo via campo `nome`)

**`supabase/functions/ai-email-assist/index.ts`**
- No prompt, usar `contact.primeiro_nome` para saudacao ao invés de `contact.nome`
- Linha 142: `Nome: ${opportunity.contact?.primeiro_nome || 'Cliente'}`
- Linha 150: instrução para usar primeiro nome nas saudações

### 5. Atualizar Exibições (sem breaking changes)

Os componentes que exibem `contact.nome` continuam funcionando pois o trigger mantém `nome` atualizado. Apenas ajustes cosméticos opcionais em:
- `ContactCard.tsx` - iniciais podem usar `primeiro_nome`
- `ProposalContextCards.tsx` - já usa `contact.nome`, continua ok
- `OpportunityCard.tsx` - usa `contact_name` derivado de `nome`, ok

### Arquivos Afetados
- **Migration:** nova migration com colunas + trigger
- **Editar:** `src/components/contacts/ContactModal.tsx`
- **Editar:** `src/components/opportunity/ContactCombobox.tsx`  
- **Editar:** `src/services/supabase/contacts.ts`
- **Editar:** `src/hooks/useOrganizationContacts.ts`
- **Editar:** `supabase/functions/ai-email-assist/index.ts`
- **Editar:** `supabase/functions/generate-proposal-pdf/replaceVariables.ts`

### Estrategia de Retrocompatibilidade
O campo `nome` continua existindo e sendo atualizado automaticamente pelo trigger. Isso significa que **todos os 25+ arquivos** que leem `contact.nome` continuam funcionando sem alteração. A mudança é incremental e segura.

