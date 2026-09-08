/**
 * WebGL capability probe.
 *
 * MapLibre requires WebGL and its constructor *throws* when a context cannot
 * be created. Thrown from inside an effect that takes down the whole route,
 * so the mandal list disappeared too — the map failing must never cost the
 * user the rest of the page (§35).
 *
 * Real causes seen in the wild: hardware acceleration switched off (an
 * ordinary Chrome setting), a blocklisted GPU driver, older Android devices,
 * and hardened/privacy browsers.
 */
export function isWebglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Release the probe context immediately; browsers cap concurrent contexts.
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
