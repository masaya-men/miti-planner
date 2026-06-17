import { describe, it, expect, vi } from 'vitest';

vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: { getState: () => ({ skills: null, stats: null, config: null }) },
}));

import { validateMitigationPlacement } from '../resourceTracker';
import { MITIGATIONS } from '../../data/mockData';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { AppliedMitigation } from '../../types';

const tStub = (key: string, options?: unknown) => {
    if (typeof options === 'string') return options;
    if (options && typeof options === 'object' && 'defaultValue' in options) {
        return String((options as { defaultValue: unknown }).defaultValue);
    }
    return key;
};
const reprisal = MITIGATIONS.find(m => m.id === 'reprisal_war')!; // recast 60
function ap(id: string, time: number): AppliedMitigation {
    return { id, mitigationId: 'reprisal_war', time, duration: 15, ownerId: 'm1' };
}

describe('forward 競合(既存CD中に重ねる)', () => {
    it('クリック配置: 置ける(available:false だが conflictOverride:true)', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [ap('a', 60)];          // 1:00 使用 → CD 2:00 まで
        const r = validateMitigationPlacement(reprisal, 90, applied, tStub); // 1:30
        expect(r.available).toBe(false);        // 赤の見た目は維持
        expect(r.conflictOverride).toBe(true);  // クリックは解放
    });

    it('ドラッグ(ignoreInstanceId 指定): 警告つきで許可(2026-06-17 方針転換・ALLOW_DRAG_INTO_CONFLICT=true)', () => {
        // 持続する脈動+画面外シェブロンで気づけるため、ドラッグも competing 位置へ置けるように統一。
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [ap('a', 60), ap('dragging', 90)];
        const r = validateMitigationPlacement(reprisal, 90, applied, tStub, 'dragging');
        expect(r.available).toBe(true);
        expect(r.warning).toBe(true);
    });
});
