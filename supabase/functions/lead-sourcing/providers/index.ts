// Provider registry for event exhibitor sources.
// Today: ExpoFP. Future: MapYourShow, A2Z Inc, Swapcard (already inline elsewhere).
// Each provider exposes a `try*FromUrl()` returning a normalized exhibitor list.

export { detectExpoFP, fetchExpoFPExhibitors, tryExpoFPFromUrl } from "./expofp.ts";
export type { ExpoFPDetection, ExpoFPExhibitor, ExpoFPFetchResult } from "./expofp.ts";
