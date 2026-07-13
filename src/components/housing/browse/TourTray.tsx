import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Plus, Route, X } from 'lucide-react';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { EphemeralAddPanel } from './EphemeralAddPanel';
import { tourAnchorRegion } from '../../../lib/housing/tourCrossing';

export interface TourTrayProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  onStart: () => void;
  onAdd: (id: string) => void;
}

/**
 * 右カラムのツアートレイ。番号付きの行き先リスト + 削除 + 「開始」。
 * 第1スパンは 追加/削除/開始 まで。DnD 並べ替えは後続で TourBuilderPane から移植。
 */
export const TourTray: React.FC<TourTrayProps> = ({ listingIds, onChange, onStart, onAdd }) => {
  const { t, i18n } = useTranslation();
  const listings = useHousingListingsStore((s) => s.listings);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);
  // 「+ 住所から追加」パネル (計画: 住所登録なし一時ツアー Task3) の開閉。
  const [addOpen, setAddOpen] = useState(false);

  // 行解決: 登録済み listing に無ければ一時 listing (計画: 住所登録なし一時ツアー Task2) を探す。
  // それ以外の既存挙動 (myListings 非考慮など) は変えない。
  const items = listingIds
    .map((id) => listings.find((l) => l.id === id) ?? ephemeral.find((l) => l.id === id))
    .filter((l): l is MockListing => Boolean(l));
  const empty = listingIds.length === 0;
  // トレイの非OCEアンカー地域 (OCEは日/米/欧と混在可なので除外)。一時追加パネルの跨ぎ早期ブロックに渡す。
  const trayRegion = tourAnchorRegion(items.map((i) => i.region));

  const remove = (id: string) => onChange(listingIds.filter((x) => x !== id));

  return (
    <div className="housing-tour-tray">
      <div className="housing-tour-tray-head">
        <span className="housing-tour-tray-title">{t('housing.tray.title')}</span>
        <span className="housing-tour-tray-count">
          {t('housing.tray.count', { count: listingIds.length })}
        </span>
      </div>

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
        onAdd={onAdd}
        trayRegion={trayRegion}
      />

      {empty ? (
        <div className="housing-empty-hint housing-tour-tray-empty">
          <Route size={20} aria-hidden="true" />
          <p>{t('housing.tray.empty')}</p>
        </div>
      ) : (
        <ol className="housing-tour-tray-list">
          {items.map((l, i) => (
            <li key={l.id} className="housing-tour-tray-item">
              <span className="housing-tour-tray-num">{i + 1}</span>
              <span className="housing-tour-tray-addr">{formatHousingAddress(l, i18n.language)}</span>
              {isEphemeralListingId(l.id) && (
                <span className="housing-ephemeral-badge">{t('housing.ephemeral.badge')}</span>
              )}
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
