# NOID RevenueOS for Events — Product Blueprint v1

- **Status:** Aprovado para orientar productização
- **Versão:** 1.0
- **Data:** 19 de julho de 2026
- **Owner:** Wagner Sansevero
- **Empresa:** HUMANOID PLATFORMS LTDA
- **Produto:** NOID RevenueOS
- **Mercado inicial:** Brasil
- **Modalidade inicial:** Implantação assistida
- **Fase:** Programa Clientes Fundadores
- **Próxima revisão sugerida:** Após os três primeiros clientes implantados

## Marcadores usados neste documento

- **APROVADO** — decisão executiva definida pelo owner neste briefing.
- **EXISTENTE** — capacidade suficientemente comprovada por código funcional / rota + hook + tabela / edge function referenciada em produção.
- **PROPOSTO** — definição conceitual do produto vertical, ainda não implementada ou não homologada.
- **NECESSITA AUDITORIA** — há sinais da capacidade no repositório, mas a evidência coletada nesta sprint não é suficiente para afirmar que está operacional.
- **BLOQUEADOR** — impede implantação ou exposição segura a clientes externos.
- **RISCO** — não impede necessariamente o piloto, mas exige mitigação.
- **FUTURO** — não pertence ao primeiro ciclo comercial.
- **FORA DO ESCOPO** — não pertence ao Revenue Core.

Hierarquia de confiança das evidências: schema em produção > migrations aplicadas > tipos gerados atuais > código funcional > rota/componente/hook > testes > documentação técnica > dumps/arquivos staged. Documentos de segurança (`docs/security/*`) são **evidência documental**, nunca prova de que a proteção está ativa.

---

## 1. Resumo executivo

**Definição oficial:**

> O NOID RevenueOS for Events é o sistema operacional de receita criado para fornecedores B2B do mercado de eventos controlarem oportunidades, propostas, atividades e previsões comerciais antes que o tempo do evento elimine a possibilidade de venda.

O mercado brasileiro de fornecedores de eventos opera sob uma restrição que CRMs genéricos ignoram: **a data do evento é uma barreira intransponível**. Uma oportunidade perde valor de forma não-linear conforme o evento se aproxima, e após a montagem ou o início do evento a receita simplesmente deixa de ser recuperável. Fornecedores de audiovisual, iluminação, sonorização, internet, credenciamento, montagem, cenografia, estruturas, mobiliário e serviços operacionais convivem com esse relógio diariamente, mas gerenciam suas oportunidades em planilhas, e-mail, WhatsApp e CRMs horizontais que não entendem "faltam 12 dias para o evento".

O NOID RevenueOS for Events resolve esse gap com um processo comercial pré-configurado, orientado pelo relógio do evento, que impede a perda de receita por qualificação superficial, falta de follow-up, propostas abandonadas, ausência de próximo passo, dados dispersos e forecast sem confiabilidade.

**A primeira versão comercial** entrega o **NOID Revenue Core** em modalidade de **implantação assistida**, dentro do **Programa Clientes Fundadores** (até cinco empresas). Não haverá self-service, trial irrestrito, nem promessa de agentes autônomos operando em nome do cliente no primeiro ciclo.

**Fronteira NOID x Eventrix.** O **Revenue Core inicial do NOID** cobre **pré-vendas, vendas, forecast e handoff comercial**. O **Eventrix** cobre a **execução operacional do evento** (inventário físico, alocação, romaneio, montagem, controle de ativos). **CS, renovação, expansão e pós-venda comercial poderão permanecer no NOID em fases futuras** — não são compromisso do primeiro ciclo. Onde os dois se tocam — catálogo comercial de produtos que consomem inventário — existem componentes, schemas e snapshots no repositório (ver Apêndice A); isso **não** comprova integração funcional. **Qualquer integração NOID → Eventrix é classificada como PROPOSTO ou NECESSITA AUDITORIA** até ser homologada operacionalmente na Sprint 0.2. Não é possível afirmar que a integração já funciona apenas porque há componentes, snapshots ou configurações no código.

---

## 2. ICP — Ideal Customer Profile

### 2.1 ICP primário (APROVADO)

Fornecedores B2B para o mercado de eventos que atendem, cumulativamente:

- **Setor:** audiovisual, sonorização, iluminação, streaming, tecnologia para eventos, internet e conectividade, credenciamento, equipamentos tecnológicos.
- **Time comercial:** 5 a 30 pessoas envolvidas em pré-vendas, vendas, gestão ou atendimento comercial.
- **Volume:** ≥ 20 propostas por mês.
- **Ticket médio:** prioritariamente acima de R$ 5 mil.
- **Ciclo comercial:** de poucos dias a ~90 dias.
- **Modelo:** trabalha com data de evento, montagem, operação ou desmontagem.
- **Dependência:** múltiplos orçamentos simultâneos e follow-up estruturado.
- **Realidade atual:** dados fragmentados entre CRM/planilha/e-mail/WhatsApp.
- **Governança:** fundador, diretor ou gerente comercial ainda envolvido diretamente na gestão do funil.

### 2.2 ICP secundário (APROVADO)

Montadoras, cenografia, estruturas, mobiliário, locação de equipamentos, serviços técnicos e serviços operacionais para eventos, com as mesmas faixas de time/volume/ticket/ciclo.

### 2.3 Perfil de comprador

- Fundador, sócio, diretor comercial, head de vendas, gerente comercial.
- Sofre diretamente com forecast não confiável e com "perdemos porque só vimos ontem".
- Autoridade para contratar tecnologia e reorganizar processo.

### 2.4 Perfil de usuário

- **SDR / Pré-vendas:** qualificação inbound e outbound.
- **Closer / Executivo comercial:** condução da oportunidade e da proposta.
- **Gestor comercial / Head de vendas:** forecast, pace, priorização, coaching.
- **Owner / Diretor:** revenue command, decisões executivas.

### 2.5 Critérios de qualificação comercial

- Envio de ≥ 20 propostas/mês.
- Ticket médio ≥ R$ 5 mil.
- Time comercial ≥ 5 pessoas.
- Ciclo baseado em data de evento.
- Fundador ou diretor disponível para o diagnóstico.
- Disposição a implantar em 30–60 dias.
- Disposição a fornecer histórico comercial mínimo para migração.

### 2.6 Critérios de desqualificação

- Operação puramente B2C.
- Volume < 20 propostas/mês.
- Ticket muito baixo com margem muito estreita.
- Empresa sem processo comercial minimamente definido.
- Empresa que espera solução self-service imediata.
- Empresa que exige customização exclusiva no produto central.
- Empresa que quer usar o NOID como ERP financeiro ou como gestor operacional do evento.

### 2.7 Anti-ICP

- Agências e organizadores de eventos (foco em produção, não fornecimento).
- Centros de convenções e casas de eventos.
- Empresas com contrato único anual e volume comercial baixo.
- Empresas que buscam disparador de WhatsApp ou marketing automation genérico.

---

## 3. Segmentos prioritários

### Prioridade 1 (APROVADO)

Audiovisual · Sonorização · Iluminação · Streaming · Tecnologia para eventos · Internet e conectividade · Credenciamento · Equipamentos tecnológicos.

### Prioridade 2 (APROVADO)

Montadoras · Cenografia · Estruturas · Mobiliário · Locação de equipamentos · Serviços técnicos · Serviços operacionais.

### Prioridade futura (FUTURO)

Agências · Organizadores · Centros de convenções · Casas de eventos · Demais segmentos.

### Ficha por segmento (P1 e P2)

| Segmento | Processo comercial típico | Principais dores | Campos relevantes | Riscos comerciais | Indicadores importantes | Aderência ao NOID |
|---|---|---|---|---|---|---|
| Audiovisual | Briefing → visita técnica → escopo → proposta → homologação → contrato | Escopo mutável, dependência de fornecedor oficial do local, prazos apertados | Data do evento, local, pavilhão, requisitos técnicos, homologação, quantidade | Perder para fornecedor oficial; escopo mal dimensionado | Ticket, taxa de visualização, dias até evento, conversão por local | Alta |
| Sonorização / Iluminação | Similar ao audiovisual, dependência forte de local | Restrições do local, curva de decisão longa em grandes eventos | Data, local, riders técnicos, homologação | Fornecedor homologado do espaço | Conversão por espaço, ticket médio | Alta |
| Streaming | Briefing técnico → PoC → proposta → contrato | Requisito técnico específico, integração com plataforma | Nº participantes, plataforma, redundância | Última hora com requisito impossível | Ciclo médio, ticket, taxa de perda por prazo | Alta |
| Internet e conectividade | Levantamento de site → dimensionamento → proposta → homologação | Site survey, capacidade do local, exclusividade | Nº usuários, banda, redundância, homologação | Fornecedor oficial do local | Conversão por local, ticket, ciclo | Alta |
| Credenciamento | Briefing → escopo → proposta → operação | Sazonalidade, escopo variável | Nº credenciais, tipo de credencial, integração | Fornecedor oficial do organizador | Ticket, conversão por organizador | Alta |
| Equipamentos tecnológicos | Consulta de disponibilidade → escopo → proposta | Conflito de agenda de equipamento, disponibilidade | Data montagem/desmontagem, quantidade | Conflito operacional | Ocupação, ticket, ciclo | Alta |
| Montadoras / Estruturas | Projeto → escopo → proposta → contrato | Projeto customizado, prazo de produção | Metragem, materiais, prazo de montagem | Prazo insuficiente de produção | Ciclo médio, ticket | Alta |
| Cenografia | Briefing criativo → projeto → orçamento → contrato | Ciclo criativo longo, revisões múltiplas | Escopo criativo, prazo de aprovação | Perder por prazo criativo | Nº de revisões, ticket, ciclo | Média-alta |
| Mobiliário / Locação | Consulta → disponibilidade → proposta | Concorrência por item específico | Quantidade, período, itens | Disponibilidade | Ocupação, conversão, ticket | Alta |

