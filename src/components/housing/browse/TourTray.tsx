import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Plus } from 'lucide-react';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import type { MockListing } from '../../../data/housing/mockListings';
import { EphemeralAddPanel } from './EphemeralAddPanel';
import { tourAnchorRegion } from '../../../lib/housing/tourCrossing';
import { TourTrayList } from './TourTrayList';

export interface TourTrayProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  onStart: () => void;
  onAdd: (id: string) => void;
}

/**
 * 右カラムのツアートレイ。番号付きの行き先リスト (TourTrayList: ドラッグ並び替え + 固定ピン +
 * 効率順ボタン) + 「開始」。行き先リスト本体は TourTrayList に集約し、スマホの並べ替えシートと共有する。
 */
export const TourTray: React.FC<TourTrayProps> = ({ listingIds, onChange, onStart, onAdd }) => {
  const { t } = useTranslation();
  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);
  // 「+ 住所から追加」パネル (計画: 住所登録なし一時ツアー Task3) の開閉。
  const [addOpen, setAddOpen] = useState(false);

  // 行解決: 公開一覧 → 自分の登録 (myListings・完全非公開/期限切れ含む) → 一時 listing の順で探す。
  // myListings を含めないと、完全非公開(private)の家を追加したとき行が解決できず、
  // トレイの件数だけ増えて中身が空に見える (実機で判明・#6)。
  // ここでの items は「一時追加パネルの跨ぎ早期ブロック」用の地域算出だけに使う
  // (実際の行き先リスト描画・順序解決は TourTrayList に委譲)。
  const items = listingIds
    .map(
      (id) =>
        listings.find((l) => l.id === id) ??
        myListings.find((l) => l.id === id) ??
        ephemeral.find((l) => l.id === id),
    )
    .filter((l): l is MockListing => Boolean(l));
  const empty = listingIds.length === 0;
  // トレイの非OCEアンカー地域 (OCEは日/米/欧と混在可なので除外)。一時追加パネルの跨ぎ早期ブロックに渡す。
  const trayRegion = tourAnchorRegion(items.map((i) => i.region));

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

      <TourTrayList listingIds={listingIds} onChange={onChange} />

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
