import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Plus, X } from 'lucide-react';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { EphemeralAddPanel } from '../browse/EphemeralAddPanel';

export interface TourEmptyStateProps {
  onGoFavorites: () => void;
  /**
   * 「住所から追加」入口 (計画: 住所登録なし一時ツアー Task3)。
   * 呼び出し側 (TourNavPage) がローカル state に積んだ一時 listing の id リスト。
   * onAddEphemeral が未指定なら入口ごと出さない (従来表示のまま)。
   */
  ephemeralIds?: string[];
  onAddEphemeral?: (id: string) => void;
  onRemoveEphemeral?: (id: string) => void;
  /** [この内容でツアーを開始]。orderTourStopIds → setListings → start は呼び出し側が担う。 */
  onStartEphemeral?: () => void;
}

/**
 * ツアー未開始の空状態 (表示専用)。
 * タイトル + リード文 + 「お気に入りへ」CTA のみの、ヘアライン注記的な静かな空状態。
 * 装飾ピル/honeyグラデ/色付きalert箱は使わない (housing-design.md 質感A案)。
 * store 配線・ナビゲーションの中身は TourNavPage (Task8) が onGoFavorites 経由で担う。
 *
 * 追加 (Task3): 「住所から追加」パネル + 積んだ一時の家の簡易リスト + 開始ボタン。
 * 一時 listing の解決 (id → 住所表示) のためだけに useEphemeralListingsStore を購読する。
 */
export const TourEmptyState: React.FC<TourEmptyStateProps> = ({
  onGoFavorites,
  ephemeralIds,
  onAddEphemeral,
  onRemoveEphemeral,
  onStartEphemeral,
}) => {
  const { t, i18n } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const ids = ephemeralIds ?? [];
  const items = ids
    .map((id) => ephemeral.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));

  return (
    <div className="housing-tour-empty">
      <p className="housing-tour-empty-title">{t('housing.tour.nav.empty.title')}</p>
      <p className="housing-tour-empty-lead">{t('housing.tour.nav.empty.lead')}</p>
      <button type="button" className="housing-tour-empty-cta" onClick={onGoFavorites}>
        {t('housing.tour.nav.empty.cta')}
      </button>

      {onAddEphemeral && (
        <div className="housing-tour-empty-ephemeral">
          <button
            type="button"
            className="housing-ephemeral-toggle"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((o) => !o)}
          >
            <Plus size={14} aria-hidden="true" />
            {t('housing.ephemeral.add_button')}
          </button>
          <EphemeralAddPanel
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onAdd={onAddEphemeral}
          />

          {items.length > 0 && (
            <>
              <ol className="housing-tour-tray-list housing-tour-empty-ephemeral-list">
                {items.map((l, i) => (
                  <li key={l.id} className="housing-tour-tray-item">
                    <span className="housing-tour-tray-num">{i + 1}</span>
                    <span className="housing-tour-tray-addr">
                      {formatHousingAddress(l, i18n.language)}
                    </span>
                    {onRemoveEphemeral && (
                      <button
                        type="button"
                        className="housing-tour-tray-remove"
                        aria-label={t('housing.tray.remove')}
                        onClick={() => onRemoveEphemeral(l.id)}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
              {onStartEphemeral && (
                <button
                  type="button"
                  className="housing-tour-tray-start"
                  onClick={onStartEphemeral}
                >
                  <Play size={14} aria-hidden="true" />
                  {t('housing.ephemeral.empty_start')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
