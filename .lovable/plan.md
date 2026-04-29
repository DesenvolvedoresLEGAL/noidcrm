
# Sprint 6.6: Consolidação do Dashboard Comercial

Sprint puramente de **interface, semântica e UX**. Nenhuma tabela, RPC, key técnica, RLS ou permissão será alterada. `business_function_key = 'closer'` continua sendo a chave técnica interna; só muda o que o usuário lê na tela.

## O que muda

### 1. Renomear textos visíveis (Closer → Comercial)

Substituir labels/títulos/descrições/toasts em todos esses arquivos (mantendo nomes de arquivo, hooks, RPCs e tabelas):

- `src/components/dashboard/closer/CloserDashboard.tsx`
  - Título "Dashboard Closer" → **"Dashboard Comercial"**
  - Subtítulo → **"Central diária de vendas, propostas, follow ups, pace e oportunidades em risco."**
- `src/components/dashboard/closer/CloserDashboardFeedbackCard.tsx`
  - Título "Como está esse novo Dashboard Closer?" → **"Como está esse novo Dashboard Comercial?"**
  - `metadata.sprint` passa para `'6.6'` (campo `dashboard_type` continua `'closer'`).
- `src/components/dashboard/runtime/RuntimeGateSafeBanner.tsx`
  - "Novo Dashboard Closer em piloto" → **"Novo Dashboard Comercial em piloto"**
- `src/components/dashboard/runtime/LegacySessionReturnBanner.tsx`
  - Botão "Abrir novo Dashboard Closer" → **"Abrir novo Dashboard Comercial"**
- `src/components/dashboard/closer/CloserPilotEntryButton.tsx`
  - "Experimentar novo Dashboard Closer" → **"Experimentar novo Dashboard Comercial"**
- `src/components/dashboard/closer/CloserNotACloserState.tsx`
  - Texto de bloqueio passa a explicar "Dashboard Comercial" e função técnica Closer.

### 2. Admin Center — Aba "Dashboard Comercial"

`src/components/settings/adminCenter/AdminCenterPage.tsx`:
- TabsTrigger "Dashboard Closer" → **"Dashboard Comercial"**.

`src/components/settings/adminCenter/closerDashboard/`:
- `CloserDashboardHealthPanel.tsx` — título **"Saúde do Dashboard Comercial"**.
- `CloserPilotRolloutPanel.tsx` — **simplificar para fluxo de 1 piloto por vez**:
  - Título: **"Ativação controlada do Dashboard Comercial"**.
  - Remover badge de contagem `X / 3` e o texto sobre "limite de 3 Closers".
  - Placeholder do select: **"Selecione um usuário comercial elegível"**.
  - Botão "Habilitar piloto"; toast de sucesso: **"Piloto do Dashboard Comercial habilitado."**.
  - Mensagens de erro traduzidas (limite, requires_review) em linguagem Comercial.
  - Backend continua aplicando o limite de 3; a UI apenas não destaca esse número.
- `ActiveCloserPilotsList.tsx` — título **"Usuários comerciais piloto"**, botão **"Desligar piloto"**.
- `CloserDashboardFeedbackSummary.tsx` — título **"Feedback do Dashboard Comercial"**.
- `CloserPerformanceMetrics.tsx` — manter, sem renomear métricas técnicas.
- `CloserRollbackPanel.tsx` — textos para "Desligar todos os pilotos do Dashboard Comercial" / mensagem "Desligar o piloto faz o usuário voltar imediatamente ao dashboard atual."
- `CloserRolloutDecisionCard.tsx` — manter funcionalidade.
- **Novo bloco "Aviso técnico"** dentro do `CloserDashboardHealthPanel.tsx`:
  > Importante: o nome comercial da tela é **Dashboard Comercial**. A função técnica usada pelo NOID continua sendo **Closer**, pois representa o usuário responsável por fechamento.

### 3. Card de Contexto CRM no perfil

`src/components/settings/profile/CurrentUserContextCard.tsx`:
- Renomear coluna "Função" → **"Função técnica"**.
- Texto explicativo abaixo dos campos:
  > A função técnica define qual dashboard e quais regras o NOID usa. Para vendedores responsáveis por fechamento, use **Vendas** e **Closer**.
- Se `business_function_key === 'closer'`: badge **"Dashboard Comercial habilitável"**.
- Se `requires_review`: alerta **"Revise este contexto antes de ativar o dashboard."** (já existe lógica `getReviewStatus`).

`src/services/crm/userContextSelf.ts`: adicionar `requires_review` no retorno (já vem da view `crm_user_context_view`).

### 4. ProfileSettings — Função Organizacional Legada

`src/pages/settings/ProfileSettings.tsx` (linhas ~378-394):
- Texto sob "Função Organizacional":
  > **Função Organizacional** é uma configuração antiga do CRM. Para dashboards dinâmicos, use o **Contexto CRM** acima.

### 5. Validar Pipeline Padrão (Sprint 6.4.1)

Já está corrigido (upsert por `user_id` + `invalidateQueries(['current-user'])`). **Apenas adicionar testes manuais documentados** no resumo final. Nenhuma mudança de código esperada — se durante os testes manuais a persistência falhar, corrigir aqui.

### 6. Não muda

- Nenhuma migration.
- Nenhum hook/serviço/RPC renomeado.
- `dashboard_type = 'closer'` continua no payload de feedback e logs.
- Runtime gate continua exigindo `business_function_key === 'closer'`.
- Sidebar, login, dashboard legado, automações, notificações, propostas, oportunidades, atividades, metas, permissões: intactos.
- Limite de 3 pilotos no backend (`crm_enable_closer_dashboard_pilot`) permanece — só não é destacado na UI.

## Detalhes técnicos

```text
Camadas tocadas:
  UI strings  → componentes acima
  Card perfil → CurrentUserContextCard + service userContextSelf
  Admin tab   → AdminCenterPage + closerDashboard/*

Não tocar:
  supabase/migrations/*
  supabase/functions/*
  src/integrations/supabase/*
  src/hooks/dashboard/*  (somente leitura — nomes técnicos)
  src/services/crm/closerDashboard*.ts (lógica)
```

## Critério de pronto

- UI principal fala "Dashboard Comercial".
- Internals (`closer`) intactos.
- Card de Contexto explica função técnica.
- Painel piloto simplificado para 1 usuário por vez (limite backend mantido).
- Pipeline Padrão valida persistência via teste manual.
- Build passa, sem erros de TS, sem mudanças de schema.

## Riscos

- Baixo. Mudanças quase 100% de cópia. Único ponto de atenção: garantir que o `dashboard_type` no feedback continue `'closer'` para não quebrar agregações existentes no Admin Center.
