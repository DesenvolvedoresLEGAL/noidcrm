## Problema identificado

O cadastro de Roteador está sendo tratado como se pudesse cair no perfil de Chip/SIM durante a validação visual do formulário. Na prática, isso gera o erro “Dados do chip: ICCID obrigatório” mesmo quando a intenção do usuário é cadastrar apenas um roteador.

A regra de negócio correta é:

```text
Cadastro de item no estoque:
- Roteador é cadastrado sozinho.
- Chip é cadastrado sozinho.
- Não existe associação roteador + chip no cadastro inicial.

Após venda/proposta aprovada:
- Separar roteador do estoque.
- Separar chip(s) do estoque.
- Associar operacionalmente roteador + até 3 chips: principal + backups.
```

## Plano de correção

1. **Separar definitivamente os perfis no formulário de item serializado**
   - Garantir que uma categoria `Roteador` renderize e valide somente os campos de fábrica do roteador.
   - Garantir que `sim_card_factory` seja ignorado/removido do payload quando o perfil atual for `router`.
   - Garantir que `router_factory` seja ignorado/removido do payload quando o perfil atual for `sim_card`.
   - Evitar que campos invisíveis de Chip bloqueiem o botão `Criar` no cadastro de Roteador.

2. **Corrigir o feedback de erro que está confundindo a operação**
   - Ajustar o utilitário de erro para apontar para o campo real: `SSID`, `Senha Wi-Fi`, `IMEI`, `ICCID`, etc.
   - Adicionar IDs nos inputs específicos de Roteador/Chip para o scroll/focus funcionar corretamente dentro do modal.
   - O toast deve mostrar erro de Chip apenas quando o usuário estiver cadastrando um Chip.

3. **Blindar a seleção de categoria**
   - Ao selecionar uma categoria, sincronizar `equipment_profile` a partir da categoria selecionada de forma estável.
   - Quando trocar de categoria, limpar o bloco que não pertence ao novo perfil para não carregar lixo invisível de validação.

4. **Manter a associação roteador + chip fora do cadastro de item**
   - Não criar associação no item de inventário.
   - Não mover regra de associação para o cadastro de roteador.
   - Preservar a customização operacional na alocação/reserva, que é o lugar certo para ocorrer depois da venda.

5. **Verificação objetiva**
   - Testar schema localmente para confirmar:
     - Roteador completo cria sem exigir ICCID.
     - Chip completo cria sem exigir IMEI/SSID.
     - Roteador incompleto mostra erro de roteador, não de chip.
   - Revisar o payload enviado por `createSerializedItem` para confirmar que roteador salva apenas `metadata.router` e não `metadata.sim_card`.

## Arquivos impactados

- `src/components/operations/inventory/InventoryItemFormDialog.tsx`
- `src/components/operations/inventory/EquipmentProfileFactoryFields.tsx`
- `src/lib/operations/formErrorFeedback.ts`
- `src/lib/operations/inventoryEquipmentProfile.test.ts`

## Fora do escopo

- Não alterar fluxo de proposta aprovada.
- Não criar associação roteador + chip agora.
- Não alterar RLS.
- Não alterar estrutura de tabelas.
- Não mexer em UX premium/design system.