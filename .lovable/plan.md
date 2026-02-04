
## Plano: Edge Function para Exportação Forense - jessica@operadora.legal

### Objetivo
Criar uma Edge Function `export-forensic-user-logs` que gera um arquivo Excel (.xlsx) com todos os 535+ registros do usuário `jessica@operadora.legal` referentes a janeiro/2026, organizado hora a hora para fins de processo judicial.

---

### 1. Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    export-forensic-user-logs                            │
├─────────────────────────────────────────────────────────────────────────┤
│  INPUT:                                                                 │
│  - user_email: "jessica@operadora.legal"                                │
│  - date_start: "2026-01-01"                                             │
│  - date_end: "2026-01-31"                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  PROCESS:                                                               │
│  1. Validar autenticação (Platform Admin only)                          │
│  2. Buscar user_id via profiles.email                                   │
│  3. Query paralelas:                                                    │
│     - audit_log (actor_user_id)                                         │
│     - auth_audit_log (user_id)                                          │
│     - system_events (actor_id)                                          │
│     - activities (owner_user_id)                                        │
│     - opportunities (created_by/owner_user_id)                          │
│  4. Unificar e ordenar por timestamp                                    │
│  5. Gerar Excel com múltiplas abas                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  OUTPUT:                                                                │
│  - Excel .xlsx (base64) com 5 abas detalhadas                           │
│  - Metadados do relatório                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Estrutura do Excel Gerado

O arquivo Excel terá 6 abas:

| Aba | Descrição | Colunas |
|-----|-----------|---------|
| **RESUMO** | Metadados do relatório | Usuário, Período, Total de Registros, Gerado em |
| **AUDIT_LOG** | Ações no sistema CRM | Data/Hora, Ação, Entidade, ID Entidade, Campo, Valor Anterior, Valor Novo, Metadados |
| **AUTH_LOG** | Logins e autenticação | Data/Hora, Tipo Evento, Sucesso, IP, Cidade, País, ISP, VPN/Proxy, User Agent, Navegador |
| **SYSTEM_EVENTS** | Eventos do sistema | Data/Hora, Categoria, Tipo Evento, Ação, Entidade, Payload |
| **ACTIVITIES** | Atividades registradas | Data/Hora, Tipo, Título, Status, Descrição, Oportunidade ID, Duração |
| **OPPORTUNITIES** | Oportunidades criadas/gerenciadas | Data/Hora, Título, Valor, Status, Pipeline, Estágio, Temperatura |

---

### 3. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/export-forensic-user-logs/index.ts` | CRIAR | Edge Function principal |
| `supabase/config.toml` | ATUALIZAR | Adicionar `[functions.export-forensic-user-logs] verify_jwt = false` |

---

### 4. Detalhes Técnicos da Edge Function

#### 4.1 Dependências (via esm.sh para Deno)
```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
```

#### 4.2 Segurança
- Verifica que o chamador é Platform Admin via `is_platform_admin_for_rls()`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS
- Valida parâmetros de entrada

#### 4.3 Queries de Dados
```sql
-- audit_log (281 registros esperados)
SELECT * FROM audit_log 
WHERE actor_user_id = $user_id 
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at;

-- auth_audit_log (14 registros esperados)
SELECT * FROM auth_audit_log 
WHERE user_id = $user_id 
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at;

-- system_events (120 registros esperados)
SELECT * FROM system_events 
WHERE actor_id = $user_id 
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at;

-- activities (92 registros esperados)
SELECT * FROM activities 
WHERE owner_user_id = $user_id 
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at;

-- opportunities (28 registros esperados)
SELECT * FROM opportunities 
WHERE (owner_user_id = $user_id OR created_by = $user_id)
  AND created_at BETWEEN '2026-01-01' AND '2026-02-01'
ORDER BY created_at;
```

#### 4.4 Geração do Excel em Deno
```typescript
// Criar workbook com múltiplas abas
const wb = XLSX.utils.book_new();

// Aba RESUMO
const resumoData = [
  { "Campo": "Usuário", "Valor": "jessica@operadora.legal" },
  { "Campo": "Período", "Valor": "01/01/2026 a 31/01/2026" },
  { "Campo": "Total Registros", "Valor": totalRecords },
  { "Campo": "Gerado em", "Valor": new Date().toISOString() },
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), "RESUMO");

// ... demais abas

// Converter para buffer (Deno-compatible)
const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

// Retornar como base64 para download via frontend
const base64 = btoa(String.fromCharCode(...new Uint8Array(excelBuffer)));
```

