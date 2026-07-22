import { create } from 'zustand';
import type { BrowseSortOrder } from '../components/housing/browse/BrowseSortSelect';
import type { FavTab } from '../components/housing/favorites/favoritesOrder';
import { generateShuffleSeed } from '../lib/housing/seededShuffle';

export type HousingListKey = 'browse' | 'favorites' | 'housinger';

interface HousingListOrderEntry {
  /** ランダム表示順を決めるシード値。'browse' のみ使用。 */
  seed: number;
  /** 離脱直前のスクロール位置 (px)。3 画面とも使用。 */
  scrollTop: number;
  /** 新着順/古い順/ランダムの選択。'browse'/'housinger' が使用 ('favorites' は未使用)。 */
  sortMode: BrowseSortOrder;
  /** お気に入りのタブ選択。'favorites' のみ使用。 */
  favTab: FavTab;
}

interface HousingListOrderState {
  entries: Record<HousingListKey, HousingListOrderEntry>;
  setScrollTop: (key: HousingListKey, value: number) => void;
  setSortMode: (key: HousingListKey, mode: BrowseSortOrder) => void;
  setFavTab: (key: HousingListKey, tab: FavTab) => void;
  /** ランダム順を再抽選する (シャッフルボタン押下時のみ呼ぶ)。 */
  reshuffle: (key: HousingListKey) => void;
  /** テスト用・および将来のリセット導線用: 全キーを初期状態に戻す (シードは新規生成)。 */
  reset: () => void;
}

const createInitialEntries = (): Record<HousingListKey, HousingListOrderEntry> => ({
  browse: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'random', favTab: 'all' },
  favorites: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'newest', favTab: 'all' },
  housinger: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'newest', favTab: 'all' },
});

/**
 * 探す/お気に入り/ハウジンガープロフィールの一覧順・スクロール位置を保持する非永続ストア。
 * 意図的に sessionStorage 永続化しない (useHousingViewStore 等とは異なる):
 * SPA内遷移 (詳細へ→戻る等) では JS メモリ上の値がそのまま残る = 再抽選されない。
 * ブラウザの実リロードではモジュールごと初期化される = 新しくシャッフルされる。
 * (設計書 docs/superpowers/specs/2026-07-21-housing-browse-random-order-scroll-restore-design.md)
 */
export const useHousingListOrderStore = create<HousingListOrderState>((set) => ({
  entries: createInitialEntries(),
  setScrollTop: (key, value) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], scrollTop: value } } })),
  setSortMode: (key, mode) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], sortMode: mode } } })),
  setFavTab: (key, tab) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], favTab: tab } } })),
  reshuffle: (key) =>
    set((s) => ({
      entries: { ...s.entries, [key]: { ...s.entries[key], seed: generateShuffleSeed() } },
    })),
  reset: () => set({ entries: createInitialEntries() }),
}));
