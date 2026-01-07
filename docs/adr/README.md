# Architecture Decision Records (ADRs)

Este diretório contém os registros de decisões arquiteturais do projeto.

## O que é um ADR?

Um ADR (Architecture Decision Record) é um documento curto que captura uma decisão arquitetural importante junto com seu contexto e consequências.

## Formato

Cada ADR segue o template em `000-template.md` e inclui:

- **Status**: Proposto, Aceito, Depreciado, Substituído
- **Contexto**: O problema ou situação que levou à decisão
- **Decisão**: A escolha feita
- **Consequências**: Os resultados esperados (positivos e negativos)

## Índice de ADRs

| # | Título | Status | Data |
|---|--------|--------|------|
| 001 | [Arquitetura Multi-Tenant](001-multi-tenant-architecture.md) | Aceito | 2024-01 |
| 002 | [Estratégia de RLS](002-rls-strategy.md) | Aceito | 2024-01 |
| 003 | [Stack de IA](003-ai-stack.md) | Aceito | 2024-02 |
| 004 | [Hierarquia de Visibilidade](004-visibility-hierarchy.md) | Aceito | 2024-02 |
| 005 | [Gamificação e XP](005-gamification-xp.md) | Aceito | 2024-03 |
| 006 | [Internacionalização](006-internationalization.md) | Aceito | 2024-03 |

## Como Criar um Novo ADR

1. Copie `000-template.md` para `NNN-titulo-descritivo.md`
2. Preencha todas as seções
3. Submeta para revisão
4. Atualize o índice acima após aprovação

## Convenções

- Números sequenciais (001, 002, ...)
- Nomes em kebab-case
- Decisões são imutáveis após aceitas
- Para mudar uma decisão, crie um novo ADR que substitui o anterior
