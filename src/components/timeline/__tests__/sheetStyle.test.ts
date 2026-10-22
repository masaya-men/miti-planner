import { describe, it, expect } from 'vitest';
import { sheetWidthExpr, sheetMemberStyle } from '../sheet/sheetStyle';

describe('sheetStyle', () => {
    it('列数 n → 幅の式(0 列は 1 列ぶんの空き)', () => {
        expect(sheetWidthExpr(9)).toBe('calc(var(--sheet-col-w) * 9)');
        expect(sheetWidthExpr(1)).toBe('calc(var(--sheet-col-w) * 1)');
        expect(sheetWidthExpr(0)).toBe('var(--sheet-col-w)');
    });
    it('メンバー要素の style は width/min/max が同じ・padding 0', () => {
        expect(sheetMemberStyle(9)).toEqual({
            width: 'calc(var(--sheet-col-w) * 9)',
            minWidth: 'calc(var(--sheet-col-w) * 9)',
            maxWidth: 'calc(var(--sheet-col-w) * 9)',
            paddingLeft: 0, paddingRight: 0,
        });
    });
});
