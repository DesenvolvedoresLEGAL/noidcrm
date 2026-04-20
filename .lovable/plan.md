

# Plano: Editor de avatar profissional + ampliar fotos em todo o sistema

## Parte 1 — Editor de Enquadramento (upload de foto)

### Diagnóstico
Hoje o upload do avatar é "fire-and-forget": o arquivo bruto vai pro Storage sem editor. O usuário não consegue reposicionar o rosto e o sistema apenas redimensiona via CSS (`object-cover`), o que **distorce ou corta a cabeça** quando a pessoa não está centralizada.

### Solução: novo componente `AvatarCropEditor`

Modal com:
- **Imagem original inteira** carregada em um `<canvas>` (sem corte prévio).
- **Quadro de recorte circular** fixo de 512×512px (target final).
- Controles:
  - **Zoom** (slider 1x → 3x).
  - **Arrastar** a foto com mouse/touch para reposicionar.
  - **Botão "Centralizar"** (reset).
  - **Botão "Cancelar"** e **"Salvar"**.
- Prévia em tempo real **dentro de um avatar circular** ao lado, no mesmo tamanho que aparece na sidebar — assim o usuário vê **exatamente** o resultado final.

### Helper compartilhado: `lib/avatar/cropMath.ts`

Função única `computeCropTransform({ image, zoom, offsetX, offsetY, outputSize })` retorna `{ drawX, drawY, drawW, drawH }`. **A mesma função alimenta a prévia E a renderização final** — fim da divergência entre o que é mostrado e o que é salvo.

### Export em PNG (não JPEG)
- `canvas.toBlob(blob => ..., 'image/png')` — preserva transparência se a foto não preencher 100%.
- Saída sempre 512×512px (qualidade alta para todos os tamanhos da UI).
- Sufixo `.png` no `fileName` enviado ao Storage.

### Fluxo
```
[Selecionar arquivo] → abre AvatarCropEditor com imagem inteira
       ↓
[Usuário arrasta + zoom até o rosto ficar bem enquadrado]
       ↓
[Prévia circular reflete em tempo real]
       ↓
[Salvar] → canvas → PNG 512x512 → upload → update profile
```

### Arquivos
- `src/components/avatar/AvatarCropEditor.tsx` — **novo** modal
- `src/lib/avatar/cropMath.ts` — **novo** helper compartilhado
- `src/pages/settings/ProfileSettings.tsx` — substitui `handleAvatarUpload` direto por abertura do editor
- `src/components/UserProfileCard.tsx` — mesma substituição

---

## Parte 2 — Ampliar e padronizar fotos em todo o sistema

### Diagnóstico
Hoje cada componente define seu próprio tamanho ad-hoc (`h-6 w-6`, `h-7 w-7`, `h-8 w-8`...). Em vários pontos críticos a foto fica **ilegível** e o `AvatarFallback` (iniciais) acaba sendo o que predomina.

### Padrão semântico de tamanhos (escala única)

Adicionar variantes na `Avatar` base:

| Token | Pixels | Uso |
|-------|--------|-----|
| `xs` | 24px | Listas densas, breadcrumbs |
| `sm` | 32px | Cards de oportunidade, dropdowns |
| `md` | 40px | Headers, tabelas |
| `lg` | 56px | Sidebar footer, cabeçalho da oportunidade |
| `xl` | 80px | Profile menu expandido, link público (rodapé "Fale com seu consultor") |
| `2xl` | 128px | ProfileSettings, página de perfil |

Implementação: prop `size` em `<Avatar size="lg" />` via CVA, mantendo retrocompatibilidade com `className`.

### Pontos de ajuste (aumentos confirmados nas screenshots enviadas)

| Local | Hoje | Novo |
|-------|------|------|
| Sidebar footer (UserProfileMenu) | `h-8 w-8` (32px) | `lg` (56px) |
| Card de oportunidade — owner | `h-6 w-6` (24px) | `sm` (32px) com ring |
| Detalhe da oportunidade — header do dono | `h-7 w-7` | `lg` (56px) |
| ProposalPublicView — "Fale com seu consultor" rodapé | atual pequeno | `xl` (80px) com ring sutil |
| PDF da proposta — assinatura do consultor | pequeno | dobrar para 96px (canvas no PDF) |
| Dashboard — saudação "Boa noite, Wagner" | atual | `lg` (56px) |
| AdminHeader | `h-7 w-7` | `md` (40px) |
| Tabelas de Users / Teams | `h-8 w-8` | `md` (40px) |

### Garantias visuais
- **Sempre** `object-cover` + `aspect-square` (foto não distorce mais).
- **Ring sutil** (`ring-2 ring-border` ou `ring-primary/10`) em tamanhos `lg+` para destacar do fundo.
- `AvatarFallback` mantém iniciais, mas com peso/tamanho proporcionais ao novo tamanho.
- Tudo via tokens semânticos (já padronizado na sprint anterior).

### Arquivos
- `src/components/ui/avatar.tsx` — adicionar variantes via CVA (`size`)
- `src/components/sidebar/UserProfileMenu.tsx` — ampliar para `lg`
- `src/components/OpportunityCard.tsx` — ampliar owner para `sm`
- `src/pages/OpportunityDetail.tsx` (header) — ampliar dono para `lg`
- `src/pages/ProposalPublicView.tsx` — consultor no rodapé para `xl`
- `src/lib/proposalPdfGenerator.ts` — dobrar tamanho do avatar do consultor no PDF
- `src/components/Dashboard*Header*.tsx` — ampliar saudação
- `src/components/admin/AdminHeader.tsx`, `src/components/settings/UsersContent.tsx`, `src/components/teams/TeamMembersManager.tsx` — atualizar para nova escala

---

## Detalhes técnicos

- **Canvas sizing:** o canvas interno do editor opera em coordenadas reais (pixels da imagem original) e renderiza visualmente em 320px no modal — `cropMath` lida com a conversão.
- **Touch support:** `pointerdown/move/up` (cobre mouse + touch sem libs).
- **Zoom:** wheel + slider, clamped 1x–3x. Não permite zoom out abaixo do que cobre o quadro (evita transparência indesejada).
- **PDF (jspdf):** `doc.addImage(pngDataUrl, 'PNG', x, y, 96, 96)` em vez de JPEG 48×48.
- **Bundle:** sem nova dependência — tudo em canvas nativo.
- **Backward compat:** avatares antigos (JPEG) continuam funcionando — só novos uploads serão PNG.

## Validação após deploy

1. Trocar foto pelo editor: arrastar + zoom funciona, prévia bate com o salvo.
2. Foto com fundo transparente fica limpa (sem barra branca).
3. Sidebar mostra rosto reconhecível em vez de iniciais predominantes.
4. Card de oportunidade mostra foto do dono claramente.
5. Link público da proposta mostra consultor com foto grande no rodapé.
6. PDF baixado tem avatar do consultor visível e nítido.

