

# Plano: humanizar o e-mail do agente (parar de "vomitar" o brief)

## Diagnóstico do preview ruim

O e-mail gerado:
> "Envio rápido sobre a proposta 'Proposta Comercial - COLUMBIA...' (enviada em **2026-04-17T13:29:54.697+00:00**). Vi 3 aberturas, última em **2026-04-17T13:31:29.444493+00:00**; tempo total **924s**; **scroll 100% no desktop**; **seções visualizadas: header, context, items, payment**. A proposta expira em **2026-04-29T12:00:00+00:00**."

Isso é **dump de telemetria**, não copy de vendedor. Causas no código atual:

1. O prompt manda usar números "literalmente" e cita um exemplo que ensina o modelo a fazer name-dropping de métricas ("revisitou 3x na seção de Investimento").
2. A regra anti-alucinação numérica (necessária) não veio acompanhada de uma **regra de estilo** que limite *como* esses números aparecem (no máximo 1, em linguagem natural, nunca timestamps).
3. Não existe instrução de **persona, tom e proibição explícita** de timestamps ISO, percentuais de scroll, nomes de seções técnicas, IDs ou jargão de produto.
4. A geração roda em `gemini-2.5-flash` num único passe (sem revisão de estilo).

## O que vou mudar

### 1) Reescrever o prompt do gerador para "vendedor sênior, não robô"

Substituir o bloco "USO DOS BLOCOS 360º" + a "REGRA NUMÉRICA" por uma seção **"VOZ E ESTILO"** com:

- **Persona**: "Você é o próprio vendedor (Wagner), escrevendo de um celular, em português brasileiro coloquial-profissional. Curto, direto, humano. Soa como WhatsApp formalizado, não como relatório."
- **Tamanho**: 50–110 palavras no corpo. 2 a 4 frases. Nunca bullet points. Nunca títulos.
- **Assunto**: 4–7 palavras, em minúsculas, sem emoji, sem nome de empresa em CAPS.
- **PROIBIDO no texto** (lista explícita):
  - timestamps ISO (`2026-04-17T13:29:...`), datas com timezone, fuso (`+00:00`, `BRT`)
  - percentuais de scroll, "tempo total Xs", nomes de seções técnicas (header, items, payment, cta)
  - títulos internos da proposta em CAPS LOCK (ex.: "COLUMBIA NA INFRAFM 2026")
  - palavras "engajamento", "métrica", "telemetria", "score", "NRHS", "vibe", "blocker"
  - mais de **um** número/data no e-mail inteiro
  - frases prontas tipo "envio rápido sobre", "podemos alinhar próximos passos", "15 minutos na quinta"
- **PERMITIDO (uso humano dos sinais)**:
  - "vi que você abriu a proposta de novo nos últimos dias" (em vez de "3 aberturas, última 2026-04-17T13:31:...")
  - "antes do fim do mês" / "essa semana" (em vez de data ISO de expiração)
  - referenciar o nome do contato pelo primeiro nome
  - chamar a empresa pelo nome fantasia em **Title Case**, nunca em CAPS

### 2) Adicionar few-shot de "ruim → bom"

Injetar no prompt do gerador 2 exemplos curtos:

**❌ RUIM** (igual ao atual): "Cleber, tudo bem? Envio rápido sobre a proposta 'Proposta Comercial - COLUMBIA...' (enviada em 2026-04-17T13:29:54.697+00:00). Vi 3 aberturas..."

**✅ BOM**: "Kleber, tudo bem? Vi que você voltou na proposta esses dias — fico à disposição se sobrou alguma dúvida sobre escopo ou investimento. Antes da gente fechar o mês, dá pra encaixar 15 min pra alinhar os próximos passos? Me diz dois horários que funcionam pra você."

### 3) Pipeline de 2 passes (gerar → reescrever humano)

Hoje: 1 chamada gera tudo.
Novo:

