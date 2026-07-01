import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

export type BrowseSortOrder = 'newest' | 'oldest';

export interface BrowseSortSelectProps {
  value: BrowseSortOrder;
  onChange: (v: BrowseSortOrder) => void;
}

const ORDERS: BrowseSortOrder[] = ['newest', 'oldest'];

/**
 * 中央ツールバーの並び替え (参考UI「並び替え: 新着順 ▼」)。
 * overflow パネル内でも安全なよう、短いメニューを下方向に絶対配置で開く。
 */
export const BrowseSortSelect: React.FC<BrowseSortSelectProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const labelOf = (o: BrowseSortOrder) => t(`housing.browse.sort_${o}`);

  return (
    <div className="housing-sort" ref={rootRef} data-open={open ? 'true' : 'false'}>
      <span className="housing-sort-label">{t('housing.browse.sort_label')}</span>
      <button
        type="button"
        className="housing-sort-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{labelOf(value)}</span>
        <ChevronDown size={14} aria-hidden="true" className="housing-sort-chevron" />
      </button>
      {open && (
        <ul className="housing-sort-menu" role="listbox" aria-label={t('housing.browse.sort_label')}>
          {ORDERS.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={value === o}
                data-selected={value === o ? 'true' : 'false'}
                className="housing-sort-option"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                <span className="housing-sort-option-check" aria-hidden="true">
                  {value === o && <Check size={13} />}
                </span>
                {labelOf(o)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
