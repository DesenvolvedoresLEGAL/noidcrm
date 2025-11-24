# Sprint 1: AI Automation - Documentação Técnica

## 📋 Visão Geral

Sprint 1 implementa as funcionalidades core de automação inteligente para reduzir trabalho manual dos vendedores:

1. **Daily AI Briefing** - Briefing diário com prioridades e insights
2. **Auto Task Creation** - Criação automática de tarefas baseada em regras
3. **AI Field Suggestions** - Sugestões inteligentes de atualização de campos
4. **Pipeline Cleanup** - Identificação automática de oportunidades para limpar

---

## 🗄️ Banco de Dados

### Novas Tabelas

#### `daily_briefings`
Armazena histórico de briefings diários gerados para cada vendedor.

```sql
CREATE TABLE daily_briefings (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  priority_actions JSONB DEFAULT '[]',
  hot_opportunities JSONB DEFAULT '[]',
  at_risk_deals JSONB DEFAULT '[]',
  summary TEXT,
  tasks_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id, briefing_date)
);
```

**Campos:**
- `priority_actions`: Array de objetos com ações priorizadas pela IA
- `hot_opportunities`: Oportunidades quentes (burning/hot)
- `at_risk_deals`: Deals em risco (sem contato há 5+ dias)
- `summary`: Resumo executivo do dia

#### `ai_suggestions`
Armazena todas as sugestões da IA (field updates, stage progression, cleanup).

```sql
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES opportunities(id),
  suggestion_type TEXT, -- 'field_update', 'stage_progression', 'pipeline_cleanup'
  entity_type TEXT,
  entity_id UUID,
  field_name TEXT,
  current_value JSONB,
  suggested_value JSONB,
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  reasoning TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
  action_taken_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Tipos de Sugestão:**
- `field_update`: Atualização de campo (valor_previsto, prob, temperature, etc)
- `stage_progression`: Sugestão de mudança de estágio
- `pipeline_cleanup`: Sugestão de arquivar/reativar oportunidade

---

## 🔧 Edge Functions

### 1. `daily-briefing-generator`

**Endpoint:** `/functions/v1/daily-briefing-generator`  
**Auth:** Required  
**Método:** POST

**Descrição:**
Gera briefing diário personalizado analisando oportunidades e atividades do vendedor.

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid",
  "briefing_date": "2025-01-15",
  "priority_actions": [
    {
      "action": "Ligar para João na Acme Corp",
      "opportunity_id": "uuid",
      "priority": "high",
      "reason": "Deal de R$ 50k sem contato há 7 dias"
    }
  ],
  "hot_opportunities": [...],
  "at_risk_deals": [...],
  "summary": "Hoje você tem 8 oportunidades quentes...",
  "tasks_created": 0
}
```

**Lógica:**
1. Busca oportunidades do vendedor
2. Filtra hot opportunities (burning/hot)
3. Identifica at-risk deals (5+ dias sem contato)
4. Chama Lovable AI (gemini-2.5-flash) para gerar prioridades
5. Armazena em `daily_briefings`

---

### 2. `auto-task-creator`

**Endpoint:** `/functions/v1/auto-task-creator`  
**Auth:** Required  
**Método:** POST

