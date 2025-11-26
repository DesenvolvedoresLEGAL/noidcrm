# SPRINT 4: Automação por IA para Atividades

## Visão Geral

Sprint 4 implementa automação inteligente baseada em IA para reduzir o trabalho manual do vendedor ao criar e gerenciar atividades. O sistema aprende com o histórico de sucesso do usuário e fornece sugestões contextuais e lembretes automáticos.

## Objetivos Principais

1. **Preenchimento Inteligente**: Sugerir horários, durações e descrições baseadas em padrões de sucesso
2. **Lembretes e Notificações**: Sistema automático de lembretes 15min antes das atividades

## Arquitetura Implementada

### 1. Banco de Dados

#### Tabela `notifications`
- Armazena todas as notificações do sistema
- Campos: `user_id`, `organization_id`, `type`, `title`, `message`, `metadata`, `read`, `read_at`
- RLS: Usuários veem apenas suas notificações
- Realtime habilitado para atualizações em tempo real

#### Coluna `duration_minutes` em `activities`
- Adicionada para análise histórica de duração de atividades
- Permite calcular durações médias por tipo de atividade

### 2. Edge Functions

#### `ai-activity-suggestions`
**Funcionalidade:**
- Analisa histórico de atividades do usuário (últimas 20 do mesmo tipo)
- Calcula padrões de sucesso (horários, durações)
- Usa Lovable AI (google/gemini-2.5-flash) para gerar sugestões contextuais

**Entrada:**
```json
{
  "activityType": "call | meeting | email | whatsapp | task | note",
  "context": {
    "opportunityId": "uuid",
    "accountName": "string"
  }
}
```

**Saída:**
```json
{
  "suggestions": {
    "suggestedTime": "HH:mm",
    "suggestedDuration": 30,
    "titleSuggestion": "string",
    "descriptionTemplate": "string",
    "tips": ["dica 1", "dica 2"],
    "historicalAvgDuration": 45,
    "historicalBestHour": 10
  }
}
```

**Algoritmo:**
1. Busca atividades do mesmo tipo (últimas 20)
2. Filtra atividades completas com sucesso
3. Calcula média de duração
4. Identifica horários com maior taxa de conclusão
5. Envia contexto + histórico para IA
6. IA retorna sugestões personalizadas

#### `activity-reminders`
**Funcionalidade:**
- Processa lembretes de atividades agendadas
- Cria notificações para atividades que começam em 10-20 minutos
- Executado via cron job a cada 10 minutos

**Fluxo:**
1. Busca atividades com status 'pending'
2. Filtra por janela de tempo (próximos 10-20min)
3. Para cada atividade:
   - Busca dados do proprietário
   - Cria registro em `notifications`
   - Notificação aparece em tempo real via websocket
4. Retorna estatísticas (lembretes enviados, erros)

**Cron Schedule:**
- Frequência: `*/10 * * * *` (a cada 10 minutos)
- URL: `/functions/v1/activity-reminders`
- Autenticação: Supabase anon key

### 3. Frontend Services

#### `src/services/crm/activity-ai.ts`
```typescript
getActivitySuggestions(activityType, context): Promise<ActivitySuggestions>
```

#### `src/services/crm/notifications.ts`
```typescript
getNotifications(unreadOnly): Promise<Notification[]>
markAsRead(notificationId): Promise<void>
markAllAsRead(): Promise<void>
getUnreadCount(): Promise<number>
```

### 4. Hooks

#### `useNotifications`
- Gerencia estado de notificações
- Subscreve atualizações em tempo real
- Funções: `markAsRead`, `markAllAsRead`, `refresh`
- Retorna: `notifications`, `unreadCount`, `loading`

### 5. Componentes UI

#### `NotificationBell`
- Ícone de sino no cabeçalho
- Badge com contador de não lidas
- Popover com lista de notificações
- Ação: marcar como lida ao clicar
- Botão "Marcar todas como lidas"

