
# Plano: Reabrir Proposta PROP-2026-00352 para Aprovação do Cliente

## Diagnóstico Completo

A proposta **PROP-2026-00352** da organização **OPERADORA LEGAL** para cliente **VIRTUX TECH LTDA** está com os seguintes problemas:

| Campo | Valor Atual | Problema |
|-------|-------------|----------|
| `status` | `rejected` | Bloqueia botões de aceite |
| `declined_at` | 15/01/2026 13:54 | Mostra banner "Proposta Recusada" |
| `declined_reason` | "Cliente não entendeu..." | Exibe motivo da recusa |
| `expires_at` | 22/01/2026 | **Expirada** (hoje é 26/01) |

O cliente não consegue aprovar porque:
1. O sistema detecta `status = 'rejected'` e define `canRespond = false`
2. Isso oculta os botões "Aprovar" e "Recusar" na visualização pública
3. Além disso, a proposta está tecnicamente expirada

---

## Solução Proposta

### Atualização de Dados (via SQL)

Executar UPDATE na tabela `proposals` para:

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Alterar status: 'rejected' → 'sent'                     │
│  2. Limpar declined_at: NULL                                │
│  3. Limpar declined_reason: NULL                            │
│  4. Estender validade: expires_at → 30 dias a partir de hoje│
└─────────────────────────────────────────────────────────────┘
```

### SQL a Executar

```text
UPDATE proposals 
SET 
  status = 'sent',
  declined_at = NULL,
  declined_reason = NULL,
  expires_at = '2026-02-25T12:00:00Z'  -- 30 dias de validade
WHERE id = '3094a2d9-d39a-4602-a09b-e1b749befa24';
```

### Link Público para o Cliente

Após a correção, o cliente poderá acessar:

```text
https://noidcrm.humanoid-os.ai/p/fdfe10fbec65b0960fcd716c98d749afad85df26ae63d2f8fee1a8e037fd53f5
```

---

## Resultado Esperado

Após a execução:

| Antes | Depois |
|-------|--------|
| Banner "Proposta Recusada" | Sem banner de recusa |
| Botões ocultos | Botões "Aprovar" e "Recusar" visíveis |
| Validade expirada (22/01) | Válida até 25/02/2026 |

O cliente poderá então preencher os dados de aceite (nome, documento, assinatura) e aprovar a proposta normalmente.

---

## Observação Importante

Esta é uma operação de **dados**, não de código. O sistema já suporta propostas no status `sent` serem aprovadas pelo cliente. A proposta foi incorretamente marcada como recusada antes do cliente ter a chance de responder.

Após aprovação deste plano, executarei o UPDATE diretamente no banco de dados para reabrir a proposta.
