/**
 * spec 2026-05-21: ギャラリー一覧 (Pinterest ビュー) 用の取得フック。
 *
 * - マウント時に getGalleryListings() → アダプタ変換 → 変換不可 (region 不明 / plot・size 欠損) を除外
 * - loading / ready / error の 3 状態
 */
import { useEffect, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { getGalleryListings } from '../../../lib/housingListingsService';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';

export type GalleryState =
  | { kind: 'loading' }
  | { kind: 'ready'; listings: MockListing[] }
  | { kind: 'error'; message: string };

export function useGalleryListings(): GalleryState {
  const [state, setState] = useState<GalleryState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docs = await getGalleryListings();
        if (cancelled) return;
        const listings = docs
          .map(firestoreToGalleryListing)
          .filter((l): l is MockListing => l !== null);
        setState({ kind: 'ready', listings });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'unknown_error';
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
