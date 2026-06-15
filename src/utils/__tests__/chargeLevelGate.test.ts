import { describe, it, expect, beforeEach, vi } from 'vitest';

// master data 未ロード時は STATIC_MITIGATIONS(=mockData)へフォールバックさせる
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: {
        getState: () => ({ skills: null, stats: null, config: null }),
    },
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

const divineBenison = MITIGATIONS.find(m => m.id === 'divine_benison')!;
const celestialIntersection = MITIGATIONS.find(m => m.id === 'celestial_intersection')!;
const oblation = MITIGATIONS.find(m => m.id === 'oblation')!; // 比較用: chargeMinLevel 無し

function makeApplied(id: string, time: number): AppliedMitigation {
    return { id: `inst_${id}_${time}`, mitigationId: id, time, duration: 15, ownerId: 'm1' };
}

function setLevel(level: number) {
    useMitigationStore.setState({ currentLevel: level });
}

describe('チャージのレベルゲート (chargeMinLevel)', () => {
    beforeEach(() => setLevel(100));

    it('ディヴァインベニゾン: データに chargeMinLevel=88 を持つ', () => {
        expect(divineBenison.maxCharges).toBe(2);
        expect(divineBenison.chargeMinLevel).toBe(88);
    });

    it('星天交差: データに chargeMinLevel=88 を持つ', () => {
        expect(celestialIntersection.maxCharges).toBe(2);
        expect(celestialIntersection.chargeMinLevel).toBe(88);
    });

    it('Lv88未満(80)では実効1チャージ: 1回使用後はリキャスト内で再配置不可', () => {
        setLevel(80);
        const applied = [makeApplied('divine_benison', 0)]; // recast 30 / duration 15
        // t=20: 直前のバリアは終了(0-15)済で重複なし・リキャスト30未経過
        const r = validateMitigationPlacement(divineBenison, 20, applied, tStub);
        expect(r.available).toBe(false); // 1チャージ消費済→残0
    });

    it('Lv88以上(90)では2チャージ: 1回使用後もリキャスト内で再配置可', () => {
        setLevel(90);
        const applied = [makeApplied('divine_benison', 0)];
        const r = validateMitigationPlacement(divineBenison, 20, applied, tStub);
        expect(r.available).toBe(true); // 2チャージ中1残
    });

    it('星天交差も Lv80 では実効1チャージ', () => {
        setLevel(80);
        const applied = [makeApplied('celestial_intersection', 0)];
        const r = validateMitigationPlacement(celestialIntersection, 20, applied, tStub);
        expect(r.available).toBe(false);
    });

    it('chargeMinLevel を持たないスキル(オブレーション)はレベルに依らず2チャージ', () => {
        setLevel(80);
        const applied = [makeApplied('oblation', 0)];
        const r = validateMitigationPlacement(oblation, 20, applied, tStub);
        expect(r.available).toBe(true); // 2チャージ中1残(レベル非依存)
    });
});
