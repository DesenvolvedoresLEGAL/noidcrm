import { detectLogoWall } from "./logo-wall.ts";

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