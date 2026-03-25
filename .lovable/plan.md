

## Problema

Dois problemas identificados:

1. **Custom fields não persistem na passagem de bastão**: A Edge Function `execute-workflow` duplica a oportunidade do funil PRE VENDAS para VENDAS, mas NÃO copia os valores de campos personalizados (`custom_field_values`). A função `generate-acceptance-proof` já faz essa cópia corretamente - basta replicar o mesmo padrão.

2. **Edição dos campos de endereço é ruim**: O componente `EditableCustomField` usa um `Input` simples de uma linha para campos de texto como endereço. Campos de endereço devem usar `Textarea` para facilitar a edição, e o clique para editar deve ser mais intuitivo.

## Plano

### 1. Copiar custom field values no handoff (execute-workflow)

**Arquivo**: `supabase/functions/execute-workflow/index.ts`

Após a duplicação da oportunidade (linha ~407, depois do bloco de cópia de histórico), adicionar o mesmo bloco que já existe em `generate-acceptance-proof`:

- Buscar todos os `custom_field_values` da oportunidade de origem (`entity_id = opportunity.id, entity_type = 'opportunity'`)
- Inserir cópia apontando para o novo `data.id`

### 2. Melhorar edição de campos personalizados na sidebar

**Arquivo**: `src/components/custom-fields/EditableCustomField.tsx`

- Campos de endereço (detectados por `isLocationField`) devem renderizar como `Textarea` em vez de `Input`, mesmo que o `field_type` seja `text`
- Aumentar a área clicável e dar feedback visual mais claro (bordas, ícone de edição sempre visível no hover)
- Permitir salvar com Enter em campos simples mas Ctrl+Enter em Textarea
- Melhorar placeholder para campos de endereço

### Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/execute-workflow/index.ts` | Adicionar bloco de cópia de `custom_field_values` após duplicação (linhas ~404-407) |
| `src/components/custom-fields/EditableCustomField.tsx` | Usar Textarea para campos de endereço; melhorar UX de edição |

