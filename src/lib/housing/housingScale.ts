/**
 * ハウジング PC 表示の倍率 (--housing-scale) を TSX / JS から扱う共通部品。
 * CSS 側は housing.css の calc(Npx * var(--housing-scale)) で倍率を掛けている (CSS zoom は使わない)。
 * ここは「CSS で表せない JS の寸法計算」と「inline style の px」を同じ倍率にそろえるためのもの。
 *   - 倍率の値は housing.css の --housing-scale-pc / --housing-scale-center の 2 トークンで決まる。
 *   - スマホ (≤767px) は常に 1。
 */

/** 要素 (省略時 html) に効いている倍率を読む。読めない / 不正値は 1。 */
export function getHousingScale(el?: Element | null): number {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return 1;
  const target = el ?? document.documentElement;
  const raw = getComputedStyle(target).getPropertyValue('--housing-scale').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** JS の寸法定数 (px) を、その要素に効いている倍率で換算する。 */
export function scalePx(px: number, el?: Element | null): number {
  return px * getHousingScale(el);
}

/** inline style 用: 倍率付きの長さ文字列 (例 hpx(24) → "calc(24px * var(--housing-scale))")。 */
export function hpx(px: number): string {
  return `calc(${px}px * var(--housing-scale))`;
}
