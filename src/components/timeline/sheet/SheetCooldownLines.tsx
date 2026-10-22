// スプシ表示のリキャスト線(薄赤の縦線)。1 メンバーぶん、配置 1 件ごとに列の中央へ描く。
// 線を引く規則(線と「押せない」の一致)は sheetCooldown.ts の sheetCooldownBoxes。
import React from 'react';
import type { AppliedMitigation, Mitigation } from '../../../types';
import type { RowLayout } from '../rowLayout';
import type { SheetColumn } from './sheetColumns';
import { sheetCooldownBoxes } from './sheetCooldown';

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

/** 1 メンバーぶんのリキャスト線。幅 2px・薄赤(MIL-SPEC は sheet.css が --ma-dng で上書き) */
export const SheetCooldownLines: React.FC<Props> = ({ items, ownerUses, cols, defs, colStart, layout, maxTime, isRowVisible, layoutReady }) => {
    const boxes = sheetCooldownBoxes(items, ownerUses, cols, defs, colStart, layout, maxTime, isRowVisible);
    return (
        <>
            {boxes.map(b => (
                <div
                    key={b.key}
                    data-mit-cd=""
                    className="absolute w-[2px] bg-red-500/45 pointer-events-none"
                    style={{ left: b.left, top: b.top, height: b.height, visibility: layoutReady ? undefined : 'hidden' }}
                />
            ))}
        </>
    );
};
