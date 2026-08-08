import { describe, it, expect } from 'vitest';
import {
    resolveSeraphismMitigation,
    matchesCopiesShieldSource,
    isRecitationCritEligible,
} from '../scholarShieldRules';
import { MITIGATIONS } from '../../data/mockData';
import type { AppliedMitigation } from '../../types';

const adloquium = MITIGATIONS.find(m => m.id === 'adloquium')!;
const concitation = MITIGATIONS.find(m => m.id === 'concitation')!;
const manifestation = MITIGATIONS.find(m => m.id === 'manifestation')!;
const accession = MITIGATIONS.find(m => m.id === 'accession')!;
const aetherflow = MITIGATIONS.find(m => m.id === 'aetherflow')!;

function seraphism(time: number, duration = 20): AppliedMitigation {
    return { id: 's1', mitigationId: 'seraphism', time, duration, ownerId: 'H1' };
}

describe('resolveSeraphismMitigation', () => {
    it('セラフィズムと無関係な技はそのまま返す', () => {
        const result = resolveSeraphismMitigation(aetherflow, 10, [seraphism(0)], MITIGATIONS);
        expect(result).toBe(aetherflow);
    });

    it('セラフィズムが有効でなければ鼓舞激励の策はそのまま返す', () => {
        const result = resolveSeraphismMitigation(adloquium, 10, [], MITIGATIONS);
        expect(result).toBe(adloquium);
    });

    it('セラフィズムの窓の外(終了後)なら鼓舞激励の策はそのまま返す', () => {
        const result = resolveSeraphismMitigation(adloquium, 25, [seraphism(0, 20)], MITIGATIONS);
        expect(result).toBe(adloquium);
    });

    it('セラフィズム有効中の鼓舞激励の策はマニフェステーションに変わる', () => {
        const result = resolveSeraphismMitigation(adloquium, 10, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('manifestation');
        expect(result).toBe(manifestation);
    });

    it('セラフィズム有効中の意気軒高の策はアクセッションに変わる', () => {
        const result = resolveSeraphismMitigation(concitation, 10, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('accession');
        expect(result).toBe(accession);
    });

    it('セラフィズム発動と同時刻(境界)は有効とみなす', () => {
        const result = resolveSeraphismMitigation(adloquium, 0, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('manifestation');
    });

    it('セラフィズム終了ちょうど(境界)は無効とみなす', () => {
        const result = resolveSeraphismMitigation(adloquium, 20, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('adloquium');
    });
});

describe('matchesCopiesShieldSource', () => {
    it('完全一致は true', () => {
        expect(matchesCopiesShieldSource('adloquium', 'adloquium')).toBe(true);
    });

    it('展開戦術(copiesShield=adloquium)はマニフェステーションも候補に含む', () => {
        expect(matchesCopiesShieldSource('manifestation', 'adloquium')).toBe(true);
    });

    it('無関係な組み合わせは false', () => {
        expect(matchesCopiesShieldSource('concitation', 'adloquium')).toBe(false);
        expect(matchesCopiesShieldSource('accession', 'adloquium')).toBe(false);
    });
});

describe('isRecitationCritEligible', () => {
    it('鼓舞激励の策・意気軒高の策・士気高揚の策は対象', () => {
        expect(isRecitationCritEligible('adloquium')).toBe(true);
        expect(isRecitationCritEligible('concitation')).toBe(true);
        expect(isRecitationCritEligible('succor')).toBe(true);
    });

    it('マニフェステーション・アクセッション・コンソレイションは対象外', () => {
        expect(isRecitationCritEligible('manifestation')).toBe(false);
        expect(isRecitationCritEligible('accession')).toBe(false);
        expect(isRecitationCritEligible('consolation')).toBe(false);
    });
});