#### `CreateActivityModal` (Atualizado)
**Preenchimento Inteligente:**
- Carrega sugestões de IA quando tipo de atividade muda
- Auto-preenche horário sugerido
- Auto-preenche duração baseada em histórico
- Sugestão de template de descrição
- Card de "Sugestões de IA" com ícone Sparkles
- Dicas contextuais baseadas no tipo de atividade

**Fluxo:**
1. Usuário abre modal de nova atividade
2. Seleciona tipo de atividade
3. Sistema carrega histórico + chama IA
4. Campos são auto-preenchidos com sugestões
5. Card de dicas aparece com recomendações
6. Usuário pode aceitar ou modificar

## Fluxo de Uso

### Preenchimento Inteligente

1. Vendedor clica em "Nova Atividade"
2. Seleciona tipo (ex: "Reunião")
3. Sistema analisa histórico:
   - "Você geralmente faz reuniões às 10h"
   - "Duração média: 45 minutos"
   - "Taxa de sucesso: 85% quando feito pela manhã"
4. Campos são auto-preenchidos
5. Dicas aparecem:
   - "💡 Recomendado agendar com 24h de antecedência"
   - "💡 Inclua pauta na descrição para maior efetividade"
6. Vendedor ajusta se necessário e salva

### Lembretes Automáticos

1. Sistema roda a cada 10 minutos
2. Busca atividades próximas (10-20min)
3. Cria notificação para cada uma
4. Notificação aparece em tempo real:
   - Badge no sino atualiza
   - Popover mostra lembrete
   - Mensagem: "Sua reunião com [Cliente] começa em 15min"
5. Usuário clica para marcar como lida
6. Sistema pode reagendar se não confirmada (futuro)

## Impacto de Tempo Economizado

### Análise por Sprint

**Sprint 1** (55 min/dia):
- Daily briefing: 10 min
- Auto task creation: 15 min
- AI form fill: 20 min
- Pipeline cleanup: 10 min

**Sprint 2** (8 min/dia):
- AI sequences: 5 min
- Stage progression: 3 min

**Sprint 3** (23 min/dia):
- Email logging: 15 min
- Calendar logging: 8 min

**Sprint 4** (12 min/dia) ⭐ NOVO:

**Preenchimento Inteligente: 7 min/dia**
- Média de 8 atividades criadas por dia
- 1 minuto por atividade se manual (pensar em horário, duração, descrição)
- 10 segundos com IA (revisar e confirmar)
- Economia: 8 × 0.83 = ~7 minutos

**Lembretes Automáticos: 5 min/dia**
- Sem lembretes: 3-5 min procurando próximas atividades na agenda
- Com lembretes: notificação instantânea
- Economia: ~5 minutos

**Total Acumulado: ~98 minutos/dia (1h38min)**

## Componentes de IA

### Prompt para Sugestões (ai-activity-suggestions)

```
Based on the following context, suggest improvements for a {type} activity:

Historical Data:
- Average successful duration: {avgDuration} minutes
- Best time for this type: {bestHour}:00
- Common titles: {commonTitles}
- Sample descriptions: {commonDescriptions}

Current Context:
{context}

Provide concise suggestions in JSON format:
{
  "suggestedTime": "HH:mm (based on success patterns)",
  "suggestedDuration": number (in minutes),
  "titleSuggestion": "string (if applicable)",
  "descriptionTemplate": "string (helpful template)",
  "tips": ["string", "string"]
}
```

### Análise de Padrões

**Cálculo de Horário Ideal:**
```javascript
const hourCounts = {};
timePatterns.forEach(t => {
  hourCounts[t.hour] = (hourCounts[t.hour] || 0) + 1;
});
const bestHour = Object.entries(hourCounts)
  .sort((a, b) => b[1] - a[1])[0][0];
```

**Cálculo de Duração Média:**
```javascript
const completedActivities = historical.filter(a => a.status === 'completed');
const avgDuration = Math.round(
  completedActivities.reduce((sum, a) => sum + a.duration_minutes, 0) / 
  completedActivities.length
);
```

## Integração com Outros Módulos

### Dashboard
- Card de "Próximas Atividades" com notificações integradas
- Badge de lembretes pendentes

