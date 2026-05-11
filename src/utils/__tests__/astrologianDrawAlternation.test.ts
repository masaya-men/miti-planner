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
const theArrow = MITIGATIONS.find(m => m.id === 'the_arrow')!;
const theBole = MITIGATIONS.find(m => m.id === 'the_bole')!;

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

describe('AST カード単発使用制約 (ドローセッション内 1 回)', () => {
    it('Astral 直後に The Arrow 配置可', () => {
        const applied = [makeApplied('astral_draw', -3)];
        const result = validateMitigationPlacement(theArrow, 5, applied, tStub);
        expect(result.available).toBe(true);
    });

    it('同 Astral セッション内で The Arrow 再使用は不可', () => {
        const applied = [
            makeApplied('astral_draw', -3),
            makeApplied('the_arrow', 5),
        ];
        const result = validateMitigationPlacement(theArrow, 30, applied, tStub);
        expect(result.available).toBe(false);
    });

    it('Umbral 後 → Astral 切替で The Arrow リセット可能', () => {
        const applied = [
            makeApplied('astral_draw', -3),
            makeApplied('the_arrow', 5),
            makeApplied('umbral_draw', 9),
            makeApplied('astral_draw', 65),
        ];
        const result = validateMitigationPlacement(theArrow, 70, applied, tStub);
        expect(result.available).toBe(true);
    });

    it('Umbral カード (The Bole) は Astral 中は使えない', () => {
        const applied = [makeApplied('astral_draw', -3)];
        const result = validateMitigationPlacement(theBole, 5, applied, tStub);
        expect(result.available).toBe(false);
    });

    it('Umbral 直後の The Bole 単発使用可', () => {
        const applied = [
            makeApplied('astral_draw', -3),
            makeApplied('umbral_draw', 9),
        ];
        const result = validateMitigationPlacement(theBole, 15, applied, tStub);
        expect(result.available).toBe(true);
    });
});
