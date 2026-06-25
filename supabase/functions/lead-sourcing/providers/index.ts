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

export { fetchNmBrasilExhibitors, tryNmBrasilFromUrl } from "./nm-brasil.ts";
export type { NmBrasilDetection, NmBrasilExhibitor, NmBrasilFetchResult } from "./nm-brasil.ts";

export { detectDrts, extractDrtsExhibitors, fetchDrtsExhibitors, tryDrtsFromUrl } from "./drts-directory.ts";
export type { DrtsDetection, DrtsExhibitor, DrtsFetchResult } from "./drts-directory.ts";

export { detectFrancalTotvs, fetchFrancalExhibitors, tryFrancalTotvsFromUrl } from "./francal-totvs.ts";
export type { FrancalDetection, FrancalExhibitor, FrancalFetchResult } from "./francal-totvs.ts";

export { detectInfraFm, fetchInfraFmExhibitors, tryInfraFmFromUrl } from "./infrafm.ts";
export type { InfraFmDetection, InfraFmExhibitor, InfraFmFetchResult } from "./infrafm.ts";

export {
  detectMundoGeo,
  extractMundoGeoExhibitors,
  fetchMundoGeoExhibitors,
  tryMundoGeoFromUrl,
} from "./mundogeo.ts";
export type {
  MundoGeoDetection,
  MundoGeoExhibitor,
  MundoGeoFetchResult,
} from "./mundogeo.ts";

export {
  detectInformaConnect,
  fetchInformaConnectExhibitors,
  tryInformaConnectFromUrl,
} from "./informa-connect.ts";
export type {
  InformaConnectDetection,
  InformaConnectExhibitor,
  InformaConnectFetchResult,
} from "./informa-connect.ts";

export { detectLogoWall, tryLogoWallFromUrl } from "./logo-wall.ts";
export type { LogoWallDetection, LogoWallFetchResult, LogoWallSponsor } from "./logo-wall.ts";
