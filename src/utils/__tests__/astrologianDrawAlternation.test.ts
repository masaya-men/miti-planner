import { describe, it, expect, vi } from 'vitest';

vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: {
        getState: () => ({ skills: null, stats: null, config: null }),
    },
}));

import { validateMitigationPlacement } from '../resourceTracker';
import { MITIGATIONS } from '../../data/mockData';
import type { AppliedMitigation } from '../../types';

const tStub = (key: string, options?: unknown) => {
    if (typeof options === 'string') return options;
    if (options && typeof options === 'object' && 'defaultValue' in options) {
        return String((options as { defaultValue: unknown }).defaultValue);
    }
    return key;
};

const astralDraw = MITIGATIONS.find(m => m.id === 'astral_draw')!;
const umbralDraw = MITIGATIONS.find(m => m.id === 'umbral_draw')!;

function makeApplied(id: string, time: number): AppliedMitigation {
    return {
        id: `inst_${id}_${time}`,
        mitigationId: id,
        time,
        duration: 1,
        ownerId: 'ast_1',
    };
}

describe('AST ドロー交互制約', () => {
    it('直前が Astral のとき Astral は配置不可', () => {
        const applied = [makeApplied('astral_draw', -3)];
        const result = validateMitigationPlacement(astralDraw, 30, applied, tStub);
        expect(result.available).toBe(false);
    });

    it('直前が Astral のとき Umbral は配置可', () => {
        const applied = [makeApplied('astral_draw', -3)];
        const result = validateMitigationPlacement(umbralDraw, 30, applied, tStub);
        expect(result.available).toBe(true);
    });

    it('直前が Umbral のとき Astral は配置可', () => {
        const applied = [
            makeApplied('astral_draw', -3),
            makeApplied('umbral_draw', 9),
        ];
        const result = validateMitigationPlacement(astralDraw, 65, applied, tStub);
        expect(result.available).toBe(true);
    });

    it('履歴空のとき Astral は配置可 (初手 / 異常時 safety net)', () => {
        const result = validateMitigationPlacement(astralDraw, 0, [], tStub);
        expect(result.available).toBe(true);
    });

    it('履歴空のとき Umbral も配置可 (異常時 safety net)', () => {
        const result = validateMitigationPlacement(umbralDraw, 0, [], tStub);
        expect(result.available).toBe(true);
    });

    it('自身の編集時は ignoreInstanceId で除外され、 直前種別で判定される', () => {
        const existing = makeApplied('astral_draw', 65);
        const applied = [
            makeApplied('astral_draw', -3),
            makeApplied('umbral_draw', 9),
            existing,
        ];
        // ignoreInstanceId で自身を除外 → 直前は Umbral (9s) → Astral 配置可
        const result = validateMitigationPlacement(astralDraw, 65, applied, tStub, existing.id);
        expect(result.available).toBe(true);
    });
});
