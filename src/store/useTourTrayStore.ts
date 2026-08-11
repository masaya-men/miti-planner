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
 * pinnedIds を持つ (resolveTourOrder が参照)。
 *
 * 2026-07-17 実機FB反映: 「最初に固定/最後に固定」の2ボタンは分かりづらいという指摘を受け、
 * ピンの意味を「その位置に固定」に刷新。pinnedFirstId/pinnedLastId (各1件まで) を廃止し、
 * pinnedIds (複数可) + togglePin(id) に置換した。並び替えロジックは resolveTourOrder 側で
 * 「pinned は trayIds の現在 index に固定」として解決する。
 *
 * 2026-08-11 実機FB反映(2回目): 「手動並び替え済みか」のグローバルなモード切替 (manualOrder) は
 * 廃止した。ドラッグで1枚動かすと全ピンが無反応になる罠があったため、ドラッグ確定は
 * 「動かしたカードをその場でピン留めする」(pin) として表現し、ピンは常に効く1つのルールに統一。
 * 「効率順に並び替え」はピンを全解除 (clearPins) してから自動順を組み直す「リセット」動作にした。
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
  /** id を必ずピン留め状態にする (既にピン済みなら何もしない)。ドラッグ確定時に使う。 */
  pin: (id: string) => void;
  /** 全ピンを解除する。「効率順に並び替え」のリセット動作から使う。 */
  clearPins: () => void;
  /** トレイを空にする (ツアー開始で消費したとき等)。ピンも一緒にリセットする。 */
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
  pin: (id) =>
    set((s) => (s.pinnedIds.includes(id) ? s : { pinnedIds: [...s.pinnedIds, id] })),
  clearPins: () => set({ pinnedIds: [] }),
  clear: () => set({ trayIds: [], pinnedIds: [] }),
}));
