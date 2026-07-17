import { create } from 'zustand';

/**
 * ツアー組み立て中の「トレイ」(行き先ドラフト)をページ横断で保持するストア (#5)。
 *
 * 以前は BrowsePage / FavoritesPage のローカル state だったため、カードをクリックして
 * 詳細ページへ移動するとページがアンマウントされ、トレイが初期化されていた。
 * ストアに載せることで探す↔お気に入り↔詳細を行き来してもトレイが保持される
 * (組み立て中のツアーは1つ=両ページで共有)。ツアー開始時に clear する。
 *
 * ツアー順制御 (ドラッグ並び替え + ピン留め + 効率順ボタン) 追加により、
 * pinnedIds / manualOrder を持つ (resolveTourOrder が参照)。
 *
 * 2026-07-17 実機FB反映: 「最初に固定/最後に固定」の2ボタンは分かりづらいという指摘を受け、
 * ピンの意味を「その位置に固定」に刷新。pinnedFirstId/pinnedLastId (各1件まで) を廃止し、
 * pinnedIds (複数可) + togglePin(id) に置換した。並び替えロジックは resolveTourOrder 側で
 * 「pinned は trayIds の現在 index に固定」として解決する。
 */
interface TourTrayState {
  /** トレイに積んだ行き先の listing id (順序 = 追加順、または手動並び替え後の順)。 */
  trayIds: string[];
  /** 配列 or updater を受ける (useState と同じ使い心地)。 */
  setTrayIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  /** ピン留めした listing id のリスト (「この位置に固定」)。複数可。 */
  pinnedIds: string[];
  /** id を pinnedIds に対して追加/解除するトグル。 */
  togglePin: (id: string) => void;
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
  pinnedIds: [],
  togglePin: (id) =>
    set((s) => ({
      pinnedIds: s.pinnedIds.includes(id)
        ? s.pinnedIds.filter((x) => x !== id)
        : [...s.pinnedIds, id],
    })),
  manualOrder: false,
  setManualOrder: (v) => set({ manualOrder: v }),
  clear: () => set({ trayIds: [], pinnedIds: [], manualOrder: false }),
}));
