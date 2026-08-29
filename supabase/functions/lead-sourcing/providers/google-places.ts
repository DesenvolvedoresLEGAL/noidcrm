// Market Search — fonte local: Google Places API (v1 Text Search).
// Retorna empresas reais com nome, telefone, site e endereço.
// Se GOOGLE_PLACES_API_KEY não estiver configurada, o motor roda sem esta fonte.

export interface PlaceCompany {
  company_name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
  maps_url: string | null;
  source: "google_places";
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

function pickComponent(components: any[] | undefined, type: string): string | null {
  if (!Array.isArray(components)) return null;
  const found = components.find((c) => Array.isArray(c?.types) && c.types.includes(type));
  return found?.shortText || found?.longText || null;
}

export async function searchPlaces(params: {
  apiKey: string;
  query: string;
  maxResults?: number;
  languageCode?: string;
  regionCode?: string;
}): Promise<PlaceCompany[]> {
  const max = Math.min(params.maxResults ?? 40, 60);
  const out: PlaceCompany[] = [];
  let pageToken: string | undefined;

  while (out.length < max) {
    const body: Record<string, unknown> = {
      textQuery: params.query,
      languageCode: params.languageCode ?? "pt-BR",
      regionCode: params.regionCode ?? "BR",
      pageSize: Math.min(20, max - out.length),
    };
    if (pageToken) body.pageToken = pageToken;

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": params.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Places ${resp.status}: ${text.substring(0, 300)}`);
    }

    const data = await resp.json();
    const places: any[] = data?.places || [];
    for (const p of places) {
      if (p?.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const name = p?.displayName?.text?.trim();
      if (!name) continue;
      out.push({
        company_name: name,
        website: p?.websiteUri || null,
        phone: p?.nationalPhoneNumber || p?.internationalPhoneNumber || null,
        address: p?.formattedAddress || null,
        city:
          pickComponent(p?.addressComponents, "administrative_area_level_2") ||
          pickComponent(p?.addressComponents, "locality"),
        state: pickComponent(p?.addressComponents, "administrative_area_level_1"),
        category: p?.primaryTypeDisplayName?.text || null,
        rating: typeof p?.rating === "number" ? p.rating : null,
        reviews: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
        maps_url: p?.googleMapsUri || null,
        source: "google_places",
      });
    }

    pageToken = data?.nextPageToken;
    if (!pageToken || places.length === 0) break;
    // Places exige um pequeno intervalo antes de usar o nextPageToken.
    await new Promise((r) => setTimeout(r, 1200));
  }

  return out.slice(0, max);
}
