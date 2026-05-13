import type { AppliedMitigation, Mitigation } from '../types';

/**
 * リキャスト専用行で使用する「現在クールダウン中スキル」 の表現。
 * placement と def を結合した、 UI レンダリング用の派生データ。
 */
export interface ActiveRecast {
  placementId: string;
  mitigationId: string;
  ownerId: string;
  placementTime: number;
  recast: number;
  remaining: number;
}

/**
 * Clockswipe (透明扇形) の角度を計算する。
 * - 使用直後 (remaining === recast): 0deg (全面塗りつぶし)
 * - 半分経過: 180deg
 * - ほぼリキャスト完了: 約 360deg (透明領域がほぼ全周)
 * - 結果は [0, 360] にクランプ。 recast <= 0 のときは 0。
 */
export function calculateAngle(remainingSec: number, recastSec: number): number {
  if (recastSec <= 0) return 0;
  const elapsed = recastSec - remainingSec;
  const ratio = elapsed / recastSec;
  const angle = ratio * 360;
  if (angle < 0) return 0;
  if (angle > 360) return 360;
  return angle;
}

/**
 * 現在時刻 currentTime 時点でリキャスト中のスキル配置を抽出する。
 * - 過去配置のみ対象 (p.time <= currentTime)
 * - (ownerId, mitigationId) 単位で最も新しい配置を採用
 * - def.recast > 0 かつ 0 < remaining <= recast のものだけ含める
 * - remaining 昇順でソートして返す
 */
export function getActiveRecasts(
  placements: AppliedMitigation[],
  defs: Mitigation[],
  currentTime: number,
): ActiveRecast[] {
  const defMap = new Map<string, Mitigation>();
  for (const def of defs) defMap.set(def.id, def);

  // (ownerId, mitigationId) 単位で最も新しい placement を保持。
  // ネストした Map にすることで、 id に区切り文字 (例: '::') が含まれていても
  // キー衝突が起きない (文字列連結方式の弱点を回避)。
  const latestByOwner = new Map<string, Map<string, AppliedMitigation>>();
  for (const p of placements) {
    if (p.time > currentTime) continue;
    let inner = latestByOwner.get(p.ownerId);
    if (!inner) {
      inner = new Map<string, AppliedMitigation>();
      latestByOwner.set(p.ownerId, inner);
    }
    const existing = inner.get(p.mitigationId);
    if (!existing || p.time > existing.time) {
      inner.set(p.mitigationId, p);
    }
  }

  const result: ActiveRecast[] = [];
  for (const inner of latestByOwner.values()) {
    for (const p of inner.values()) {
      const def = defMap.get(p.mitigationId);
      if (!def || def.recast <= 0) continue;
      const remaining = def.recast - (currentTime - p.time);
      // p.time <= currentTime はループ前段でフィルタ済みなので
      // remaining <= def.recast は数学的に保証される。
      // よってここでは remaining <= 0 のみチェックすればよい。
      if (remaining <= 0) continue;
      result.push({
        placementId: p.id,
        mitigationId: p.mitigationId,
        ownerId: p.ownerId,
        placementTime: p.time,
        recast: def.recast,
        remaining,
      });
    }
  }

  result.sort((a, b) => a.remaining - b.remaining);
  return result;
}

/**
 * 表示上限 limit に従って actives を絞り込む。
 * - count <= limit: 全件、 placementTime 昇順で返す
 * - count > limit: remaining が短いものから捨て、 残った limit 件を placementTime 昇順で返す
 *
 * 「残り時間が短いものを優先的に隠す」 = 「もうすぐ消えるから新規スキルにスペースを譲る」 という意図。
 */
export function selectVisibleByLimit(actives: ActiveRecast[], limit: number): ActiveRecast[] {
  // limit <= 0 のときは常に空配列を返す。
  // (slice(-0) は slice(0) と等価で全件返してしまうため、 明示的に早期 return する)
  if (limit <= 0) return [];
  if (actives.length <= limit) {
    return [...actives].sort((a, b) => a.placementTime - b.placementTime);
  }
  const byRemainingAsc = [...actives].sort((a, b) => a.remaining - b.remaining);
  const survivors = byRemainingAsc.slice(-limit);
  return survivors.sort((a, b) => a.placementTime - b.placementTime);
}
