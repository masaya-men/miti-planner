// スプシ表示のリキャスト線(中立色の縦線。色は sheet.css の --sheet-cd トークン)。1 メンバーぶん、配置 1 件ごとに列の中央へ描く。
// 線を引く規則(線と「押せない」の一致)は sheetCooldown.ts の sheetCooldownBoxes。
import React from 'react';
import type { AppliedMitigation, Mitigation } from '../../../types';
import type { RowLayout } from '../rowLayout';
import type { SheetColumn } from './sheetColumns';
import { sheetCooldownBoxes, SHEET_CD_BOX_W } from './sheetCooldown';

interface Props {
    items: readonly AppliedMitigation[];
    ownerUses: readonly AppliedMitigation[];
    cols: readonly SheetColumn[];
    defs: readonly Mitigation[];
    colStart: number;
    layout: RowLayout;
    maxTime: number;
    isRowVisible: (t: number) => boolean;
    /** memberLayout 未計測の 1 フレームは隠す(MitigationItem の layoutReady と同じ) */
    layoutReady: boolean;
}

/** 線の見える形。joinY より上は切り(帯の下に隠れる部分)、joinY から 4px かけて 6px 幅 → 4px 幅に細くする。joinY = 0(帯なし)は最初から 4px 幅 */
export function cdClipPath(joinY: number): string {
    if (joinY <= 0) return 'polygon(1px 0, calc(100% - 1px) 0, calc(100% - 1px) 100%, 1px 100%)';
    const j = `${joinY}px`;
    const j2 = `${joinY + 4}px`;
    return `polygon(0 ${j}, 100% ${j}, calc(100% - 1px) ${j2}, calc(100% - 1px) 100%, 1px 100%, 1px ${j2})`;
}

/** 1 メンバーぶんのリキャスト線。見える幅 4px・中立色の実線・終わりに横棒(色は sheet.css のトークン) */
export const SheetCooldownLines: React.FC<Props> = ({ items, ownerUses, cols, defs, colStart, layout, maxTime, isRowVisible, layoutReady }) => {
    const boxes = sheetCooldownBoxes(items, ownerUses, cols, defs, colStart, layout, maxTime, isRowVisible);
    return (
        <>
            {boxes.map(b => (
                <div
                    key={b.key}
                    data-mit-cd-box=""
                    className="absolute pointer-events-none"
                    style={{ left: b.left, top: b.top, width: SHEET_CD_BOX_W, height: b.height, visibility: layoutReady ? undefined : 'hidden' }}
                >
                    {/* 線本体: 外箱は 6px(帯と同じ幅・同じ中心)。clip-path で、帯の下端(joinY)から 4px 幅へ細くなる */}
                    <div
                        data-mit-cd=""
                        className="absolute inset-0"
                        style={{ clipPath: cdClipPath(b.joinY) }}
                    />
                    {b.ended && <div data-mit-cd-end="" className="absolute" />}
                </div>
            ))}
        </>
    );
};
