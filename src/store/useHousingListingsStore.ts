/**
 * spec 2026-05-21: ハウジングワークスペース共有の物件データストア。
 *
 * - 一覧系 (中央 Pinterest / 右パネル / フィルタ件数 / お気に入り / ツアー) が
 *   この 1 つのストアから実 Firestore データ (view-model) を読む。
 * - load() は HousingWorkspace マウント時に 1 回だけ呼ぶ (冪等)。
 * - マップビューは sampleWardLayout (mock 位置) のまま現状維持なので本ストアを使わない (Phase 2B)。
 */
import { create } from 'zustand';
import type { MockListing } from '../data/housing/mockListings';
// 注意: service / adapter は load() 内で動的 import する。
// 静的 import すると firebase.ts がこのストアを import する全コンポーネント経由でロードされ、
// テストの appcheck teardown ハングを誘発するため (memory: reference_vitest_pool_firebase)。

export type HousingListingsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface HousingListingsState {
  status: HousingListingsStatus;
  listings: MockListing[];
  error: string | null;
  load: () => Promise<void>;
  /** 編集保存後に一覧カードへ即反映する (既存は置換、 無ければ先頭に追加)。 */
  upsert: (listing: MockListing) => void;
  /** 削除済み / 非表示になった物件を一覧から即除去する。 */
  remove: (id: string) => void;
  reset: () => void;
}

const INITIAL = {
  status: 'idle' as HousingListingsStatus,
  listings: [] as MockListing[],
  error: null as string | null,
};

export const useHousingListingsStore = create<HousingListingsState>((set, get) => ({
  ...INITIAL,
  load: async () => {
    const cur = get().status;
    // 冪等: 取得中 / 取得済みなら何もしない (error からは再試行可)
    if (cur === 'loading' || cur === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const [{ getGalleryListings }, { firestoreToGalleryListing }] = await Promise.all([
        import('../lib/housingListingsService'),
        import('../lib/housing/galleryAdapter'),
      ]);
      const docs = await getGalleryListings();
      const listings = docs
        .map(firestoreToGalleryListing)
        .filter((l): l is MockListing => l !== null);
      set({ status: 'ready', listings, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      set({ status: 'error', error: message });
    }
  },
  upsert: (listing) =>
    set((s) => {
      const idx = s.listings.findIndex((l) => l.id === listing.id);
      if (idx === -1) return { listings: [listing, ...s.listings] };
      const next = s.listings.slice();
      next[idx] = listing;
      return { listings: next };
    }),
  remove: (id) => set((s) => ({ listings: s.listings.filter((l) => l.id !== id) })),
  reset: () => set(INITIAL),
}));