---

## 4. Problemas atendidos

Taxonomia oficial de dores comerciais do vertical de eventos. Cada dor traz sintoma, impacto, momento, persona, tratamento pretendido pelo Revenue Core e métrica relacionada. O status abaixo é do **tratamento no produto atual** — não da existência da dor.

| # | Dor | Sintoma | Impacto financeiro | Momento | Persona | Tratamento no Revenue Core | Métrica relacionada | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Lead sem resposta rápida | Lead esperando > 24 h | Perda por concorrência | Entrada | SDR | Fila priorizada + SLA + alerta | Tempo de 1ª resposta | PROPOSTO / NECESSITA AUDITORIA |
| 2 | Lead frio sem cadência | Contatos esparsos | Perda por esquecimento | Nutrição | SDR | Cadência configurável | Nº toques | NECESSITA AUDITORIA |
| 3 | Qualificação superficial | Handoff sem dor/urgência | Retrabalho + fechamento pobre | Qualificação | SDR | Framework vertical + checklist | Taxa de qualificação real | NECESSITA AUDITORIA |
| 4 | Handoff incompleto | Closer recebe sem contexto | Perda de tempo, pergunta repetida | Handoff | SDR/Closer | Campos obrigatórios + snapshot | Retrabalho | PROPOSTO |
| 5 | Oportunidade sem data do evento | Sem relógio | Sem priorização | Vendas | Closer | Campo obrigatório + alerta | % opps com data | PROPOSTO |
| 6 | Oportunidade sem próximo passo | Deal órfão | Estagnação | Vendas | Closer | Alerta + campo obrigatório | % opps sem próximo passo | NECESSITA AUDITORIA |
| 7 | Atividade atrasada | Follow-up perdido | Perda por silêncio | Vendas | Closer | Alerta + dashboard | Atividades atrasadas | NECESSITA AUDITORIA |
| 8 | Proposta não enviada | Deal parado em "em construção" | Ciclo estendido | Proposta | Closer | Alerta de proposta pendente | Tempo em construção | NECESSITA AUDITORIA |
| 9 | Proposta enviada e não visualizada | Silêncio do cliente | Perda por esquecimento | Proposta | Closer | Alerta de não-visualização + tracking | Tempo até 1ª visualização | NECESSITA AUDITORIA |
| 10 | Proposta visualizada sem follow-up | Sinal ignorado | Perda por lentidão | Proposta | Closer | Alerta de visualização + realtime | Tempo entre visualização e follow-up | NECESSITA AUDITORIA |
| 11 | Negociação parada | Deal sem movimento há X dias | Estagnação | Negociação | Closer/Gestor | Alerta de stalled | Dias parado | NECESSITA AUDITORIA |
| 12 | Evento próximo sem decisão | Faltam N dias | Perda iminente | Fechamento | Closer/Gestor | Alerta escalonado | Dias até evento | PROPOSTO |
| 13 | Evento iniciado com opp aberta | Perda operacional inevitável | Perda total | Fechamento | Gestor | Alerta crítico + auto-classificação | Nº opps com evento iniciado abertas | PROPOSTO |
| 14 | Perda por fornecedor oficial/homologado | Cliente já tinha fornecedor | Deal morto na origem | Qualificação | SDR | Campo de qualificação | Perdas por essa causa | PROPOSTO |
| 15 | Perda por indisponibilidade | Sem operação para atender | Perda controlável | Diagnóstico | Closer | Validação prévia | Perdas por indisponibilidade | PROPOSTO |
| 16 | Perda por contato tardio | Descoberta tardia | Perda por tempo | Qualificação | SDR/Closer | Alerta de janela | Perdas por prazo | PROPOSTO |
| 17 | Perda por preço / budget / fit | Diagnóstico impreciso | Ciclo desperdiçado | Fechamento | Closer/Gestor | Motivos estruturados | Perdas por motivo | NECESSITA AUDITORIA |
| 18 | Forecast superestimado / sem dados | Meta não bate com pipeline | Decisão errada | Gestão | Gestor/Owner | Forecast unificado + confidence | Acurácia | NECESSITA AUDITORIA |
| 19 | Falta de visibilidade do gestor | Gestor sem panorama | Coaching ineficiente | Gestão | Gestor | Dashboards por função | Adesão do gestor | NECESSITA AUDITORIA |
| 20 | Motivos de perda mal preenchidos | Aprendizado zero | Sem melhoria contínua | Perda | Todos | Motivos estruturados + obrigatório | % perdas classificadas | NECESSITA AUDITORIA |
| 21 | Produtos/escopos inconsistentes | Propostas divergentes | Retrabalho + margem baixa | Proposta | Closer/Ops | Catálogo + template | Divergência de escopo | NECESSITA AUDITORIA |
| 22 | Dados comerciais espalhados | Verdade em 5 lugares | Erro sistêmico | Sempre | Todos | Fonte única | Adesão ao sistema | PROPOSTO |

---

## 5. Proposta de valor

### 5.1 Promessa comercial principal (APROVADO — versão agressiva)

> **"O sistema comercial que impede sua empresa de descobrir tarde demais que perdeu o evento."**

### 5.2 Promessa institucional (APROVADO — versão neutra)

> "O NOID organiza, prioriza e protege a operação comercial dos fornecedores de eventos, do primeiro contato ao fechamento."

### 5.3 Proposta de valor por persona

- **SDR:** fila de leads priorizada pelo relógio do evento, cadência estruturada, handoff sem retrabalho.
- **Closer:** cada oportunidade com data de evento, próximo passo e criticidade explícita; proposta com sinal de visualização e alerta antes de esfriar.
- **Gestor:** forecast unificado, pace diário, oportunidades em risco antes que virem perda, coaching baseado em dado real.
- **Owner:** Revenue Command com receita realizada e cobertura de meta na mesma fonte que os relatórios e a comissão.

### 5.4 Proposta de valor por segmento

- **Audiovisual / Sonorização / Iluminação / Streaming:** conversão por local e por organizador visível, priorização automática por dias até o evento, alertas de fornecedor oficial.
- **Internet e conectividade / Credenciamento:** sinalização de exclusividade do local, ciclo baseado em homologação.
- **Montadoras / Cenografia / Estruturas:** proteção do prazo de produção com alertas escalonados conforme montagem se aproxima.
- **Mobiliário / Locação de equipamentos:** integração com ocupação futura via NOID→Eventrix, sem virar sistema de inventário.

### 5.5 Diferenciais

- **Vs. CRM genérico:** entende data de evento, montagem, homologação, fornecedor oficial e janela crítica. Não é uma coluna a mais no negócio; é a lógica central de priorização.
- **Vs. planilhas:** governança multi-usuário, auditoria, forecast, propostas com tracking, dashboards por função.
- **Vs. ferramentas isoladas:** uma única fonte da verdade para receita realizada — a mesma que alimenta relatórios, forecast, comissão e Revenue Command.

**Não usamos** promessas percentuais, casos fictícios, ROI numérico ou "aumento de X% em Y semanas". A primeira leva de clientes construirá o baseline.

---

## 6. Fluxo comercial padrão

### 6.1 Pipeline padrão de Pré-vendas (APROVADO como desenho de produto — PROPOSTO como configuração default)

1. Novo lead
2. Tentativa de contato
3. Contato realizado
4. Em qualificação
5. Qualificado para vendas
6. Nutrição
7. Desqualificado

### 6.2 Pipeline padrão de Vendas (APROVADO como desenho — PROPOSTO como default do template)

1. Oportunidade recebida
2. Diagnóstico realizado
3. Escopo em construção
4. Proposta enviada
5. Proposta visualizada
6. Negociação
7. Aprovação pendente
8. Ganho
9. Perdido
10. Cancelado

### 6.3 Ficha por etapa

Para cada etapa dos pipelines acima, o Revenue Core deve documentar (o preenchimento definitivo ocorre no Product Fit Audit):

