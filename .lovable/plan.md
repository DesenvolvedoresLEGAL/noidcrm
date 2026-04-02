

# Aplicar Configurações Completas na Conta do Proprio Usuario

## Problema

A pagina de perfil do usuario (`/app/settings/profile`) mostra apenas nome e avatar via `UserProfileCard`. Porem a pagina de edicao de usuario pelo admin (`/app/settings/users/:userId/edit` - `EditUser.tsx`) tem uma interface completa com 4 abas:

- **Dados**: Nome, email, telefone, CPF, data de nascimento, funcao, equipe, pipeline padrao
- **Agenda**: Integracao de calendario (placeholder)
- **E-mails**: Configuracao SMTP completa com assinatura
- **Outras configuracoes**: Redefinicao de senha + preferencias

Os usuarios comuns so veem a versao basica. Precisam ver a mesma interface completa para suas proprias contas.

## Solucao

Refatorar `ProfileSettings.tsx` para usar a mesma estrutura de abas do `EditUser.tsx`, adaptada para o usuario logado (self-edit):

### Alteracoes

**1. `src/pages/settings/ProfileSettings.tsx`** - Reescrever completamente:
- Adicionar as 4 abas: Dados, Agenda, E-mails, Outras configuracoes
- Reutilizar o componente `SmtpSettings` existente passando o `user.id` do usuario logado
- Buscar dados do profile (phone, cpf, birth_date, default_pipeline_id) e team_members
- Permitir edicao de: nome, telefone, CPF, data de nascimento, pipeline padrao, equipe
- Campo email fica readonly (como no EditUser)
- Campo funcao organizacional fica readonly (usuario nao pode alterar o proprio role)
- Aba "Outras configuracoes": troca de senha usando `supabase.auth.updateUser` (direto, sem edge function, pois e o proprio usuario)
- Remover header do avatar que ja vem no card do usuario (manter avatar editavel no topo)

**2. `src/pages/settings/SettingsPageV3.tsx`** - Opcional, sem mudancas necessarias pois ja aponta para `/app/settings/profile`

**3. Nao remover `SecuritySettings`** - A rota de seguranca continua existindo mas as funcionalidades de senha ficam consolidadas na aba "Outras configuracoes" do perfil

### Logica de Self-Edit vs Admin-Edit

| Funcionalidade | Self-Edit (ProfileSettings) | Admin-Edit (EditUser) |
|---|---|---|
| Nome, telefone, CPF, nascimento | Editavel | Editavel |
| Email | Readonly | Readonly |
| Funcao organizacional | Readonly (exibe badge) | Editavel |
| Equipe | Readonly (exibe texto) | Editavel |
| Pipeline padrao | Editavel | Editavel |
| SMTP/Email | Editavel (proprio user) | Editavel (target user) |
| Senha | `auth.updateUser` | Edge function `admin-reset-password` |
| Bloquear | Nao exibe | Exibe |

### Componentes Reutilizados
- `SmtpSettings` - ja aceita `userId` como prop
- `useTeams`, `useOrganizationPipelines` - hooks existentes
- Formatadores `formatCPF`, `formatPhone` - extrair do EditUser ou copiar

### Arquivos Afetados

| Arquivo | Alteracao |
|---|---|
| `src/pages/settings/ProfileSettings.tsx` | Reescrever com 4 abas completas para self-edit |

