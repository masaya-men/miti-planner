import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

export interface TourEmptyStateProps {
  onGoFavorites: () => void;
  onGoBrowse: () => void;
  /**
   * 「住所から追加」入口 (計画: 住所登録なし一時ツアー Task3)。
   * 実際の追加パネル (EphemeralAddPanel モーダル) と開閉 state は TourNavPage が持ち、
   * ここはトグルボタンの見た目と配置だけを担う (onOpenAdd 未指定なら入口ごと出さない)。
   */
  onOpenAdd?: () => void;
  addOpen?: boolean;
}

/**
 * ツアー未開始の空状態 (表示専用)。
 * タイトル + リード文 + 「お気に入りへ」「探すへ」CTA + 「住所から追加」トグルのみの、
 * ヘアライン注記的な静かな空状態。装飾ピル/honeyグラデ/色付きalert箱は使わない (housing-design.md 質感A案)。
 *
 * 住所を1件でも積むと trayIds > 0 になり、TourNavPage は計画ビュー
 * (PC=詳細+蛇行グリッド / スマホ=縦一覧) へ切り替わる。積んだ家の一覧・開始ボタンは計画ビュー側が持つ。
 */
export const TourEmptyState: React.FC<TourEmptyStateProps> = ({
  onGoFavorites,
  onGoBrowse,
  onOpenAdd,
  addOpen,
}) => {
  const { t } = useTranslation();

  return (
    <div className="housing-tour-empty">
      <p className="housing-tour-empty-title">{t('housing.tour.nav.empty.title')}</p>
      <p className="housing-tour-empty-lead">{t('housing.tour.nav.empty.lead')}</p>
      <button type="button" className="housing-tour-empty-cta" onClick={onGoFavorites}>
        {t('housing.tour.nav.empty.cta')}
      </button>
      <button type="button" className="housing-tour-empty-cta" onClick={onGoBrowse}>
        {t('housing.tour.nav.empty.cta_browse')}
      </button>

      {onOpenAdd && (
        <div className="housing-tour-empty-ephemeral">
          <button
            type="button"
            className="housing-ephemeral-toggle"
            aria-expanded={addOpen ?? false}
            onClick={onOpenAdd}
          >
            <Plus size={14} aria-hidden="true" />
            {t('housing.ephemeral.add_button')}
          </button>
        </div>
      )}
    </div>
  );
};