- **Objetivo** da etapa
- **Critério de entrada** (que evento coloca a opp aqui)
- **Critério de saída** (que evento move a opp adiante)
- **Campos obrigatórios** para permanência
- **Próxima atividade obrigatória** (com prazo)
- **SLA recomendado** de permanência
- **Alertas** vinculados
- **Responsável** (SDR / Closer / Gestor)
- **Automação desejada**
- **Risco comercial** típico
- **Evento de auditoria** gerado
- **Condição para avanço**, **condição para retorno**, **condição para perda/desqualificação**

**Exemplo canônico** (Vendas, etapa "Proposta visualizada"):

- Critério de entrada: `proposal_views` registra 1ª visualização.
- Critério de saída: cliente responde OU 48 h sem resposta.
- Campos obrigatórios: data do evento, próximo passo, decisor identificado.
- Próxima atividade: follow-up em ≤ 24 h.
- Alertas: T+24 h sem follow-up; T+48 h escala para gestor.
- Automação: cria atividade de follow-up automática após visualização (NECESSITA AUDITORIA no produto atual).
- Risco: cair para "Negociação" ou "Perdido" por silêncio.

### 6.4 Fluxos transversais

- **Handoff SDR → Closer:** oportunidade só entra em Vendas com data do evento, decisor, dor, urgência e próximo passo preenchidos.
- **Fluxo da proposta:** criação → revisão interna → envio → tracking de visualização → aceite/decline público → snapshot congelado na oportunidade.
- **Fluxo de follow-up:** toda atividade concluída dispara sugestão de próxima atividade; nenhuma opp em Vendas pode ficar sem próximo passo por mais que o SLA da etapa.
- **Fluxo de ganho:** venda ganha → snapshot de escopo → handoff operacional (fora do NOID Revenue Core, entra Eventrix).
- **Fluxo de perda:** motivo estruturado obrigatório (categoria + motivo específico + accountability comercial/cliente/operação/mercado/desconhecido).
- **Fluxo de cancelamento:** ganho pode ser cancelado com registro separado; a receita cancelada é excluída do realizado líquido (regra existente no produto).
- **Fluxo pós-venda mínimo:** handoff operacional documentado; NOID Revenue Core não gerencia execução do evento.
- **Fronteira NOID ↔ Eventrix:** a partir do "Ganho", o NOID congela snapshot de demanda operacional; a execução (inventário, alocação, romaneio) fica no Eventrix.

---

## 7. Campos específicos de eventos (PROPOSTO)

Conjunto vertical mínimo que uma oportunidade do mercado de eventos deve suportar. Alguns já existem parcialmente no produto atual (NECESSITA AUDITORIA na Sprint 0.2); outros são novos campos verticais (PROPOSTO).

### Identificação
- Nome do evento · Tipo do evento · Edição/ano · Organizador · Contratante · Agência ou intermediário · Tipo de participação (expositor, organizador, patrocinador, fornecedor)

### Datas
- Data inicial · Data final · Data de montagem · Data de desmontagem · Data limite de contratação · Data estimada de decisão · Data prevista de fechamento

### Localização
- Local · Pavilhão · Auditório · Espaço · Nº do estande · Endereço · Cidade · Estado

### Escopo
- Produto/serviço · Quantidade · Duração da operação · Nº de participantes · Nº de usuários/conexões (quando aplicável) · Requisitos técnicos · Restrições do local · Fornecedor homologado exigido · Credenciamento técnico exigido

### Comercial
- Budget · Ticket estimado · Urgência · Concorrentes · Fornecedor oficial · Critério de decisão · Decisor · Influenciadores · Processo de aprovação · Probabilidade · Próximo passo · Data do próximo passo

### Relacionamento
- Evento recorrente · Cliente recorrente · Histórico no evento · Histórico no espaço · Histórico com organizador · Histórico de ganhos/perdas

**Para cada campo**, o Product Fit Audit deverá definir: obrigatoriedade, momento de preenchimento, pipeline relacionado, persona responsável, uso em automações/dashboards/forecast/propostas/handoff. **Nenhuma migration será feita nesta sprint.**

---

## 8. Qualificação padrão

### 8.1 Framework vertical proposto (PROPOSTO)

Checklist mínimo obrigatório para promover pré-vendas → vendas:

- Evento identificado (nome + tipo)
- Data confirmada
- Local confirmado
- Serviço procurado
- Dor real identificada
- Urgência
- Budget
- Decisor
- Processo de decisão
- Concorrência mapeada
- Fornecedor oficial/homologado
- Data limite de contratação
- Viabilidade operacional
- Capacidade de atendimento
- Próximo passo definido
- Potencial financeiro
- Fit com o ICP
- Risco comercial

### 8.2 Pontuação sugerida

Pontuação binária por item + pesos para: data confirmada, decisor, budget, viabilidade operacional. Cortes:

- **Qualificado:** todos os obrigatórios preenchidos + score ≥ limiar.
- **Nutrição:** obrigatórios parcialmente preenchidos, mas fit e potencial mantidos.
- **Desqualificado:** eliminatórios acionados (fornecedor oficial já contratado; evento já iniciado; sem budget; sem fit).

### 8.3 Responsabilidades

- **SDR:** preencher qualificação e disparar handoff.
- **Closer:** validar qualificação na primeira interação.
- **Gestor:** auditar qualidade de qualificação semanalmente.

### 8.4 Comparação com o produto atual

- Existe página `/app/settings/qualification` (`QualificationFrameworkPage`) e módulo `src/lib/qualification/*` com scoring/recomendação. **Status: NECESSITA AUDITORIA** — o produto tem framework configurável, mas a aderência ao checklist vertical acima precisa ser confirmada em Sprint 0.2. Nada será alterado nesta sprint.

---

## 9. Automações padrão

Conjunto vertical recomendado. Nenhuma será implementada aqui.

| Automação | Gatilho | Condições | Ação | Responsável | Exceções | Canal | Frequência | Risco duplicidade | Aprovação | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Criar próxima atividade após contato | Atividade "contato" concluída | Opp em Vendas | Cria atividade sugerida | Sistema | Etapa "Ganho"/"Perdido" | In-app | Por evento | Alto (mitigar por regra anti-dup) | Não | NECESSITA AUDITORIA |
| Alertar lead sem 1ª resposta | Lead > SLA | SLA por origem | Notifica SDR + escala | Sistema | Lead descartado | In-app + push | Por evento | Baixo | Não | NECESSITA AUDITORIA |
| Alertar opp sem próximo passo | Cron | Opp em Vendas ativa | Notifica owner | Sistema | Ganho/Perdido | In-app | Diária | Baixo | Não | NECESSITA AUDITORIA |
| Alertar atividade atrasada | Cron | due_date < now | Notifica owner + gestor | Sistema | Concluída/cancelada | In-app + push | Diária | Baixo | Não | NECESSITA AUDITORIA |
| Follow-up após proposta enviada | Proposta enviada | Sem atividade futura | Cria follow-up +24 h | Sistema | Deal Ganho/Perdido | In-app | Por evento | Médio | Não | NECESSITA AUDITORIA |
| Alertar proposta não visualizada | Cron | Proposta enviada há N h sem view | Notifica owner | Sistema | Deal fechado | In-app | Por evento | Baixo | Não | NECESSITA AUDITORIA |
| Alertar proposta visualizada sem resposta | Cron | View > N h sem atividade | Notifica owner + gestor | Sistema | Aceita/Recusada | In-app + push | Por evento | Baixo | Não | NECESSITA AUDITORIA |
| Escalonar criticidade por proximidade do evento | Cron | Data do evento - hoje ≤ limiar | Rebalança prioridade + alerta | Sistema | Ganho/Perdido | In-app | Diária | Baixo | Não | PROPOSTO |
| Alertar evento iniciado com opp aberta | Cron | data_inicial < hoje E status aberto | Alerta crítico + gestor | Sistema | Fechada | In-app + email | Diária | Baixo | Sim (auto-classificação exige aprovação) | PROPOSTO |
| Alertar negócio parado | Cron | Sem atividade há N dias | Notifica owner + gestor | Sistema | Fechado | In-app | Diária | Baixo | Não | NECESSITA AUDITORIA |
| Alertar opp sem data do evento | Cron | Campo vazio em etapa X+ | Notifica owner | Sistema | Fechada | In-app | Diária | Baixo | Não | PROPOSTO |
| Alertar opp sem decisor | Cron | Campo vazio em etapa X+ | Notifica owner | Sistema | Fechada | In-app | Diária | Baixo | Não | PROPOSTO |
| Handoff pós-ganho | Deal ganho | Snapshot pronto | Cria tarefa operacional | Sistema | — | In-app | Por evento | Baixo | Não | PROPOSTO |
| Motivo estruturado obrigatório na perda | Mudança para "Perdido" | Motivo vazio | Bloqueia + solicita motivo | Sistema | — | UI | Por evento | Baixo | Não | NECESSITA AUDITORIA |

