import { create } from 'zustand';

/**
 * スマホのボトムナビ「トップ」を、既に `/housing` (探す) にいる状態で再タップしたときに
 * 一覧を先頭までスクロールさせるための一方向シグナル。
 *
 * ナビと一覧グリッド (ListingGrid) は DOM 上で離れているため、ナビ側が `requestScrollTop()`
 * で `tick` を進め、一覧側が `tick` の変化を検知してスクロールコンテナを先頭へ戻す。
 * 値そのものには意味は無い (単調増加のカウンタ)。多くのサイトのボトムナビと同じ挙動。
 */
interface HousingHomeScrollSignalState {
  tick: number;
  requestScrollTop: () => void;
}

export const useHousingHomeScrollSignal = create<HousingHomeScrollSignalState>((set) => ({
  tick: 0,
  requestScrollTop: () => set((s) => ({ tick: s.tick + 1 })),
}));
