# ADR-006: Internacionalização (i18n)

## Status

Aceito

## Data

2024-03-15

## Contexto

O sistema precisa suportar múltiplos idiomas para atender:
- Mercado brasileiro (PT-BR) como principal
- Expansão futura para outros países (ES, EN)
- Organizações multinacionais

### Forças em Jogo
- **UX**: Interface no idioma do usuário
- **Manutenção**: Traduções precisam ser fáceis de atualizar
- **Performance**: Não pode impactar carregamento
- **Consistência**: Terminologia deve ser uniforme
- **Conteúdo dinâmico**: Dados do banco não são traduzidos

## Decisão

> Nós decidimos usar **react-i18next** com **arquivos JSON de tradução** organizados por namespace, com **detecção automática de idioma** e **fallback para PT-BR**.

### Estrutura

1. **Library**: react-i18next + i18next-browser-languagedetector
2. **Formato**: JSON por idioma e namespace
3. **Fallback**: PT-BR como idioma padrão
4. **Detecção**: Navegador → Preferência salva → PT-BR

## Alternativas Consideradas

### Alternativa 1: Inline Translations (Template Strings)
- **Prós**: Simples para poucos strings
- **Contras**: Não escala, difícil manutenção

### Alternativa 2: CMS de Tradução (Phrase, Crowdin)
- **Prós**: Interface para tradutores, workflow
- **Contras**: Custo, dependência externa, latência

### Alternativa 3: Compilação em Build Time (Astro, Next i18n)
- **Prós**: Performance máxima
- **Contras**: Build separado por idioma, complexidade

## Consequências

### Positivas
- **Padrão de mercado**: react-i18next é bem documentado
- **Type-safe**: Integração com TypeScript possível
- **Lazy loading**: Namespaces carregados sob demanda
- **Flexível**: Interpolação, pluralização, formatação

### Negativas
- **Bundle size**: Adiciona ~40KB gzipped
- **Chaves hardcoded**: Erros de typo só aparecem em runtime
- **Contexto**: Algumas traduções precisam de contexto

### Riscos
- **Traduções faltando**: Fallback para chave. Mitigado por CI check.
- **Inconsistência**: Mitigado por glossário centralizado.

## Implementação

### Estrutura de Arquivos

```
src/
└── i18n/
    ├── index.ts           # Configuração
    ├── locales/
    │   ├── pt-BR/
    │   │   ├── common.json
    │   │   ├── crm.json
    │   │   ├── settings.json
    │   │   └── gamification.json
    │   ├── en/
    │   │   └── ...
    │   └── es/
    │       └── ...
    └── types.ts           # Tipos para autocompletion
```

### Configuração

```typescript
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en', 'es'],
    defaultNS: 'common',
    ns: ['common', 'crm', 'settings', 'gamification'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });
```

### Uso em Componentes

```typescript
import { useTranslation } from 'react-i18next';

function OpportunityCard({ opportunity }) {
  const { t } = useTranslation('crm');
  
  return (
    <Card>
      <h3>{opportunity.title}</h3>
      <p>{t('opportunity.value', { value: opportunity.value })}</p>
      <Badge>{t(`stages.${opportunity.stage}`)}</Badge>
    </Card>
  );
}
```

### Exemplo de Arquivo de Tradução

```json
// src/i18n/locales/pt-BR/crm.json
{
  "opportunity": {
    "title": "Oportunidade",
    "value": "Valor: {{value, currency}}",
    "created": "Criada em {{date, datetime}}"
  },
  "stages": {
    "prospecting": "Prospecção",
    "qualification": "Qualificação",
    "proposal": "Proposta",
    "negotiation": "Negociação",
    "closed_won": "Ganho",
    "closed_lost": "Perdido"
  },
  "actions": {
    "create": "Nova Oportunidade",
    "edit": "Editar",
    "delete": "Excluir",
    "delete_confirm": "Tem certeza que deseja excluir esta oportunidade?"
  }
}
```

### Formatação de Números e Datas

```typescript
// Configuração de formatadores
i18n.services.formatter?.add('currency', (value, lng) => {
  return new Intl.NumberFormat(lng, {
    style: 'currency',
    currency: lng === 'pt-BR' ? 'BRL' : 'USD',
  }).format(value);
});

i18n.services.formatter?.add('datetime', (value, lng) => {
  return new Intl.DateTimeFormat(lng, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
});
```

## Glossário de Termos

| PT-BR | EN | ES |
|-------|----|----|
| Oportunidade | Opportunity | Oportunidad |
| Lead | Lead | Lead |
| Funil | Pipeline | Embudo |
| Etapa | Stage | Etapa |
| Atividade | Activity | Actividad |
| Contato | Contact | Contacto |
| Conta | Account | Cuenta |

## Referências

- [react-i18next Documentation](https://react.i18next.com/)
- Configuração: `src/i18n/`
- Hook customizado: `src/hooks/useTranslation.ts`
