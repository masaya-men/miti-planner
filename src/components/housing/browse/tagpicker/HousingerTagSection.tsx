import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listPublishedHousingers, type PublishedHousinger } from '../../../../lib/housing/publishedHousingers';
import { personalTagIdForUid } from '../../../../lib/housing/housingerProfile';
import { HousingerAvatar } from '../../housinger/HousingerAvatar';

export interface HousingerTagSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * タグ検索「ハウジンガー」セクション。マイページを公開している全員をチップで並べる (検索欄なし)。
 * design 2026-07-27-housing-tag-and-search-design.md §2 / 2026-08-04 個人タグ廃止でデータ元を
 * housing_profiles に変更 (design 2026-08-04-housing-tag-search-by-owner-design.md §3.1)。
 */
export const HousingerTagSection: React.FC<HousingerTagSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [housingers, setHousingers] = useState<PublishedHousinger[]>([]);

  useEffect(() => {
    let cancelled = false;
    listPublishedHousingers()
      .then((result) => {
        if (cancelled) return;
        setHousingers(result);
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
          {status === 'ready' && housingers.length === 0 && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_empty')}</div>
          )}
          {status === 'ready' && housingers.length > 0 && (
            <div className="housing-tagpicker-chip-grid">
              {housingers.map((h) => {
                const filterId = personalTagIdForUid(h.uid);
                return (
                  <button
                    key={h.uid}
                    type="button"
                    className="housing-tagpicker-chip"
                    data-selected={selected.includes(filterId) ? 'true' : 'false'}
                    onClick={() => onToggle(filterId)}
                  >
                    <HousingerAvatar avatarUrl={h.avatarUrl ?? null} name={h.displayName} className="housing-tagpicker-chip-avatar" />
                    <span>{h.displayName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
