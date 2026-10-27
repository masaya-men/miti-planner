/**
 * NEWビーム演出の開始を listing.id から決定的にずらす (2026-08-16)。
 * 複数のNEWカードが同時に画面内へ入ったとき全員が寸分違わず同時に光ると
 * 機械的で不自然に見えるため(Material Designの staggered animation 指針、
 * Framer Motion の staggerChildren / GSAP の stagger 等が標準機能として
 * 存在するのが示す通り、複数要素の同時アニメーションは業界的に避けられる)、
 * カードごとに 300〜1200ms の範囲でずらす。id 由来の決定的な値なので同じカードは
 * 毎回同じズレになる (再現性のためランダムにはしない)。
 */
export function staggerDelayMs(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return NEW_SHINE_MIN_DELAY_MS + (Math.abs(hash) % NEW_SHINE_STAGGER_RANGE_MS);
}

// NEW の帯のキラッ (0.9s) の開始を 300〜1200ms の間でずらす (2026-10-22: 縁を一周する 3s の光から
// 帯の上だけの短い光沢に変えたため、待たせすぎないよう幅を縮めた)。
const NEW_SHINE_MIN_DELAY_MS = 300;

const NEW_SHINE_STAGGER_RANGE_MS = 900;
