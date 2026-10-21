import { bbox, centroid, dedupe, offsetPoly, P, spanAt } from './geom';
import { css, facetCol, FLAT, mix, shade } from './color';
import { weatherSVG } from './weather';
import type { ArmorPalette, CapSpec, PanelSpec } from './types';

/**
 * 装甲の描画: 多角形 → 辺ごとの C 面(向きから光を計算)→ 面(つや・粒)→ 稜線の光 → 彫り線 → 継ぎ目 → くぼみ。
 * id は呼ぶ側が画面内で一意にする(内部の SVG id の接頭辞)。
 */
export function armorSVG(spec: PanelSpec, pal: ArmorPalette, id: string): string {
  const b = spec.b ?? 4, t = pal[spec.tone ?? 'pri'], sh = spec.shadow ?? 2.4;
  const pts = dedupe(spec.pts), inner = offsetPoly(pts, b), n = pts.length;
  let s = `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${css(mix(t.top, t.hi, 0.10))}"/><stop offset="0.45" stop-color="${css(t.top)}"/><stop offset="1" stop-color="${css(t.bot)}"/></linearGradient>` +
    `<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${css(pal.pkTop)}"/><stop offset="1" stop-color="${css(pal.pkBot)}"/></linearGradient>` +
    `<filter id="${id}s" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="${sh}" stdDeviation="${sh * 0.9}" flood-color="#000" flood-opacity="0.65"/></filter></defs>`;
  s += `<polygon points="${P(pts)}" fill="${css(pal.edge)}" filter="url(#${id}s)"/>`;
  let ridge = '';
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy), br = shade(dy / l, -dx / l, true);
    s += `<polygon points="${P([a, c, inner[(i + 1) % n], inner[i]])}" fill="${css(facetCol(br, t))}"/>`;
    if (br > FLAT + 0.04) { const u = inner[i], v = inner[(i + 1) % n]; ridge += `<line x1="${u[0].toFixed(2)}" y1="${u[1].toFixed(2)}" x2="${v[0].toFixed(2)}" y2="${v[1].toFixed(2)}"/>`; }
  }
  s += `<polygon points="${P(inner)}" fill="url(#${id}f)"/>`;
  if (pal.grain) s += `<polygon points="${P(inner)}" fill="url(#grain)" opacity="${pal.grain}"/>`;
  s += `<polygon points="${P(inner)}" fill="none" stroke="rgba(0,0,0,0.20)" stroke-width="0.6"/>`;
  if (ridge) s += `<g stroke="#fff" stroke-opacity="${pal.spec}" stroke-width="0.5" stroke-linecap="round">${ridge}</g>`;
  s += `<polygon points="${P(pts)}" fill="none" stroke="${css(pal.edge)}" stroke-width="0.7" stroke-linejoin="miter"/>`;
  (spec.scribes ?? []).forEach((d) => { s += `<path class="wash" d="${d}"/><path d="${d}" fill="none" stroke="${pal.scribeHi}" stroke-width="0.8" transform="translate(0.6,0.8)"/><path d="${d}" fill="none" stroke="${pal.scribe}" stroke-width="1.1"/>`; });
  (spec.seams ?? []).forEach((d) => {
    s += `<path class="wash" d="${d}"/><path d="${d}" fill="none" stroke="${pal.scribeHi}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" transform="translate(0.5,1)"/>` +
         `<path d="${d}" fill="none" stroke="${pal.seam}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
         `<path d="${d}" fill="none" stroke="${pal.seamCore}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  (spec.pockets ?? []).forEach((pk) => {
    const pp = dedupe(pk.pts), pb = pk.b ?? 1.8, pin = offsetPoly(pp, pb), m = pp.length;
    for (let i = 0; i < m; i++) {
      const a = pp[i], c = pp[(i + 1) % m], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy);
      s += `<polygon points="${P([a, c, pin[(i + 1) % m], pin[i]])}" fill="${css(facetCol(shade(dy / l, -dx / l, false), t))}"/>`;
    }
    s += `<polygon points="${P(pin)}" fill="${pk.fill ?? `url(#${id}p)`}"/>`;
    s += `<polygon points="${P(pp)}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/><polygon points="${P(pp)}" class="wx-rim"/>`;
  });
  (spec.circles ?? []).forEach(([cx, cy, r]) => {
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${css(mix(t.lo, t.face, 0.2))}"/><circle cx="${cx}" cy="${cy + 0.9}" r="${r - 0.4}" fill="${css(mix(t.face, t.hi, 0.6))}"/><circle cx="${cx}" cy="${cy}" r="${r - 1.6}" fill="#050606"/>`;
  });
  s += weatherSVG(spec, pts, inner, id);
  return s;
}

