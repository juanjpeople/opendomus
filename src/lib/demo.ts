/** Select the local sample house before opening IndexedDB. Each tab keeps its selection. */
export type SampleHouse = "demo" | "tests";
export const DEMO_BUILD = process.env.NEXT_PUBLIC_DEMO === "1";
function selectedHouse(): SampleHouse | null {
  if (typeof window === "undefined") return DEMO_BUILD ? "demo" : null;
  const requested = new URLSearchParams(window.location.search).get("house");
  try {
    if (requested === "demo" || requested === "tests") sessionStorage.setItem("refugiar-sample-house", requested);
    else if (requested === "home") sessionStorage.removeItem("refugiar-sample-house");
    const stored = sessionStorage.getItem("refugiar-sample-house");
    return stored === "demo" || stored === "tests" ? stored : DEMO_BUILD ? "demo" : null;
  } catch {
    // Never open the real house when an explicit sample selection could not be saved.
    if (requested === "demo" || requested === "tests") throw new Error("No se pudo abrir la casa de ejemplo: el almacenamiento de la pestaña está bloqueado.");
    return DEMO_BUILD ? "demo" : null;
  }
}
export const SAMPLE_HOUSE = selectedHouse();
export const DEMO_ENABLED = SAMPLE_HOUSE !== null;
export const HOUSE_DB = SAMPLE_HOUSE === "tests" ? "RefugiarTestDB" : DEMO_ENABLED ? "RefugiarDemoDB" : "RefugiarDB";
export function houseStorageKey(key: string): string {
  return SAMPLE_HOUSE ? `${key}-${SAMPLE_HOUSE}` : key;
}
