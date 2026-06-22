import type { Mitigation } from '../types';
import { EXCLUDED_FROM_RECAST_ROW } from './recastRow';

/**
 * カンペ専用で追加で隠すスキル ID。
 * `EXCLUDED_FROM_RECAST_ROW`(常時回すリソース技) とは別枠＝リキャスト行には残すが
 * カンペ(軽減一覧)には出さないもの。
 * - earthly_star (アーサリースター): AST の設置ヒール。軽減ではないためカンペでは雑音。
 */
const CHEATSHEET_ONLY_HIDDEN_IDS: ReadonlySet<string> = new Set([
    'earthly_star',
]);

/**
 * カンペ(軽減カンペ)のアイコン表示から除外するスキル判定。
 *
 * 除外対象:
 * - 挑発(`isTankSwap` マーカー): タンクスイッチ用で軽減効果を持たない
 * - エーテルフロー / アストラルドロー / アンブラルドロー: 常時回す高頻度リソース生成系
 *   (リキャスト行と同じ理由で枠がもったいないため、除外集合 `EXCLUDED_FROM_RECAST_ROW` を再利用)
 *
 * これは「カンペにアイコンを出すか」だけを決める**表示専用**フィルタであり、
 * ダメージ計算(damageMap)や挑発の実効ターゲット計算(swapMarkers)には一切影響しない。
 */
export function isHiddenFromCheatSheet(def: Pick<Mitigation, 'id' | 'isTankSwap'>): boolean {
    return def.isTankSwap === true
        || EXCLUDED_FROM_RECAST_ROW.has(def.id)
        || CHEATSHEET_ONLY_HIDDEN_IDS.has(def.id);
}

/**
 * 置かれた軽減リストから、カンペ表示用に非表示スキル(`isHiddenFromCheatSheet`)を除いたものを返す。
 *
 * カンペ(PipView: PC PiP / スマホ全画面)の表示用フィルタ。除外条件を `isHiddenFromCheatSheet`
 * 一箇所に集約し、ビュー側で個別にハードコードして除外が漏れる(過去 PipView は aetherflow のみ除外
 * していた)のを防ぐ。
 *
 * @param findDef `mitigationId` から定義(`id`/`isTankSwap`)を引く関数。マスター未解決(undefined)は
 *   従来どおり残す(アイコン描画側が `def` 無しを null 表示するため、ここでは落とさない)。
 */
export function filterCheatSheetMitigations<T extends { mitigationId: string }>(
    mitigations: T[],
    findDef: (id: string) => Pick<Mitigation, 'id' | 'isTankSwap'> | undefined,
): T[] {
    return mitigations.filter(m => {
        const def = findDef(m.mitigationId);
        return def ? !isHiddenFromCheatSheet(def) : true;
    });
}
