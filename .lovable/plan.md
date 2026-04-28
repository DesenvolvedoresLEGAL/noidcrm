## Problema

No modal **Funis e Etapas → Distribuição automática de leads** existem dois bugs:

1. **Erro 400 ao salvar** quando o cargo elegível é **"Qualquer cargo (usar lista)"**.
   - Mensagem real do backend: `new row for relation "pipelines" violates check constraint "pipelines_lead_distribution_role_check"`.
   - Causa: o frontend envia o valor literal `'any'` em `lead_distribution_role`, mas a constraint do banco só aceita `sdr | seller | closer | cs | am | farmer | ae` (ou `NULL`). Por isso, ao escolher "SDR / Pré-vendas" funciona, mas "Qualquer cargo" sempre quebra.

2. **Lista "Usuários elegíveis" mostra todos os usuários já cadastrados** (incluindo inativos / removidos).
   - Causa: o hook `useOrganizationUsers` faz UNION de `organization_members (status=active)` com **todos** os `profiles` da organização, e marca os inativos com sufixo `(Inativo)`. Esse comportamento é proposital para outros formulários (ex.: Editar Oportunidade, onde queremos exibir o owner antigo mesmo inativo). Mas no contexto de **distribuição de leads** só faz sentido listar usuários ativos.

## Correção

### 1. `src/components/pipelines/EditPipelineModal.tsx`
- Quando `distributionRole === 'any'`, enviar `lead_distribution_role: null` em vez de `'any'` (compatível com a constraint do banco e com o significado: "sem filtro de cargo, usar lista").
- Ao carregar pipeline existente, traduzir `null → 'any'` para a UI continuar mostrando "Qualquer cargo".
- Filtrar a lista exibida em **Usuários elegíveis** removendo qualquer usuário marcado como `(Inativo)` pelo hook (mantendo só ativos da organização).
- Validação adicional: bloquear o "Salvar" quando estratégia ≠ `none`, cargo = `any` e nenhum usuário foi selecionado (hoje só mostra um aviso amarelo, mas o backend aceita salvar vazio).

### 2. `src/services/supabase/pipelines.ts` (defesa em profundidade)
- No `updatePipeline` / `createPipeline`, sanitizar: se `lead_distribution_role === 'any'` ou string vazia → gravar `null`. Garante que nenhum outro caller futuro derrube a constraint.

### Fora de escopo
- Não alterar `useOrganizationUsers` (é compartilhado por 14+ telas que dependem do comportamento atual de exibir inativos com sufixo).
- Não alterar a constraint do banco — o conjunto de cargos é intencional.

## Arquivos impactados

- `src/components/pipelines/EditPipelineModal.tsx` (mapear `any ↔ null`, filtrar inativos da lista, validação de salvar)
- `src/services/supabase/pipelines.ts` (sanitização defensiva de `lead_distribution_role`)

## Riscos

- Baixo. Mudanças isoladas ao modal de funis e à camada de serviço de pipelines.
- Pipelines existentes que já tenham `lead_distribution_role = 'sdr' | 'closer' | 'cs'` continuam funcionando normalmente.
- Pipelines criados anteriormente com a UI mostrando "Qualquer cargo" nunca chegaram a ser salvos (sempre falhavam), então não há dados legados a migrar.

## Próximos passos

Após aprovação:
1. Aplicar as duas alterações.
2. Testar: criar/editar funil escolhendo Round Robin + "Qualquer cargo" + 2 usuários ativos → salvar deve funcionar.
3. Confirmar que a lista exibe apenas usuários ativos da organização.
