import { genId } from '../../../utils/genId';
import type { Mitigation, AppliedMitigation } from '../../../types';
import { validateMitigationPlacement } from '../../../utils/resourceTracker';
import { resolveMitigationTap } from '../../../utils/mitigationTapResolver';

/** スプシモードで列のマスをクリックしたときの結果(純粋判定) */
export type SheetTapResult =
  | { kind: 'remove'; id: string }
  | { kind: 'place'; linkedMitigationId?: string; warning?: string }
  | { kind: 'blocked'; message?: string }
  | { kind: 'selectTarget' }
  | { kind: 'selectShield'; shields: AppliedMitigation[] };


/**
 * クリック → 消す / 弾く / 対象選択 / 鼓舞選択 / 置く(警告つき含む)の判定。
 * 通常表示の MitigationSelector.handleMitigationClick と同じ順序・同じ判定部品を使う。
 */
export function resolveSheetTap(
  def: Mitigation,
  time: number,
  ownerMitigations: AppliedMitigation[],
  allMitigations: AppliedMitigation[],
  t: (k: string, o?: object) => string,
): SheetTapResult {
  const existing = ownerMitigations.find(am => am.mitigationId === def.id && am.time === time);
  if (existing) return { kind: 'remove', id: existing.id };

  const status = validateMitigationPlacement(def, time, ownerMitigations, t);
  // 前方のリキャスト中(conflictOverride)はレーン表示と同じく置ける。重なりは競合のシェブロン・脈動が知らせる
  if (!status.available && !status.conflictOverride) return { kind: 'blocked', message: status.message };

  const r = resolveMitigationTap(def, time, allMitigations);
  if (r.kind === 'place') {
    return {
      kind: 'place',
      ...(r.linkedMitigationId ? { linkedMitigationId: r.linkedMitigationId } : {}),
      ...((status.warning || status.conflictOverride) && status.message ? { warning: status.message } : {}),
    };
  }
  return r;
}

/** 配置データを作る(Timeline.handleMitigationSelect と同じ形) */
export function buildAppliedMitigation(
  def: Mitigation,
  time: number,
  ownerId: string,
  extra?: { targetId?: string; linkedMitigationId?: string },
): AppliedMitigation {
  return {
    id: genId(),
    mitigationId: def.id,
    time,
    duration: def.duration,
    ownerId,
    targetId: extra?.targetId,
    linkedMitigationId: extra?.linkedMitigationId,
  };
}
