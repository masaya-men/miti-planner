/**
 * Task 2.3: 物件詳細 — シェル内大パネル1枚ページ (全経路の単一着地点)
 *
 * - 一覧のカードクリック (旧: `HousingDetailModalRoute` によるモーダル重ね表示) と
 *   直URL / 共有URL / 通知タップ (旧: このファイルの独自フルページ実装) を統合し、
 *   すべて `/housing/listing/:listingId` (シェルの子ルート) → この 1 ページに着地させる。
 * - データ取得 / peers 取得 / 通知バナー組み立て / 削除・編集・異議のハンドラは
 *   `useHousingDetail` (Task 2.2) に集約済み。このコンポーネントは hook の結果を
 *   `HousingDetailContent` + `HousingDetailMap` へ配線するだけの薄いページ。
 * - ページなので (モーダルと違い) ESC/背景クリックで閉じる概念は無く、
 *   `notFound`/`postRemoved` でも navigate はしない (直URL に戻り先の履歴が無い場合が
 *   あるため)。代わりに「表示できません」パネルを ← 戻る 付きで描画する。
 * - シェル (`HousingShell`) が body overflow:hidden + 内部スクロールを管理するため、
 *   このページ自身は body-overflow を解禁しない (旧フルページ実装からの変更点)。
 */
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HousingDetailContent } from './HousingDetailContent';
import { HousingDetailMap } from './HousingDetailMap';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDetail } from './useHousingDetail';
import '../../../styles/housing.css';

export const HousingDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const d = useHousingDetail(listingId);

  // 取得失敗 (削除済み/非公開/不存在) と SNS 投稿消滅は、どちらも「もう表示できない」
  // という点で同じ扱い (plan 準拠: error 状態は無く notFound に統合済み)。
  // listing が (postRemoved 前の取得で) 残っていても、こちらを優先する。
  if (d.notFound || d.postRemoved) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-fullpage-main">
          <p>{t(d.postRemoved ? 'housing.detail.postRemoved' : 'housing.detail.unavailable')}</p>
          <Link
            to="/housing"
            className="housing-detail-back"
            aria-label={t('housing.detail.back_aria')}
          >
            ← {t('housing.detail.back_aria')}
          </Link>
        </div>
      </div>
    );
  }

  if (!d.listing) {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-fullpage-main">{t('housing.detail.title')}…</div>
      </div>
    );
  }

  return (
    <div className="housing-detail-panel">
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
        />
        <HousingDetailMap listing={d.listing} />
      </main>
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
            // ページなので close は無い (戻り先は ← 戻る に委ねる)。res.ok は無視でよい。
            await d.onConfirmDelete();
          }}
          loading={d.deleting}
        />
      )}
    </div>
  );
};
