import type { Mitigation } from '../../../types';
import { chargeStateAt } from '../../../utils/resourceTracker';
import { barStartY, type RowLayout } from '../rowLayout';
import { SHEET_COL_W, SHEET_ICON_PX } from './sheetColumns';

/**
 * スプシモードの座標・リキャスト線の区間(純粋関数)。
 * 設計書: docs/superpowers/specs/2026-10-22-spreadsheet-mode-design.md §3.3
 */

/** 列の中に置いたアイコンの左端(列の中で左右中央) */
export function sheetIconLeft(
  colStart: number,
  colIndex: number,
  colW: number = SHEET_COL_W,
  iconPx: number = SHEET_ICON_PX,
): number {
  return colStart + colIndex * colW + (colW - iconPx) / 2;
}

/**
 * placedTime に置いた 1 件が引くリキャスト線の秒区間 [開始, 終了] の一覧。
 * `uses` = 同 owner・同共有リキャスト群(getSharedCooldownIds)の配置秒(placedTime を含む)。
 *
 * - 非チャージ技: 帯の終点の秒(placedTime + max(1, duration) − 1)から placedTime + recast まで。recast<=0 は線なし。
 * - チャージ技(recast 方式): validateMitigationPlacement と同じ充電シミュレーション(chargeStateAt)で、
 *   placedTime の使用で残り 0 になった瞬間 → 次の 1 チャージが回復する秒まで。0 にならなければ線なし。
 * - チャージ技(requires 窓方式): 線なし(リキャスト概念がない)。
 */
export function cooldownSpans(def: Mitigation, uses: readonly number[], placedTime: number): [number, number][] {
  if (!def.recast || def.recast <= 0) return [];

  if (def.maxCharges) {
    if (def.requires) return [];
    const { charges, rechargeTimer } = chargeStateAt(def, uses, placedTime);
    if (charges > 0) return [];
    return [[placedTime, placedTime + def.recast - rechargeTimer]];
  }

  return [[placedTime + Math.max(1, def.duration) - 1, placedTime + def.recast]];
}

/**
 * リキャスト線の縦位置。始点 = barStartY(span 開始の秒)、終点 = min(span 終了, maxTime) の秒の行の中央。
 * 空の行を隠す設定で終点の秒が隠れていれば、効果時間の帯(Timeline の effectiveEndTime)と同じく
 * 「終点以下・始点以上で最大の可視秒」に切り詰める(見つからなければ始点の秒)。
 * isRowVisible は隠さない設定なら常に true を返す関数を渡す。高さ 0 以下は null(描かない)。
 */
export function cooldownLineBox(
  layout: RowLayout,
  span: [number, number],
  maxTime: number,
  isRowVisible: (t: number) => boolean,
): { top: number; height: number } | null {
  const [start, rawEnd] = span;
  const end = Math.min(rawEnd, maxTime);
  let endTime = start;
  for (let t = end; t >= start; t--) {
    if (isRowVisible(t)) {
      endTime = t;
      break;
    }
  }
  const top = barStartY(layout, start);
  const height = layout.topOf(endTime) + layout.unitPx / 2 - top;
  if (height <= 0) return null;
  return { top, height };
}
