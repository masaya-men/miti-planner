// スプシ表示のリキャスト線の箱(純粋関数)。描画は SheetCooldownLines.tsx。
// 設計書: docs/superpowers/specs/2026-10-22-spreadsheet-mode-design.md §3.3 / 追記「共有リキャスト」
import type { AppliedMitigation, Mitigation } from '../../../types';
import { getSharedCooldownIds } from '../../../utils/resourceTracker';
import type { RowLayout } from '../rowLayout';
import { SHEET_COL_W, sheetColumnIndex, type SheetColumn } from './sheetColumns';
import { cooldownSpans, cooldownLineBox } from './sheetGeometry';

/** 線の外箱の幅(px)。帯の幅(標準 6px)と同じにし、帯の中心と線の中心をそろえる */
export const SHEET_CD_BOX_W = 6;

export interface SheetCooldownBox {
    key: string;
    left: number;
    top: number;
    height: number;
    /** 線の終わりが本当の終点(maxTime で切っていない)なら true → 終わりの横棒を出す */
    ended: boolean;
    /** 効果時間の帯の下端が線の上端から何 px 下か(帯の幅から線の幅へ細くなる継ぎ目の位置)。自分の列で帯がある時だけ。無ければ 0 */
    joinY: number;
}

/**
 * 線を引く配置 = 表に列がある配置だけ。列が見つからない配置(自動配置の占星術師のドロー等)は押せるマス自体が無いので線も引かない。
 * 「線がある = そのマスは押せない」との一致を保つ(列に描かれる配置は従来どおり autoHidden も含めて全部引く)。
 */
export function placementsWithColumn(
    items: readonly AppliedMitigation[],
    cols: readonly SheetColumn[],
    defs: readonly Mitigation[],
): AppliedMitigation[] {
    return items.filter(am => sheetColumnIndex(cols, am.mitigationId, defs) >= 0);
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
                // 帯(効果時間)のある自分の列: 帯の下端(Timeline の barEndY と同じ bottomOf - 1)で帯の幅から線の幅へつなぐ
                let joinY = 0;
                if (ci === ownCi && ownDef.duration > 1) {
                    const bandBottom = layout.bottomOf(Math.min(am.time + ownDef.duration - 1, maxTime)) - 1;
                    joinY = Math.min(Math.max(0, bandBottom - box.top), box.height);
                }
                boxes.push({
                    key: `${am.id}:${ci}:${si}`,
                    // 線の外箱は SHEET_CD_BOX_W 幅(帯と同じ中心 = 列の中央)。見える幅 4px は CSS の clip-path で出す
                    left: colStart + ci * SHEET_COL_W + SHEET_COL_W / 2 - SHEET_CD_BOX_W / 2,
                    top: box.top,
                    height: box.height,
                    ended: box.ended,
                    joinY,
                });
            });
        }
    }
    return boxes;
}