- **Passe 1 ("draft factual")**: usa o brief, escolhe 1 sinal âncora (ex.: "cliente revisitou proposta" OU "proposta expira em breve" OU "primeira aproximação pós-WhatsApp"), define objetivo único do e-mail e gera rascunho. Modelo: `gemini-2.5-pro` (melhor estilo que flash).
- **Passe 2 ("humanize & strip")**: recebe o rascunho + a lista PROIBIDO e devolve a versão final reescrita em voz humana, removendo qualquer telemetria que tenha vazado. Modelo: `gpt-5-mini`.
- Custo extra é baixo (texto curto) e o ganho de qualidade é o que o usuário está pedindo.

### 4) Sanitizador determinístico pós-geração

Antes de salvar `ai_email_messages`, rodar regex no `body_text`/`subject` e **bloquear envio direto** (força approval com flag `style_violation`) se detectar:

- timestamp ISO `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`
- timezone `\+00:00` ou ` BRT`
- `scroll \d+%`
- `\d+s` (segundos como métrica) ou `tempo total`
- 4+ palavras em CAPS consecutivas
- termos da blacklist (`engajamento`, `NRHS`, `vibe_state`, `seções visualizadas`, etc.)

Se passar, salva normalmente. Se falhar, marca `validation_flag = 'style_violation'` + `validation_warnings_json` listando o que vazou e força aprovação humana com o motivo claro.

### 5) Ajustar o `renderBriefForPrompt` para "esconder ruído"

O brief continua 360º para o modelo **raciocinar**, mas o que vai pro prompt é renderizado em forma mais narrativa:

- Datas em formato BR (`17/04`) e relativas (`há 4 dias`), não ISO.
- Engajamento como narrativa: "cliente abriu a proposta 3 vezes; última visita há 4 dias; ficou bastante tempo lendo no desktop" — em vez de `views: 3, total_seconds: 924, max_scroll: 100`.
- Esconder campos cujo nome literal estava vazando (`scroll_pct`, `sections_viewed`, `total_seconds`, `T...+00:00`).

Isso reduz a tentação do modelo de copiar tokens crus.

### 6) UI de aprovação: badge "estilo robótico"

No `OpportunityPendingApprovalsCard`, quando `validation_flag = 'style_violation'`, mostrar badge vermelho "⚠ Estilo robótico detectado: timestamps ISO, scroll %" — junto com botão direto "Reescrever" que dispara um novo run só do passe 2 (humanize) sobre o mesmo rascunho.

## Arquivos tocados

### Backend
- `supabase/functions/execute-email-agent-run/index.ts` — novo prompt de voz/estilo, few-shot, pipeline 2-passes, sanitizador determinístico, gravação do `style_violation`.
- `supabase/functions/_shared/opportunity-context.ts` — `renderBriefForPrompt` em formato narrativo BR (datas relativas, sem ISO/timezone, sem campos técnicos no texto).
- `supabase/functions/_shared/email-style-guard.ts` (novo) — regex blacklist + função `enforceHumanStyle(text)` reutilizável.

### Frontend
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx` — badge "Estilo robótico" + ação "Reescrever".
- `src/hooks/useOpportunityApprovals.ts` — expor `style_violation` no tipo de warning.

## Validação

1. Disparar o agente para a opp **COLUMBIA NA INFRAFM 2026** novamente. Esperado:
   - Sem `2026-04-17T...`, sem `+00:00`, sem `924s`, sem `scroll 100%`, sem `seções visualizadas: header, context...`.
   - 2–4 frases, tom de WhatsApp formal, primeiro nome do contato, no máximo 1 número/data.
2. Forçar o passe 1 a vazar timestamp → confirmar que o passe 2 limpa.
3. Forçar o passe 2 a falhar (mock) → confirmar que `style_violation` dispara, vai pra approval com badge vermelho.
4. Comparar 3 e-mails seguidos pra garantir variação de CTA (sem "15 min na quinta" repetido).

## Resultado esperado

E-mails que parecem **escritos pelo Wagner**, não pelo painel de analytics. Os dados 360º continuam sendo usados — mas como **inteligência interna** que decide *o quê* falar, e não como *texto* do e-mail.

