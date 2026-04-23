
Objetivo: corrigir o cadastro de Conta para que Tipo de Empresa, Vendedor Responsável e CS Responsável apareçam/persistam corretamente, adicionar o campo de Pré-Vendedor Responsável e parar de quebrar Segmento/Origem no editor.

1. Corrigir a causa principal dos campos “sumindo” no formulário
- Unificar os valores canônicos de `tipo_empresa` entre `AccountEditor` e `AccountModalTabs`, porque hoje os dois usam listas diferentes e com casing diferente (`Cliente/Prospect/...` vs `cliente/prospect/...`), o que faz o Select parecer vazio mesmo com dado salvo.
- Corrigir `segmento` no `AccountEditor`: hoje o Select usa valores em slug minúsculo (`tecnologia`, `varejo`...), mas a conta costuma guardar valores legíveis/canônicos (`Tecnologia`, `Saúde`...), então o valor salvo não casa com os itens e não renderiza.
- Reusar o normalizador existente de segmento para leitura consistente e evitar duplicidade visual.

2. Tornar os responsáveis confiáveis no editor
- Ajustar os Selects de `owner_user_id` e `cs_user_id` para sempre exibir o usuário atualmente salvo, mesmo se ele estiver inativo ou não vier na lista padrão de membros ativos.
- Revisar `useOrganizationUsers()` para suportar esse caso sem quebrar a listagem normal da organização.
- Manter persistência no mesmo fluxo atual (`updateAccount`), sem mudar RLS.

3. Adicionar o novo campo “Pré-Vendedor Responsável”
- Criar uma migration adicionando `pre_sales_user_id` na tabela `accounts` (UUID nullable, mesmo padrão de responsáveis).
- Incluir o campo no schema tipado do front por meio da integração normal do banco.
- Expor esse campo em:
  - `src/services/supabase/accounts.ts`
  - `src/hooks/useAccountDetails.ts`
  - `src/pages/AccountEditor.tsx`
  - `src/components/accounts/AccountModalTabs.tsx`
  - `src/components/accounts/AccountOverviewTabEnhanced.tsx`
- Label no UI: “Pré-Vendedor Responsável”.

4. Eliminar a inconsistência de Origem
- Continuar usando somente o cadastro robusto já existente de Origens/Grupos de Origens (`origins` + `origin_groups`) como fonte de opções.
- Remover qualquer comportamento que dependa de listas paralelas/hardcoded para origem no cadastro de conta.
- No editor da conta, o Select de origem passará a:
  - carregar da tabela oficial de origens;
  - mostrar o valor atual salvo mesmo se ele estiver inativo/legado;
  - evitar ficar “em branco” quando a conta já tem origem preenchida.

5. Sincronizar Origem e Pré-Vendedor a partir da oportunidade vinculada
- Implementar uma regra de sincronização segura para contas já ligadas a oportunidades:
  - `origem_principal` da conta poderá ser preenchida a partir da `origem` da oportunidade vinculada;
  - `pre_sales_user_id` da conta poderá ser preenchido a partir de `qualified_by_user_id` da oportunidade.
- Critério técnico: usar a oportunidade vinculada mais recente com valor válido para cada campo.
- Aplicar isso em dois níveis:
  - leitura/hidratação da conta para exibição correta;
  - backfill dos registros existentes que hoje estão vazios.

6. Observação importante sobre Segmento
- O sistema já tem fonte nativa para `origem` e `pré-vendedor` na oportunidade.
- Para `segmento`, o CRM atual não tem um campo canônico nativo na oportunidade equivalente ao de origem; por isso o ajuste correto é:
  - usar `accounts.segmento` como fonte de verdade da conta;
  - normalizar sua leitura;
  - manter o preenchimento automático por CNAE quando aplicável.
- Isso resolve o problema real de “não puxar” no editor sem criar duplicidade estrutural.

7. Backfill dos dados já existentes
- Executar um backfill pontual para contas que estejam sem `origem_principal` e/ou sem `pre_sales_user_id`, buscando esses dados da oportunidade vinculada mais recente.
- Não alterar contas que já estejam corretamente preenchidas.
- Não é necessário mudar políticas RLS; as políticas org-scoped atuais de `accounts` já cobrem a nova coluna.

Arquivos impactados
- `src/pages/AccountEditor.tsx`
- `src/components/accounts/AccountModalTabs.tsx`
- `src/hooks/useAccountDetails.ts`
- `src/hooks/useOrganizationUsers.ts`
- `src/services/supabase/accounts.ts`
- `src/components/accounts/AccountOverviewTabEnhanced.tsx`
- `src/lib/segment-normalizer.ts` (reuso)
- novo helper opcional para opções canônicas de conta/segmento
- nova migration em `supabase/migrations/...`

Riscos controlados
- Baixo/médio: mudança principal é de formulário, normalização e 1 nova coluna nullable.
- Sem quebra de multitenancy: permanece tudo em `accounts.organization_id`.
- Sem duplicar a arquitetura de origem: o cadastro oficial existente continua sendo a única fonte de opções.

Resultado esperado
- Tipo de Empresa passa a aparecer e salvar corretamente.
- Vendedor Responsável e CS Responsável deixam de “sumir” no editor.
- Conta ganha campo de Pré-Vendedor Responsável.
- Origem passa a respeitar o cadastro oficial de Origens/Grupos e pode ser herdada da oportunidade.
- Segmento volta a carregar corretamente no cadastro da conta.
