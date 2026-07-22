/**
 * seed から決定的な Fisher-Yates シャッフルを行う (mulberry32 PRNG)。
 * 同じ items (内容配列) + seed なら常に同じ並びを返す。元配列は変更しない。
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const nextRandom = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** シャッフル用の新しいシード値を生成する (0〜0xffffffff の整数)。 */
export function generateShuffleSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
