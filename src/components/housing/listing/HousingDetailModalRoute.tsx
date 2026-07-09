/**
 * Phase 3: 物件詳細モーダルのルートラッパー
 *
 * - background-location パターンで「上に被せる」 側として App.tsx から描画される
 * - URL の `:listingId` を取って Firestore から listing を読み、 モーダルを開く
 * - URL クエリ `?notification=<id>` がある場合は通知 doc を id で直接読み込み、
 *   詳細モーダル内に「通報の案内バナー」を出して家主にアクションを促す
 *   (別モーダルを重ねるとスタッキングが破綻するため、 詳細の中に出す)
 * - 開いただけ / 読んだだけでは解決しない。 解決アクション (誤りとして却下 / 異議 / 削除) で read=解決にする
 * - 閉じるとき (ESC / 背景クリック / × / 削除完了): `navigate(-1)` で背景ルートに戻る
 * - listing 取得中・失敗時はモーダルを描画しない (null)
 *
 * Task 2.2: データ取得 / peers 取得 / 通知バナー組み立て / 削除・編集・異議のハンドラは
 * `useHousingDetail` hook に抽出済み (Task 2.3 で HousingDetailPage も同じ hook を使う予定)。
 * このコンポーネントは hook の結果を消費し、 navigate (閉じる / notFound・postRemoved 時の
 * toast+戻る) だけを担う薄いラッパー。
 */
import { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HousingDetailModal } from './HousingDetailModal';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { showToast } from '../../Toast';
import { useHousingDetail } from './useHousingDetail';

export const HousingDetailModalRoute: React.FC = () => {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const d = useHousingDetail(listingId);

  const close = useCallback(() => navigate(-1), [navigate]);

  // 取得失敗 = 削除済み / 非公開 / 存在しない。 静かに閉じず toast で理由を案内してから背景に戻る。
  useEffect(() => {
    if (d.notFound) {
      showToast(t('housing.detail.unavailable'), 'info');
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.notFound]);

  // SNS 連動物件のツイートが消滅した (hook が検知 + store から除去済み)。 toast で案内して背景に戻る。
  useEffect(() => {
    if (d.postRemoved) {
      showToast(t('housing.detail.postRemoved'), 'info');
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.postRemoved]);

  if (!d.listing) return null;

  return (
    <>
      <HousingDetailModal
        listing={d.listing}
        viewerUid={d.viewerUid}
        hasDuplicates={d.hasDuplicates}
        peers={d.peers}
        onClose={close}
        reportNotice={d.reportNotice}
        onListingUpdated={d.handleListingSaved}
        onDeleted={d.onListingDeleted}
        onPeerHidden={d.onPeerHidden}
      />
      {d.editOpen && (
        <HousingEditModal
          open={d.editOpen}
          onClose={d.closeEdit}
          listing={d.listing}
          onSaved={d.handleListingSaved}
        />
      )}
      {d.deleteOpen && (
        <HousingDeleteConfirm
          open={d.deleteOpen}
          listingTitle={d.listing.description ?? d.listing.addressKey}
          onCancel={d.closeDelete}
          onConfirm={async () => {
            const res = await d.onConfirmDelete();
            if (res.ok) close();
          }}
          loading={d.deleting}
        />
      )}
    </>
  );
};
