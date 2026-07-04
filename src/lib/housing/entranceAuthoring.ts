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

/** 全マップの上書き table から、空(点ゼロ)のマップを除いた書き出し用 table を返す。 */
export function buildFullExport(overrides: Record<string, EntranceOverrides>): Record<string, EntranceOverrides> {
  const out: Record<string, EntranceOverrides> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v && Object.keys(v).length > 0) out[k] = v;
  }
  return out;
}
