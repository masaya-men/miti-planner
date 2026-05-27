/**
 * ambient slideshow の次ステップ秒数 (2.6-6 秒間のランダム値、 Allmarks 流)。
 * 純関数化することで vitest で deterministic にテスト可能。
 */
export const SLIDESHOW_MIN_STEP_MS = 2600;
export const SLIDESHOW_MAX_STEP_MS = 6000;

export function pickNextStepMs(rng: () => number = Math.random): number {
  return SLIDESHOW_MIN_STEP_MS + rng() * (SLIDESHOW_MAX_STEP_MS - SLIDESHOW_MIN_STEP_MS);
}
