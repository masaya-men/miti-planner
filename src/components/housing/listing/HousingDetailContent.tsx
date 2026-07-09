/**
 * Task 2.3/2.4 + 2026-07-09 再設計「写真ヒーロー+固定レール」: 物件詳細の中身 (シェル子ルートの大パネルから描画)
 *
 * - 左 (.housing-detail-visual): 写真ギャラリー (ヒーロー) のみ
 * - 右レール (.housing-detail-side): 固定ヘッド (タイトル/住所/タグ) → 唯一のスクロール域
 *   (.housing-detail-scroll = 説明 + 「この住所の他の登録」) → 固定の操作バー → 固定の区画マップ
 *   (HousingDetailMap。 mapRef が引けない物件は null を返しレールが操作バーで終わる)
 * - 地図を右レール最下部の別列 + 不透明背景に置くことで、 旧「地図がギャラリーに透けて重なる」
 *   不具合を構造的に根治
 * - 家主が通報通知から開いた場合は、 グリッドの上に「通報の案内バナー」を表示
 *   (別モーダルを重ねるとスタッキングが破綻するため、 詳細の中に出す方針)
 * - レイアウトは housing.css (.housing-detail-body / -content / -side) で制御
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing, ReportReason } from '../../../types/housing';
import { HousingPhotoGallery } from './HousingPhotoGallery';
import { HousingDetailMap } from './HousingDetailMap';
import { HousingActionBar } from './HousingActionBar';
import { HousingDuplicatePeersSection } from './HousingDuplicatePeersSection';
import { useScrollFade } from '../../../lib/housing/useScrollFade';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { useHousingReport } from '../report/useHousingReport';
import { showToast } from '../../Toast';

/** 家主が通報通知から開いた時に詳細内へ出す案内 (任意) */
export interface ReportNotice {
  reason: ReportReason;
  comment?: string;
  /** 自己復帰の上限を超えて再非表示 = 却下/編集では戻せず管理者対応 (Discord 異議) のみ */
  escalated?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDispute: () => void;
  /** 「これは誤り」 = 通報を却下し非表示を自己解除する */
  onDismiss: () => void;
}

export interface HousingDetailContentProps {
  listing: HousingListing;
  viewerUid: string | null;
  /** 同 addressKey に自分以外の生きてる listing が居るとき true (= 「今もあります」 ボタン表示条件)。 */
  hasDuplicates?: boolean;
  /** §3.8: 同 addressKey の他生存 listing 群 (= 下部「この住所の他の登録」 セクション用)。 */
  peers?: HousingListing[];
  onClose?: () => void;
  reportNotice?: ReportNotice;
  /** 編集保存成功時に呼ぶ callback (親で詳細を再 fetch して即反映する) */
  onListingUpdated?: () => void;
  /** 削除成功時に呼ぶ callback (親で一覧ストア除去 + 関連通知の一掃を行う) */
  onDeleted?: () => void;
  /** §3.8: 「ちがった」 で 1 撃 hide 成功時、 親側の一覧ストアからも除去するための callback。 */
  onPeerHidden?: (peerId: string) => void;
}

