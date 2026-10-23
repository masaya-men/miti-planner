import { describe, it, expect } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

describe('罫線の設定はふつう表示とスプシ表示で別', () => {
  it('スプシ側の既定は ON、ふつう側は OFF のまま', () => {
    const s = useMitigationStore.getState();
    expect(s.sheetRowBorders).toBe(true);
    expect(s.showRowBorders).toBe(false);
  });
  it('スプシ側を切り替えてもふつう側は変わらない(逆も同じ)', () => {
    useMitigationStore.getState().setSheetRowBorders(false);
    expect(useMitigationStore.getState().sheetRowBorders).toBe(false);
    expect(useMitigationStore.getState().showRowBorders).toBe(false);
    useMitigationStore.getState().setShowRowBorders(true);
    expect(useMitigationStore.getState().sheetRowBorders).toBe(false);
    useMitigationStore.getState().setShowRowBorders(false);
    useMitigationStore.getState().setSheetRowBorders(true);
  });
});
