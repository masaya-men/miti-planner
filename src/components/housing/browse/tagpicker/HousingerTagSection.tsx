import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listAllPersonalTags } from '../../../../lib/housing/personalTagLookup';
import type { PersonalTag } from '../../../../types/housing';

export interface HousingerTagSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * タグ検索「ハウジンガー」セクション。全員分の個人タグをチップで並べる (検索欄なし)。
 * design 2026-07-27-housing-tag-and-search-design.md §2。
 */
export const HousingerTagSection: React.FC<HousingerTagSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tags, setTags] = useState<PersonalTag[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAllPersonalTags()
      .then((result) => {
        if (cancelled) return;
        setTags(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = t('housing.tagpicker.housinger_section_title');

  return (
    <div className="housing-tagpicker-section">
      <button
        type="button"
        className="housing-tagpicker-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="housing-tagpicker-section-title">{title}</span>
      </button>
      {open && (
        <div className="housing-tagpicker-section-body">
          {status === 'loading' && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_loading')}</div>
          )}
          {status === 'error' && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_error')}</div>
          )}
          {status === 'ready' && tags.length === 0 && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_empty')}</div>
          )}
          {status === 'ready' && tags.length > 0 && (
            <div className="housing-tagpicker-chip-grid">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="housing-tagpicker-chip"
                  data-selected={selected.includes(tag.id) ? 'true' : 'false'}
                  onClick={() => onToggle(tag.id)}
                >
                  {tag.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
