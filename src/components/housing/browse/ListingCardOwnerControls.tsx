import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { scalePx } from '../../../lib/housing/housingScale';
import type { MockListing } from '../../../data/housing/mockListings';

interface ListingCardOwnerControlsProps {
  listing: MockListing;
  visibilityMenuOpen: boolean;
  setVisibilityMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  visibilityMenuPos: { top: number; right: number } | null;
  setVisibilityMenuPos: React.Dispatch<React.SetStateAction<{ top: number; right: number } | null>>;
  visibilityBtnRef: React.RefObject<HTMLButtonElement | null>;
  visibilityMenuPortalRef: React.RefObject<HTMLDivElement | null>;
  onRequestVisibilityChange?: (id: string, next: 'public' | 'unlisted' | 'private') => void;
  onEditListing?: (id: string) => void;
}

/** ListingCard (マイページ) の家主向け管理コントロール: 公開状態バッジ+切替メニュー+編集ボタン。 */
export const ListingCardOwnerControls: React.FC<ListingCardOwnerControlsProps> = ({
  listing,
  visibilityMenuOpen,
  setVisibilityMenuOpen,
  visibilityMenuPos,
  setVisibilityMenuPos,
  visibilityBtnRef,
  visibilityMenuPortalRef,
  onRequestVisibilityChange,
  onEditListing,
}) => {
  const { t } = useTranslation();
  return (
    <>
          <button
            ref={visibilityBtnRef}
            type="button"
            className="housing-card-visibility-badge housing-card-visibility-badge-overlay"
            aria-haspopup="menu"
            aria-expanded={visibilityMenuOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (!visibilityMenuOpen && visibilityBtnRef.current) {
                const rect = visibilityBtnRef.current.getBoundingClientRect();
                setVisibilityMenuPos({ top: rect.bottom + scalePx(4), right: window.innerWidth - rect.right });
              }
              setVisibilityMenuOpen((v) => !v);
            }}
          >
            {t(`housing.register.visibility.${listing.visibility ?? 'public'}`)}
          </button>

        {/* カード自体が overflow:hidden なのでメニューは body 直下に portal し、
            ボタンの画面座標を基準に fixed 配置する (2026-07-24 実機指摘)。 */}
        {visibilityMenuOpen && visibilityMenuPos && createPortal(
          <div
            ref={visibilityMenuPortalRef}
            role="menu"
            className="housing-card-visibility-menu housing-card-visibility-menu-portal"
            style={{ top: `${visibilityMenuPos.top}px`, right: `${visibilityMenuPos.right}px` }}
          >
            {(['public', 'unlisted', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="menuitem"
                disabled={(listing.visibility ?? 'public') === v}
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibilityMenuOpen(false);
                  onRequestVisibilityChange?.(listing.id, v);
                }}
              >
                {t(`housing.register.visibility.${v}`)}
              </button>
            ))}
          </div>,
          document.body,
        )}

          <button
            type="button"
            className="housing-card-edit-btn housing-card-edit-btn-overlay"
            aria-label={t('housing.mypage.editListing')}
            title={t('housing.mypage.editListing')}
            onClick={(e) => {
              e.stopPropagation();
              onEditListing?.(listing.id);
            }}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
    </>
  );
};
