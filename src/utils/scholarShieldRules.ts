import type { Mitigation, AppliedMitigation } from '../types';

/**
 * セラフィズム発動中に鼓舞激励の策/意気軒高の策が自動的に変化する先。
 * 公式ジョブガイド確認済み(2026-08-08): セラフィズムは鼓舞激励の策をマニフェステーションに、
 * 意気軒高の策をアクセッションに変える。
 */
const SERAPHISM_TRANSFORMS: Record<string, string> = {
    adloquium: 'manifestation',
    concitation: 'accession',
};

/**
 * 指定時刻にセラフィズムが有効なら、鼓舞激励の策/意気軒高の策をマニフェステーション/
 * アクセッションの定義に置き換える。対象外の技や、セラフィズムが有効でない場合はそのまま返す。
 *
 * ownerMitigations は呼び出し側で「このスキルの持ち主」1人分に絞り込んだ配列を渡すこと
 * (セラフィズムは学者本人にしか発動しない自己バフのため)。
 */
export function resolveSeraphismMitigation(
    mit: Mitigation,
    time: number,
    ownerMitigations: readonly AppliedMitigation[],
    allMitigations: readonly Mitigation[],
): Mitigation {
    const transformedId = SERAPHISM_TRANSFORMS[mit.id];
    if (!transformedId) return mit;

    const isSeraphismActive = ownerMitigations.some(am =>
        am.mitigationId === 'seraphism' && time >= am.time && time < am.time + am.duration
    );
    if (!isSeraphismActive) return mit;

    return allMitigations.find(d => d.id === transformedId) ?? mit;
}

/**
 * 展開戦術等の copiesShield 判定: コピー元候補が copiesShield の id と一致するか。
 * 鼓舞激励の策(adloquium)はセラフィズム中にマニフェステーションへ変化するため、
 * 展開戦術のコピー元候補にはマニフェステーションも含める(公式確認済み: 両方とも
 * 「鼓舞」状態を付与するため展開戦術の対象になる)。
 */
export function matchesCopiesShieldSource(candidateMitigationId: string, copiesShield: string): boolean {
    if (candidateMitigationId === copiesShield) return true;
    if (copiesShield === 'adloquium' && candidateMitigationId === 'manifestation') return true;
    return false;
}

/**
 * 秘策(Recitation)が確定クリティカルを保証する対象技の id 一覧。
 * 公式ジョブガイド確認済み(2026-08-08): 鼓舞激励の策・意気軒高の策(旧: 士気高揚の策)・
 * 不撓不屈の策・深謀遠慮が対象。マニフェステーション/アクセッションは明記されておらず対象外。
 * 不撓不屈の策・深謀遠慮はバリア技ではない(isShield: false)ため、このバリア用チェックの
 * 呼び出し元には元々渡ってこない。
 */
const RECITATION_CRIT_ELIGIBLE_IDS = new Set(['adloquium', 'concitation', 'succor']);

export function isRecitationCritEligible(mitigationId: string): boolean {
    return RECITATION_CRIT_ELIGIBLE_IDS.has(mitigationId);
}

/**
 * バリアの回復魔力(ポテンシー)倍率対応チェック: 確定クリティカルや回復効果アップ(受ける回復効果+n%等)
 * は、回復魔力から算出するバリア(valueType: 'potency')にしか乗らない。「最大HPの◯%」のような
 * 固定計算のバリア(valueType: 'hp'、ブラックナイト・ディヴァインヴェール・シェイクオフ等)は
 * 回復魔力の計算式を経由しないため、これらの倍率は乗らない。
 * 2026-08-26 網羅調査で確認済み: 海外攻略サイトでも「戦士のシェイクオフには乗らないが、
 * 賢者のエウクラシア・ディアグノシスには乗る」と明記されている。
 */
export function isPotencyBasedShield(mit: Pick<Mitigation, 'isShield' | 'valueType'>): boolean {
    return !!mit.isShield && mit.valueType === 'potency';
}
