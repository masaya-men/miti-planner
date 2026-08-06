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

const feyBlessing = MITIGATIONS.find(m => m.id === 'fey_blessing')!;
const aetherpact = MITIGATIONS.find(m => m.id === 'aetherpact')!;
const feyIllumination = MITIGATIONS.find(m => m.id === 'fey_illumination')!;

function summonSeraph(time: number): AppliedMitigation {
    return { id: 'ss1', mitigationId: 'summon_seraph', time, duration: 22, ownerId: 'm1' };
}

describe('セラフィム召喚中のフェアリー専用技(エオス/セレネ専用)ロックアウト', () => {
    it('フェイブレッシング: セラフィム召喚中は配置不可', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [summonSeraph(0)];
        const r = validateMitigationPlacement(feyBlessing, 10, applied, tStub); // セラフィム窓(0-22s)内
        expect(r.available).toBe(false);
    });

    it('エーテルパクト: セラフィム召喚中は配置不可', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [summonSeraph(0)];
        const r = validateMitigationPlacement(aetherpact, 10, applied, tStub);
        expect(r.available).toBe(false);
    });

    it('フェイブレッシング: セラフィムの窓の外なら配置できる', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [summonSeraph(0)]; // 0-22s のみ有効
        const r = validateMitigationPlacement(feyBlessing, 30, applied, tStub); // 窓の外
        expect(r.available).toBe(true);
    });

    it('フェイイルミネーション: 名称が変わるだけで実際は使えるので、セラフィム召喚中でもブロックしない', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [summonSeraph(0)];
        const r = validateMitigationPlacement(feyIllumination, 10, applied, tStub);
        expect(r.available).toBe(true);
    });
});