**Regra:** nenhuma automação vertical será ativada por padrão para clientes fundadores sem homologação explícita na Sprint 0.2.

---

## 10. Dashboards

| Dashboard | Persona | Pergunta que responde | Fonte principal (a validar) | Status no produto |
|---|---|---|---|---|
| Central SDR | SDR | "Quais leads devo trabalhar agora?" | Pipelines de pré-vendas + fila priorizada | NECESSITA AUDITORIA |
| Dashboard do Closer | Closer | "Onde perco receita hoje?" | `useCloserDashboardData` (`src/hooks/dashboard/`) | EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL |
| Dashboard do Gestor | Gestor | "Meu time bate a meta?" | Agregação por dono | NECESSITA AUDITORIA |
| Forecast | Gestor / Owner | "Onde estou vs. meta, com qual confiança?" | Forecast unificado (regra registrada: `calculateForecastScenarios`) | EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL |
| Revenue Command | Owner | "Realizado, gap, concentração, run rate" | `commercial_won_revenue_view` restrita ao pipeline sales primário | EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL (SSoT recentemente alinhada com Forecast por correção pontual; **reconciliação operacional definitiva será provada na Sprint 0.2**) |
| Win/Loss | Gestor / Owner | "Por que ganho/perco?" | `WinLossHub` (`src/pages/intelligence/`) | EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL |
| Relatórios comerciais | Gestor / RevOps | "Cortes por vendedor/segmento/período" | Relatórios v2 | EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL |
| Propostas em risco | Closer / Gestor | "Que propostas vão morrer?" | Combinação de proposals + views + atividades | PROPOSTO (parcialmente coberto por Dashboard Closer) |
| Eventos próximos sem definição | Gestor | "O que fecha esta semana?" | Corte por data do evento | PROPOSTO |

**Nenhum dashboard será criado ou redesenhado nesta sprint.** A **reconciliação operacional entre módulos** (Dashboard do Closer, Forecast, Revenue Command, Win/Loss, Relatórios e Fonte Única de Receita) **não pode ser afirmada como definitiva** com base apenas em rota + componente + hook — precisa de teste e rastreamento da fonte de dados na Sprint 0.2.

---

## 11. Métricas oficiais

Para cada métrica: definição, fórmula conceitual, fonte, periodicidade, persona, risco de interpretação, disponibilidade. **A fonte técnica só é afirmada quando comprovada** — caso contrário, "fonte a definir no Product Fit Audit".

### 11.1 Pré-vendas
Leads recebidos · Tempo de 1ª resposta · Tentativas de contato · Taxa de conexão · Taxa de qualificação · Taxa de desqualificação · Motivos de desqualificação · Conversão SDR→Vendas · Tempo médio de qualificação.

### 11.2 Vendas
Oportunidades recebidas · Propostas enviadas · Propostas visualizadas · Conversão por etapa/vendedor/segmento/origem/evento/organizador/local · Ticket médio · Ciclo médio · Motivos de perda · Receita ganha · Receita perdida · Receita em risco.

### 11.3 Verticais (PROPOSTO — específicas do vertical de eventos)
Dias até o evento · Dias até a montagem · Dias desde o último contato · Dias desde a proposta · Opps sem próximo passo · Opps com evento próximo · Eventos iniciados com opp aberta · Valor em risco antes do evento · Conversão por antecedência · Perdas por contato tardio · Perdas por fornecedor oficial · Perdas por indisponibilidade · Perdas por prazo · Receita por evento · Receita por local · Receita por organizador · Recorrência de clientes/eventos.

### 11.4 Gestão
Cobertura de pipeline · Forecast · Commit · Best case · Gap para meta · Pipeline saudável · Negócios estagnados · Atividades críticas · Confiabilidade dos dados.

### 11.5 Fontes já comprovadas

- **Receita realizada:** existe fonte técnica única `commercial_won_revenue_view` referenciada pelo Forecast, Dashboard, Revenue Command, OTE e Relatórios (correção recente unificou o escopo ao pipeline sales primário). **Status: EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL.** A reconciliação numérica definitiva entre todas as telas será rastreada e comprovada na Sprint 0.2; a correção recente é evidência estrutural, não substitui teste operacional.
- **Integração dos indicadores entre módulos:** **EXISTENTE ESTRUTURALMENTE — NECESSITA AUDITORIA OPERACIONAL**.
- **Demais métricas verticais:** **NECESSITA AUDITORIA** — várias dependem de campos verticais (Seção 7) ainda não formalizados.

**Regra:** nenhuma RPC ou função de cálculo será criada nesta sprint.

---

## 12. Escopo do NOID Revenue Core

### 12.1 Escopo-alvo do primeiro ciclo comercial — sujeito à classificação e homologação no Product Fit Audit

Empresas · Contatos · Leads · Oportunidades · Pipelines · Atividades · Próximos passos · Pré-vendas · Qualificação · Handoff · Vendas · Produtos e serviços · Propostas · Motivos de perda · Motivos de desqualificação · Forecast · Revenue Command · Win/Loss · Dashboards por função · Relatórios · Importação · Exportação · Usuários · Equipes · Papéis · Permissões · Auditoria básica · Notificações · Automações homologadas · Implantação assistida · Treinamento · Suporte inicial.

**Nenhum módulo desta lista é considerado definitivamente vendável antes de ser classificado, na Sprint 0.2, em uma das categorias:** `PRONTO / CONFIGURAR / CORRIGIR / ADAPTAR / OCULTAR / FUTURO`. A lista acima define o **alvo** do primeiro ciclo, não uma garantia de prontidão comercial de cada capacidade.

### 12.2 Core configurável (APROVADO)

Pipelines, etapas, framework de qualificação, motivos de perda/desqualificação, templates de proposta, campos personalizados, formulários públicos, cadências, regras de automação, permissões.

### 12.3 Add-ons futuros (FUTURO)

Integrações específicas (Eventrix, HumanERP, ERPs de terceiros), sequências avançadas de e-mail, telefonia integrada, WhatsApp oficial homologado, roleplay para treinamento, gamificação avançada, OTE avançado.

### 12.4 Recursos internos (não vendáveis, uso da HUMANOID/LEGAL)

Kairós, Apollo Invisible, Autopilot, Qualified Queue, Agent Builder, Headless Humanoid Lab, AI Operations experimental, Revenue Attribution, Forensic Command Center, Trace Viewer, Admin Control Room, Skills Library.

### 12.5 Recursos experimentais (FUTURO / RISCO — não expor a cliente externo)

Vibe Selling, Optimization Hub, Experiments Hub, Playbooks Hub, Knowledge Graph, Memories, Decision Rules, Learning Performance, MCP Registry.

---

## 13. Itens candidatos a ocultação no primeiro ciclo

Nada será ocultado nesta sprint. A lista abaixo orienta a Sprint 0.2 (Product Fit Audit) e a criação do NOID Events Template.

| Item | Rota / Componente localizado | Público atual | Risco | Recomendação | Forma futura de ocultação | Dependências |
|---|---|---|---|---|---|---|
| Autonomous / Agentes autônomos | `/app/settings/noid-intelligence/agents/*`, `CreateAgent`, `AgentBuilderPage`, `AgentSimulatorPage`, `AgentOutcomesPage` | Interno LEGAL | Alto — expectativa de "IA autônoma" para clientes | OCULTAR | Feature flag por plano + entitlement | Governança de agentes |
| Agent Builder | `AgentBuilderPage` | Interno | Alto — customização de agente por cliente | OCULTAR | Feature flag | Idem |
| Headless Humanoid Lab | `/app/settings/noid-intelligence/hh-lab` (`HeadlessHumanoidLabPage`) | Interno | Alto | OCULTAR | Feature flag | — |
| AI Operations experimental | `/app/ai-operations` (`AIOperations.tsx`) | Interno | Alto | OCULTAR | Feature flag | — |
| Kairós Hub | `/app/intelligence/kairos` (`KairosHub`) | Interno LEGAL | Alto — não homologado para cliente externo | OCULTAR (manter para LEGAL) | Entitlement | Playbooks Kairós |
| Apollo ROI / Apollo Invisible | `/app/intelligence/apollo-roi` (`ApolloRoi`), edge functions `apollo-*` | Interno LEGAL | Alto | OCULTAR | Entitlement | Governança de contatos |
| Optimization / Experiments / Playbooks / Vibe / Knowledge Graph / Memories | `/app/intelligence/optimization`, `/experiments`, `/playbooks`, `/vibe`, `/graph`, `/memories` | Interno | Alto | OCULTAR | Feature flag | — |
| Inventário Eventrix (integração) | `/app/settings/eventrix-inventory` (`EventrixInventorySettings`) | Beta | Médio — cliente pode confundir com Eventrix | OCULTAR até homologação | Feature flag por plano | Sincronização Eventrix |
| Backup de Inventário NOID | `/app/settings/noid-inventory-backup` (`NoidInventoryBackupPage`) | Interno | Baixo — página de export read-only | OCULTAR | Restringir a owner/admin (já é via `SettingsGate full`) | — |
| OTE avançado / Roleplay | `/app/reports/ote`, `/app/objetivos/desempenho`, `/app/roleplay/*` | Interno / experimental | Médio | OCULTAR até homologação vertical | Feature flag | Config OTE |
| Configurações específicas da LEGAL | `/admin/*` | HUMANOID (super admin) | Alto | Manter apartado do produto de cliente | Já isolado por rota `/admin` | Platform admin |
| Ferramentas de auditoria (super admin) | Forensic Command Center, Trace Viewer, Revenue Integrity, Control Room | HUMANOID | Alto | Manter apartado | Rota `/admin` | Platform admin |
| Placeholders "em breve" | `NoidPlaceholder` em Orquestrações / Logs / Ferramentas / Memórias | Aparecem no menu | Médio | OCULTAR | Feature flag | — |
| Funcionalidades sem validação externa | Skills Library, Decision Rules, Learning Performance, MCP Registry | Interno | Médio | OCULTAR | Feature flag | — |

