// スプシ表示のメンバー要素(列数 n 本ぶんの幅)の style。TimelineRow / JobPickerRow / MilspecJackRow / SheetColumnHeader で共通。
import type { CSSProperties } from 'react';

/** 列数 n → 幅の式。n = 0(技が無いジョブ・未設定)は 1 列ぶんの空き。 */
export function sheetWidthExpr(n: number): string {
    return n > 0 ? `calc(var(--sheet-col-w) * ${n})` : 'var(--sheet-col-w)';
}

/** メンバー要素の幅 + 左右 padding 0 */
export function sheetMemberStyle(n: number): CSSProperties {
    const w = sheetWidthExpr(n);
    return { width: w, minWidth: w, maxWidth: w, paddingLeft: 0, paddingRight: 0 };
}