### Oportunidades
- Sugestões de IA ao criar atividade relacionada
- Contexto enriquecido com dados da oportunidade

### AI Copilot (Sprint 1)
- Daily briefing inclui lembretes do dia
- Sugestões de follow-up consideram padrões históricos

## Segurança

### RLS Policies
- Notificações: usuários veem apenas próprias
- Sistema pode inserir notificações (para cron jobs)
- Atividades: mantém políticas existentes

### Rate Limiting
- Edge function pública: não aplicável
- Edge function autenticada: protegida por Supabase auth

## Métricas de Sucesso

**Adoção:**
- % de usuários que usam sugestões de IA
- Taxa de aceitação de sugestões (quantos campos mantêm valores sugeridos)

**Eficiência:**
- Tempo médio para criar atividade (antes vs depois)
- Redução de atividades não confirmadas
- Taxa de conclusão de atividades com lembretes

**Qualidade:**
- Taxa de conclusão de atividades sugeridas vs manuais
- Feedback de usuários sobre qualidade das sugestões

## Limitações Conhecidas

1. **Histórico mínimo**: Precisa de 5+ atividades do mesmo tipo para boas sugestões
2. **Contexto limitado**: IA não considera contexto completo da oportunidade
3. **Lembretes simples**: Apenas notificação in-app (não email/SMS ainda)
4. **Sem reagendamento automático**: Implementação futura
5. **Análise básica de padrões**: Não considera dias da semana, sazonalidade

## Roadmap Futuro

### Melhorias de Curto Prazo
- Análise de padrões por dia da semana
- Sugestões de participantes baseadas em histórico
- Notificações por email além de in-app
- Reagendamento automático de atividades não confirmadas

### Melhorias de Médio Prazo
- Machine learning para prever taxa de sucesso
- Sugestões de preparação pré-atividade
- Integração com transcrição de chamadas
- Auto-preenchimento de resultado pós-atividade

### Melhorias de Longo Prazo
- Análise de sentimento em descrições
- Recomendações de estratégia por tipo de cliente
- Predição de melhor canal (call vs meeting vs email)
- Coaching em tempo real durante atividades

## Configuração

### Secrets Necessárias
- `LOVABLE_API_KEY`: Pré-configurada automaticamente
- Sem necessidade de configuração adicional

### Extensões Habilitadas
- `pg_cron`: Para execução agendada de lembretes
- `pg_net`: Para chamadas HTTP do cron para edge functions

### Cron Jobs Ativos
```sql
activity-reminders-job: */10 * * * * (a cada 10 minutos)
```

## Troubleshooting

### "Suggestions not loading"
- Verificar se usuário tem histórico de atividades (mínimo 5)
- Checar console para erros de IA
- Confirmar que LOVABLE_API_KEY está configurada

### "No reminders received"
- Verificar se cron job está ativo: `SELECT * FROM cron.job`
- Checar logs da função: edge function logs > activity-reminders
- Confirmar que atividade está com status 'pending'

### "Notifications not updating in real-time"
- Verificar se realtime está habilitado na tabela
- Checar subscrição do channel no console
- Confirmar que RLS permite leitura das notificações

## Testing

### Testar Sugestões de IA
1. Criar 5+ atividades do mesmo tipo
2. Marcar algumas como 'completed'
3. Abrir modal de nova atividade
4. Selecionar mesmo tipo
5. Verificar se sugestões aparecem

### Testar Lembretes
1. Criar atividade para daqui 15 minutos
2. Aguardar 5 minutos
3. Verificar se notificação aparece no sino
4. Clicar para marcar como lida
5. Verificar se badge atualiza

## Conclusão

Sprint 4 adiciona **~12 minutos/dia** de economia através de preenchimento inteligente e lembretes automáticos. Combinado com Sprints anteriores, o CRM agora economiza **~98 minutos/dia (1h38min)**, ultrapassando a meta original de 78 minutos identificada na análise de produtividade.

## Próximos Passos

**Sprint 5** (Planejado):
- Mobile Quick Actions
- Voice-to-text para atividades
- Geolocalização para check-ins
- Push notifications nativas
- Modo offline