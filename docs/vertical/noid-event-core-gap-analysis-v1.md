# Event Core — Gap Analysis v1

**Sprint:** `NOID-VERTICAL-1.0-VERT-01.1`
**Data:** 2026-07-22

## 1. Contexto

A arquitetura-alvo prevê um **EVENT_CORE** — camada dedicada às entidades comuns a todo o setor de eventos (event, edition, venue, organizer, exhibitor, agency, participants, roles, datas de montagem/realização/desmontagem). O NOID nasceu do caso LEGAL sem uma modelagem formal desse core; muitas necessidades foram acomodadas em custom fields, roleplay archetypes ou em campos livres de `opportunities`.

## 2. Método

Busca estática por padrões:
- Tabelas `information_schema`: nenhuma `events`, `event_editions`, `venues`, `organizers`, `exhibitors`, `agencies`, `sponsors`, `suppliers`, `event_participants`, `event_roles` no schema `public` (baseline confirmado no dump 00 e no Product Fit Audit v1.1).
- Vocabulário no código: `Organizador`, `Expositor`, `Agência`, `Empresa Contratante` aparecem apenas em `src/services/roleplay/archetypes.ts:6` e `src/schemas/roleplay.ts:17`.
- Enum `Expositor` em `src/integrations/supabase/types.ts` (lines 39699, 40100) — indica enum Postgres em uso mas nome do enum é genérico.
- Sourcing engine (Kairós/ExpoFP) trabalha com "expositores" mas persiste como `prospects` genéricos.

## 3. Inventário por entidade

| # | Entidade Event Core | Existe? | Onde | Maturidade | Recomendação |
|---|---|---|---|---|---|
| EC-01 | Event | **Não existe entidade dedicada** | Referenciado como custom field / campo livre em `opportunities` | 0 | Criar no NOID (Event Core), não Eventrix |
| EC-02 | Event Edition | Não existe | — | 0 | Criar no NOID |
| EC-03 | Venue | Não existe | Endereço embutido em `accounts` ou custom fields | 0 | Criar no NOID (`venues`) |
| EC-04 | Organizer | Papel implícito | Roleplay archetype `Organizador`; sem tabela dedicada | 1 | Papel de account (`account_role` = organizer) |
| EC-05 | Exhibitor | Papel implícito | Roleplay archetype `Expositor`; prospects sourced via Kairós | 1 | Papel de account (`account_role` = exhibitor) |
| EC-06 | Agency | Papel implícito | Roleplay archetype `Agência` | 1 | Papel de account |
| EC-07 | Sponsor | Não existe | — | 0 | Papel de account futuro |
| EC-08 | Supplier | Não existe | — | 0 | Papel de account futuro |
| EC-09 | Event Participant (M:N Account ↔ Event) | Não existe | — | 0 | Criar `event_participants` |
| EC-10 | Event Role | Não existe formalmente | Enum `Organizador/Expositor/Agência/Empresa Contratante` disperso | 1 | Extrair para lookup table `event_roles` |
| EC-11 | Mounting Date | Não existe formalmente | Custom field ou inferido em `inventory_reservations.starts_at` | 1 | Coluna dedicada em event/edition |
| EC-12 | Event Date | Não existe formalmente | Custom field | 1 | Coluna dedicada |
| EC-13 | Dismantling Date | Não existe formalmente | Custom field / inventory_reservations.ends_at | 1 | Coluna dedicada |
| EC-14 | Opportunity ↔ Event relationship | Não existe formalmente | `opportunities.close_date_prevista` como proxy | 0 | Criar FK `opportunities.event_edition_id` (nullable) |
| EC-15 | Multi-event contracts | Não existe | Contract vinculado a Account, não a Event | 0 | Criar tabela ponte `contract_event_editions` |
| EC-16 | Event Revenue | Derivável | Via `commercial_won_revenue_view` filtrado por custom field | 1 | View `event_revenue_view` após EC-01/EC-14 |
| EC-17 | Event History | Não existe | Timeline global em `timeline_events` | 1 | View filtrada por event |
| EC-18 | Event 360 view | Não existe | — | 0 | Página futura após EC-01..EC-14 |

## 4. Duplicidades / conceitos dispersos

- Vocabulário Event Core aparece em **roleplay** (archetypes), **sourcing/ICP** (Kairós), **inventory_reservations** (datas), **proposals** (inventory_demand). Nenhum ponto único de verdade.
- Kairós persiste "expositor" como `prospects` genérico (correto para pipeline) mas não como entidade Event.

## 5. Dependência do Eventrix

Eventrix hoje resolve parcialmente:
- Categorias/famílias de inventário (não Event Core).
- Alocação de equipamento por evento (via `inventory_reservations` referenciando Eventrix IDs).

Eventrix **não** entrega:
- Modelagem de Event / Edition / Venue como entidades primeiras.
- Papéis Event (organizer/exhibitor/agency).
- Multi-event contracts.

Conclusão: Event Core deve viver **dentro do NOID** (não delegado ao Eventrix). Eventrix permanece como `OPTIONAL_INTEGRATION` de inventário/operação.

## 6. Riscos

| ID | Risco | Severidade |
|---|---|---|
| EG-01 | Sem Event Core, ROI por evento e coorte por edição são impossíveis com dados estruturados | HIGH |
| EG-02 | Vocabulário disperso em enums/archetypes/custom fields gera drift entre módulos | MEDIUM |
| EG-03 | Multi-event contracts inviável sem tabela ponte | HIGH |
| EG-04 | Sourcing (Kairós/ExpoFP) já produz "expositores" sem persistir vínculo estruturado com Event | HIGH |

## 7. Recomendação de destino

Sprint dedicada `VERT-EVENT-CORE-01`:

1. Criar `events`, `event_editions`, `venues`, `event_roles`, `event_participants` (tenant-aware, RLS, grants).
2. Adicionar `opportunities.event_edition_id` nullable + índice.
3. Migrar archetypes de roleplay para `event_roles` (seed).
4. Migrar rotas Kairós para criar `event_participants` quando prospect for "exhibitor".
5. Não migrar Eventrix — permanece integração opcional para inventário.

Nada disso deve ser executado agora.
