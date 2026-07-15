import { useTranslation } from 'react-i18next';
import { UserPlus, Copy } from 'lucide-react';

export interface TourInvitePanelProps {
  /** null=未発行 / 文字列=発行済み(招待リンクの token) */
  tourToken: string | null;
  onInvite: () => void;
  onCopy: () => void;
  onEnd: () => void;
}

/**
 * 幹事の「みんなを招待」パネル (Task 2.1・表示専用)。
 * 中央地図パネルの右下オーバーレイに常駐する。
 * 発行前/発行済みで表示を分岐するだけで、実際の発行/コピー/終了処理は
 * 呼び出し側 (TourNavPage) が onInvite/onCopy/onEnd 経由で担う。
 */
export const TourInvitePanel: React.FC<TourInvitePanelProps> = ({
  tourToken,
  onInvite,
  onCopy,
  onEnd,
}) => {
  const { t } = useTranslation();

  if (tourToken === null) {
    return (
      <div className="housing-tour-invite">
        <button type="button" className="housing-tour-invite-btn" onClick={onInvite}>
          <UserPlus size={14} aria-hidden="true" />
          {t('housing.tour.nav.invite.button')}
        </button>
        {/* 箱で囲まない静かな注記 (feedback_housing_no_ai_pills) */}
        <p className="housing-tour-invite-hint">{t('housing.tour.nav.invite.hint')}</p>
      </div>
    );
  }

  // リンク本体は長いため表示は省略(ellipsis)。実際のコピーは onCopy 側が担う。
  const inviteUrl = `${location.origin}/housing/tour/${tourToken}`;

  return (
    <div className="housing-tour-invite">
      <span className="housing-tour-invite-label">{t('housing.tour.nav.invite.link_label')}</span>
      <span className="housing-tour-invite-link" title={inviteUrl}>
        {inviteUrl}
      </span>
      <div className="housing-tour-invite-actions">
        <button type="button" className="housing-tour-invite-copy" onClick={onCopy}>
          <Copy size={14} aria-hidden="true" />
          {t('housing.tour.nav.invite.copy')}
        </button>
        <button type="button" className="housing-tour-invite-end" onClick={onEnd}>
          {t('housing.tour.nav.invite.end')}
        </button>
      </div>
    </div>
  );
};
