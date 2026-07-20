# SPRINT NOID-VERTICAL 0.1.1 — Correção Documental do Blueprint

## Escopo
Edições **exclusivamente** em `docs/product/noid-revenueos-for-events-product-blueprint-v1.md`. Nenhuma outra alteração (código, migration, RLS, RPC, Edge Function, secret, config, dados, memória, plano).

## Passos

### 1. Pré-verificação (read-only)
- `git status --short` → confirmar árvore limpa antes.
- `code--view` do blueprint atual para localizar Seções 12, 18, 19, 21, 22 e a descrição de fronteira NOID×Eventrix.
- Confirmar presença das 23 seções + Apêndice A antes da edição.

### 2. Edições no blueprint (via `code--line_replace`, cirúrgicas)

**Seção 19 — Governança do Freeze**
- Reescrever para deixar explícito: freeze 19/07/2026 → 18/08/2026 proíbe expansão funcional mas **permite productização**.
- Listar as 13 atividades permitidas (Product Fit Audit read-only, NOID Events Template, ocultação de módulos, feature flags/entitlements, remoção de provas sociais não comprovadas, correções na landing, preços/contratos/SLA, correções P0 do Revenue Core, segurança/isolamento multi-tenant, onboarding repetível, ambiente demo, correções para clientes fundadores, correções para operação interna LEGAL/KAIRÓS).
- Listar as 9 atividades proibidas (novos módulos, agentes, dashboards fora do Core, integrações não-GO-LIVE, funcionalidades experimentais, expansão de escopo, dev exclusivo por cliente, redesign cosmético, automações fora do Revenue Core).

**Seção 12 — Escopo do Revenue Core**
- Substituir título "Core obrigatório — vendável no primeiro ciclo" por "Escopo-alvo do primeiro ciclo comercial — sujeito à classificação e homologação no Product Fit Audit".
- Adicionar nota: nada é vendável antes da classificação `PRONTO / CONFIGURAR / CORRIGIR / ADAPTAR / OCULTAR / FUTURO`.

**Evidências operacionais (Seções relevantes de dashboards/métricas)**
- Rebaixar status de reconciliação/integração para `EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL` em: Dashboard do Closer, Forecast, Revenue Command, Win/Loss, Relatórios, Fonte Única de Receita, integração de indicadores entre módulos.
- Remover qualquer afirmação de reconciliação operacional definitiva.

**Seção 18 — Escopo da Sprint 0.2**
- Reescrever: inventário macro de todas rotas/Edge Functions/RPCs/tabelas/migrations, com aprofundamento **apenas** em: rotas expostas a clientes, módulos do Revenue Core, módulos a ocultar, tabelas do Revenue Core, RPCs de fluxos ativos, Edge Functions chamadas pelo frontend/automações ativas, migrations relevantes (Revenue Core, onboarding, billing, permissões, RLS, Storage, isolamento multi-tenant), dependências dos Clientes Fundadores.
- Explicitar: não exige auditoria linha a linha do histórico completo de migrations.

**Seção 21 — Novos Bloqueadores P0**

*Bloqueador: Provas sociais não comprovadas na landing*
- Risco, Probabilidade (Alta), Impacto (Crítico reputacional/jurídico/comercial), Mitigação (remover ou substituir por cases reais com autorização), Owner (Marketing + Produto + Fundador), Gate (antes de qualquer prospect na landing e antes da primeira demo externa).
- Registrar que a correção é permitida durante o freeze.

*Bloqueador: Repositório público sem confirmação executiva*
- Risco, Probabilidade (confirmada no metadata atual do GitHub, sujeita a nova verificação), Impacto (Alto para PI, potencialmente crítico se houver histórico sensível), Mitigação (confirmar intencionalidade, revisar histórico de secrets, tornar privado se não deliberado), Owner (Fundador + Engenharia + Segurança), Gate (imediato, antes do primeiro cliente externo).
- Deixar explícito: visibilidade do repositório **não** é alterada nesta sprint documental.

**Seção 22 — Preços dos Clientes Fundadores**
- Planos comerciais públicos definitivos: decisão após os 3 primeiros clientes.
- Condição comercial do Programa Clientes Fundadores: decisão antes da primeira proposta.
- Preço de implantação assistida: decisão antes da primeira proposta.
- Mensalidade fundadora: decisão antes da primeira proposta.
- Comissão provisória da pré-vendas: decisão executiva imediata (outbound inicia 20/07/2026).
- Comissão definitiva: revisável após baseline comercial.

**Fronteira NOID × Eventrix**
- Revenue Core inicial do NOID = pré-vendas, vendas, forecast, handoff comercial.
- Eventrix = execução operacional do evento.
- CS, renovação, expansão e pós-venda comercial podem permanecer no NOID em fases futuras.
- Integração NOID → Eventrix classificada como `PROPOSTA` ou `NECESSITA AUDITORIA` até homologação.
- Remover qualquer afirmação de que a integração já funciona baseada apenas em componentes/snapshots/configs.

### 3. Validação final
- `code--view` do blueprint pós-edição: confirmar 23 seções + Apêndice A intactos.
- `git status --short` e `git diff --stat`: confirmar que **apenas** `docs/product/noid-revenueos-for-events-product-blueprint-v1.md` foi modificado.
- Nenhum arquivo funcional, migration, RLS, RPC, Edge Function, secret, config ou memória alterado.

## Resposta ao usuário
1. Arquivo corrigido (caminho).
2. Lista de seções alteradas (12, 18, 19, 21, 22, fronteira NOID×Eventrix, evidências de dashboards).
3. Contradições resolvidas (freeze vs. productização; "vendável" vs. classificação pendente; evidência estrutural vs. operacional).
4. Novos bloqueadores registrados (provas sociais na landing; repositório público).
5. Confirmação: somente o blueprint foi alterado (via `git diff --stat`).
6. Próxima sprint: NOID-VERTICAL 0.2 — Product Fit Audit.

## Riscos
- Baixo — edição puramente documental, sem impacto em runtime, RLS ou dados.
- Único risco operacional: divergência de linhas ao aplicar `line_replace`; mitigado por `code--view` prévio e edições cirúrgicas.
