import { create } from 'zustand';

/**
 * ツアー組み立て中の「トレイ」(行き先ドラフト)をページ横断で保持するストア (#5)。
 *
 * 以前は BrowsePage / FavoritesPage のローカル state だったため、カードをクリックして
 * 詳細ページへ移動するとページがアンマウントされ、トレイが初期化されていた。
 * ストアに載せることで探す↔お気に入り↔詳細を行き来してもトレイが保持される
 * (組み立て中のツアーは1つ=両ページで共有)。ツアー開始時に clear する。
 */
interface TourTrayState {
  /** トレイに積んだ行き先の listing id (順序 = 追加順)。 */
  trayIds: string[];
  /** 配列 or updater を受ける (useState と同じ使い心地)。 */
  setTrayIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  /** トレイを空にする (ツアー開始で消費したとき等)。 */
  clear: () => void;
}

export const useTourTrayStore = create<TourTrayState>((set) => ({
  trayIds: [],
  setTrayIds: (ids) =>
    set((s) => ({ trayIds: typeof ids === 'function' ? ids(s.trayIds) : ids })),
  clear: () => set({ trayIds: [] }),
}));
