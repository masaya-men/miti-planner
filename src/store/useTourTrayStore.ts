import { create } from 'zustand';

/**
 * ツアー組み立て中の「トレイ」(行き先ドラフト)をページ横断で保持するストア (#5)。
 *
 * 以前は BrowsePage / FavoritesPage のローカル state だったため、カードをクリックして
 * 詳細ページへ移動するとページがアンマウントされ、トレイが初期化されていた。
 * ストアに載せることで探す↔お気に入り↔詳細を行き来してもトレイが保持される
 * (組み立て中のツアーは1つ=両ページで共有)。ツアー開始時に clear する。
 *
 * ツアー順制御 (ドラッグ並び替え + 最初/最後固定ピン + 効率順ボタン) 追加により、
 * pinnedFirstId / pinnedLastId / manualOrder を持つ (resolveTourOrder が参照)。
 */
interface TourTrayState {
  /** トレイに積んだ行き先の listing id (順序 = 追加順、または手動並び替え後の順)。 */
  trayIds: string[];
  /** 配列 or updater を受ける (useState と同じ使い心地)。 */
  setTrayIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  /** 「最初に固定」した listing id。null = 未固定。 */
  pinnedFirstId: string | null;
  setPinnedFirstId: (id: string | null) => void;
  /** 「最後に固定」した listing id。null = 未固定。 */
  pinnedLastId: string | null;
  setPinnedLastId: (id: string | null) => void;
  /**
   * true = ドラッグ等でユーザーが手動並び替え済み (resolveTourOrder は trayIds の順序を維持)。
   * false = 自動順 (orderTourStops)。既定 false (従来挙動)。
   */
  manualOrder: boolean;
  setManualOrder: (v: boolean) => void;
  /** トレイを空にする (ツアー開始で消費したとき等)。ピン/手動順フラグも一緒にリセットする。 */
  clear: () => void;
}

export const useTourTrayStore = create<TourTrayState>((set) => ({
  trayIds: [],
  setTrayIds: (ids) =>
    set((s) => ({ trayIds: typeof ids === 'function' ? ids(s.trayIds) : ids })),
  pinnedFirstId: null,
  setPinnedFirstId: (id) => set({ pinnedFirstId: id }),
  pinnedLastId: null,
  setPinnedLastId: (id) => set({ pinnedLastId: id }),
  manualOrder: false,
  setManualOrder: (v) => set({ manualOrder: v }),
  clear: () => set({ trayIds: [], pinnedFirstId: null, pinnedLastId: null, manualOrder: false }),
}));