**Descrição:**
Cria tarefas automaticamente baseado em 3 regras principais.

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "tasks_created": 5,
  "tasks": [...]
}
```

**Regras de Criação:**

1. **Follow-up para oportunidades stale**
   - Condição: `days_since_contact > 3`
   - Cria: Task de follow-up agendada para +1 dia
   
2. **Preparação para reuniões**
   - Condição: Reunião agendada para amanhã
   - Cria: Task "Preparar reunião" 2h antes

3. **Envio de proposta**
   - Condição: Oportunidade em estágio de "Negociação"
   - Cria: Task "Enviar proposta comercial"

**Flags:**
- Todas as tasks criadas têm `ai_generated: true`

---

### 3. `ai-field-suggestions`

**Endpoint:** `/functions/v1/ai-field-suggestions`  
**Auth:** Required  
**Método:** POST

**Descrição:**
Analisa uma oportunidade e sugere atualizações inteligentes de campos.

**Request Body:**
```json
{
  "opportunityId": "uuid"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "field_name": "prob",
      "current_value": 50,
      "suggested_value": 75,
      "confidence_score": 0.85,
      "reasoning": "Cliente confirmou budget e timing, aumentar probabilidade",
      "status": "pending",
      "expires_at": "2025-01-22T00:00:00Z"
    }
  ]
}
```

**Campos Sugeridos:**
- `valor_previsto`
- `prob`
- `temperature`
- `close_date_prevista`
- `stage_id`

**Lógica:**
1. Busca oportunidade + notas + emails recentes
2. Envia contexto completo para IA
3. IA analisa e sugere até 3 atualizações
4. Armazena em `ai_suggestions` com 7 dias de validade

---

### 4. `pipeline-cleanup-suggester`

**Endpoint:** `/functions/v1/pipeline-cleanup-suggester`  
**Auth:** Required  
**Método:** POST

**Descrição:**
Identifica oportunidades candidatas para limpeza (arquivar ou reativar).

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "opportunity_id": "uuid",
      "suggestion_type": "pipeline_cleanup",
      "suggested_value": "archive",
      "confidence_score": 0.90,
      "reasoning": "Sem atividade há 60 dias, probabilidade 10%, valor baixo",
      "opportunity": {
        "id": "uuid",
        "title": "Deal ABC",
        "valor_previsto": 5000,
        "days_since_contact": 60
      }
    }
  ]
}
```

**Critérios de Limpeza:**
- `last_contact_date < 45 dias atrás` OU `null`
- `prob < 30%`
- `status = 'new'`

**Ações Sugeridas:**
- `archive`: Mover para perdido
- `reactivate`: Tentar reativar

**Lógica:**
1. Busca oportunidades stale do vendedor
2. Para cada uma, envia para IA analisar
3. IA decide: arquivar ou reativar
4. Armazena em `ai_suggestions` com 30 dias de validade

---

## 🎨 Componentes React

### 1. `DailyBriefingCard`

**Localização:** `src/components/dashboard/DailyBriefingCard.tsx`

**Props:** Nenhuma

**Descrição:**
Card exibido no Dashboard com briefing do dia.

**Features:**
- Auto-load do briefing ao montar
- Botão "Gerar Briefing" se não existe
- Display de:
  - Ações prioritárias com badges de prioridade
  - Oportunidades quentes (top 3)
  - Deals em risco (top 3)
- Click para navegar para oportunidades

---

### 2. `AIFieldSuggestions`

**Localização:** `src/components/ai/AIFieldSuggestions.tsx`

**Props:**
```typescript
interface AIFieldSuggestionsProps {
  opportunityId: string;
  onAccept?: (suggestion: AISuggestion) => void;
}
```

**Descrição:**
Exibe sugestões de atualização de campos da oportunidade.

**Features:**
- Auto-load ao montar
- Formatação de valores (moeda, porcentagem, datas)
- Botões "Aceitar" / "Rejeitar"
- Badge de confiança (confidence score)
- Atualiza status no banco

**Integração:**
Incluído na aba "AI Insights" do modal de oportunidade.

---

### 3. `PipelineCleanupPanel`

**Localização:** `src/components/dashboard/PipelineCleanupPanel.tsx`

**Props:** Nenhuma

**Descrição:**
Painel no Dashboard com sugestões de limpeza.

**Features:**
- Auto-load ao montar
- Display de sugestões com detalhes do deal
- Botões contextuais:
  - Se "archive": "Arquivar" / "Manter Ativo"
  - Se "reactivate": "Reativar" / "Arquivar Mesmo Assim"
- Atualiza status da oportunidade (won/lost)

---

### 4. `AutoTaskCreator`

**Localização:** `src/components/dashboard/AutoTaskCreator.tsx`

**Props:** Nenhuma

**Descrição:**
Card com botão para criar tarefas automaticamente.

**Features:**
- Botão "Criar Tarefas"
- Feedback visual do resultado
- Lista de regras aplicadas

---

## 📦 Serviços

### `ai-automation.ts`

**Localização:** `src/services/crm/ai-automation.ts`

**Funções exportadas:**

