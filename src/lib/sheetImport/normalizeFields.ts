const MT = new Set(['mt', 'メインタンク', 'main tank', 'maintank', '메인탱커', '主坦']);
const ST = new Set(['st', 'サブタンク', 'off tank', 'offtank', '서브탱커', '副坦']);
const AOE = new Set([
  '全体', 'aoe', 'raidwide', 'raid', '全体攻撃', '全体攻击', '전체', '광역', 'all',
]);

/** 攻撃の対象を MT/ST/AoE に正規化。空/不明は null。 */
export function normalizeTarget(v: string): 'AoE' | 'MT' | 'ST' | null {
  const n = v.trim().toLowerCase();
  if (!n) return null;
  if (n === 'mt' || MT.has(n)) return 'MT';
  if (n === 'st' || ST.has(n)) return 'ST';
  if (AOE.has(n)) return 'AoE';
  return null;
}

const PHYS = new Set(['物理', 'physical', 'phys', '물리', '物理伤害', '物理']);
const MAG = new Set(['魔法', 'magic', 'magical', 'magic damage', '마법', '魔法伤害']);

/** ダメージ種別を physical/magical に正規化。空/不明は null(=呼び出し側で既定 magical)。 */
export function normalizeDamageType(v: string): 'physical' | 'magical' | null {
  const n = v.trim().toLowerCase();
  if (!n) return null;
  if (PHYS.has(n)) return 'physical';
  if (MAG.has(n)) return 'magical';
  return null;
}
