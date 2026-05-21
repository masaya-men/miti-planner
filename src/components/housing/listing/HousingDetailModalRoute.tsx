/**
 * Phase 3: 物件詳細モーダルのルートラッパー
 *
 * - background-location パターンで「上に被せる」 側として App.tsx から描画される
 * - URL の `:listingId` を取って Firestore から listing を読み、 モーダルを開く
 * - 閉じるとき (ESC / 背景クリック / × / 削除完了): `navigate(-1)` で背景ルートに戻る
 * - listing 取得中・失敗時はモーダルを描画しない (null)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import type { HousingListing } from '../../../types/housing';
import { HousingDetailModal } from './HousingDetailModal';

export const HousingDetailModalRoute: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const viewerUid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'housing_listings', listingId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = snap.data();
        if (data.deletedAt || data.isHidden) {
          setNotFound(true);
          return;
        }
        setListing({ id: snap.id, ...data } as HousingListing);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const close = () => navigate(-1);

  // 取得失敗 = 背景に戻る (フルページに飛ばしても良いが UX 上モーダルは閉じる)
  useEffect(() => {
    if (notFound) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  if (!listing) return null;
  return (
    <HousingDetailModal
      listing={listing}
      viewerUid={viewerUid}
      onClose={close}
    />
  );
};
