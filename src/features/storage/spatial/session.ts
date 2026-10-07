import { createSpatialRenderer } from "./renderer";
import { spatialSystem, type SpatialCard, type SpatialStatus, type XRAnchorLike, type XRFrameLike, type XRHitSourceLike, type XRLayerLike, type XRSessionLike, type XRSpaceLike } from "./types";

export const MAX_SPATIAL_LABELS = 12;
interface Placement { matrix: Float32Array; anchor?: XRAnchorLike }
export interface SpatialController {
  select(id: string): void;
  update(cards: SpatialCard[]): void;
  place(): void;
  clear(): void;
  end(): Promise<void>;
}

/** Se llama directamente desde el gesto del usuario, para conservar la activación requerida por WebXR. */
export async function startSpatialSession(overlay: HTMLElement, selectedId: string, cards: SpatialCard[], events: {
  status: (status: SpatialStatus, count: number) => void;
  ended: () => void;
  failed: () => void;
}): Promise<SpatialController> {
  const xr = spatialSystem();
  if (!xr) throw new Error("WebXR unavailable");
  const session = await xr.requestSession("immersive-ar", {
    requiredFeatures: ["local", "hit-test", "dom-overlay"], optionalFeatures: ["anchors"], domOverlay: { root: overlay },
  });
  let ended = false;
  let renderer: ReturnType<typeof createSpatialRenderer> | undefined;
  let hitSource: XRHitSourceLike | undefined;
  let local: XRSpaceLike | undefined;
  const placements = new Map<string, Placement>();
  let selected = selectedId;
  let pin = false;
  let placing = false;
  let revision = 0;
  let available = new Map(cards.map((card) => [card.id, card]));
  let lastStatus = "";
  const report = (status: SpatialStatus) => {
    const key = `${status}:${placements.size}`;
    if (key !== lastStatus) { lastStatus = key; events.status(status, placements.size); }
  };
  const clear = () => {
    revision++;
    for (const [id, placement] of placements) { placement.anchor?.delete(); renderer?.remove(id); }
    placements.clear(); pin = false;
  };
  // Los controles del overlay no deben causar un segundo anclaje por el evento XR select.
  const preventXRSelect = (event: Event) => event.preventDefault();
  const select = () => { pin = true; };
  const reset = () => { clear(); report("reset"); };
  const cleanup = () => {
    if (ended) return;
    ended = true; clear(); hitSource?.cancel(); renderer?.dispose();
    local?.removeEventListener("reset", reset);
    overlay.removeEventListener("beforexrselect", preventXRSelect);
    session.removeEventListener("select", select);
    session.removeEventListener("end", cleanup);
    events.ended();
  };
  session.addEventListener("end", cleanup);
  overlay.addEventListener("beforexrselect", preventXRSelect);
  session.addEventListener("select", select);
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, preserveDrawingBuffer: false }) as (WebGLRenderingContext & { makeXRCompatible(): Promise<void> }) | null;
    if (!gl) throw new Error("WebGL unavailable");
    await gl.makeXRCompatible();
    if (ended) throw new Error("Session ended");
    const Layer = (window as unknown as { XRWebGLLayer: new (session: XRSessionLike, context: WebGLRenderingContext) => XRLayerLike }).XRWebGLLayer;
    const layer = new Layer(session, gl);
    session.updateRenderState({ baseLayer: layer });
    local = await session.requestReferenceSpace("local");
    if (ended) throw new Error("Session ended");
    local.addEventListener("reset", reset);
    const viewer = await session.requestReferenceSpace("viewer");
    if (ended) throw new Error("Session ended");
    hitSource = await session.requestHitTestSource({ space: viewer });
    if (ended) { hitSource.cancel(); throw new Error("Session ended"); }
    renderer = createSpatialRenderer(gl);
    const space = local;
    const source = hitSource;
    const scene = renderer;

    function frame(_time: number, xrFrame: XRFrameLike) {
      if (ended) return;
      try {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, layer.framebuffer);
        gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
        const viewerPose = xrFrame.getViewerPose(space);
        if (!viewerPose) { pin = false; report("tracking-lost"); session.requestAnimationFrame(frame); return; }
        const hit = xrFrame.getHitTestResults(source)[0];
        const surface = hit?.getPose(space);
        const card = available.get(selected);
        if (pin && surface && card && !placing && (placements.has(selected) || placements.size < MAX_SPATIAL_LABELS)) {
          pin = false;
          const id = selected;
          const expected = revision;
          const placement: Placement = { matrix: new Float32Array(surface.transform.matrix) };
          placements.get(id)?.anchor?.delete();
          placements.set(id, placement); scene.update(card);
          if (hit.createAnchor) {
            placing = true;
            // Invocar durante el frame activo, no después de un await.
            try {
              void hit.createAnchor().then((anchor) => {
                if (ended || expected !== revision || placements.get(id) !== placement) anchor.delete();
                else placement.anchor = anchor;
              }).catch(() => { /* El pose en espacio local sigue siendo espacial sin la extensión anchors. */ }).finally(() => { placing = false; });
            } catch { placing = false; }
          }
          report("placed");
        } else { pin = false; report(surface ? "surface" : "searching"); }
        const visible: { id: string; matrix: Float32Array }[] = [];
        for (const [id, placement] of placements) {
          if (!placement.anchor) { visible.push({ id, matrix: placement.matrix }); continue; }
          const pose = xrFrame.getPose(placement.anchor.anchorSpace, space);
          // Sin tracking no mostrar una tarjeta en una ubicación inventada.
          if (pose) visible.push({ id, matrix: pose.transform.matrix });
        }
        for (const view of viewerPose.views) {
          const viewport = layer.getViewport(view);
          if (!viewport) continue;
          gl!.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          if (surface) scene.draw(view, surface.transform.matrix);
          for (const label of visible) scene.draw(view, label.matrix, label.id);
        }
        session.requestAnimationFrame(frame);
      } catch { events.failed(); void session.end().catch(cleanup); }
    }
    session.requestAnimationFrame(frame);
    return {
      select(id) { selected = id; },
      update(next) {
        available = new Map(next.map((card) => [card.id, card]));
        for (const [id, placement] of placements) {
          const card = available.get(id);
          if (card) scene.update(card);
          else { placement.anchor?.delete(); placements.delete(id); scene.remove(id); }
        }
      },
      place() { pin = true; },
      clear() { clear(); report("searching"); },
      async end() { try { await session.end(); } finally { cleanup(); } },
    };
  } catch (error) { try { await session.end(); } catch { /* Sesión ya cerrada. */ } cleanup(); throw error; }
}
