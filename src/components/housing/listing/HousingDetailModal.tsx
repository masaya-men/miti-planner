/**
 * Phase 3: 物件詳細モーダル (一覧から開いた時)
 *
 * - background-location パターンの「上に被せる」 側
 * - ESC / 背景クリック / 閉じるボタンで onClose
 * - スタイルは housing.css の token 経由
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import { HousingDetailContent, type ReportNotice } from './HousingDetailContent';

export interface HousingDetailModalProps {
  listing: HousingListing;
  viewerUid: string | null;
  /** 同 addressKey に自分以外の生きてる listing が居るとき true (= 「今もあります」 ボタン表示条件)。 */
  hasDuplicates?: boolean;
  /** §3.8: 同 addressKey の他生存 listing 群 (= 詳細モーダル下部「この住所の他の登録」 一覧用)。 */
  peers?: HousingListing[];
  onClose: () => void;
  reportNotice?: ReportNotice;
  /** 編集保存成功時に呼ぶ callback (親で詳細を再 fetch して即反映する) */
  onListingUpdated?: () => void;
  /** 削除成功時に呼ぶ callback (親で一覧ストア除去 + 関連通知の一掃を行う) */
  onDeleted?: () => void;
  /** §3.8: 「ちがった」 で 1 撃 hide 成功時、 親側の一覧ストアからも除去するための callback。 */
  onPeerHidden?: (peerId: string) => void;
}

export const HousingDetailModal: React.FC<HousingDetailModalProps> = ({
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
  const { t } = useTranslation();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div
      className="housing-detail-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('housing.detail.title')}
        className="housing-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="housing-detail-close"
          onClick={onClose}
          aria-label={t('housing.detail.close_aria')}
        >
          ×
        </button>
        <HousingDetailContent
          listing={listing}
          viewerUid={viewerUid}
          hasDuplicates={hasDuplicates}
          peers={peers}
          onClose={onClose}
          reportNotice={reportNotice}
          onListingUpdated={onListingUpdated}
          onDeleted={onDeleted}
          onPeerHidden={onPeerHidden}
        />
      </div>
    </div>
  );
};
