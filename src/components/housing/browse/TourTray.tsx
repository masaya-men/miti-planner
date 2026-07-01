import { useTranslation } from 'react-i18next';
import { Play, X } from 'lucide-react';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

export interface TourTrayProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  onStart: () => void;
}

/**
 * 右カラムのツアートレイ。番号付きの行き先リスト + 削除 + 「開始」。
 * 第1スパンは 追加/削除/開始 まで。DnD 並べ替え・推定時間の精緻化は後続で TourBuilderPane から移植。
 */
export const TourTray: React.FC<TourTrayProps> = ({ listingIds, onChange, onStart }) => {
  const { t, i18n } = useTranslation();
  const listings = useHousingListingsStore((s) => s.listings);

  const items = listingIds
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));
  const empty = listingIds.length === 0;

  const remove = (id: string) => onChange(listingIds.filter((x) => x !== id));

  return (
    <div className="housing-tour-tray">
      <div className="housing-tour-tray-head">
        <span className="housing-tour-tray-title">{t('housing.tray.title')}</span>
        <span className="housing-tour-tray-count">{listingIds.length}</span>
      </div>

      {empty ? (
        <div className="housing-tour-tray-empty">{t('housing.tray.empty')}</div>
      ) : (
        <ol className="housing-tour-tray-list">
          {items.map((l, i) => (
            <li key={l.id} className="housing-tour-tray-item">
              <span className="housing-tour-tray-num">{i + 1}</span>
              <span className="housing-tour-tray-addr">{formatHousingAddress(l, i18n.language)}</span>
              <button
                type="button"
                className="housing-tour-tray-remove"
                aria-label={t('housing.tray.remove')}
                onClick={() => remove(l.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        className="housing-tour-tray-start"
        disabled={empty}
        onClick={onStart}
      >
        <Play size={14} aria-hidden="true" />
        {t('housing.tray.start')}
      </button>
    </div>
  );
};
