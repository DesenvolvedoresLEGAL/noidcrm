## Plano de correção imediata

**Problema confirmado**
- `CONARH 2026` lista as marcas na página principal como imagens/logos, com nomes no `alt` e URLs em storage (`images-programacao/parceiros/...`), sem página `/patrocinadores` no path.
- `Expert XP` tem muitos logos como imagem dentro de seções de patrocinadores; alguns não têm link externo e o fallback atual só roda quando o path parece sponsor. Quando cai no pipeline genérico, ele captura banner/CTA como lead.
- O `logo-wall.ts` atual só ativa `filename_grid` se a URL tiver `/patrocinadores`, `/sponsors`, `/parceiros`, etc.; por isso falha no CONARH `/` e pode deixar o Expert XP escorrer para parser genérico.

## Implementação proposta

1. **Fortalecer `logo-wall.ts`**
   - Detectar páginas de logo-wall também por conteúdo, não só por path:
     - headings/textos como `PATROCINADORES`, `PARCEIROS`, `EXPOSITORES`, `+300 estandes`, `230+ patrocinadores`;
     - alta densidade de imagens em diretórios como `/parceiros/`, `/patrocinadores/`, `/sponsors/`, `/logos/`, `/wp-content/uploads/`.
   - Extrair nomes diretamente do `alt` quando for útil (ex.: `Totvs`, `Gupy`, `SulAmérica`, `Senior`, `Caju`, `Beneo`, etc.).
   - Usar filename apenas como fallback quando `alt` vier vazio/genérico.
   - Preservar dedupe por nome para grids sem website e por domínio para links externos.
   - Filtrar ruídos como `banner xp`, `hero`, `hor-line`, `xp`, imagens de palestrantes e assets de layout.

2. **Ajustar gatilho do provider no pipeline**
   - Manter o provider `logo-wall` antes do Firecrawl/AI.
   - Se `logo-wall` retornar >= 6 logos, usar esse resultado determinístico e pular Firecrawl/AI, igual ao fluxo atual.
   - Se retornar pouco, cair nos providers existentes sem bloquear outros eventos.

3. **Validar localmente com HTML real**
   - Testar `https://conarh.org.br/` e confirmar dezenas/centenas de marcas extraídas, não `Banner`.
   - Testar `https://www.expertxp.com.br/patrocinadores/` e confirmar que não fica em 1 lead e que nomes como `Kapitalo`, `Mapfre`, `BTG`, `Bradesco`, `Vinci Compass` aparecem.

4. **Deploy da edge function**
   - Deployar apenas `lead-sourcing` após o patch.

## Arquivos impactados
- `supabase/functions/lead-sourcing/providers/logo-wall.ts`
- Possivelmente `supabase/functions/lead-sourcing/index.ts` apenas se for necessário registrar métricas adicionais do novo modo de detecção.

## Riscos
- Baixo: mudança isolada no provider determinístico de logo-wall.
- Mitigação: ativação exige densidade alta de logos e sinais de página de patrocinadores/parceiros/expositores, evitando capturar imagens comuns de landing pages.

## Próximo passo
Aprovar o plano para eu aplicar o patch e deployar a função `lead-sourcing`.