export interface DisplacementMapOptions {
  width: number;
  height: number;
  edge: number;
  radius: number;
}

/**
 * Build a displacement map for liquid glass refraction.
 * Rounded-rect SDF distance from edge + smooth vector field via 1/distance weighting.
 * Returns a data URL (PNG) suitable for <feImage href={...}>.
 */
export function makeDisplacementMapDataURL(opts: DisplacementMapOptions): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(opts.width));
  canvas.height = Math.max(1, Math.round(opts.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;

  const W = canvas.width;
  const H = canvas.height;
  const R = opts.radius;
  const edge = opts.edge;
  const eps = 0.5;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Rounded-rect SDF (dEdge)
      let dEdge: number;
      const inLeft = x < R;
      const inRight = x > W - 1 - R;
      const inTop = y < R;
      const inBot = y > H - 1 - R;
      if (inLeft && inTop) {
        const dx = R - x;
        const dy = R - y;
        dEdge = R - Math.hypot(dx, dy);
      } else if (inRight && inTop) {
        const dx = x - (W - 1 - R);
        const dy = R - y;
        dEdge = R - Math.hypot(dx, dy);
      } else if (inLeft && inBot) {
        const dx = R - x;
        const dy = y - (H - 1 - R);
        dEdge = R - Math.hypot(dx, dy);
      } else if (inRight && inBot) {
        const dx = x - (W - 1 - R);
        const dy = y - (H - 1 - R);
        dEdge = R - Math.hypot(dx, dy);
      } else {
        dEdge = Math.min(x, y, W - 1 - x, H - 1 - y);
      }
      if (dEdge < 0) dEdge = 0;

      const t = Math.min(1, dEdge / edge);
      const magnitude = Math.pow(1 - t, 1.6);

      // Smooth inward vector via 1/distance weighting
      const dL = x;
      const dR2 = W - 1 - x;
      const dT = y;
      const dB = H - 1 - y;
      const wL = 1 / (dL + eps);
      const wR = 1 / (dR2 + eps);
      const wT = 1 / (dT + eps);
      const wB = 1 / (dB + eps);
      const uxRaw = wL - wR;
      const uyRaw = wT - wB;
      const ulen = Math.hypot(uxRaw, uyRaw) || 1;
      const ux = uxRaw / ulen;
      const uy = uyRaw / ulen;

      const idx = (y * W + x) * 4;
      data[idx] = Math.round(128 + ux * 127 * magnitude);
      data[idx + 1] = Math.round(128 + uy * 127 * magnitude);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
