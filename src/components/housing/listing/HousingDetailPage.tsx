/**
 * Task 2.3: 物件詳細 — シェル内大パネル1枚ページ (全経路の単一着地点)
 *
 * - 一覧のカードクリック (旧: `HousingDetailModalRoute` によるモーダル重ね表示) と
 *   直URL / 共有URL / 通知タップ (旧: このファイルの独自フルページ実装) を統合し、
 *   すべて `/housing/listing/:listingId` (シェルの子ルート) → この 1 ページに着地させる。
 * - データ取得 / peers 取得 / 通知バナー組み立て / 削除・編集・異議のハンドラは
 *   `useHousingDetail` (Task 2.2) に集約済み。このコンポーネントは hook の結果を
 *   `HousingDetailContent` へ配線するだけの薄いページ (地図は Task 2.4 で Content 側の
 *   左ビジュアル列へ移設済み。ここで二重配線しない)。
 * - ページなので (モーダルと違い) ESC/背景クリックで閉じる概念は無く、
 *   `notFound`/`postRemoved` でも navigate はしない (直URL に戻り先の履歴が無い場合が
 *   あるため)。代わりに「表示できません」パネルを ← 戻る 付きで描画する。
 * - シェル (`HousingShell`) が body overflow:hidden + 内部スクロールを管理するため、
 *   このページ自身は body-overflow を解禁しない (旧フルページ実装からの変更点)。
 * - Task 2.4: `.housing-detail-panel` (シェル内スクロール) の中に `.housing-detail-shell`
 *   (探す/ツアーと同じ濃紺フラット面の 1 枚パネル) を挟む二層構造。
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HousingDetailContent } from './HousingDetailContent';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDetail } from './useHousingDetail';
import '../../../styles/housing.css';

export const HousingDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { listingId } = useParams<{ listingId: string }>();
  // Task 3.3a: 編集は route 遷移 (/housing/listing/:listingId/edit)。 hook は react-router を
  // 意識しないため、 navigate を包んだコールバックをここ (呼び出し側) で渡す。
  const d = useHousingDetail(listingId, {
    onEdit: () => navigate(`/housing/listing/${listingId}/edit`),
  });

  // 取得失敗 (削除済み/非公開/不存在) と SNS 投稿消滅は、どちらも「もう表示できない」
  // という点で同じ扱い (plan 準拠: error 状態は無く notFound に統合済み)。
  // listing が (postRemoved 前の取得で) 残っていても、こちらを優先する。
  if (d.notFound || d.postRemoved) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">
            <p>{t(d.postRemoved ? 'housing.detail.postRemoved' : 'housing.detail.unavailable')}</p>
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

  if (!d.listing) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">{t('housing.detail.title')}…</main>
        </div>
      </div>
    );
  }

  return (
    <div className="housing-detail-panel">
      <div className="housing-detail-shell">
        <header className="housing-detail-fullpage-header">
          <Link
            to="/housing"
            className="housing-detail-back"
            aria-label={t('housing.detail.back_aria')}
          >
            ← {t('housing.detail.back_aria')}
          </Link>
        </header>
        <main className="housing-detail-fullpage-main">
          <HousingDetailContent
            listing={d.listing}
            viewerUid={d.viewerUid}
            hasDuplicates={d.hasDuplicates}
            peers={d.peers}
            reportNotice={d.reportNotice}
            onListingUpdated={d.handleListingSaved}
            onDeleted={d.onListingDeleted}
            onPeerHidden={d.onPeerHidden}
            onClose={() => navigate('/housing')}
          />
        </main>
      </div>
      {d.deleteOpen && (
        <HousingDeleteConfirm
          open={d.deleteOpen}
          listingTitle={d.listing.description ?? d.listing.addressKey}
          onCancel={d.closeDelete}
          onConfirm={async () => {
            // 削除成功時は一覧へ戻る (旧 HousingDetailModalRoute と同じ挙動)。
            // navigate(-1) ではなく固定パスにするのは、直URL/共有URL 経由だと
            // アプリ内履歴が無い場合があるため。
            const res = await d.onConfirmDelete();
            if (res.ok) navigate('/housing');
          }}
          loading={d.deleting}
        />
      )}
    </div>
  );
};
