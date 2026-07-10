import { HOUSING_AREAS, type HousingArea, type HousingSize } from '../../types/housing.js';
import { PLOT_RANGE } from '../../constants/housing.js';

/**
 * (エリア × 区画番号) → ハウス区画サイズ (S/M/L) の対応表。
 *
 * ## 出典と検証 (2026-07-10 確定)
 * - **一次データ**: xivapi `ffxiv-datamining` の `csv/en/HousingLandSet.csv`。
 *   ゲーム内部シートで `LandSet[0..59].PlotSize` (0=S / 1=M / 2=L) を持つ。
 * - **独立検証**: 本リポジトリの `*Ward.generated.json` / `*SubWard.generated.json` の
 *   `houses[].outline` を靴紐公式で面積計算すると S≈11.1k / M≈20.0k / L≈35.5k の
 *   3 クラスタに完全分離 (中間値ゼロ)。CSV と **300/300 一致**。
 * - **S/M/L の向き**は `InitialPrice` で確定 (S=300〜375 万 / M=1600〜2000 万 / L=4000〜5000 万、 重複ゼロ)。
 * - 詳細な調査ログ = `docs/.private/2026-07-10-plot-size-table-and-address-v2.md`
 *
 * ## 構造上の事実 (テストで不変条件として固定)
 * - エリアごとに並びが違う (5 本の表が必要)。
 * - 各エリア内で 本街 (plot 1-30) と 拡張街 (plot 31-60) は完全一致 (拡張街は本街のコピー)。
 * - 構成比は全エリア一律で 60 区画あたり 40 S / 14 M / 6 L。
 *
 * ## 適用範囲
 * - 対象は `buildingType === 'house'` のみ。`apartment` は size を持たない
 *   (`validateAddress` が `not_allowed_for_apartment` を返す)。
 * - FC 個室 (`roomKind === 'private_chamber'`) は**親 plot のサイズ**に従うので、
 *   同じ `getPlotSize(area, plot)` でそのまま引ける。
 * - 将来のパッチで区画構成が変わったら上記 CSV を再取得して本ファイルを更新すること。
 */

/** index 0 = plot 1 ... index 59 = plot 60。 */
const PLOT_SIZE_BY_AREA: Record<HousingArea, string> = {
    Mist: 'MLSMLMMSSSSSSMLSSSSSSSSSSSSSMMMLSMLMMSSSSSSMLSSSSSSSSSSSSSMM',
    LavenderBeds: 'MSLSMLSSSSMSSSSMSSSSMSSSSSMLSMMSLSMLSSSSMSSSSMSSSSMSSSSSMLSM',
    Goblet: 'SSSMLMSMSSMMLSSSSSMSSSSSMSSSSLSSSMLMSMSSMMLSSSSSMSSSSSMSSSSL',
    Shirogane: 'MSSSSSLMSSSSMSMLSSMSSSSMSSSMSLMSSSSSLMSSSSMSMLSSMSSSSMSSSMSL',
    Empyreum: 'SMSSSSMMSSSLSSSSMMSSMLSSSMSSSLSMSSSSMMSSSLSSSSMMSSMLSSSMSSSL',
};

/**
 * 区画のサイズを返す。エリアが不正 / plot が 1-60 の外なら `null`。
 *
 * @param area  ハウジングエリア (`HOUSING_AREAS`)
 * @param plot  区画番号 (1-60 の通し番号。 1-30=本街 / 31-60=拡張街)
 */
export function getPlotSize(area: string, plot: number): HousingSize | null {
    if (!(HOUSING_AREAS as readonly string[]).includes(area)) return null;
    if (!Number.isInteger(plot) || plot < PLOT_RANGE.min || plot > PLOT_RANGE.max) return null;
    return PLOT_SIZE_BY_AREA[area as HousingArea][plot - 1] as HousingSize;
}

/** テスト / 検証用に生の 60 文字テーブルを公開する (アプリコードは `getPlotSize` を使うこと)。 */
export const PLOT_SIZE_TABLE: Readonly<Record<HousingArea, string>> = PLOT_SIZE_BY_AREA;