```typescript
// Gera briefing diário
generateDailyBriefing(): Promise<DailyBriefing>

// Cria tarefas automaticamente
createAutoTasks(): Promise<{ success: boolean; tasks_created: number; tasks: any[] }>

// Gera sugestões de campos
generateFieldSuggestions(opportunityId: string): Promise<{ suggestions: AISuggestion[] }>

// Gera sugestões de limpeza
generateCleanupSuggestions(): Promise<{ suggestions: AISuggestion[] }>

// Aceita sugestão
acceptSuggestion(suggestionId: string): Promise<void>

// Rejeita sugestão
rejectSuggestion(suggestionId: string): Promise<void>

// Busca sugestões pendentes
getPendingSuggestions(): Promise<AISuggestion[]>

// Busca briefing de hoje
getTodayBriefing(): Promise<DailyBriefing | null>
```

---

## 🔐 Segurança (RLS)

### `daily_briefings`

```sql
-- Users can view own briefings
CREATE POLICY ON daily_briefings FOR SELECT
USING (auth.uid() = user_id);

-- System can insert briefings
CREATE POLICY ON daily_briefings FOR INSERT
WITH CHECK (true);

-- Admins can view org briefings
CREATE POLICY ON daily_briefings FOR SELECT
USING (user_is_org_admin(organization_id));
```

### `ai_suggestions`

```sql
-- Users can view own suggestions
CREATE POLICY ON ai_suggestions FOR SELECT
USING (auth.uid() = user_id OR user_is_org_admin(organization_id));

-- Users can update own suggestions
CREATE POLICY ON ai_suggestions FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert/update suggestions
CREATE POLICY ON ai_suggestions FOR INSERT/UPDATE
WITH CHECK (true);
```

---

## 🚀 Deployment

### Edge Functions

Todas as edge functions são auto-deployed via Lovable Cloud:
- `daily-briefing-generator`
- `auto-task-creator`
- `ai-field-suggestions`
- `pipeline-cleanup-suggester`

### Environment Variables

Necessárias (já configuradas automaticamente):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

---

## 📊 Métricas de Sucesso

### KPIs Sprint 1

1. **Tempo economizado**
   - Target: 15-20 min/dia por vendedor
   - Medição: Antes/depois de logging manual

2. **Taxa de adoção**
   - Target: 70%+ dos vendedores usam Daily Briefing
   - Medição: Analytics de uso

3. **Precisão das sugestões**
   - Target: 60%+ de sugestões aceitas
   - Medição: `COUNT(status='accepted') / COUNT(status IN ('accepted','rejected'))`

4. **Qualidade do pipeline**
   - Target: Reduzir 30% de deals stale
   - Medição: Before/after de `days_since_contact > 30`

---

## 🐛 Troubleshooting

### Briefing não gera

**Sintoma:** Botão "Gerar Briefing" não funciona

**Possíveis causas:**
1. LOVABLE_API_KEY não configurado
2. Rate limit excedido (429)
3. Falta de créditos (402)

**Solução:**
- Verificar logs da edge function
- Checar rate limits em Settings → Usage
- Adicionar créditos se necessário

### Sugestões não aparecem

**Sintoma:** AIFieldSuggestions retorna vazio

**Possíveis causas:**
1. Oportunidade sem dados suficientes
2. AI retornou erro
3. Todas expiradas (>7 dias)

**Solução:**
- Adicionar notas/emails à oportunidade
- Verificar logs da edge function
- Limpar sugestões expiradas

### Tasks duplicadas

**Sintoma:** Auto Task Creator cria tasks duplicadas

**Possíveis causas:**
1. Usuário clicou múltiplas vezes
2. Lógica de verificação falhou

**Solução:**
- Já implementado: verifica existência antes de criar
- Se persistir, revisar queries de verificação

---

## 🔮 Próximos Passos (Sprint 2)

1. **Email sync** (auto-logging de emails)
2. **Call transcription** (transcrever calls automático)
3. **Sequências AI-powered** (decisão automática de entrada/saída)
4. **Smart sequences** (A/B test e personalização)

---

## 📚 Referências

- [Lovable AI Docs](https://docs.lovable.dev/features/ai)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- Memoria: `feature/crm/phase-3-implementation`
