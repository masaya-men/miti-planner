/**
 * DPS サブロールの並び順(近接 → 遠隔物理 → キャスター)。
 * パーティ枠割当(D1→D4)とジョブピッカーの表示順で共有し、重複定義を避ける(DRY)。
 *
 * 各配列は FF14 の標準的なジョブガイド順。member 列の自動割当(resolveImportParty)と
 * JobPicker のグルーピングが同じ真実を参照する。
 */

/** 近接物理 DPS (melee)。 */
export const DPS_MELEE: readonly string[] = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];

/** 遠隔物理 DPS (physical ranged)。 */
export const DPS_PHYS_RANGED: readonly string[] = ['brd', 'mch', 'dnc'];

/** 魔法 DPS (magical ranged / caster)。 */
export const DPS_MAGIC_RANGED: readonly string[] = ['blm', 'smn', 'rdm', 'pct'];

/**
 * DPS の並び順を平坦化した順序付きリスト(近接 → 遠隔物理 → キャスター)。
 * 先頭ほど D1 寄り(近接を左)。このリストに無い jobId は dpsRank で末尾扱い。
 */
export const DPS_SUBROLE_ORDER: readonly string[] = [
  ...DPS_MELEE,
  ...DPS_PHYS_RANGED,
  ...DPS_MAGIC_RANGED,
];

/**
 * jobId の DPS 並び順ランクを返す。小さいほど D1 寄り(近接が先頭)。
 * DPS_SUBROLE_ORDER に無い jobId は末尾(Number.MAX_SAFE_INTEGER)。
 * ロールに依らず数値を返すだけの純関数(呼び出し側で DPS のみに使う)。
 */
export function dpsRank(jobId: string): number {
  const i = DPS_SUBROLE_ORDER.indexOf(jobId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** タンクの並び順(MT→ST の既定)。FF14 公式ジョブガイド順。MT/ST はジョブで一意に決まらないため決定的な既定として使う。 */
export const TANK_ORDER: readonly string[] = ['pld', 'war', 'drk', 'gnb'];

/** ピュアヒラ(PH = H1 寄り)。 */
export const HEALER_PURE: readonly string[] = ['whm', 'ast'];
/** バリアヒラ(BH = H2 寄り)。 */
export const HEALER_BARRIER: readonly string[] = ['sch', 'sge'];
/** ヒラの並び順(PH → BH = H1→H2 の既定)。 */
export const HEALER_ORDER: readonly string[] = [...HEALER_PURE, ...HEALER_BARRIER];

/** jobId のタンク並び順ランク(小さいほど MT 寄り)。未知は末尾。 */
export function tankRank(jobId: string): number {
  const i = TANK_ORDER.indexOf(jobId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
/** jobId のヒラ並び順ランク(小さいほど H1 寄り=PH 優先)。未知は末尾。 */
export function healerRank(jobId: string): number {
  const i = HEALER_ORDER.indexOf(jobId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
