import { useCallback, useState } from 'react';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
import type { MockListing } from '../../../data/housing/mockListings';

/**
 * ツアー中ページ(TourNavPage)のナビ中の並び替え (replanning)。
 */
export function useTourReplan(listingIds: string[], currentIndex: number, pool: MockListing[]) {
  const reorderRemaining = useHousingTourStore((s) => s.reorderRemaining);

  // ナビ中の並び替え (replanning): 計画画面と同じ部品を「残りの家だけ」で再利用する。
  // draft は開始時に listingIds.slice(currentIndex) で初期化し、「ツアーに戻る」で store へ確定する
  // (ページを離れた場合は draft ごと捨てる)。
  const [replanning, setReplanning] = useState(false);
  const [replanDraft, setReplanDraft] = useState<string[]>([]);
  const [replanSelectedId, setReplanSelectedId] = useState<string | null>(null);
  const replanPinnedIds = useTourTrayStore((s) => s.pinnedIds);
  const startReplan = useCallback(() => {
    setReplanDraft(listingIds.slice(currentIndex));
    setReplanSelectedId(listingIds[currentIndex] ?? null);
    setReplanning(true);
  }, [listingIds, currentIndex]);
  const resumeFromReplan = useCallback(() => {
    // 画面に見えている順 (ピン留め込みの解決済み順) をそのまま確定する。
    reorderRemaining(resolveTourOrder(replanDraft, pool, { pinnedIds: replanPinnedIds }));
    setReplanning(false);
  }, [reorderRemaining, replanDraft, pool, replanPinnedIds]);

  return { replanning, replanDraft, setReplanDraft, replanSelectedId, setReplanSelectedId, startReplan, resumeFromReplan };
}

export type TourReplan = ReturnType<typeof useTourReplan>;
