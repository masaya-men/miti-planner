/**
 * Phase 3: 物件詳細ヘッダ右端の家主専用 ︙ メニュー。
 *
 * - 親側で「家主かどうか」 を判定し、 家主時だけレンダリングする想定
 * - クリック / Esc / 外側クリックで閉じる (基本的な popover 仕様)
 * - 編集 / 削除の 2 アクションのみ
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface HousingDetailKebabProps {
  onEdit: () => void;
  onDelete: () => void;
}

export const HousingDetailKebab: React.FC<HousingDetailKebabProps> = ({
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="housing-kebab" ref={ref}>
      <button
        type="button"
        aria-label={t('housing.detail.kebab.aria_label')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="housing-kebab-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="5" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="19" r="2" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="housing-kebab-menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            {t('housing.detail.kebab.edit')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="housing-kebab-item-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {t('housing.detail.kebab.delete')}
          </button>
        </div>
      )}
    </div>
  );
};
