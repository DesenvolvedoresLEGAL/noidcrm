

## Contexto do Problema

A publicação funcionou, mas agora há dois problemas:

1. **Badge de versão no canto inferior esquerdo** - O componente `BuildInfoBadge` que foi criado para debug está visível na interface e precisa ser removido

2. **Erro crítico no console: "Cannot read properties of undefined (reading 'createContext')"** - Este erro impede o carregamento das páginas no site publicado

## Causa Raiz do Erro

O erro acontece porque a configuração `manualChunks` no `vite.config.ts` separou o React em um chunk independente (`react.js`), mas outras bibliotecas que dependem do React (como Radix UI, framer-motion, react-i18next) podem ser carregadas **antes** do chunk do React. 

Quando isso acontece, essas bibliotecas tentam usar `React.createContext()`, mas o React ainda não foi inicializado, causando o erro "Cannot read properties of undefined".

## Plano de Correção

### Parte A: Remover o BuildInfoBadge

1. **Remover import e uso do componente em `src/App.tsx`**
   - Remover a linha `import { BuildInfoBadge } from "@/components/BuildInfoBadge";`
   - Remover a linha `<BuildInfoBadge />`

2. **Deletar o arquivo do componente**
   - Remover `src/components/BuildInfoBadge.tsx`

### Parte B: Corrigir configuração de chunks (erro createContext)

1. **Ajustar `vite.config.ts`**
   - Simplificar a estratégia de `manualChunks` para evitar separar React de suas dependências
   - Agrupar React junto com bibliotecas que dependem dele (Radix, framer-motion, etc.) em um único chunk "framework"
   - Isso garante que tudo seja carregado junto e na ordem correta

**Nova estratégia de chunks:**
```text
┌─────────────────────────────────────────────┐
│ framework (React + Radix + framer-motion)   │  ← Carrega primeiro
├─────────────────────────────────────────────┤
│ icons (lucide-react)                        │
├─────────────────────────────────────────────┤
│ editor (tiptap)                             │
├─────────────────────────────────────────────┤
│ charts (recharts)                           │
├─────────────────────────────────────────────┤
│ backend (supabase)                          │
├─────────────────────────────────────────────┤
│ vendor (outras dependências)                │
└─────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/App.tsx` | Remover import e uso do BuildInfoBadge |
| `src/components/BuildInfoBadge.tsx` | Deletar arquivo |
| `vite.config.ts` | Ajustar manualChunks para agrupar React com dependentes |

## Resultado Esperado

- Badge de versão removido da interface
- Páginas carregando normalmente sem erro de `createContext`
- Deploy continuará funcionando (mantemos a otimização de chunks, só ajustada)

