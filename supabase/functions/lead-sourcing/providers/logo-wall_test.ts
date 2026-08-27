import { detectLogoWall, normalizeSlugName } from "./logo-wall.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("extrai catálogo Next.js por alt, seção e cota sem capturar navegação", () => {
  const companyNames = ["Empresa Alfa", "Empresa Beta", "Empresa Gama", "Empresa Delta", "Empresa Épsilon", "Empresa Zeta"];
  const sponsorImages = companyNames.map((name, index) =>
    `<img alt="${name}" src="/_next/image?url=${encodeURIComponent(`https://cdn.example.com/logos/company-${index + 1}.png`)}&w=256&q=75">`
  ).join("");
  const html = `
    <nav><a href="/conteudo"><img alt="CONTEÚDO" src="/icons/content.svg"></a></nav>
    <main>
      <h1>Patrocinadores</h1>
      <div><h2>Master</h2>${sponsorImages}</div>
      <div><h2>Bronze</h2><img alt="Empresa Alfa" src="https://cdn.example.com/logos/company-1.png"></div>
    </main>`;

  const result = detectLogoWall("https://evento.example/sponsors", html);
  assert(result?.detection.mode === "sectioned_alt_grid", "deveria selecionar o extrator semântico");
  assert(result.sponsors.length === 6, "deveria deduplicar empresas e ignorar navegação");
  assert(result.sponsors.every((item) => item.tier === "Patrocinadores — Master"), "deveria preservar seção e cota");
  assert(result.sponsors.every((item) => !item.name.includes("CONTEÚDO")), "não deveria capturar menu");
});

Deno.test("normaliza slugs de mídia WordPress em nomes legíveis", () => {
  assert(normalizeSlugName("EC3-AZIMUT") === "Azimut", "deveria remover prefixo de cota");
  assert(normalizeSlugName("diantonio-boats") === "Diantonio Boats", "deveria title-case slug");
  assert(normalizeSlugName("FLUVIMAR2_NOVO") === "Fluvimar2", "deveria remover sufixo editorial");
  assert(normalizeSlugName("Logo_JRG_Fundo_CLARO (propspeed)") === "Propspeed", "deveria priorizar marca entre parênteses");
  assert(normalizeSlugName("LOGO EcoolMove-05") === "EcoolMove", "deveria preservar camel case");
});

Deno.test("carrossel horizontal WordPress agrupa expositores por seção editorial", () => {
  const slide = (alt: string, file: string) =>
    `<div class="swiper-slide"><figure><img class="swiper-slide-image" src="https://saopauloboatshow.com.br/wp-content/uploads/2025/09/${file}" alt="${alt}"></figure></div>`;
  const html = `
    <h2>ESTALEIROS</h2>
    ${slide("EC3-AZIMUT", "EC3-AZIMUT.png")}
    ${slide("EC3-CORAL", "EC3-CORAL.png")}
    ${slide("diantonio-boats", "diantonio-boats.png")}
    ${slide("drakkar-boats", "drakkar-boats.png")}
    <h2>SHOPPING</h2>
    ${slide("EC-KAPAZI", "EC-KAPAZI.png")}
    ${slide("EC-MERCURY", "EC-MERCURY.png")}
    ${slide("conttempla", "conttempla.png")}`;

  const result = detectLogoWall("https://saopauloboatshow.com.br/expositores-confirmados/", html);
  assert(result?.detection.mode === "sectioned_alt_grid", "deveria usar o extrator seccionado");
  assert(result.sponsors.length === 7, `deveria capturar todos os slides, veio ${result?.sponsors.length}`);
  assert(result.sponsors.some((s) => s.name === "Azimut" && s.tier === "ESTALEIROS"), "deveria manter seção editorial");
  assert(result.sponsors.some((s) => s.name === "Kapazi" && s.tier === "SHOPPING"), "deveria trocar de seção");
});
