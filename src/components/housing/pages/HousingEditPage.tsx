/**
 * Task 3.3a: 編集ページ (シェル子ルート `/housing/listing/:listingId/edit`)。
 *
 * `HousingDetailPage` と役割は分離しつつ、 listingId から listing を getDoc で直接取得し、
 * `<RegisterPage mode="edit" initialValues={listing} />` を大パネルで描画する薄いラッパー。
 * 家主のみ編集可 (viewerUid === listing.ownerUid)。 取得不可 / 非オーナー / 削除済みは、
 * 詳細ページの not_found と同じパネル (← 戻る 付き) を描画する。 navigate はしない
 * (直URL に戻り先の履歴が無い場合があるため。 HousingDetailPage の設計を踏襲)。
 *
 * `useHousingDetail` (通知バナー / peers / SNS ツイート生存確認等の重い機構) はここでは
 * 使わない。 編集ページに不要なため getDoc 直叩きに留める (brief の指示どおり)。
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import type { HousingListing } from '../../../types/housing';
import { RegisterPage } from './RegisterPage';
import { useResolveReport } from '../report/useResolveReport';
import '../../../styles/housing.css';

export const HousingEditPage: React.FC = () => {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const viewerUid = user?.uid ?? null;
  // Task3.3a 回帰修復: 編集保存成功時に「編集=通報対処」 として自己非表示を解除する
  // (旧 useHousingDetail.handleListingSaved と同じ挙動。 結果 ok/escalation/error は
  // 気にせず呼ぶだけ = 通報の無い物件でも安全に呼べる旧来仕様)。
  const { resolve: resolveReport } = useResolveReport();

  const [listing, setListing] = useState<HousingListing | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // auth 復元前 (loading===true) に fetch すると本人判定ができない (viewerUid が一時的に
    // null 扱い) ため、 useHousingDetail と同じ auth-ready gate で待つ。
    if (authLoading) return;
    if (!listingId) return;
    // listingId が変わって同一インスタンスが再利用されても、前回の結果 (stale な
    // notFound=true や別 listing) を残さないよう fetch 開始前にリセットする
    // (現状の唯一の導線は detail→edit→detail で edit→edit は起きないが堅牢性のため)。
    setNotFound(false);
    setListing(null);
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'housing_listings', listingId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = snap.data() as HousingListing;
        // 削除済みは家主でも編集不可。 家主以外は viewerUid 不一致で弾く
        // (isHidden は見ない = 通報で非表示になった自分の物件も編集で対処できる必要があるため)。
        if (data.deletedAt || data.ownerUid !== viewerUid) {
          setNotFound(true);
          return;
        }
        setListing({ ...data, id: snap.id });
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId, authLoading, viewerUid]);

  if (notFound) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">
            <p>{t('housing.detail.unavailable')}</p>
            <Link
              to="/housing"
              className="housing-detail-back"
              aria-label={t('housing.detail.back_aria')}
            >
              ← {t('housing.detail.back_aria')}
            </Link>
          </main>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">{t('housing.detail.title')}…</main>
        </div>
      </div>
    );
  }

  return (
    <RegisterPage mode="edit" initialValues={listing} onSaved={(id) => resolveReport(id)} />
  );
};