export const HousingDetailContent: React.FC<HousingDetailContentProps> = ({
  listing,
  viewerUid,
  hasDuplicates = false,
  peers = [],
  onClose,
  reportNotice,
  onListingUpdated,
  onDeleted,
  onPeerHidden,
}) => {
  const { t, i18n } = useTranslation();
  // 2026-05-26 アパート号棟欠落バグ修正 + 多言語化: 住所組み立ては必ず formatHousingAddress 経由。
  const fullAddress = formatHousingAddress(listing, i18n.language);
  // 見出しは住所に固定 (FF14 の家は識別子が住所。 任意タイトル欄は設けない)。
  // 紹介文 (description) は任意の本文としてスクロール領域に表示する。
  const title = fullAddress;

  // §3.8 (2026-05-27): 重複一覧の「ちがった」 で 1 撃 hide した peer は即時 UI から消す。
  // 親の peers は同じ参照のまま、 ここで filter する (= 親に再 fetch 走らせない軽量実装)。
  const [hiddenPeerIds, setHiddenPeerIds] = useState<Set<string>>(new Set());
  const visiblePeers = useMemo(
    () => peers.filter((p) => !hiddenPeerIds.has(p.id)),
    [peers, hiddenPeerIds],
  );
  const { report: reportPeer } = useHousingReport();
  // §3.8: 押し切った瞬間に UI から消える (Optimistic UI)。 サーバ応答を待つと
  // 1〜2 秒のタイムラグで「気持ち悪い」 体感になる。 失敗時のみロールバックする。
  // 成功時は親の一覧ストアにも伝搬し、 モーダルを閉じた後の一覧画面にも即反映する
  // (= 親が onPeerHidden で useHousingListingsStore.remove を呼ぶ前提)。
  const handleReportPeer = async (peerId: string) => {
    setHiddenPeerIds((prev) => {
      const next = new Set(prev);
      next.add(peerId);
      return next;
    });
    const result = await reportPeer(peerId, 'wrong_info');
    if (result.ok) {
      showToast(t('housing.detail.duplicates.toast_hidden'), 'success');
      onPeerHidden?.(peerId);
    } else {
      setHiddenPeerIds((prev) => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
      showToast(t('housing.detail.duplicates.toast_error'), 'error');
    }
  };

  const textScroll = useScrollFade<HTMLDivElement>();

  return (
    <div className="housing-detail-body">
      {reportNotice && (
        <div className="housing-detail-report-banner" role="alert">
          <p className="housing-detail-report-title">{t('housing.guide.title')}</p>
          <p className="housing-detail-report-reason">
            {t('housing.guide.reason_label')}:{' '}
            <strong>{t(`housing.report.reason.${reportNotice.reason}`)}</strong>
          </p>
          <p className="housing-detail-report-body">
            {t(`housing.guide.body.${reportNotice.reason}`)}
          </p>
          {reportNotice.reason === 'other' && reportNotice.comment && (
            <blockquote className="housing-detail-report-comment">
              {reportNotice.comment}
            </blockquote>
          )}
          {reportNotice.escalated ? (
            <>
              <p className="housing-detail-report-escalated">
                {t('housing.guide.escalated_note')}
              </p>
              <div className="housing-detail-report-actions">
                <button
                  type="button"
                  onClick={reportNotice.onDelete}
                  className="housing-btn-danger"
                >
                  {t('housing.guide.cta.delete')}
                </button>
                <button type="button" onClick={reportNotice.onDispute}>
                  {t('housing.guide.cta.dispute')}
                </button>
              </div>
            </>
          ) : (
            <div className="housing-detail-report-actions">
              {(reportNotice.reason === 'wrong_info' || reportNotice.reason === 'other') && (
                <button type="button" onClick={reportNotice.onEdit}>
                  {t('housing.guide.cta.edit')}
                </button>
              )}
              {(reportNotice.reason === 'sold' || reportNotice.reason === 'other') && (
                <button
                  type="button"
                  onClick={reportNotice.onDelete}
                  className="housing-btn-danger"
                >
                  {t('housing.guide.cta.delete')}
                </button>
              )}
              {(reportNotice.reason === 'griefing' ||
                reportNotice.reason === 'nsfw' ||
                reportNotice.reason === 'other') && (
                <button type="button" onClick={reportNotice.onDispute}>
                  {t('housing.guide.cta.dispute')}
                </button>
              )}
              <button type="button" onClick={reportNotice.onDismiss}>
                {t('housing.guide.cta.dismiss')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="housing-detail-content">
        {/* HERO: 写真ギャラリー (地図はここではない=透け重なりの元だった) */}
        <div className="housing-detail-visual">
          <div className="housing-detail-gallery">
            <HousingPhotoGallery listing={listing} />
          </div>
        </div>

        {/* RAIL: テキスト一式がスクロール域、操作・地図は固定 */}
        <div className="housing-detail-side">
          {/* テキスト一式 = 唯一のスクロール域。 長くても固定高さを超えず、 端フェードで示す。 */}
          <div
            className="housing-detail-textscroll-wrap"
            data-at-top={textScroll.atStart}
            data-at-bottom={textScroll.atEnd}
          >
            <div
              className="housing-detail-textscroll"
              ref={textScroll.ref}
              onScroll={textScroll.onScroll}
            >
              <div className="housing-detail-info">
                <h2 className="housing-detail-title">{title}</h2>
                <p className="housing-detail-address">
                  {listing.dc} / {listing.server}
                </p>
                {listing.tags.length > 0 && (
                  <ul className="housing-detail-tags">
                    {listing.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
              {listing.description && (
                <p className="housing-detail-description">{listing.description}</p>
              )}
              <HousingDuplicatePeersSection peers={visiblePeers} onReportPeer={handleReportPeer} />
            </div>
          </div>

          <div className="housing-detail-actions">
            <HousingActionBar
              listing={listing}
              viewerUid={viewerUid}
              hasDuplicates={hasDuplicates}
              onClose={onClose}
              onListingUpdated={onListingUpdated}
              onDeleted={onDeleted}
            />
          </div>

          {/* mapRef が引けない物件では null → レールは操作バーで自然に終わる */}
          <HousingDetailMap listing={listing} />
        </div>
      </div>
    </div>
  );
};
