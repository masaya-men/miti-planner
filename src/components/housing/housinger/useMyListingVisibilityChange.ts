/**
 * マイページ一覧の公開状態切替。カードの切替メニューで選んだ内容を確認モーダルへ渡し、
 * 実行はモーダルの確認で行う。成功したら画面の一覧と myListings ストアの両方へ反映する。
 */
import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import {
  useHousingVisibilityUpdate,
  type HousingVisibilityValue,
} from '../mypage/useHousingVisibilityUpdate';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';

export function useMyListingVisibilityChange(
  listings: MockListing[],
  setListings: Dispatch<SetStateAction<MockListing[]>>,
) {
  const { t } = useTranslation();
  const [visibilityTarget, setVisibilityTarget] = useState<{
    listingId: string;
    listingTitle: string;
    next: HousingVisibilityValue;
  } | null>(null);
  const { updateVisibility, loading: visibilityUpdating } = useHousingVisibilityUpdate();

  const requestVisibilityChange = (id: string, next: HousingVisibilityValue) => {
    const target = listings.find((l) => l.id === id);
    if (!target) return;
    setVisibilityTarget({ listingId: id, listingTitle: target.title || '', next });
  };

  const cancelVisibilityChange = () => setVisibilityTarget(null);

  const confirmVisibilityChange = async () => {
    if (!visibilityTarget) return;
    const { listingId, next } = visibilityTarget;
    const result = await updateVisibility(listingId, next);
    if (result.ok) {
      // 楽観的更新: publishUntil は update-visibility ハンドラと同じ規則 (unlisted/private は null)。
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? { ...l, visibility: next, publishUntil: next === 'public' ? l.publishUntil : null }
            : l,
        ),
      );
      // 公開状態切替の直後に再訪しても古い一覧が即表示されないよう、myListings ストアにも反映する。
      useHousingListingsStore.setState((s) => ({
        myListings: s.myListings.map((l) =>
          l.id === listingId
            ? { ...l, visibility: next, publishUntil: next === 'public' ? l.publishUntil : null }
            : l,
        ),
      }));
      setVisibilityTarget(null);
    } else {
      showToast(t('housing.mypage.visibilityConfirm.error'), 'error');
    }
  };

  return {
    visibilityTarget,
    visibilityUpdating,
    requestVisibilityChange,
    cancelVisibilityChange,
    confirmVisibilityChange,
  };
}
