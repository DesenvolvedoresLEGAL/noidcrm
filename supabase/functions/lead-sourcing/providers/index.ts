// Provider registry for event exhibitor sources.
// Today: ExpoFP, Informa Markets (Swapcard). Future: MapYourShow, A2Z Inc.
// Each provider exposes a `try*FromUrl()` returning a normalized exhibitor list.

export { detectExpoFP, fetchExpoFPExhibitors, tryExpoFPFromUrl } from "./expofp.ts";
export type { ExpoFPDetection, ExpoFPExhibitor, ExpoFPFetchResult } from "./expofp.ts";

export {
  detectInformaMarkets,
  findInformaMarketsLinkInHtml,
  fetchInformaMarketsExhibitors,
  tryInformaMarketsFromUrl,
} from "./informa-markets.ts";
export type {
  InformaMarketsDetection,
  InformaMarketsExhibitor,
  InformaMarketsFetchResult,
} from "./informa-markets.ts";

export { detectSpa, extractFromHydratedPayload, tryGenericSpaFromUrl } from "./spa-nextjs.ts";
export type { SpaDetection, SpaExhibitor, SpaFetchResult } from "./spa-nextjs.ts";