---

## 14. Itens fora do escopo do Revenue Core

**FORA DO ESCOPO** (não entram no NOID Revenue Core, nem como add-on):

- ERP financeiro · Contabilidade · Fiscal · Emissão fiscal · Folha de pagamento
- Gestão completa de estoque · Gestão operacional completa do evento · Gestão de montagem e desmontagem
- Sistema de ingresso · Credenciamento operacional completo
- Gestão de fornecedores · Gestão de projetos · Gestão de facilities · Gestão de chamados técnicos
- Disparador de WhatsApp · Marketing automation genérico · Rede social
- Desenvolvimento exclusivo por cliente · Customizações que alterem o produto central
- Funcionalidades do Eventrix · Funcionalidades do HumanERP

**Poderá ser integrado (não incluído):**
- Eventrix (inventário físico, alocação, operação) — via categorias/famílias e snapshot de demanda.
- HumanERP (fiscal / faturamento / cobrança) — via webhook de venda ganha.
- ERPs de terceiros (integração sob acordo comercial).
- WhatsApp oficial via provedor homologado (FUTURO).

**Poderá virar add-on (FUTURO):**
- Telefonia integrada · Sequências avançadas · Roleplay para treinamento · Gamificação · OTE avançado · Analytics vertical premium.

**Pertence ao Eventrix:**
- Inventário físico, serial number, ICCID, IMEI, alocação, romaneio, movimentação, manutenção.

**Pertence ao HumanERP:**
- Faturamento fiscal, contas a receber/pagar, contabilidade, cobrança recorrente.

**Nunca deve entrar no NOID Revenue Core:**
- Qualquer módulo que replique responsabilidade de Eventrix ou HumanERP.
- Customização exclusiva por cliente que altere o produto central.

---

## 15. Tenant Template — NOID Events Template (PROPOSTO)

Descrição conceitual. **Não será criado nesta sprint.**

### 15.1 Objetivo

Organização fictícia, populada com dados totalmente sintéticos, capaz de ser clonada para demonstração comercial e ambiente de treinamento sem qualquer dado real da LEGAL ou de qualquer cliente.

### 15.2 Estrutura

- 1 organização fictícia (nome, CNPJ e razão social sintéticos).
- Personas fixas: 1 owner, 1 gestor, 2 closers, 2 SDRs.
- Pipelines: pré-vendas e vendas conforme Seções 6.1 e 6.2.
- Etapas com automações desligadas por padrão.
- Catálogo de ~15 produtos representativos dos segmentos P1 e P2.
- ~20 empresas fictícias e ~30 contatos.
- ~40 oportunidades distribuídas por etapa, incluindo casos de proposta enviada, visualizada, negociação, ganho, perdido, cancelado.
- ~15 propostas com layouts padrão.
- Atividades passadas e futuras suficientes para popular dashboards.
- Motivos de perda e desqualificação alinhados ao vertical.
- Formulário público de qualificação.
- Handoff configurado.
- Dashboards, Forecast, Revenue Command e Win/Loss com dados suficientes para demonstração.

### 15.3 Critérios de qualidade

- **Isolamento:** organização não deve compartilhar `organization_id` com nenhuma outra; RLS deve impedir vazamento.
- **Clonagem:** processo repetível para gerar N cópias sem colisão.
- **Atualização:** ao atualizar o template, cópias existentes não são afetadas.
- **Não conter:** dados reais da LEGAL, PII de clientes reais, integrações reais habilitadas (Kairós, Apollo, Slack, e-mail SMTP real), chaves de API reais.

### 15.4 Uso

Base para demos comerciais, playground de pré-vendas, treinamento de novos closers, ambiente de teste de configuração antes do GO LIVE do cliente.

---

## 16. Critérios de implantação

Processo padrão para clientes fundadores. **PROPOSTO** — a operação real será construída ao longo dos primeiros 30 dias.

| Fase | Objetivo | Entrada | Saída | Responsável | Prazo | Evidências | Critério de aprovação |
|---|---|---|---|---|---|---|---|
| 1. Diagnóstico | Mapear vazamentos de receita | Reunião com owner | Relatório de diagnóstico | Fundador HUMANOID | 3 dias | Doc de diagnóstico | Owner assina diagnóstico |
| 2. Levantamento do processo atual | Entender pipeline, qualificação e proposta atuais | Diagnóstico aprovado | Doc "AS-IS" | Fundador + gestor cliente | 3 dias | Doc AS-IS | Owner e gestor aprovam |
| 3. Definição do escopo | Escopo da implantação | AS-IS | Escopo TO-BE | Fundador | 2 dias | Escopo assinado | Owner assina escopo |
| 4. Coleta de dados | Base para migração | Escopo assinado | Planilhas modelo preenchidas | Cliente | 5–10 dias | Planilhas + validação | Estrutura mínima atingida |
| 5. Configuração | Configurar pipelines, qualificação, produtos, motivos, layouts, permissões, usuários | Planilhas + escopo | Tenant configurado | Time HUMANOID | 3–5 dias | Print de configurações | Checklist de configuração |
| 6. Migração | Importar dados históricos | Tenant + planilhas | Dados carregados | Time HUMANOID | 2–3 dias | Contagem de registros | Amostra validada pelo cliente |
| 7. Validação | Cliente testa | Dados carregados | Bugs classificados | Cliente + HUMANOID | 3 dias | Lista de findings | Nenhum BLOQUEADOR aberto |
| 8. Treinamento do gestor | Gestor operando dashboards | Sistema validado | Gestor autônomo | HUMANOID | 1 dia | Ata de treinamento | Gestor aprova |
| 9. Treinamento do time | SDRs/closers operando | Gestor treinado | Time operando | HUMANOID | 2 dias | Ata | Time aprova |
| 10. GO LIVE assistido | Operação real | Tudo validado | Sistema em uso | HUMANOID + cliente | 1 dia | Registro de acesso e uso | Owner declara GO LIVE |
| 11. Hypercare | Suporte próximo | GO LIVE | Estabilidade | HUMANOID | 15 dias | Lista de tickets | Nenhum crítico aberto |
| 12. Revisão de 30 dias | Baseline e ajustes | Hypercare | Baseline | HUMANOID + cliente | 1 reunião | Baseline documentado | Owner aprova continuidade |

### 16.1 Informações obrigatórias fornecidas pelo cliente

- Lista de usuários (nome, e-mail, papel).
- Estrutura de time (opcional para times < 8 pessoas).
- Base de contas/contatos com pelo menos: nome, e-mail principal, CNPJ (quando pessoa jurídica).
- Base de oportunidades ativas com pelo menos: título, empresa, valor, etapa, dono, data de fechamento prevista.
- Catálogo de produtos/serviços com preço.
- Motivos de perda usados atualmente.

### 16.2 Limites do onboarding assistido (Clientes Fundadores)

- Até 30 usuários por organização.
- Até ~10.000 registros históricos importados na Fase 6 (limite operacional; excedentes tratados como caso especial).
- Até 3 pipelines configurados.
- Até 2 sessões de treinamento formais.

### 16.3 Critérios de saneamento

- Deduplicação por CNPJ e por e-mail.
- Rejeição de linhas com campos obrigatórios ausentes.
- Normalização de datas.
- Tratamento explícito de valores nulos.

---

## 17. Critérios de sucesso dos Clientes Fundadores

**Nenhum percentual de sucesso é fixado nesta sprint.** Os primeiros 30 dias após o GO LIVE de cada cliente servem para construir o baseline.

### 17.1 Critérios de implantação (binários)

Organização criada sem alterações de código · Usuários convidados e permissões testadas · Dados importados e conciliados · Pipelines configurados · Produtos configurados · Qualificação configurada · Motivos configurados · Propostas validadas · Dashboards funcionando · Automações homologadas · Treinamento realizado · Cliente operando em GO LIVE assistido.

### 17.2 Critérios de adoção (medidos em 30 dias)

