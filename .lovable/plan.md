## Objetivo

Aplicar a nova identidade visual do HUMANOID — **Neural Cognition Spectrum™** (paleta) e **Cognitive Typography System™** (tipografia) — como base de design tokens do NOID RevenueOS, sem refatorar componentes individuais. Tudo flui pelos tokens semânticos, então a mudança propaga automaticamente.

## Escopo

**Dentro:**
- Atualizar `src/index.css` (tokens HSL, gradientes, sombras, fontes, sidebar)
- Atualizar `tailwind.config.ts` (fontFamily, novos tokens auxiliares opcionais: `cortex`, `deep-neural`, `indigo`, `quantum-gold`, `mind-white`, `electric-cyan`)
- Carregar fontes em `index.html` (Space Grotesk, Satoshi, IBM Plex Mono via CDN/Fontsource)
- Atualizar `meta theme-color` para Indigo `#3742FF`

**Fora:**
- Reescrita de componentes existentes
- Mudança de estrutura de páginas
- Lógica de negócio
- Páginas públicas (landing) ficam intactas — só herdam tokens

## Mapeamento Paleta → Tokens Semânticos

| Token | Light | Dark | Origem |
|---|---|---|---|
| `--background` | `0 0% 100%` (branco) | `230 53% 13%` Deep Neural | Mind White / Deep Neural |
| `--foreground` | `230 53% 13%` | `240 14% 96%` Mind White | Deep Neural / Mind White |
| `--card` | `0 0% 100%` | `0 0% 4%` Cortex Black | Mind White / Cortex |
| `--primary` | `236 100% 61%` Indigo | mesmo | Indigo Intelligence #3742FF |
| `--accent` | `188 100% 51%` Cyan | mesmo | Electric Cyan #03E3FF |
| `--secondary` | `230 53% 13%` Deep Neural | mesmo | Deep Neural Blue |
| `--warning` / quantum | `44 92% 50%` | mesmo | Quantum Gold #F2B90C |
| `--success` | `151 67% 49%` | mesmo | #27D380 |
| `--destructive` | `0 100% 68%` | mesmo | Danger #FF5C5C |
| `--muted` | `240 14% 96%` | `230 40% 18%` | Mind White / Deep Neural variant |
| `--border` | `240 14% 90%` | `230 40% 22%` | derivado |
| `--ring` | Indigo | Indigo | foco institucional |

Sidebar dark usa Cortex Black `#0A0A0A`; light mantém branco institucional com texto Deep Neural.

## Gradientes e Sombras

```css
--gradient-neural: linear-gradient(135deg, hsl(236 100% 61%) 0%, hsl(188 100% 51%) 60%, hsl(44 92% 50%) 100%);
--gradient-cognitive: linear-gradient(180deg, hsl(230 53% 13%) 0%, hsl(0 0% 4%) 100%);
--gradient-primary: var(--gradient-neural); /* alias p/ retrocompat */
--shadow-glow: 0 0 40px hsl(236 100% 61% / 0.25);
```

## Tipografia

`index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap" rel="stylesheet" />
```

`tailwind.config.ts` → `fontFamily`:
```ts
sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],      // operacional (default body)
display: ['"Space Grotesk"', 'Satoshi', 'sans-serif'],              // institucional
mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],             // técnico
```

`index.css` `body`: `@apply font-sans` (Satoshi). `h1..h3` recebem `font-display` via base layer:
```css
@layer base {
  h1, h2, h3 { @apply font-display tracking-tight; }
  code, kbd, pre, samp, .font-technical { @apply font-mono; }
}
```

Capitalização sentence case já é o padrão atual; nenhum CSS global de uppercase será adicionado.

## Arquivos Impactados

1. `src/index.css` — substituir bloco `:root` e `.dark`, gradientes, sombras, base de tipografia
2. `tailwind.config.ts` — adicionar `fontFamily` + `backgroundImage.gradient-neural/cognitive` (manter `gradient-primary` como alias)
3. `index.html` — `<link>` das 3 fontes + `theme-color="#3742FF"`

## Riscos

- Componentes que usam classes Tailwind cruas (`text-white`, `bg-black`, `text-purple-*`) não respondem a tokens. Não vou caçar todos nesta sprint — eles continuam funcionando, apenas ficam visualmente fora do sistema. Posso abrir sprint follow-up de auditoria se quiser.
- Quantum Gold passa a ocupar o slot `--warning`. Cores de aviso ficam levemente mais quentes que o âmbar atual — desejado pelo guia (gold = consciência operacional/atenção).
- Carregar 3 famílias via CDN adiciona ~80KB. Aceitável; alternativa é Fontsource (npm) em sprint posterior.

## Critérios de Aceite

- Tokens HSL refletindo a paleta oficial em light e dark
- Body em Satoshi, headings em Space Grotesk, mono em IBM Plex Mono
- `bg-primary` renderiza Indigo `#3742FF`
- `bg-accent` renderiza Electric Cyan `#03E3FF`
- `bg-gradient-neural` aplica o Neural Flow Gradient
- Build e typecheck passam
- Nenhum componente quebra (mudança puramente em tokens/fontes)

## Fora de Escopo (próxima sprint, se quiser)

- Auditoria e refactor de classes cruas (`text-white`, gradientes hardcoded em landing)
- Migração de fontes para `@fontsource` (offline/perf)
- Ajuste fino de componentes onde Quantum Gold deveria substituir warning padrão
