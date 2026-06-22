import type { Mitigation } from '../types';
import { EXCLUDED_FROM_RECAST_ROW } from './recastRow';

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
    return def.isTankSwap === true || EXCLUDED_FROM_RECAST_ROW.has(def.id);
}
