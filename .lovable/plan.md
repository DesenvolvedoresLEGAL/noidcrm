

# Sprint 0.1B — Agent Creation Studio

## Resumo

Transformar a tela "Novo Agente" em um **Agent Creation Studio** com 3 modos de criação: IA conversacional, importação de prompt externo e manual (atual). Inclui conceito de Blueprint intermediário, edge function de geração via Lovable AI, e parsing inteligente de prompts colados.

## Arquitetura

```text
┌─────────────────────────────────────────────┐
│         CreateAgent.tsx (orquestrador)       │
│  ┌──────────┬──────────────┬──────────────┐  │
│  │ Criar    │  Importar    │   Manual     │  │
│  │ com IA   │  Prompt      │   (atual)    │  │
│  └────┬─────┴──────┬───────┴──────┬───────┘  │
│       │            │              │           │
│  AICreation   PromptImport   ManualForm      │
│       │            │              │           │
│       └────────────┼──────────────┘           │
│                    ▼                          │
│           BlueprintPreview                    │
│         (revisão antes de salvar)             │
│                    │                          │
│                    ▼                          │
│          create-ai-agent (edge fn)            │
└─────────────────────────────────────────────┘
```

---

## 1. Tipos (ai-agents.ts)

Adicionar `AgentBlueprint` interface:
- `name`, `objective`, `description`, `autonomy_level`, `agent_scope`, `primary_channel`
- `suggested_type`: `'reactive' | 'proactive' | 'hybrid' | 'utility'`
- `prompts`: `{ system?, deliberation?, generation?, review? }`
- `suggested_triggers`, `suggested_tools`, `suggested_rules`: arrays descritivos
- `warnings`, `missing_info`: arrays de strings
- `source_type`: `'conversation' | 'prompt_import' | 'manual'`
- `source_text`: string original do usuário

Adicionar `CreateAgentFromBlueprintPayload` que estende `CreateAgentPayload` com campos de prompts e `source_type`.

## 2. Edge Function: `generate-agent-blueprint`

Nova edge function que recebe texto livre (ou prompt colado) e retorna um `AgentBlueprint` estruturado.

- Usa Lovable AI (`LOVABLE_API_KEY`) com `google/gemini-3-flash-preview`
- Aceita `{ mode: 'conversation' | 'prompt_import', text: string }`
- Usa tool-calling para extrair output estruturado (schema do Blueprint)
- System prompt em PT-BR orientado ao contexto CRM/NOID
- Retorna blueprint JSON tipado

## 3. Edge Function: `create-ai-agent` (atualizar)

Adicionar suporte para receber campos extras do blueprint:
- `prompt_system`, `prompt_deliberation`, `prompt_generation`, `prompt_review` -- gravados na `ai_agent_versions` v1
- `source_type` -- gravado no `config_json` da versão
- `source_text` -- gravado no `config_json` da versão

## 4. Hooks (useAIAgents.ts)

Adicionar:
- `useGenerateBlueprint()` -- mutation que chama `generate-agent-blueprint`

## 5. Frontend -- Refatorar CreateAgent.tsx

### Tela principal: Seleção de modo

3 cards grandes:
- **Criar com IA** (icon Sparkles) -- "Descreva o agente em linguagem natural"
- **Importar Prompt** (icon FileText) -- "Cole um prompt pronto de outra ferramenta"
- **Configurar Manualmente** (icon Settings) -- "Monte o agente campo a campo"

### Modo "Criar com IA"

- Textarea grande com placeholder conversacional
- Chips de ajuda (canal, objetivo, escopo, autonomia)
- Botao "Gerar Blueprint" que chama a edge function
- Loading state com skeleton
- Resultado: `BlueprintPreview` com todos os campos editaveis

### Modo "Importar Prompt"

- Textarea grande para colar prompt
- Select de origem (ChatGPT, Claude, Gemini, Manus, Outro)
- Botao "Analisar Prompt" que chama a mesma edge function com `mode: 'prompt_import'`
- Resultado: `BlueprintPreview` com alertas de ambiguidade

### Modo "Manual"

- Form atual (já existe), sem alterações significativas

### Componente `BlueprintPreview`

Painel de revisão com blocos editáveis:
- Informações básicas (nome, objetivo, descrição)
- Configuração (autonomia, escopo, canal)
- Prompts gerados (system, deliberation, generation, review) -- textareas editáveis
- Sugestões (triggers, tools, regras) -- lista read-only informativa
- Alertas (warnings, missing_info) -- badges amarelos/vermelhos
- Botões: "Refinar com IA", "Criar Agente em Draft"

Ao salvar: chama `create-ai-agent` com dados do blueprint (incluindo prompts), redireciona para detalhes.

## 6. Routing

Nenhuma rota nova necessária. A tela `/app/settings/noid-intelligence/agents/new` muda internamente de form para studio.

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Create | `supabase/functions/generate-agent-blueprint/index.ts` |
| Edit | `supabase/functions/create-ai-agent/index.ts` -- aceitar prompts + source |
| Edit | `src/types/ai-agents.ts` -- AgentBlueprint, payload estendido |
| Edit | `src/hooks/useAIAgents.ts` -- useGenerateBlueprint |
| Rewrite | `src/pages/settings/noid-intelligence/CreateAgent.tsx` -- Agent Creation Studio |
| Create | `src/components/noid-intelligence/BlueprintPreview.tsx` |
| Create | `src/components/noid-intelligence/AICreationMode.tsx` |
| Create | `src/components/noid-intelligence/PromptImportMode.tsx` |
| Create | `src/components/noid-intelligence/ManualCreationMode.tsx` |

