/** Superficie mínima de WebXR usada por OpenDomus. Sin polyfill que simule tracking espacial. */
export type XRSpaceLike = EventTarget;
export interface XRTransformLike { matrix: Float32Array; inverse: { matrix: Float32Array } }
export interface XRViewLike { projectionMatrix: Float32Array; transform: XRTransformLike }
export interface XRAnchorLike { anchorSpace: XRSpaceLike; delete(): void }
export interface XRHitLike {
  getPose(space: XRSpaceLike): { transform: XRTransformLike } | null;
  createAnchor?(): Promise<XRAnchorLike>;
}
export interface XRHitSourceLike { cancel(): void }
export interface XRFrameLike {
  getViewerPose(space: XRSpaceLike): { views: XRViewLike[] } | null;
  getPose(space: XRSpaceLike, base: XRSpaceLike): { transform: XRTransformLike } | null;
  getHitTestResults(source: XRHitSourceLike): XRHitLike[];
}
export interface XRLayerLike {
  framebuffer: WebGLFramebuffer;
  getViewport(view: XRViewLike): { x: number; y: number; width: number; height: number } | null;
}
export interface XRSessionLike extends EventTarget {
  renderState: { baseLayer?: XRLayerLike };
  requestReferenceSpace(type: "local" | "viewer"): Promise<XRSpaceLike>;
  requestHitTestSource(options: { space: XRSpaceLike }): Promise<XRHitSourceLike>;
  requestAnimationFrame(callback: (time: number, frame: XRFrameLike) => void): number;
  updateRenderState(options: { baseLayer: XRLayerLike }): void;
  end(): Promise<void>;
}
export interface XRSystemLike {
  isSessionSupported(mode: "immersive-ar"): Promise<boolean>;
  requestSession(mode: "immersive-ar", options: {
    requiredFeatures: string[]; optionalFeatures: string[]; domOverlay: { root: HTMLElement };
  }): Promise<XRSessionLike>;
}
export function spatialSystem(): XRSystemLike | undefined {
  return (navigator as Navigator & { xr?: XRSystemLike }).xr;
}
export interface SpatialCard { id: string; title: string; lines: string[]; footer: string }
export type SpatialStatus = "searching" | "surface" | "placed" | "tracking-lost" | "reset";
