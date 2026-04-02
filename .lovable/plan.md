

# Sistema Inteligente de E-mails Contextuais com IA

## Problema Atual
O `ai-email-assist` gera emails genéricos de "follow-up" sem considerar o contexto real da oportunidade: etapa do pipeline, tipo de pipeline (pré-vendas vs vendas vs operacional), se já recebeu proposta, histórico de atividades, temperatura do deal. Isso pode resultar em emails inadequados — por exemplo, enviar um follow-up de proposta para um lead que ainda está em qualificação.

## Solução

### 1. Enriquecer o `ai-email-assist` com Contexto Completo
Atualizar a Edge Function para buscar e injetar no prompt da IA:

- **Pipeline e etapa**: nome do pipeline, `pipeline_type` (qualification/sales/onboarding/customer_success), nome da etapa, `order_index`, probabilidade da etapa
- **Proposta**: se existe proposta (`proposals`), status dela (draft/sent/approved/rejected), data de envio
- **Atividades recentes**: últimas 10 atividades (tipo, status, data) para entender a cadência de interação
- **Temperatura e scoring**: `temperature`, `vibe_state`, `prob`
- **Dias na etapa**: `days_in_stage` para calibrar urgência

A IA receberá um prompt estruturado com regras claras por cenário:
- **Pré-vendas/Qualificação**: foco em discovery, entender dor, agendar reunião
- **Vendas sem proposta**: foco em apresentação de valor, avançar para proposta
- **Vendas com proposta enviada**: follow-up da proposta, negociação
- **Vendas com proposta aprovada**: fechamento, próximos passos
- **Operacional/Onboarding**: welcome, kickoff, acompanhamento
- **Lead frio (temperatura cold)**: reengajamento suave
- **Lead quente**: urgência, CTA forte

### 2. Tipo de E-mail Automático (inferido pelo contexto)
Em vez do usuário escolher manualmente "follow-up", o sistema infere o `emailType` correto:
- `qualification_discovery` — pipeline de qualificação, etapas iniciais
- `qualification_handoff` — qualificação, etapa final (passagem para vendas)
- `proposal_followup` — proposta enviada, aguardando resposta
- `proposal_presentation` — sem proposta ainda, apresentar solução
- `negotiation` — proposta visualizada/negociação
- `closing` — probabilidade alta, fechar
- `onboarding_welcome` — pipeline operacional, início
- `reengagement` — temperatura fria, muitos dias na etapa

### 3. Validações de Segurança (guardrails)
Antes de gerar/enviar, o sistema valida:
- **Contato tem email?** Se não, bloquear com mensagem clara
- **Já foi enviado email nas últimas 24h?** Alertar o usuário
- **Tipo do email é compatível com a etapa?** Não gerar email de proposta se não existe proposta
- **Pipeline operacional?** Ajustar tom (não é mais venda, é serviço)

### 4. Atualizar o EmailComposer para mostrar contexto
O modal de composição exibirá:
- Badge com o tipo de email inferido (ex: "Follow-up de Proposta")
- Indicador visual da etapa e pipeline
- Warning se já enviou email recente
- O botão "Gerar com IA" passa o contexto completo automaticamente

### 5. Atualizar o CreateActivityModal (tipo email)
Quando o tipo é "email" e há oportunidade selecionada:
- Auto-preencher destinatário do contato da oportunidade
- Botão "Gerar com IA" que chama o `ai-email-assist` com contexto da oportunidade
- Mostrar badge do tipo de email inferido

### 6. Templates por Categoria de Etapa
Adicionar categorias na tabela `email_templates` vinculadas a contextos:
- `qualification`, `sales_no_proposal`, `sales_with_proposal`, `negotiation`, `onboarding`
- O seletor de templates filtra automaticamente pela categoria relevante ao contexto

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/ai-email-assist/index.ts` | Buscar pipeline, etapa, proposta, atividades, temperatura. Prompt contextual com regras por cenário. Inferir emailType. Validações de segurança. |
| `src/components/opportunity/EmailComposer.tsx` | Mostrar contexto inferido (badge tipo email, etapa, warnings). Passar contexto completo ao chamar IA. Filtrar templates por categoria. |
| `src/components/activities/CreateActivityModal.tsx` | Auto-preencher email do contato quando opp selecionada. Botão "Gerar com IA" contextual. |
| `src/services/crm/email-templates.ts` | Adicionar filtro por categoria contextual. |

## Resultado
- IA gera emails precisos e adequados à jornada do lead
- Guardrails impedem envios inadequados (sem contato, email duplicado, tipo errado)
- Templates são filtrados pelo contexto automaticamente
- O vendedor vê claramente que tipo de email está sendo gerado e por quê

