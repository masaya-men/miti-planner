/**
 * Phase 3: 物件詳細フルページ (`/housing/listing/:listingId` 直アクセス用)
 *
 * - Firestore `housing_listings/{listingId}` を読みに行く
 * - `deletedAt` が立っている / `isHidden=true` / 存在しない場合は Not found
 * - 取得後は HousingDetailLayout に渡す
 *
 * モーダル経由 (一覧から開いた時) は HousingDetailModalRoute を使う。
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import type { HousingListing } from '../../../types/housing';
import { HousingDetailLayout } from './HousingDetailLayout';
import '../../../styles/housing.css';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; listing: HousingListing }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

export const HousingDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const viewerUid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!listingId) {
      setState({ kind: 'not_found' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'housing_listings', listingId));
        if (cancelled) return;
        if (!snap.exists()) {
          setState({ kind: 'not_found' });
          return;
        }
        const data = snap.data();
        if (data.deletedAt || data.isHidden) {
          setState({ kind: 'not_found' });
          return;
        }
        setState({
          kind: 'ok',
          listing: { id: snap.id, ...data } as HousingListing,
        });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'unknown_error';
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (state.kind === 'loading') {
    return (
      <div className="housing-detail-fullpage housing-workspace" data-theme="dark">
        <div className="housing-detail-fullpage-main">{t('housing.detail.title')}…</div>
      </div>
    );
  }
  if (state.kind === 'not_found') {
    return (
      <div className="housing-detail-fullpage housing-workspace" data-theme="dark">
        <div className="housing-detail-fullpage-main">Not found</div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="housing-detail-fullpage housing-workspace" data-theme="dark">
        <div className="housing-detail-fullpage-main">Error: {state.message}</div>
      </div>
    );
  }
  return (
    <div className="housing-workspace" data-theme="dark">
      <HousingDetailLayout listing={state.listing} viewerUid={viewerUid} />
    </div>
  );
};
