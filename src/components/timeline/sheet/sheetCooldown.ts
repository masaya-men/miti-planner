// スプシ表示のリキャスト線の箱(純粋関数)。描画は SheetCooldownLines.tsx。
// 設計書: docs/superpowers/specs/2026-10-22-spreadsheet-mode-design.md §3.3 / 追記「共有リキャスト」
import type { AppliedMitigation, Mitigation } from '../../../types';
import { getSharedCooldownIds } from '../../../utils/resourceTracker';
import type { RowLayout } from '../rowLayout';
import { SHEET_COL_W, sheetColumnIndex, type SheetColumn } from './sheetColumns';
import { cooldownSpans, cooldownLineBox } from './sheetGeometry';

export interface SheetCooldownBox {
    key: string;
    left: number;
    top: number;
    height: number;
}

/**
 * 線の箱を作る(純粋関数)。「線がある = そのマスは押せない(validateMitigationPlacement が弾く)」と一致させる:
 * - 線を引く列 = 置いた技の共有リキャスト群(getSharedCooldownIds)が描かれる列すべて(重複は 1 本)。
 * - 列の技がチャージ技: 判定は同じ id の使用だけで数えるので、同じ id の配置だけが線を引く(同じ id の使用で残り 0 の区間)。
 * - 列の技が非チャージ: 判定は群の直前の使用 + 列の技の recast で弾くので、区間は [置いた秒, 置いた秒 + 列の recast]。
 *   ただし置いた技自身の列は、帯(効果時間)と重ならないよう帯の終点から(cooldownSpans と同じ)。
 * @param items 線を引く配置(仮想アイテム・autoHidden は呼び出し側で除く)
 * @param ownerUses 同じ持ち主の全配置(チャージの充電計算用。判定と同じ母集団)
 */
export function sheetCooldownBoxes(
    items: readonly AppliedMitigation[],
    ownerUses: readonly AppliedMitigation[],
    cols: readonly SheetColumn[],
    defs: readonly Mitigation[],
    colStart: number,
    layout: RowLayout,
    maxTime: number,
    isRowVisible: (t: number) => boolean,
): SheetCooldownBox[] {
    const boxes: SheetCooldownBox[] = [];
    for (const am of items) {
        const ownDef = defs.find(d => d.id === am.mitigationId);
        if (!ownDef) continue;
        const ownCi = sheetColumnIndex(cols, am.mitigationId, defs);
        const seen = new Set<number>();
        for (const id of getSharedCooldownIds(am.mitigationId)) {
            const ci = sheetColumnIndex(cols, id, defs);
            if (ci < 0 || seen.has(ci)) continue;
            seen.add(ci);
            const colDef = cols[ci].def;
            let spans: [number, number][];
            if (colDef.maxCharges) {
                if (colDef.id !== am.mitigationId) continue;
                const uses = ownerUses.filter(u => u.mitigationId === colDef.id).map(u => u.time);
                spans = cooldownSpans(colDef, uses, am.time);
            } else if (colDef.id === am.mitigationId) {
                spans = cooldownSpans(colDef, [], am.time);
            } else {
                if (!colDef.recast || colDef.recast <= 0) continue;
                const start = ci === ownCi ? am.time + Math.max(1, ownDef.duration) - 1 : am.time;
                spans = [[start, am.time + colDef.recast]];
            }
            spans.forEach((span, si) => {
                const box = cooldownLineBox(layout, span, maxTime, isRowVisible);
                if (!box) return;
                boxes.push({
                    key: `${am.id}:${ci}:${si}`,
                    left: colStart + ci * SHEET_COL_W + SHEET_COL_W / 2 - 1,
                    top: box.top,
                    height: box.height,
                });
            });
        }
    }
    return boxes;
}
