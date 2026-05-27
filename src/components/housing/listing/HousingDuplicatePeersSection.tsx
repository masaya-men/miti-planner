/**
 * 詳細モーダル下部の「この住所の他の登録」 セクション。
 *
 * - peers (= 同 addressKey の他 listing) が 0 件なら何も描画しない
 * - 各 peer を mini カードで縦並び、 右側に長押し「ちがった」 ボタン
 * - onReportPeer(peerId) を完了時に呼ぶ (= 親で reportListing API + toast)
 *
 * 設計書: docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.1
 */
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { HousingLongPressButton } from './HousingLongPressButton';

export interface HousingDuplicatePeersSectionProps {
  peers: HousingListing[];
  onReportPeer: (peerId: string) => void;
}

export const HousingDuplicatePeersSection: React.FC<HousingDuplicatePeersSectionProps> = ({
  peers,
  onReportPeer,
}) => {
  const { t, i18n } = useTranslation();
  if (peers.length === 0) return null;

  return (
    <section className="housing-detail-peers">
      <h3 className="housing-detail-peers-title">
        {t('housing.detail.duplicates.title', { count: peers.length })}
      </h3>
      <ul className="housing-detail-peers-list">
        {peers.map((peer) => {
          const addr = formatHousingAddress(peer, i18n.language);
          const title = peer.description?.trim() ? peer.description : addr;
          const thumb = peer.sourceImageUrls?.[0] ?? peer.videoPosterUrl;
          return (
            <li key={peer.id} className="housing-detail-peers-item">
              {thumb && (
                <img
                  className="housing-detail-peers-thumb"
                  src={thumb}
                  alt=""
                  loading="lazy"
                />
              )}
              <div className="housing-detail-peers-info">
                <p className="housing-detail-peers-card-title">{title}</p>
                <p className="housing-detail-peers-card-address">{addr}</p>
              </div>
              <div className="housing-detail-peers-action">
                <p className="housing-detail-peers-note">
                  {t('housing.detail.duplicates.collaboration_note')}
                </p>
                <HousingLongPressButton
                  label={t('housing.detail.duplicates.action_wrong')}
                  onConfirm={() => onReportPeer(peer.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
