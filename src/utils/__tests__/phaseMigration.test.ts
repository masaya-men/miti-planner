import { describe, it, expect } from 'vitest';
import { migratePhases, isLegacyPhaseFormat } from '../phaseMigration';

describe('isLegacyPhaseFormat', () => {
    it('endTimeがありstartTimeがないフェーズを旧形式と判定する', () => {
        const phases = [{ id: 'p1', name: 'Phase 1', endTime: 60 }];
        expect(isLegacyPhaseFormat(phases)).toBe(true);
    });

    it('startTimeがあるフェーズを新形式と判定する', () => {
        const phases = [{ id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 }];
        expect(isLegacyPhaseFormat(phases)).toBe(false);
    });

    it('空配列はfalse', () => {
        expect(isLegacyPhaseFormat([])).toBe(false);
    });
});

describe('migratePhases', () => {
    it('endTimeベースのフェーズをstartTimeベースに変換する', () => {
        const legacy = [
            { id: 'p1', name: 'Phase 1', endTime: 60 },
            { id: 'p2', name: 'Phase 2', endTime: 120 },
        ];
        const result = migratePhases(legacy);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'Phase 1', en: '' }, startTime: 0 });
        expect(result[1]).toEqual({ id: 'p2', name: { ja: 'Phase 2', en: '' }, startTime: 60 });
    });

    it('LocalizedString名のフェーズも正しく変換する', () => {
        const legacy = [
            { id: 'p1', name: { ja: 'フェーズ1', en: 'Phase 1' }, endTime: 30 },
            { id: 'p2', name: { ja: 'フェーズ2', en: 'Phase 2' }, endTime: 90 },
        ];
        const result = migratePhases(legacy);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'フェーズ1', en: 'Phase 1' }, startTime: 0 });
        expect(result[1]).toEqual({ id: 'p2', name: { ja: 'フェーズ2', en: 'Phase 2' }, startTime: 30 });
    });

    it('フェーズが1つの場合、startTime=0に変換する', () => {
        const legacy = [{ id: 'p1', name: 'Only Phase', endTime: 300 }];
        const result = migratePhases(legacy);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'Only Phase', en: '' }, startTime: 0 });
    });

    it('[object Object]混入データをクリーニングする', () => {
        const legacy = [{ id: 'p1', name: 'Phase 1\n[object Object]', endTime: 60 }];
        const result = migratePhases(legacy);
        expect(result[0].name).toEqual({ ja: 'Phase 1', en: '' });
    });

    it('新形式のデータはそのまま返す', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
        ];
        const result = migratePhases(newFormat);
        expect(result).toEqual(newFormat);
    });

    it('空配列は空配列を返す', () => {
        expect(migratePhases([])).toEqual([]);
    });
});