Percentual de usuários ativos (baseline) · Frequência de acesso (baseline) · Opps atualizadas (baseline) · Atividades registradas (baseline) · Próximos passos preenchidos (baseline) · Propostas criadas via NOID (baseline) · Motivos de perda preenchidos (baseline) · Gestor usando dashboards (baseline) · Forecast revisado semanalmente (baseline).

### 17.3 Critérios de resultado (medidos após baseline)

Redução de opps sem próximo passo · Redução de propostas abandonadas · Aumento da atualização do pipeline · Melhoria da qualidade da qualificação · Maior previsibilidade · Redução do tempo de resposta · Melhoria da governança comercial.

### 17.4 Regras do Programa

- Até 5 empresas no primeiro ciclo.
- Implantação assistida (sem self-service).
- Feedback estruturado quinzenal.
- Reuniões periódicas com o fundador.
- Uso de case sujeito a autorização específica por escrito.
- **Nenhuma promessa de desenvolvimento exclusivo.**
- Solicitações do cliente são avaliadas e classificadas como: **produto** (entra no backlog), **configuração** (entrega no ciclo), **integração** (avaliação de add-on), **roadmap** (posterior) ou **fora do escopo**.

---

## 18. Product Fit Audit — próxima fase (Sprint 0.2)

**Nesta sprint apenas** foram registradas evidências macro (ver Apêndice A). A auditoria completa ocorre na Sprint 0.2.

### 18.1 Classificação obrigatória por capacidade

- **PRONTO** — capacidade operacional, homologada para cliente externo.
- **CONFIGURAR** — capacidade existe; falta apenas configuração no template.
- **CORRIGIR** — bug conhecido bloqueia uso comercial.
- **ADAPTAR** — capacidade existe, mas precisa de ajuste vertical.
- **OCULTAR** — capacidade existe e é interna; não expor no primeiro ciclo.
- **FUTURO** — capacidade não pertence ao primeiro ciclo.

### 18.2 Campos do audit por capacidade

Módulo · Rota · Componente · Hook · Tabela · RPC · Edge Function · Público · Status · Risco · Dependência · Evidência · Recomendação · Prioridade · Critério de aceite.

### 18.3 Escopo da Sprint 0.2 — inventário macro + aprofundamento seletivo

A Sprint 0.2 deverá **inventariar de forma macro** todas as rotas, edge functions, RPCs, tabelas e migrations do repositório — mas **aprofundará apenas** os itens listados abaixo. **Não é exigida auditoria linha a linha do histórico completo de migrations.**

**Inventário macro (obrigatório, sem aprofundamento):**

- Todas as rotas sob `/app/*`, `/app/settings/*`, `/admin/*` e rotas públicas.
- Todas as edge functions em `supabase/functions/` (inventário macro identificou **~272 diretórios** — número referencial).
- Todas as migrations em `supabase/migrations/` (inventário macro identificou **~688 arquivos** — número referencial; nem toda migration cria capacidade nova).
- Todas as tabelas com base no schema em produção via introspecção read-only (o dump `database/dumps/00_table_list.sql` **não** é usado como fato definitivo).
- Todas as RPCs declaradas no schema `public`.

**Aprofundamento obrigatório (auditoria detalhada + classificação `PRONTO / CONFIGURAR / CORRIGIR / ADAPTAR / OCULTAR / FUTURO`):**

- **Rotas expostas a clientes** (fora de `/admin/*` e de módulos internos LEGAL).
- **Módulos do Revenue Core** (Seção 12).
- **Módulos internos que precisam ser ocultados** no primeiro ciclo (Seção 13).
- **Tabelas consumidas por capacidades do Revenue Core.**
- **RPCs referenciadas por fluxos ativos** (frontend, edge functions em uso, jobs cron ativos).
- **Edge Functions chamadas pelo frontend ou por automações ativas.**
- **Migrations relevantes para** Revenue Core, onboarding, billing, permissões, RLS, Storage e isolamento multi-tenant.
- **Dependências necessárias para implantação dos Clientes Fundadores.**
- Marcar candidatos a **CORRIGIR** com prioridade explícita (P0/P1/P2).

---

## 19. Governança do freeze (19/07/2026 → 18/08/2026)

O freeze **inicia em 19/07/2026** e **encerra em 18/08/2026** (30 dias). O freeze **proíbe expansão funcional**, mas **permite productização** — ou seja, atividades necessárias para transformar o produto atual em algo vendável e operável para os primeiros clientes externos, sem introduzir novas capacidades.

### 19.1 Permitido durante o freeze (productização)

- **Product Fit Audit read-only** (Sprint 0.2).
- **Criação e configuração do NOID Events Template** (organização fictícia + dados sintéticos + processo de clonagem).
- **Ocultação de módulos internos ou experimentais** (via feature flag / entitlement).
- **Criação ou ajuste de feature flags e entitlements** necessários para isolamento comercial entre planos, clientes e uso interno LEGAL.
- **Remoção de provas sociais e promessas não comprovadas** (landing, materiais comerciais, decks).
- **Correções na landing page** para adequação ao posicionamento aprovado neste blueprint.
- **Definição de preços, condições comerciais, contratos e SLA** (Programa Clientes Fundadores).
- **Correções P0 do Revenue Core** (apenas as classificadas como CORRIGIR na Sprint 0.2 com prioridade P0).
- **Segurança e isolamento multi-tenant** (RLS, Storage, tenant isolation suite, staging).
- **Onboarding e implantação repetível** (playbook, checklist, ambiente de implantação).
- **Ambiente demonstrativo** (base do template ligada ao pitch comercial).
- **Correções necessárias para os Clientes Fundadores** (bug, integridade de dados, autenticação, billing, importação, exportação, homologação comercial).
- **Correções necessárias para a operação interna da LEGAL**, incluindo Kairós e demais ferramentas internas necessárias ao dia a dia da HUMANOID.

### 19.2 Proibido durante o freeze

- **Novos módulos.**
- **Novos agentes.**
- **Novos dashboards não pertencentes ao Core.**
- **Novas integrações não necessárias ao GO LIVE.**
- **Novas funcionalidades experimentais.**
- **Expansão de escopo.**
- **Desenvolvimento exclusivo por cliente.**
- **Redesign cosmético sem impacto de GO LIVE.**
- **Automações fora do Revenue Core.**

### 19.3 Árvore de decisão do freeze

1. **Existe hoje?** Se não, é feature nova → backlog pós-freeze.
2. **Está quebrado?** Se sim, prossegue.
3. **Representa risco de segurança, dados, receita ou implantação?** Se sim, alta prioridade.
4. **É necessário para o Revenue Core?** Se sim, prossegue.
5. **É necessário para cliente fundador ou para a operação interna da LEGAL?** Se sim, prossegue.
6. **É configuração ou desenvolvimento?** Se configuração, execute sem código.
7. **A alteração aumenta o escopo funcional?** Se sim, backlog pós-freeze — **productização, ocultação, feature flag e correção não são expansão de escopo**.

---

## 20. Brief comercial — 20 de julho de 2026

### 20.1 O que não vender

> "Mais um CRM com inteligência artificial."

### 20.2 O que vender

> "Um sistema comercial criado dentro de uma operação real de eventos para identificar oportunidades sem próximo passo, propostas abandonadas, falhas de qualificação e receita em risco antes que o evento aconteça."

### 20.3 Oferta inicial

- Diagnóstico de vazamentos de receita.
- Demonstração assistida.
- Implantação Revenue Core.
- Participação no Programa Clientes Fundadores.

### 20.4 CTA recomendado

> "Estamos selecionando cinco fornecedores do mercado de eventos para receber um diagnóstico de vazamento de receita e participar da primeira implantação externa do NOID."

### 20.5 Papéis

- **Pré-vendas:** prospecta, qualifica, agenda diagnóstico.
- **Fundador:** conduz diagnóstico, demo, proposta e fechamento no primeiro ciclo.
- Sem trial self-service no primeiro ciclo.
- Sem promessa de Autonomous.
- Sem promessa de desenvolvimento exclusivo.

---

## 21. Riscos e dependências

