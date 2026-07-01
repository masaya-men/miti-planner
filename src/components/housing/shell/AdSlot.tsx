import { useTranslation } from 'react-i18next';

export interface AdSlotProps {
  /** 配置識別子 (例: 'browse-left' / 'browse-right')。将来の配信で使う。 */
  slot: string;
}

/**
 * 最小の広告予約枠。現状は "Sponsored" プレースホルダのみ。
 * 将来の広告収入の余地を確保するための箱 (2026-07-01 ユーザー方針 = b: 最小予約枠を残す)。
 */
export const AdSlot: React.FC<AdSlotProps> = ({ slot }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-ad-slot" data-ad-slot={slot}>
      <span className="housing-ad-slot-label">{t('housing.ad.sponsored')}</span>
    </div>
  );
};
