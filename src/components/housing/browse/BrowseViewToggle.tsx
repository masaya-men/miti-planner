import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import type { HousingBrowseView } from '../../../store/useHousingViewStore';
import './BrowseViewToggle.css';

import { useDismissOnOutside } from '../../../hooks/useDismissOnOutside';
export interface BrowseViewToggleProps {
  value: HousingBrowseView;
  onChange: (v: HousingBrowseView) => void;
  /** マップ表示中に「マップ ▾ {DC名}」と出す DC の表示名。未選択なら省略。 */
  mapDcLabel?: string | null;
  /** マップの DC メニュー (開いている時だけ「マップ」ボタンの下に出る)。 */
  mapMenu?: ReactNode;
  mapMenuOpen?: boolean;
  onMapMenuClose?: () => void;
}

const VIEWS: HousingBrowseView[] = ['list', 'map', 'tags', 'housinger'];

/**
 * 探す中央パネル上部の「一覧 | 地図」切替 (spec 3.1)。
 * `ListingGrid.tsx` に温存されていた設計位置を、中央カラムの上部 (トグル + 分岐) として実装する。
 */
export const BrowseViewToggle: React.FC<BrowseViewToggleProps> = ({
  value, onChange, mapDcLabel, mapMenu, mapMenuOpen = false, onMapMenuClose,
}) => {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);

  // DC メニューは外側クリック / Esc で閉じる。「マップ」ボタン自体は anchor の内側なので、
  // 押した時の開閉トグルと二重に反応しない。
  useDismissOnOutside(mapMenuOpen === true && !!onMapMenuClose, () => onMapMenuClose?.(), [anchorRef]);

  useEffect(() => {
    if (!mapMenuOpen || !onMapMenuClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMapMenuClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapMenuOpen, onMapMenuClose]);

  const labelOf = (v: HousingBrowseView) => t(`housing.browse.view_${v}`);

  return (
    <div className="housing-view-toggle-anchor" ref={anchorRef} data-menu-open={mapMenuOpen ? 'true' : undefined}>
      <div className="housing-view-toggle" role="tablist" aria-label={t('housing.browse.view_aria')}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={value === v}
            data-selected={value === v ? 'true' : 'false'}
            data-view={v}
            aria-haspopup={v === 'map' ? 'true' : undefined}
            aria-expanded={v === 'map' && value === 'map' ? mapMenuOpen : undefined}
            className="housing-view-toggle-btn"
            onClick={() => onChange(v)}
          >
            {labelOf(v)}
            {v === 'map' && value === 'map' && (
              <>
                <ChevronDown size={12} aria-hidden="true" className="housing-view-toggle-caret" />
                {mapDcLabel ? <span className="housing-view-toggle-dc">{mapDcLabel}</span> : null}
              </>
            )}
          </button>
        ))}
      </div>
      {mapMenuOpen && mapMenu}
    </div>
  );
};
