import { useMemo } from 'react';
import type { MockListing } from '../../data/housing/mockListings';
import { resolveTourSteps, computeTourProgress, type TourStep, type TourProgress } from './tourNav';
import { resolveWardMapRef } from './resolveWardMapRef';
import { getPlotDirections, type PlotDirections } from './wardDirections';
import { useWardMapAsset, type WardMapAssetState } from './useWardMapAsset';
import { buildTourMapPlacements, type TourMapModel } from './buildTourMapPlacements';
import { crossingBetween, firstDestination, type TourCrossing } from './tourCrossing';

export interface TourRenderModel {
  steps: TourStep[];
  progress: TourProgress;
  nextStep: TourStep | null;
  prevStep: TourStep | null;
  currentListing: MockListing | null;
  directions: PlotDirections | null;
  crossing: TourCrossing;
  mapRef: ReturnType<typeof resolveWardMapRef>;
  asset: WardMapAssetState;
  mapModel: TourMapModel | null;
  mapStatus: 'none' | 'loading' | 'ready' | 'error';
  originName: string | null;
}

/**
 * ツアーの描画に必要な派生データ一式を組み立てる共有フック(Task 2.4)。
 *
 * 元々 TourNavPage(幹事)に直書きされていた派生 orchestration をそのまま抽出したもの
 * (ロジックの新規実装はしていない・既存 lib 関数の呼び出し列を移しただけ)。
 * pool(=解決済み listing 一覧)・orderedIds(=ツアー順の listing id 列)・currentIndex を渡すと、
 * ステップ/進捗/次の目的地/前の目的地/地図モデルまで一括で解決する。
 *
 * `buildTourPool` は幹事専用の store 合流ロジックのためこのフックには含めない(呼び出し側が
 * pool を用意して渡す)。
 */
export function useTourRenderModel(
  pool: MockListing[],
  orderedIds: string[],
  currentIndex: number,
): TourRenderModel {
  const steps = useMemo(() => resolveTourSteps(orderedIds, pool), [orderedIds, pool]);
  const progress = useMemo(
    () => computeTourProgress(steps, currentIndex),
    [steps, currentIndex],
  );

  // 次の目的地(左パネルの生きたカード用) / 前の目的地(跨ぎ判定用)。
  const nextStep = useMemo(
    () => (currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null),
    [steps, currentIndex],
  );
  const prevStep = useMemo(
    () => (currentIndex - 1 >= 0 ? steps[currentIndex - 1] : null),
    [steps, currentIndex],
  );

  // 地図 (全5エリア対応): 現在の目的地の住所 → 表示すべきワード地図 mapKey を解決し、
  // そのマップだけ遅延ロード。ready になったら実エーテライト起点→家のゴージャス経路モデルを組む。
  const currentListing = progress.currentStep?.listing ?? null;
  const directions = useMemo(
    () => getPlotDirections(currentListing?.area ?? '', currentListing?.plot),
    [currentListing],
  );
  // 前の家→この家の移動種別(DC/ワールド跨ぎ)。行き方枠(右パネル)+中央マップのぼかし案内へ渡す。
  // 1件目(currentIndex===0)は前の家が無いので跨ぎ判定できない → まずどこへ向かうかの出発案内を出す(#2)。
  const crossing: TourCrossing = useMemo(() => {
    if (!currentListing) return { kind: 'none' };
    if (currentIndex === 0) return firstDestination(currentListing);
    return crossingBetween(prevStep?.listing ?? null, currentListing);
  }, [prevStep, currentListing, currentIndex]);
  const mapRef = useMemo(
    () =>
      currentListing
        ? resolveWardMapRef(
            currentListing.area ?? '',
            currentListing.plot ?? null,
            currentListing.apartmentBuilding ?? null,
            currentListing.buildingType,
          )
        : null,
    [currentListing],
  );
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);
  const mapModel = useMemo(
    () =>
      asset.status === 'ready' && mapRef
        ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, currentListing, steps, currentIndex)
        : null,
    [asset, mapRef, currentListing, steps, currentIndex],
  );
  const mapStatus: 'none' | 'loading' | 'ready' | 'error' = !mapRef
    ? 'none'
    : asset.status === 'ready'
      ? 'ready'
      : asset.status === 'error'
        ? 'error'
        : 'loading';

  // 名前ラベルの源: 家は正典 directions.aetheryte、アパートは plot が無く directions が引けないため
  // 起点解決済みの mapModel.originName にフォールバック(マーカーと同じ最寄りエーテライト名)。
  const originName = directions?.aetheryte ?? mapModel?.originName ?? null;

  return {
    steps, progress, nextStep, prevStep, currentListing,
    directions, crossing, mapRef, asset, mapModel, mapStatus, originName,
  };
}
