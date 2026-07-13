/**
 * ステッパーの進行連動オートスクロール量 (純関数)。
 * 中身の高さ contentH がビューポート viewportH を超える分だけを overflow とし、
 * 進捗 progress (0..1) に比例して body を上へ送る量 (px, ≥0) を返す。
 * 収まる場合・非有限値・負値はゼロ (動かさない) に丸める。
 */
export function computeStepperScroll(progress: number, contentH: number, viewportH: number): number {
  // Heights must be finite and non-negative
  if (!Number.isFinite(contentH) || contentH < 0 || !Number.isFinite(viewportH) || viewportH < 0) {
    return 0;
  }
  const overflow = Math.max(0, contentH - viewportH);
  if (overflow <= 0) return 0;
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return p * overflow;
}