| Risco | Probabilidade | Impacto | Mitigação | Owner sugerido | Gate |
|---|---|---|---|---|---|
| Herança de configurações específicas da LEGAL | Alta | Alto | Sprint 0.3 (Tenant Template) sem clonar tenant LEGAL | Produto | Antes de qualquer demo externa |
| Funcionalidades experimentais expostas | Alta | Alto | Ocultação por entitlement/feature flag na Sprint 0.2 | Engenharia | Antes do primeiro fundador |
| Falta de isolamento multi-tenant comprovado | Média | Crítico | Fase 2 (Tenant Isolation) executada em staging | Segurança | Antes do 1º cliente externo |
| Métricas inconsistentes | Média | Alto | SSoT de receita existente estruturalmente; **reconciliação operacional a comprovar na Sprint 0.2** | RevOps | Antes do GO LIVE |
| Módulos incompletos | Alta | Médio | Classificar em CORRIGIR / OCULTAR na Sprint 0.2 | Produto | Sprint 0.2 |
| Promessas de IA autônoma não homologadas | Média | Alto | Não vender Autonomous no primeiro ciclo | Comercial | Constante |
| Customização excessiva por cliente | Média | Alto | Regra "produto vs configuração vs fora do escopo" | Comercial + Produto | Contrato |
| Implantação manual sem repetibilidade | Alta | Alto | Checklist de implantação (Seção 16) | Ops | 1º cliente |
| Falta de baseline de resultados | Certa | Médio | 30 dias de baseline por cliente | CS | Após GO LIVE |
| Dependência do fundador | Alta | Alto | Documentar diagnóstico e demo | Fundador | Após 3º cliente |
| Dependência de integrações externas | Média | Médio | Sinalizar integrações como add-on | Produto | Contrato |
| Falta de critérios claros de aceite | Média | Alto | Fase 7 e 10 da implantação com aceite explícito | Ops | Cada fase |
| **Métricas, resultados, clientes ou depoimentos não comprovados na landing** (**BLOQUEADOR P0**) | Alta | Crítico reputacional, jurídico e comercial | Remover ou substituir por dados e cases reais, com autorização e evidência formal. Correção permitida durante o freeze. | Marketing + Produto + Fundador | **Antes de enviar qualquer prospect para a landing e antes da primeira demo externa** |
| **Repositório principal do NOID configurado como público sem confirmação de decisão executiva** (**BLOQUEADOR P0**) | Confirmada no metadata atual do GitHub, sujeita a nova verificação na execução | Alto para propriedade intelectual; potencialmente crítico caso exista histórico sensível (secrets, PII, dados de clientes) | Confirmar se a exposição é intencional; revisar histórico de commits em busca de secrets; tornar o repositório privado caso não seja decisão deliberada. **A visibilidade do repositório NÃO é alterada nesta sprint documental.** | Fundador + Engenharia + Segurança | **Imediato, antes do primeiro cliente externo** |

---

## 22. Decisões em aberto

Cada decisão registra opções, impactos, recomendação inicial e momento sugerido de decisão. **Nenhum valor final é fixado.**

| Decisão | Opções | Impactos | Recomendação inicial | Momento |
|---|---|---|---|---|
| Preços por plano | (a) Preço fixo por org; (b) Preço por usuário; (c) Híbrido | Previsibilidade x escala | (c) Híbrido: base + por usuário | Após 3 fundadores |
| Limites de usuários por plano | (a) 10/30/ilimitado; (b) tudo por usuário | Simplicidade x ARR | (a) para começar | Antes de plano comercial oficial |
| Limites de armazenamento / propostas / IA | Limites nominais x limites soft | UX x custo | Limites soft com alerta | Após 3 fundadores |
| SLA definitivo | 8x5 vs 24x7 vs híbrido | Custo operacional | 8x5 no primeiro ciclo | Antes do 1º contrato |
| Planos comerciais definitivos | Starter / Pro / Enterprise | Posicionamento | Aguardar baseline | Após 3 fundadores |
| Integrações incluídas | Nenhuma; Eventrix incluso; HumanERP incluso | Ticket x complexidade | Nenhuma incluída; add-on | Antes de plano comercial |
| Política de customização paga | Não fazer; horas técnicas cobradas | Escalabilidade | Não fazer no Revenue Core | Constante |
| Estratégia de WhatsApp | Provedor oficial x sem WhatsApp x add-on | Compliance | Sem WhatsApp no primeiro ciclo | FUTURO |
| Política de trial futuro | Sem trial; trial guiado; trial self-service | Aquisição x qualidade | Sem trial no primeiro ciclo | Após 3 fundadores |
| Estrutura de suporte | Só e-mail; e-mail + call; Slack Connect | Custo | E-mail + call para fundadores | 1º contrato |
| Meta de MRR | — | Direciona time | Definir após baseline | Após 3 fundadores |
| Comissão comercial interna | Fixo; % MRR; misto | Motivação x custo | Misto | Antes do outbound |
| Critérios jurídicos definitivos | Contrato padrão x adendos | Risco jurídico | Contrato padrão simples + adendo de LGPD | Antes do 1º contrato |

---

## 23. Roadmap imediato

1. **Fase 1 — Product Blueprint** (esta sprint).
2. **Fase 2 — Product Fit Audit** (Sprint 0.2): classificação completa de rotas/tabelas/RPCs/edge functions.
3. **Fase 3 — NOID Events Template**: organização fictícia + dados sintéticos + processo de clonagem.
4. **Fase 4 — Correções P0 do Revenue Core**: apenas o que Sprint 0.2 classificar como CORRIGIR + P0.
5. **Fase 5 — Segurança e isolamento multi-tenant**: execução em staging da suíte de isolamento; homologação de RLS/Storage.
6. **Fase 6 — Onboarding e implantação repetível**: playbook de implantação assistida.
7. **Fase 7 — Ambiente demonstrativo**: base do template ligada ao pitch comercial.
8. **Fase 8 — Primeiro cliente fundador**: 1 empresa em GO LIVE assistido.
9. **Fase 9 — Aprendizados dos três primeiros clientes**: baseline consolidado.
10. **Fase 10 — GO LIVE público**: encerramento do Programa Clientes Fundadores; primeira versão comercial disponível ao mercado.

---

## Apêndice A — Matriz preliminar de evidências do produto atual

Auditoria macro read-only realizada durante esta sprint. **Não é o Product Fit Audit.** Nenhuma afirmação abaixo trata funcionalidade como pronta apenas por existir tela, rota, componente ou nome no código. Documentação de segurança é tratada como **evidência documental**, não como comprovação de proteção ativa.

Legenda de nível de confiança: **Alto** = múltiplas fontes convergentes (código funcional + rota + hook + uso corrente); **Médio** = uma fonte convergente + coerência estrutural; **Baixo** = apenas menção estrutural.

