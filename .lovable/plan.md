

## Notificação no Slack quando proposta é aceita

### Como funciona hoje
Quando um cliente aceita uma proposta, a edge function `generate-acceptance-proof` já executa toda a lógica pós-aceite: cria contrato, notifica usuários internos, registra histórico, etc. O ponto de integração ideal é essa mesma função.

### O que precisa ser feito

**1. Conectar o Slack ao projeto**
- Usar o conector Slack do Lovable (bot) para conectar seu workspace
- Isso disponibiliza as credenciais automaticamente como variáveis de ambiente
- O bot já tem acesso a canais públicos como `#geral` por padrão

**2. Adicionar envio de mensagem na edge function**
- Arquivo: `supabase/functions/generate-acceptance-proof/index.ts`
- Após o bloco de notificações internas (linha ~825), adicionar chamada ao Slack via connector gateway
- A mensagem será enviada ao canal `#geral` com os dados da proposta aceita

**3. Formato da mensagem**
- Usar Slack Block Kit para uma mensagem rica e profissional, incluindo:
  - Nome do cliente (conta)
  - Título da proposta
  - Valor total
  - Nome do vendedor responsável
  - Emoji de celebração

Exemplo visual:
```text
🎉 Nova contratação fechada!

Cliente: CIELO S.A.
Proposta: PROP-2026-00447 — Implantação CRM
Valor: R$ 45.000,00
Vendedor: João Silva

Parabéns ao time! 🚀
```

### Resumo técnico

| Passo | Ação |
|-------|------|
| Conectar Slack | Conector Lovable (bot) via gateway |
| Onde integrar | `generate-acceptance-proof/index.ts`, após notificações internas |
| Canal | `#geral` (configurável) |
| API | Gateway `connector-gateway.lovable.dev/slack/api/chat.postMessage` |
| Headers | `Authorization: Bearer LOVABLE_API_KEY` + `X-Connection-Api-Key: SLACK_API_KEY` |

Primeiro passo: conectar o Slack ao projeto. Posso iniciar?

