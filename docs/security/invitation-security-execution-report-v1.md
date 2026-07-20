# Invitation Security Execution Report v1

**Sprint:** NOID-SECURITY 1.0 — Fase 9
**Status:** **NÃO EXECUTADO EM STAGING — bloqueado por ausência do projeto Supabase de staging.**

## 1. Escopo planejado

Rota `/accept-invitation/:token` + RPCs associadas
(`accept_organization_invitation`, `create_invitation`, etc.). Cenários
obrigatórios (do prompt da sprint):

| Cenário | Verificação | Executado |
| --- | --- | --- |
| Token válido | Cria membership no papel exato | ⏸️ |
| Token inválido | Erro genérico, sem enumeração | ⏸️ |
| Token expirado | Retorno genérico, TTL respeitado | ⏸️ |
| Token revogado | Idem | ⏸️ |
| Token já utilizado | Single-use enforcement | ⏸️ |
| Reutilização concorrente | Consumo atômico (transacional) | ⏸️ |
| Convite para usuário já membro | Idempotência sem duplicação | ⏸️ |
| Convite para e-mail diferente do logado | Bloqueio | ⏸️ |
| Convite ORG_A usado por user ORG_B | Isolamento cross-org | ⏸️ |
| Token alterado / vazio / caracteres especiais | Rejeição | ⏸️ |
| Resposta antes do login | Dados mínimos (nome da org, papel) | ⏸️ |
| Logs sem token completo | Auditoria | ⏸️ |
| Elevação de papel via convite | Bloqueio (não pode criar owner/platform_admin) | ⏸️ |

## 2. Análise estática preliminar

Revisão read-only do fluxo `accept_organization_invitation`:

- ✅ Função marcada `SECURITY DEFINER` com `SET search_path = public`.
- ✅ Consome o token em `UPDATE ... RETURNING` (atômico).
- ✅ Compara `auth.email()` com `invited_email` normalizado.
- ✅ TTL configurável em `organization_invitations.expires_at`.
- ⚠️ Necessário confirmar em staging: (a) que erros retornam mensagem
  genérica, (b) que o token não aparece em `system_events` completo,
  (c) que role `platform_admin` **não pode** ser concedido via convite.

## 3. Motivo do bloqueio

Idem demais fases — sem staging, os cenários com token forjado / expirado /
concorrente não podem ser reproduzidos sem risco à produção.

## 4. Conclusão parcial

- **P0-05 (segurança do aceite de convite):** permanece **ABERTO** até
  execução em staging. Análise estática não detectou vulnerabilidade
  evidente, mas não substitui homologação.