#### 4.5 Response
```typescript
return new Response(
  JSON.stringify({
    success: true,
    filename: `forensic_jessica_operadora_legal_jan2026.xlsx`,
    data: base64,
    metadata: {
      user_email: "jessica@operadora.legal",
      period: "2026-01-01 to 2026-01-31",
      counts: {
        audit_log: 281,
        auth_audit_log: 14,
        system_events: 120,
        activities: 92,
        opportunities: 28,
        total: 535
      }
    }
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

### 5. Colunas Detalhadas por Aba

#### 5.1 Aba AUDIT_LOG
| Coluna | Fonte | Formato |
|--------|-------|---------|
| Data/Hora | created_at | dd/MM/yyyy HH:mm:ss |
| Ação | action | texto |
| Tipo Entidade | entity_type | texto |
| ID Entidade | entity_id | UUID |
| Campo Alterado | field_name | texto |
| Valor Anterior | old_value | JSON stringified |
| Valor Novo | new_value | JSON stringified |
| Trace ID | trace_id | UUID |
| Metadados | metadata | JSON stringified |

#### 5.2 Aba AUTH_LOG
| Coluna | Fonte | Formato |
|--------|-------|---------|
| Data/Hora | created_at | dd/MM/yyyy HH:mm:ss |
| Tipo Evento | event_type | login/logout/failed |
| Sucesso | success | Sim/Não |
| Endereço IP | ip_address | texto |
| Cidade | city | texto |
| Região | region | texto |
| País | country_name | texto |
| ISP | isp | texto |
| VPN | is_vpn | Sim/Não |
| Proxy | is_proxy | Sim/Não |
| User Agent | user_agent | texto |
| Tipo Dispositivo | device_type | texto |
| Resolução Tela | screen_resolution | texto |
| Timezone | timezone | texto |
| Idioma | language | texto |
| URL Acessada | page_url | texto |

#### 5.3 Aba SYSTEM_EVENTS
| Coluna | Fonte | Formato |
|--------|-------|---------|
| Data/Hora | created_at | dd/MM/yyyy HH:mm:ss |
| Trace ID | trace_id | UUID |
| Categoria | event_category | texto |
| Tipo Evento | event_type | texto |
| Ação | action | texto |
| Tipo Entidade | entity_type | texto |
| ID Entidade | entity_id | UUID |
| Payload | payload | JSON stringified |

#### 5.4 Aba ACTIVITIES
| Coluna | Fonte | Formato |
|--------|-------|---------|
| Data/Hora | created_at | dd/MM/yyyy HH:mm:ss |
| Tipo | type | call/meeting/email/task |
| Título | title | texto |
| Status | status | pending/completed/cancelled |
| Descrição | description | texto |
| Agendado Para | scheduled_date | dd/MM/yyyy HH:mm |
| Concluído Em | completed_at | dd/MM/yyyy HH:mm |
| Duração (min) | duration_minutes | número |
| Oportunidade ID | opportunity_id | UUID |
| Conta ID | account_id | UUID |
| Automático | is_automated | Sim/Não |
| Gerado por IA | ai_generated | Sim/Não |
| Sentimento | sentiment | texto |

#### 5.5 Aba OPPORTUNITIES
| Coluna | Fonte | Formato |
|--------|-------|---------|
| Data/Hora Criação | created_at | dd/MM/yyyy HH:mm:ss |
| Título | title | texto |
| Valor Previsto | valor_previsto | R$ formatado |
| Probabilidade | prob | % |
| Status | status | open/won/lost |
| Pipeline | pipeline_id | texto |
| Estágio | stage_id | texto |
| Temperatura | temperature | hot/warm/cold |
| Score IA | win_probability_ai | % |
| Tipo Lead | lead_type | texto |
| Fechamento Previsto | close_date_prevista | dd/MM/yyyy |

---

### 6. Como Usar (Chamada via Frontend)

```typescript
const response = await supabase.functions.invoke('export-forensic-user-logs', {
  body: {
    user_email: 'jessica@operadora.legal',
    date_start: '2026-01-01',
    date_end: '2026-01-31'
  }
});

if (response.data?.success) {
  // Converter base64 para blob e download
  const binaryString = atob(response.data.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([bytes], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = response.data.filename;
  a.click();
}
```

---

### 7. Validação e Testes

Após implementação:

1. **Deploy automático** da Edge Function
2. **Chamar a função** via `supabase--curl_edge_functions`
3. **Verificar contagens** esperadas (~535 registros)
4. **Baixar Excel** e validar estrutura

---

### 8. Considerações Legais

O Excel gerado incluirá:
- **Cabeçalho legal**: "RELATÓRIO FORENSE - USO EXCLUSIVO JUDICIAL"
- **Hash de integridade**: SHA256 do conteúdo para validação
- **Timestamp de geração**: Com timezone UTC
- **Assinatura digital**: ID do Platform Admin que gerou
