export type EntranceOverrides = Record<string, [number, number]>;

/** 0..1 正規化 → viewBox px。 */
export function normToPx(nx: number, ny: number, vb: { w: number; h: number }): { x: number; y: number } {
  return { x: nx * vb.w, y: ny * vb.h };
}

/** viewBox px → 0..1 正規化。 */
export function pxToNorm(px: number, py: number, vb: { w: number; h: number }): [number, number] {
  return [px / vb.w, py / vb.h];
}

/** 現JSON に mapKey の上書きをマージした新オブジェクトを返す。空 override は該当 mapKey を削除、他 mapKey は保持。 */
export function buildEntranceExport(
  existing: Record<string, EntranceOverrides>,
  mapKey: string,
  overrides: EntranceOverrides,
): Record<string, EntranceOverrides> {
  const next: Record<string, EntranceOverrides> = { ...existing };
  if (Object.keys(overrides).length === 0) {
    delete next[mapKey];
  } else {
    next[mapKey] = { ...overrides };
  }
  return next;
}