| Domínio / Capacidade | Evidência localizada | Tipo | Status preliminar | Confiança | Observação | Aprofundar em 0.2 |
|---|---|---|---|---|---|---|
| Roteamento e app shell | `src/App.tsx` com rotas `/app/*`, `/app/settings/*`, `/admin/*` e rotas públicas `/p/:token`, `/f/:token`, `/agendar-demo`, `/docs` | Código funcional | EXISTENTE | Alto | ~180+ rotas mapeadas; muitas são settings ou intelligence interna | Sim |
| Autenticação | `src/pages/Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `AcceptInvitation.tsx`, `AuthStatus.tsx` | Código funcional | EXISTENTE | Alto | Fluxos padrão presentes | Homologar em 0.2 |
| Onboarding | `src/pages/Onboarding.tsx` | Código funcional | NECESSITA AUDITORIA | Médio | Completude do fluxo para fundadores a validar | Sim |
| Organizações / memberships / permissões | `src/components/SettingsGate.tsx`, `usePermissions`, `useEntitlements`, `FeatureGate` | Código funcional | EXISTENTE | Alto | Hierarquia full/partial/basic; gate por feature | Homologar cobertura por rota em 0.2 |
| Equipes e usuários | `/app/settings/teams`, `/teams-users` (`TeamsAndUsers.tsx`), `/users`, `EditUser` | Rota + página | EXISTENTE | Médio | Interface presente; profundidade de validação NECESSITA AUDITORIA | Sim |
| Pipelines | `/app/settings/pipelines` (`PipelineSettings.tsx`) | Rota + página | EXISTENTE | Médio | Configurável; aderência ao pipeline vertical proposto (Seções 6.1/6.2) NECESSITA AUDITORIA | Sim |
| Leads / Contas / Contatos | `/app/leads`, `/app/accounts`, `/app/contacts`, `AccountEditor`, `AccountDetail`, `AccountSidebar` | Código funcional | EXISTENTE | Alto | Estruturas centrais presentes | Vertical em 0.2 |
| Oportunidades / Atividades | `/app/opportunities`, `/app/opportunities/:id`, `/app/activities` | Código funcional | EXISTENTE | Alto | Núcleo do CRM | Campos verticais em 0.2 |
| Propostas | `Proposals.tsx`, `ProposalEditor.tsx`, `ProposalPublicView.tsx`, `services/proposals/*`, `lib/proposals/pricingLedger.ts` | Código funcional | EXISTENTE | Alto | Correção recente reconciliou header/banner/pagamento com pricing ledger | Homologar em 0.2 |
| Produtos | `Products.tsx`, `ProductEditorPage.tsx`, `/app/settings/product-*` | Código funcional | EXISTENTE | Alto | Editor de composição vertical presente | Sim |
| Qualificação | `/app/settings/qualification` (`QualificationFrameworkPage.tsx`), `src/lib/qualification/` (score + recommendation + disqualify reasons + tests) | Código funcional + testes | EXISTENTE | Alto | Framework configurável; aderência ao checklist vertical (Seção 8.1) NECESSITA AUDITORIA | Sim |
| Handoff | Não localizado como módulo isolado | — | NÃO LOCALIZADO | Baixo | Handoff parece implícito no fluxo de etapas; formalização vertical PROPOSTA | Sim |
| Forecast | `/app/forecast` (`Forecast.tsx`), tipos em `src/types/forecast-*.ts` | Rota + tipos | EXISTENTE | Alto | Fonte de receita realizada unificada (SSoT `commercial_won_revenue_view`) | Homologar em 0.2 |
| Revenue Command | `/app/revenue-command` (`RevenueCommandPage.tsx`), `hooks/revenue-command/useRevenueTodayCommand.ts` | Código funcional | EXISTENTE | Alto | SSoT alinhada com Forecast em correção recente | — |
| Win/Loss | `/app/intelligence/winloss` (`WinLossHub`), `services/winloss/lossSemantic.ts` | Código funcional | EXISTENTE | Médio | Motor semântico presente; efetividade vertical NECESSITA AUDITORIA | Sim |
| Dashboards por função (Closer) | `hooks/dashboard/useCloserDashboardData.ts`, `components/dashboard/closer/CloserDashboard.tsx` | Código funcional | EXISTENTE | Alto | Modo preview/runtime; completude vertical NECESSITA AUDITORIA | Sim |
| Dashboards por função (SDR / Gestor / GTM) | `/app/gtm/sdr`, `/ae`, `/cs`, `/revops`, `/manager`, `/ceo` | Rotas | NECESSITA AUDITORIA | Médio | Rotas presentes; efetividade e público-alvo a validar | Sim |
| Relatórios | `/app/reports`, `/app/reports/ote`, `/app/settings/relatorios`, `/reports-v2-flags`, `/reports-health` | Rotas | NECESSITA AUDITORIA | Médio | Múltiplos endpoints de relatório; SSoT parcial | Sim |
| Importação / Exportação | `/app/settings/dados`, `/exportacoes`, `NoidInventoryBackupPage`, `MigrationAuditPage` | Rotas | NECESSITA AUDITORIA | Médio | Existem interfaces; robustez para onboarding NECESSITA AUDITORIA | Sim |
| Automação e sequências | `/app/automation` (`AutomationAndSequences.tsx`), edge functions `auto-*`, `advance-email-cadence-progress` | Código funcional + edge functions | EXISTENTE | Médio | Existe; aderência ao conjunto vertical (Seção 9) NECESSITA AUDITORIA | Sim |
| Billing | `/app/settings/billing/*`, edge functions `abacatepay-checkout`, `abacatepay-webhook` | Código funcional | EXISTENTE | Médio | Núcleo presente; homologação de bloqueio por inadimplência NECESSITA AUDITORIA | Sim |
| Trial e bloqueio | Sem rota de trial-block localizada como página isolada | — | NECESSITA AUDITORIA | Baixo | Menções em memória; auditar em 0.2 | Sim |
| Administração HUMANOID | `/admin/*` (organizations, users, forensic, revenue, analytics, logs, audit, trash, backup, ai, infrastructure, settings, control-room, trace, plans, revenue-integrity) | Rotas | EXISTENTE (interno) | Alto | Área administrativa apartada do produto do cliente | Isolamento em 0.2 |
| Módulos de IA | `/app/settings/noid-intelligence/*`, `ai-*` edge functions | Rotas + edge functions | EXISTENTE (uso interno) | Alto | Volume alto de edge functions `ai-*`; nem tudo homologado para cliente externo | Classificar item a item em 0.2 |
| Agent Builder | `AgentBuilderPage`, `AgentsList`, `CreateAgent`, `AgentDetail`, `AgentSimulatorPage`, `AgentOutcomesPage` | Código funcional | EXISTENTE (interno) | Alto | Não vendável no primeiro ciclo | Ocultação em 0.2 |
| Kairós | `/app/intelligence/kairos` (`KairosHub.tsx`), `services/intelligence/{autopilot,qualifiedQueue,revenueAttribution,sdrCopilot,coverage}.ts`, edge functions `kairos-*` | Código funcional + serviços + edge functions | EXISTENTE (interno LEGAL) | Alto | Ferramenta interna necessária à operação da LEGAL; permitida no freeze para correções | Ocultação para cliente externo em 0.2 |
| Apollo | `services/enrichment/apolloService.ts`, `services/enrichment/apolloPreview.ts`, `services/intelligence/apollo{EndpointMatrix,BrowserParity,Invisible}.ts`, `/app/intelligence/apollo-roi` (`ApolloRoi.tsx`), edge functions `apollo-*` | Código funcional + serviços + edge functions | EXISTENTE (interno LEGAL) | Alto | Não homologado externamente | Ocultação em 0.2 |
| OTE | `/app/reports/ote` (`OTEReport.tsx`), `/app/objetivos/desempenho` (`DesempenhoPage.tsx`), `src/lib/ote/` | Código funcional + testes | EXISTENTE | Médio | Configuração complexa; ocultar do primeiro ciclo externo | Ocultação em 0.2 |
| Roleplay | `/app/roleplay/*` (7 rotas, incluindo admin) | Rotas | EXISTENTE (experimental) | Médio | Não vendável no primeiro ciclo | Ocultação em 0.2 |
| Inventário Eventrix (integração) | `/app/settings/eventrix-inventory` (`EventrixInventorySettings.tsx`), `/app/settings/noid-inventory-backup` (`NoidInventoryBackupPage.tsx`), schemas `eventrixInventorySettings.ts`, `productInventoryRequirement.ts`, `proposalInventoryDemandSnapshot.ts` | Código funcional | EXISTENTE (integração beta) | Alto | Estrutura Config → Categorias/Famílias → Requisitos de Produto → Snapshot na proposta presente; ativação real com Eventrix NECESSITA AUDITORIA | Ocultação até homologação |
| Documentação | `/docs/*` público e `/app/docs/*` interno | Rotas | EXISTENTE | Médio | Conteúdo NECESSITA AUDITORIA | Sim |
| Termos / Privacidade | `/terms`, `/privacy` | Rotas | EXISTENTE | Alto | Homologar textos com jurídico | Antes do outbound |
| Suporte | `/app/support`, `/app/support/tickets/:ticketId` | Rotas | EXISTENTE | Médio | Fluxo interno; homologar SLA | Sim |
| Monitoramento | `/admin/control-room`, `/admin/trace/:traceId`, `/admin/logs` | Rotas | EXISTENTE (interno) | Médio | Uso operacional | — |
| Segurança / Isolamento | `docs/security/phase1-rls-audit.md`, `phase2-tenant-isolation.md`, `storage-classification.csv`, `.github/workflows/tenant-isolation.yml`, `supabase/migrations-staged/storage/*` | **Evidência documental** e workflow | NECESSITA AUDITORIA | Médio | Documentos + workflow existem; **efetividade em produção precisa ser comprovada** por execução da suíte contra staging | Sim (bloqueia GO LIVE público) |
| Backup e restauração | `NoidInventoryBackupPage` (export read-only) + `docs/security/*` | Rota + documento | NECESSITA AUDITORIA | Baixo | Existe export de inventário; backup/restore completo do tenant NECESSITA AUDITORIA | Sim |
| Notificações | `NotificationsHistory.tsx`, `/app/notifications`, edge functions de push, `sw-push.js` | Código funcional | EXISTENTE | Médio | Cobertura vertical NECESSITA AUDITORIA | Sim |
| Migrations | `supabase/migrations/` (~688 arquivos) | Estrutural | NECESSITA AUDITORIA | Médio | Contagem é referencial; aplicabilidade em produção **não** é confirmada por presença de arquivo | Introspecção read-only em 0.2 |
| Edge functions | `supabase/functions/` (~272 diretórios) | Estrutural | NECESSITA AUDITORIA | Médio | Contagem é referencial; nem toda função em uso | Classificar em 0.2 |
| Schema atual (tabelas) | `database/dumps/00_table_list.sql` (**snapshot; pode estar desatualizado**) | Dump | NECESSITA AUDITORIA | Baixo | Não usar como fonte de verdade; introspecção via read-only em 0.2 | Sim |

---

## Notas finais

- Nenhum arquivo funcional foi alterado nesta sprint.
- Nenhuma migration foi criada; nenhuma tabela foi alterada; nenhuma RLS/RPC/Edge Function/secret/dado foi tocada.
- Nenhum tenant, template, seed ou dado sintético foi inserido.
- O único artefato produzido é este documento em `docs/product/noid-revenueos-for-events-product-blueprint-v1.md`.
- Documentos de segurança em `docs/security/*` foram tratados como evidência documental e **não** como comprovação de que a proteção está ativa em produção.
- As memórias arquiteturais foram usadas apenas como contexto durante a análise e **não são citadas** como evidência técnica neste blueprint.
- A validação final da existência real de cada capacidade é objeto da **Sprint NOID-VERTICAL 0.2 — Product Fit Audit**.
