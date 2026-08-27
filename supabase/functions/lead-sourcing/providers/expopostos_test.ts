import { detectExpoPostos, fetchExpoPostosBrands } from "./expopostos.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("detecta somente URLs da Expo Postos", () => {
  assert(detectExpoPostos("https://expopostos.com.br/expositores-marcas"), "domínio principal deveria ser detectado");
  assert(detectExpoPostos("https://admin.expopostos.com.br/api/marca_confirmada/"), "subdomínio deveria ser detectado");
  assert(!detectExpoPostos("https://example.com/expositores-marcas"), "outro domínio não deveria ser detectado");
});

Deno.test("pagina até o total exato informado pela API", async () => {
  const pages = new Map<string, unknown>([
    ["1", { count: 3, next: "https://example.test/?page=2", results: [{ id: 1, nome: "A" }, { id: 2, nome: "B" }] }],
    ["2", { count: 3, next: null, results: [{ id: 3, nome: "C" }] }],
  ]);
  const fakeFetch = ((url: string | URL | Request) => {
    const page = String(url).includes("page=2") ? "2" : "1";
    return Promise.resolve(new Response(JSON.stringify(pages.get(page)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }) as typeof fetch;

  const result = await fetchExpoPostosBrands(fakeFetch);
  assert(result.brands.length === 3, "deveria retornar todas as marcas");
  assert(result.pages_fetched === 2, "deveria seguir a paginação");
  assert(result.total_count === 3, "deveria preservar o total oficial");
  assert(result.access_method === "direct", "deveria registrar acesso direto");
});

Deno.test("rejeita paginação parcial em vez de concluir com lista truncada", async () => {
  const fakeFetch = (() => Promise.resolve(new Response(JSON.stringify({
    count: 210,
    next: null,
    results: [{ id: 1, nome: "Única" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }))) as typeof fetch;

  let rejected = false;
  try {
    await fetchExpoPostosBrands(fakeFetch);
  } catch (error) {
    rejected = String(error).includes("incomplete pagination");
  }
  assert(rejected, "resultado parcial deveria falhar fechado");
});