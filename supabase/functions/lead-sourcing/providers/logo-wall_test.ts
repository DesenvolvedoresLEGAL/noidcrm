import { detectLogoWall } from "./logo-wall.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("extrai catálogo Next.js por alt, seção e cota sem capturar navegação", () => {
  const sponsorImages = Array.from({ length: 6 }, (_, index) =>
    `<img alt="Empresa ${index + 1}" src="/_next/image?url=${encodeURIComponent(`https://cdn.example.com/logos/company-${index + 1}.png`)}&w=256&q=75">`
  ).join("");
  const html = `
    <nav><a href="/conteudo"><img alt="CONTEÚDO" src="/icons/content.svg"></a></nav>
    <main>
      <h1>Patrocinadores</h1>
      <div><h2>Master</h2>${sponsorImages}</div>
      <div><h2>Bronze</h2><img alt="Empresa 1" src="https://cdn.example.com/logos/company-1.png"></div>
    </main>`;

  const result = detectLogoWall("https://evento.example/sponsors", html);
  assert(result?.detection.mode === "sectioned_alt_grid", "deveria selecionar o extrator semântico");
  assert(result.sponsors.length === 6, "deveria deduplicar empresas e ignorar navegação");
  assert(result.sponsors.every((item) => item.tier === "Patrocinadores — Master"), "deveria preservar seção e cota");
  assert(result.sponsors.every((item) => !item.name.includes("CONTEÚDO")), "não deveria capturar menu");
});