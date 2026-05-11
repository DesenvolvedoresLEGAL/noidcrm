## Sprint INV — Perfil técnico de Roteador e Chip

### O que muda para o usuário

**Cadastro de Categoria**
- Novo campo "Perfil de equipamento" com 3 opções: *Genérico*, *Roteador*, *Chip*.
- O perfil é a flag oficial que liga os campos extras. Marcar a categoria "Roteadores" como perfil = Roteador faz com que todo item dessa categoria exija os dados de fábrica.

**Cadastro de Item**
- Quando a categoria selecionada tem perfil = Roteador, aparece um bloco "Dados de fábrica do roteador" com:
  - SSID de fábrica (obrigatório)
  - Senha Wi-Fi de fábrica (obrigatório)
  - Usuário admin (obrigatório)
  - Senha admin (obrigatório)
  - IMEI (obrigatório)
- Quando a categoria tem perfil = Chip, aparece "Dados do chip" com:
  - ICCID (obrigatório)
  - Número da linha (obrigatório)
  - Operadora (obrigatório, select: Vivo, Claro, TIM, Algar, Outra)
  - APN (obrigatório)
  - PIN (opcional)
- Validação Zod condicional: se o perfil for Roteador/Chip e os campos estiverem vazios, o submit é bloqueado com mensagens em pt-BR. Se for Genérico, esses campos não aparecem.
- O bloco existente de "Especificações Técnicas" continua disponível para dados livres adicionais.

**Alocação à venda (reserva operacional)**
- Na lista de itens alocados (`InventoryAllocatedItemsList`), cada linha de roteador ganha um botão "Configurar rede".
- Abre um diálogo "Configuração personalizada" com:
  - SSID personalizado (obrigatório)
  - Senha Wi-Fi personalizada (obrigatório, mínimo 8 caracteres)
  - Observação operacional (opcional)
- Os campos ficam salvos por alocação — o mesmo roteador físico pode ter SSID/senha diferentes em vendas diferentes.
- Para chips alocados aparece botão "Configurar chip" com APN específico da operação e observações.
- Na tela de preparação operacional, o item de roteador só pode avançar para "Despachado" se já tiver configuração personalizada salva.

### Como vai funcionar tecnicamente

**Banco**
- Migration adiciona à `public.inventory_categories`:
  - `equipment_profile text not null default 'generic'` com check `in ('generic','router','sim_card')`.
- Os dados técnicos do item ficam em `inventory_items.metadata` sob chaves estruturadas:
  - `metadata.router = { ssid_factory, wifi_password_factory, admin_user, admin_password, imei }`
  - `metadata.sim_card = { iccid, line_number, carrier, apn, pin }`
- Migration adiciona à `public.inventory_reservation_allocations`:
  - `custom_config jsonb not null default '{}'::jsonb`
  - Comentário documentando shape `{ router: { ssid_custom, wifi_password_custom, notes }, sim_card: { apn_operational, notes } }`.
- Trigger `validate_router_allocation_dispatch`: bloqueia transição de `operational_status` para `dispatched` se item for roteador/chip e `custom_config` estiver vazio.
- RLS: tabelas já têm policies por organization; nada novo é necessário.

**Frontend**
- `src/lib/operations/inventoryEquipmentProfile.ts` (novo): tipo `EquipmentProfile`, labels, schemas Zod (`routerFactorySchema`, `simCardFactorySchema`, `routerCustomSchema`, `simCardCustomSchema`), helpers `getRouterFactory(metadata)`, `getSimCardFactory(metadata)`, `getRouterCustom(allocation)`, `getSimCardCustom(allocation)`.
- `InventoryCategoryFormDialog.tsx`: select "Perfil de equipamento".
- `InventoryClassificationFields.tsx`: ao escolher categoria, expor o `equipment_profile` da categoria via callback, para o pai saber qual bloco renderizar.
- `InventoryItemFormDialog.tsx`:
  - Novo componente `RouterFactoryFields` (renderizado se categoria.profile === 'router').
  - Novo componente `SimCardFactoryFields` (renderizado se profile === 'sim_card').
  - Schema Zod refatorado com `superRefine` que exige campos quando perfil != generic.
  - Persistência em `metadata.router`/`metadata.sim_card` preservando `metadata.technical_specs` existente.
- `InventoryAllocationDialog.tsx` / `InventoryAllocatedItemsList.tsx`: novo componente `AllocationCustomConfigDialog` que carrega categoria.profile do item alocado e renderiza form custom apropriado, salvando em `inventory_reservation_allocations.custom_config`.
- `src/services/operations/inventoryAllocations.ts`: adicionar `updateAllocationCustomConfig(allocationId, custom)`.
- Indicador visual: badge "Config pendente" (variant=destructive) na linha de alocação roteador/chip sem `custom_config`.
- Estados: loading no submit, error toast com `mapDuplicateError`, empty state quando categoria não tem perfil definido.

### Riscos
- Itens de roteador já cadastrados ficarão sem dados de fábrica. Mitigação: a obrigatoriedade vale só para *novos* salvamentos quando o perfil estiver ativo; itens existentes podem ser editados normalmente, mas o submit exige preencher os campos antes de salvar de novo (mensagem clara orientando).
- Senha admin do roteador armazenada em `metadata` (jsonb) sem criptografia adicional. Acesso já é protegido por RLS de organização. Se exigir cofre dedicado, fica para sprint futura.
- Trigger de bloqueio no dispatch pode surpreender operação. Mitigação: mensagem do trigger em pt-BR ("Configure SSID e senha personalizados antes de despachar este roteador").

### Fora de escopo
- Criptografia/cofre dedicado para senhas.
- Geração automática de SSID/senha aleatória.
- Histórico de alterações de configuração personalizada.
- Versionamento de firmware do roteador.
- Sincronia com ERP de inventário.

### Critérios de aceite
- Categoria pode ser marcada como Roteador ou Chip.
- Cadastro/edição de item exibe e exige campos conforme perfil; submit bloqueado se faltar dado obrigatório.
- Alocação roteador permite salvar SSID/senha personalizada; alocação chip permite APN operacional.
- Mesmo roteador em vendas distintas mantém configurações independentes.
- Trigger impede dispatch de roteador/chip sem configuração personalizada.
- RLS por organização preservada em todas as tabelas afetadas.
- Typecheck e build passam.