/** キーキャップの描画。id は armorSVG と同じく呼ぶ側が一意にする */
export function capSVG(c: CapSpec, pal: ArmorPalette, id: string): string {
  const t = pal.key, b = c.b ?? 1.7, pts = c.pts, inner = offsetPoly(pts, b), n = pts.length;
  let s = `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="${css(mix(t.top, t.hi, 0.10))}"/><stop offset="0.5" stop-color="${css(t.top)}"/><stop offset="1" stop-color="${css(t.bot)}"/></linearGradient>` +
    `<radialGradient id="${id}d" cx="0.5" cy="0" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="${pal.dish}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<filter id="${id}s" x="-30%" y="-30%" width="160%" height="190%"><feGaussianBlur stdDeviation="0.75"/></filter></defs>`;
  s += `<g class="sh"><polygon points="${P(pts)}" transform="translate(0 1.5)" fill="#000" fill-opacity="${pal.keySh}" filter="url(#${id}s)"/></g>`;
  s += `<polygon points="${P(pts)}" fill="${css(pal.keyEdge)}"/>`;
  let rim = '';
  for (let i = 0; i < n; i++) {
    const a = pts[i], d = pts[(i + 1) % n], dx = d[0] - a[0], dy = d[1] - a[1], l = Math.hypot(dx, dy), br = shade(dy / l, -dx / l, true);
    const q = P([a, d, inner[(i + 1) % n], inner[i]]);
    s += `<polygon points="${q}" fill="${css(facetCol(br, t))}"/>`;
    if (br > FLAT) rim += `<polygon points="${q}"/>`;
  }
  s += `<polygon points="${P(inner)}" fill="url(#${id}f)"/>`;
  if (pal.dish) s += `<polygon points="${P(inner)}" fill="url(#${id}d)"/>`;
  {
    const bb = bbox(inner), [pcx, pcy] = centroid(inner);
    s += `<ellipse cx="${pcx.toFixed(2)}" cy="${(pcy - bb.h * 0.04).toFixed(2)}" rx="${(bb.w * 0.32).toFixed(2)}" ry="${(bb.h * 0.3).toFixed(2)}" fill="url(#wx-polish)"/>`;
    s += `<clipPath id="${id}c"><polygon points="${P(pts)}"/></clipPath><g clip-path="url(#${id}c)"></g>`;
  }
  s += `<g class="rim" fill="#fff">${rim}</g>`;
  s += `<polygon points="${P(pts)}" fill="none" stroke="${css(pal.keyEdge)}" stroke-width="0.55" stroke-linejoin="round"/>`;
  if (c.lip) {
    const bb = bbox(inner), y = bb.y + bb.h - 2.5, [x0, x1] = spanAt(inner, y), cx = (x0 + x1) / 2, hw = Math.min(8, (x1 - x0) * 0.2);
    s += `<line class="lip-hi" x1="${(cx - hw).toFixed(2)}" y1="${(y + 0.9).toFixed(2)}" x2="${(cx + hw).toFixed(2)}" y2="${(y + 0.9).toFixed(2)}"/><line class="lip" x1="${(cx - hw).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(cx + hw).toFixed(2)}" y2="${y.toFixed(2)}"/>`;
  }
  return s;
}

/**
 * 共有 defs の中身(粒子ノイズ・汚れ・鋼のグラデ)。noiseDataUrl は canvas で作った 128x128 のノイズ画像
 * (ブラウザ側で 1 回作って渡す)。光の粒用の milspec-fxglow / 2 / 3(見本 js:1209-1211)も含む。
 */
export function armorDefsSVG(noiseDataUrl = ''): string {
  return `<pattern id="grain" width="128" height="128" patternUnits="userSpaceOnUse"><image href="${noiseDataUrl}" width="128" height="128"/></pattern>` +
    `<filter id="milspec-fxglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.55"/></filter>` +
    `<filter id="milspec-fxglow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1"/></filter>` +
    `<filter id="milspec-fxglow3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>` +
    `<filter id="wash" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.9"/></filter>` +
    `<linearGradient id="wx-grime" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ma-grime);stop-opacity:0"/><stop offset="1" style="stop-color:var(--ma-grime)"/></linearGradient>` +
    `<linearGradient id="wx-stk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ma-streak)"/><stop offset="1" style="stop-color:var(--ma-streak);stop-opacity:0"/></linearGradient>` +
    `<radialGradient id="wx-heat"><stop offset="0.55" stop-color="#5a64aa" stop-opacity="0"/><stop offset="0.72" stop-color="#5a64aa" stop-opacity="0.22"/><stop offset="0.86" stop-color="#9a6a36" stop-opacity="0.18"/><stop offset="1" stop-color="#9a6a36" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="wx-polish"><stop offset="0" style="stop-color:var(--ma-polish)"/><stop offset="1" style="stop-color:var(--ma-polish);stop-opacity:0"/></radialGradient>` +
    `<linearGradient id="stl-fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--ma-steel-hi)"/><stop offset="0.5" style="stop-color:var(--ma-steel)"/><stop offset="1" style="stop-color:var(--ma-steel-lo)"/></linearGradient>` +
    `<linearGradient id="stl-sh" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" style="stop-color:var(--ma-steel-hi)"/><stop offset="0.35" style="stop-color:var(--ma-steel)"/><stop offset="1" style="stop-color:var(--ma-steel-lo)"/></linearGradient>` +
    `<radialGradient id="stl-nut" cx="0.35" cy="0.3" r="0.9"><stop offset="0" style="stop-color:var(--ma-steel-hi)"/><stop offset="0.6" style="stop-color:var(--ma-steel)"/><stop offset="1" style="stop-color:var(--ma-steel-lo)"/></radialGradient>`;
}
