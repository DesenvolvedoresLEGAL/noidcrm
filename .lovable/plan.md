

# Correção: SMTP Incompatível com Deno Runtime Atual

## Causa Raiz

O erro é claro nos logs:
```
TypeError: Deno.writeAll is not a function
```

A biblioteca `deno.land/x/smtp@v0.7.0` usa APIs Deno **descontinuadas** (`Deno.writeAll`, `Deno.readAll`) que foram removidas nas versões mais recentes do Deno runtime usado pelo Edge Functions. A biblioteca é antiga e incompatível.

## Solução

Substituir a biblioteca `smtp@v0.7.0` por `denomailer` (`deno.land/x/denomailer@1.6.0`), que é ativamente mantida e compatível com o runtime atual.

**Ambas as Edge Functions** são afetadas: `test-smtp-connection` e `send-smtp-email`.

## Alterações

### 1. `supabase/functions/test-smtp-connection/index.ts`

- Trocar import de `SmtpClient` por `SMTPClient` do denomailer
- Atualizar a API de conexão e envio:

```typescript
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Novo padrão de conexão + envio
const client = new SMTPClient({
  connection: {
    hostname: smtp_host,
    port: Number(smtp_port),
    tls: Number(smtp_port) === 465,
    auth: {
      username: smtp_user,
      password: smtp_password,
    },
  },
});

await client.send({
  from: from_name ? `${from_name} <${from_email}>` : from_email,
  to: from_email,
  subject: "Teste de Conexao SMTP - CRM",
  html: `<div>...</div>`,
});

await client.close();
```

### 2. `supabase/functions/send-smtp-email/index.ts`

- Mesma troca de biblioteca e API
- Manter toda lógica de autenticacao, busca de config SMTP, assinatura e logging

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/test-smtp-connection/index.ts` | Migrar smtp@v0.7.0 para denomailer@1.6.0 |
| `supabase/functions/send-smtp-email/index.ts` | Migrar smtp@v0.7.0 para denomailer@1.6.0 |

## Deploy

Redeploy de ambas as Edge Functions apos alteracoes.

