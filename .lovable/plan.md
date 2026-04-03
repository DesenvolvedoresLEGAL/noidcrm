

## Correção: Upload de Logo não persiste no banco

### Problema
A função `handleLogoUpload` (linha 257) faz `setFormData(prev => ({ ...prev, logo_url: publicUrl }))` — atualiza apenas o estado local. O `logo_url` só é salvo no banco quando o usuário clica "Salvar" (`handleSave`). Se a página recarregar ou o `useEffect` (linha 107) re-executar, o `formData` é resetado com o valor antigo do banco.

O mesmo problema existe no `handleRemoveLogo`.

### Solução
Após o upload (e remoção) do logo, salvar imediatamente o `logo_url` no banco de dados via `supabase.update()`, além de atualizar o estado local.

### Alterações

**Arquivo: `src/pages/settings/OrganizationSettings.tsx`**

1. Na função `handleLogoUpload` (após linha 257): adicionar chamada direta ao banco para persistir o `logo_url`:
```typescript
// Após obter a publicUrl e atualizar o formData:
await supabase
  .from('organizations')
  .update({ logo_url: publicUrl })
  .eq('id', organization.id);
```

2. Na função `handleRemoveLogo` (após linha 281): persistir a remoção no banco:
```typescript
// Após limpar o formData:
await supabase
  .from('organizations')
  .update({ logo_url: '' })
  .eq('id', organization.id);
```

### Arquivos afetados
- **Editar:** `src/pages/settings/OrganizationSettings.tsx`

