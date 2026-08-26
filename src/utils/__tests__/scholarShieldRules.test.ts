import { describe, it, expect } from 'vitest';
import {
    resolveSeraphismMitigation,
    matchesCopiesShieldSource,
    isRecitationCritEligible,
    isPotencyBasedShield,
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

// 2026-08-26 網羅調査(回帰): 確定クリティカル・回復効果アップは「回復魔力から算出するバリア」
// (valueType: 'potency') にしか乗らない。「最大HPの◯%」の固定計算バリア(valueType: 'hp') には
// 乗らない。8.0以降の新規バリア技追加時も、この判定はvalueTypeを見るだけで自動的に正しくなる。
describe('isPotencyBasedShield', () => {
    // 最大HPの◯%で決まる固定バリア(回復魔力計算を経由しない) = 回復効果アップ・確定クリは乗らない
    const flatHpShieldIds = [
        'divine_veil', 'tempera_grassa', 'the_blackest_night',
        'arcane_crest', 'shake_it_off', 'improvisation',
    ];

    it.each(flatHpShieldIds)('%s (最大HP%%固定) は false', (id) => {
        const mit = MITIGATIONS.find(m => m.id === id);
        expect(mit).toBeTruthy();
        expect(mit!.isShield).toBe(true);
        expect(mit!.valueType).toBe('hp');
        expect(isPotencyBasedShield(mit!)).toBe(false);
    });

    // 回復魔力(ポテンシー)から算出するバリア = 回復効果アップ・確定クリが乗る
    const potencyShieldIds = [
        'adloquium', 'manifestation', 'concitation', 'succor', 'accession', 'consolation',
        'eukrasian_prognosis_ii', 'eukrasian_prognosis', 'holos', 'panhaima', 'haima', 'eukrasian_diagnosis',
        'helios_conjunction', 'aspected_helios', 'celestial_intersection', 'the_spire',
        'bloodwhetting', 'nascent_flash', 'divine_caress', 'divine_benison',
    ];

    it.each(potencyShieldIds)('%s (回復魔力計算) は true', (id) => {
        const mit = MITIGATIONS.find(m => m.id === id);
        expect(mit).toBeTruthy();
        expect(mit!.isShield).toBe(true);
        expect(mit!.valueType).toBe('potency');
        expect(isPotencyBasedShield(mit!)).toBe(true);
    });

    it('バリア技ではない(isShield:false)技は false', () => {
        const reprisal = MITIGATIONS.find(m => m.id.startsWith('reprisal_'));
        expect(reprisal).toBeTruthy();
        expect(isPotencyBasedShield(reprisal!)).toBe(false);
    });

    it('MITIGATIONS内の isShield:true 全件が hp/potency のどちらかに分類され、判定結果と矛盾しない(将来の追加漏れ検知用)', () => {
        const copiesShieldIds = new Set(['deployment_tactics', 'deployment_tactics_base']);
        const shields = MITIGATIONS.filter(m => m.isShield && !copiesShieldIds.has(m.id));
        expect(shields.length).toBeGreaterThan(0);
        for (const mit of shields) {
            expect(mit.valueType, `${mit.id} は isShield:true なのに valueType が未設定`).toBeDefined();
            expect(isPotencyBasedShield(mit)).toBe(mit.valueType === 'potency');
        }
    });
});
