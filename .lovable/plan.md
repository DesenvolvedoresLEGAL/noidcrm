## Diagnóstico

- A proposta aceita da Canon (`053419df...`) gerou job de aceite e notificações, mas não gerou inventário.
- O fluxo atual `post-acceptance-effects` só processa comemoração/notificações/Slack; não existe etapa de inventário nele.
- Já existe um gerador manual de pré-reserva (`generatePreReservationFromProposal`), mas ele depende de alguém abrir a proposta e informar datas.
- No caso Canon, `proposals.event_start_date` e `opportunities.event_start_date` estão vazios, e os produtos da proposta (`LEGAL™ XGo Pro`, `Fast Delivery`) estão com `inventory_control_mode = none`; mesmo com automação, hoje eles não reservariam nada sem configuração de estoque.
- O calendário atual renderiza uma grade horizontal por dia/item, por isso “estica” e fica ruim para uso operacional.

## Plano de implementação

### 1. Criar uma etapa automática de inventário no pós-aceite
- Estender o job de aceite com campos próprios de inventário: processado em, status, erro, pré-reserva criada, reserva criada.
- No `post-acceptance-effects`, adicionar uma etapa idempotente de inventário:
  - Se a proposta aceita já tiver pré-reserva/reserva, não duplicar.
  - Se não tiver, gerar pré-reserva automaticamente a partir dos itens da proposta.
  - Usar a regra atual de ponto-dia/BOM: quantidade física = pontos, não pontos × diárias; componentes = pontos × quantidade por ponto.
  - Se o produto não tiver controle de inventário, registrar aviso claro no job/log para operação saber que nada foi reservado por configuração ausente.

### 2. Resolver datas de evento de forma segura
- Usar `proposals.event_start_date` como primeira fonte.
- Se vazio, usar `proposal_dynamic_pricing_rules.event_start_date` quando existir.
- Se ainda vazio, usar `opportunities.event_start_date`.
- Para fim do evento, adicionar suporte persistente a `event_end_date` em propostas/oportunidades ou, se ausente, usar `billing_days` dos itens ponto-dia para calcular o fim.
- Se nenhuma data puder ser resolvida, não criar reserva “falsa”; criar alerta/notificação operacional pedindo data do evento.

### 3. Pré-reserva quando a proposta está “na mesa”
- Adicionar automação também para proposta enviada/ativa com data de evento:
  - Ao enviar proposta, criar pré-reserva automaticamente para segurar capacidade.
  - Ao aceitar, reaproveitar a pré-reserva existente em vez de criar outra.
  - Ao editar itens/datas de uma proposta enviada ainda não aceita, recalcular/recriar a pré-reserva vinculada com segurança, sem afetar reservas definitivas.

### 4. Fluxo de aceite e confirmação operacional
- No aceite do cliente:
  - Garantir pré-reserva automaticamente.
  - Notificar perfis operacionais/Admin/Owner com link para a pré-reserva.
  - Se todos os itens já estiverem alocados e sem conflito, converter automaticamente para reserva definitiva com `confirmation_trigger = proposal_approved`.
  - Se houver demanda por categoria/família ainda não alocada, manter como pré-reserva ativa e destacar “pendente de alocação/confirmação”.
- Manter a conversão manual existente para o time operacional confirmar depois de alocar itens físicos.

### 5. Ajustar produtos LEGAL que devem reservar estoque
- Criar uma rotina/validação para apontar produtos vendidos com estoque sem configuração (`inventory_control_mode = none`).
- Para a Canon, deixar claro que `LEGAL™ XGo Pro` não reservou porque ainda está sem vínculo de inventário.
- Preparar UI/alerta para configurar rapidamente o controle de estoque/BOM dos produtos relevantes.

### 6. Melhorar a tela de pré-reservas
- Exibir origem “Proposta aceita/enviada” com cliente, proposta, evento, operação e itens/componentes.
- Adicionar filtros rápidos: próximas operações, pendentes de alocação, conflitos, sem data, sem configuração de inventário.
- Mostrar ação clara: “Alocar itens” e “Confirmar reserva”.

### 7. Redesenhar o calendário de inventário
- Trocar a grade horizontal gigante por uma visão mensal real.
- Mostrar cards/barras por dia ou por período, com:
  - Pré-reservas
  - Reservas confirmadas
  - Preparação/despacho/operação/retorno
  - Cliente/proposta/código
  - Risco/conflito
- Manter alternativas tabulares compactas:
  - Por reserva
  - Por categoria/família
  - Por item físico apenas quando necessário
- Limitar a visão padrão ao mês selecionado, com navegação mês anterior/próximo.

### 8. Validação/backfill
- Criar uma rotina segura para reprocessar propostas aceitas recentes sem inventário.
- Aplicar no caso Canon/Hospitalar depois que as datas e produtos estiverem configurados.
- Validar no banco e na UI:
  - Pré-reserva criada
  - Itens/componentes criados
  - Quantidade ponto-dia correta
  - Calendário mensal mostrando a ocupação entre 19/05 e 22/05
  - Notificação operacional criada

## Arquivos impactados

- `supabase/functions/post-acceptance-effects/index.ts`
- Nova/ajustada lógica server-side para gerar pré-reservas por proposta
- Migração para campos de job de inventário e possível `event_end_date`
- `src/services/operations/inventoryProposalBridge.ts`
- `src/components/operations/inventory/InventoryPreReservationsTab.tsx`
- `src/components/operations/inventory/InventoryOccupancyCalendarPage.tsx`
- Serviços/hooks de inventário já existentes para invalidação e listagem
- Possível ajuste em editor de proposta para capturar início/fim do evento de forma explícita

## Riscos e controles

- Não vou criar reserva sem data válida; isso vira alerta operacional.
- Não vou duplicar reserva: tudo será idempotente por `proposal_id`.
- Reserva definitiva automática só se a alocação já estiver completa e sem conflito.
- RLS/multitenancy serão preservados; automação server-side validará `organization_id`.
- Produtos antigos sem controle de estoque continuam funcionando comercialmente, apenas não bloqueiam inventário até serem configurados.