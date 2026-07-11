import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { HOUSING_AREAS, type HousingArea } from '../../../../types/housing';
import { getAreaName } from '../../../../lib/housing/areaName';
import type { WardMapKind } from '../../../../lib/housing/browseMapSpots';

export interface MapControlsProps {
  area: HousingArea;
  ward: number;
  mapKind: WardMapKind;
  /** ward番号 (1〜30) → 現在の area・フィルタ適用後の件数。0件の区は未登録 (Map に無い) 扱い。 */
  wardCounts: Map<number, number>;
  kindCounts: { main: number; sub: number };
  onAreaChange: (area: HousingArea) => void;
  onWardChange: (ward: number) => void;
  onKindChange: (kind: WardMapKind) => void;
}

const WARDS = Array.from({ length: 30 }, (_, i) => i + 1);
const KINDS: WardMapKind[] = ['main', 'sub'];
const MIN_WARD = 1;
const MAX_WARD = 30;

/**
 * area/ward の切替先の kindCounts から、自動セットすべき mapKind を決める純関数
 * (spec Task6:「area/ward 変更時: mapKind は件数が多い側へ自動セット (両方 0 なら main)」)。
 * 呼び出し側 (BrowseMapView) が切替先の kindCounts を先読みして計算し、これに通す。
 * 同数 (0件同士を含む) は本街 (main) を優先する。
 */
export function autoSelectMapKind(kindCounts: { main: number; sub: number }): WardMapKind {
  return kindCounts.sub > kindCounts.main ? 'sub' : 'main';
}

/**
 * 地図モードの操作列 (spec §3.3、plan Task6)。
 * 住宅街切替 (5ボタンのセグメント) + 区ドロップダウン (`BrowseSortSelect.tsx` と同形、前後矢印つき)
 * + 本街/拡張街タブ (件数付き) の3ブロックを横に並べる。件数は常に呼び出し側が渡す
 * 「現在のフィルタ適用後」の値をそのまま表示する (このコンポーネント自身は集計しない)。
 */
export const MapControls: React.FC<MapControlsProps> = ({
  area,
  ward,
  mapKind,
  wardCounts,
  kindCounts,
  onAreaChange,
  onWardChange,
  onKindChange,
}) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wardRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wardRootRef.current && !wardRootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const goWard = (next: number) => {
    if (next < MIN_WARD || next > MAX_WARD) return;
    onWardChange(next);
  };

  return (
    <div className="housing-mapctl" data-testid="housing-map-controls">
      <div className="housing-mapctl-areas" role="group" aria-label={t('housing.workspace.filter.area')}>
        {HOUSING_AREAS.map((a) => (
          <button
            key={a}
            type="button"
            className="housing-mapctl-area-btn"
            data-testid={`housing-mapctl-area-${a}`}
            data-selected={area === a ? 'true' : 'false'}
            onClick={() => onAreaChange(a)}
          >
            {getAreaName(a, i18n.language)}
          </button>
        ))}
      </div>

      <div className="housing-mapctl-ward" ref={wardRootRef} data-open={open ? 'true' : 'false'}>
        <button
          type="button"
          className="housing-mapctl-ward-arrow"
          data-testid="housing-mapctl-ward-prev"
          aria-label={t('housing.map.prev_ward')}
          disabled={ward <= MIN_WARD}
          onClick={() => goWard(ward - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>

        <div className="housing-mapctl-ward-select">
          <button
            type="button"
            className="housing-mapctl-ward-trigger"
            data-testid="housing-mapctl-ward-trigger"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span>{t('housing.map.ward_label', { ward })}</span>
            <ChevronDown size={14} aria-hidden="true" className="housing-mapctl-ward-chevron" />
          </button>
          {open && (
            <ul
              className="housing-mapctl-ward-menu"
              role="listbox"
              aria-label={t('housing.map.ward_label', { ward })}
            >
              {WARDS.map((n) => (
                <li key={n}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={ward === n}
                    data-selected={ward === n ? 'true' : 'false'}
                    data-testid={`housing-mapctl-ward-option-${n}`}
                    className="housing-mapctl-ward-option"
                    onClick={() => {
                      onWardChange(n);
                      setOpen(false);
                    }}
                  >
                    {t('housing.map.ward_count', { ward: n, count: wardCounts.get(n) ?? 0 })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="housing-mapctl-ward-arrow"
          data-testid="housing-mapctl-ward-next"
          aria-label={t('housing.map.next_ward')}
          disabled={ward >= MAX_WARD}
          onClick={() => goWard(ward + 1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="housing-mapctl-kind" role="tablist">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mapKind === k}
            data-selected={mapKind === k ? 'true' : 'false'}
            data-testid={`housing-mapctl-kind-${k}`}
            className="housing-mapctl-kind-btn"
            onClick={() => onKindChange(k)}
          >
            {t('housing.map.tab_count', { label: t(`housing.map.${k}_tab`), count: kindCounts[k] })}
          </button>
        ))}
      </div>
    </div>
  );
};
