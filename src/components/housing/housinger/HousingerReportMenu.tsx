/**
 * ハウジンガーページの「…」メニュー (通報)。本人以外が見ているときだけ親が置く。
 * HousingDetailKebab.tsx と同じ popover 仕様 (クリック/Esc/外側クリックで閉じる) を軽量実装
 * (項目が「報告する」1つだけなので共有コンポーネント化はしない)。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingerReportModal } from '../report/HousingerReportModal';
import { showToast } from '../../toastBus';

import { useDismissOnOutside } from '../../../hooks/useDismissOnOutside';
interface Props {
  viewerUid: string | null;
  housingerUid: string;
}

export const HousingerReportMenu: React.FC<Props> = ({ viewerUid, housingerUid }) => {
  const { t } = useTranslation();
  const [kebabOpen, setKebabOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useDismissOnOutside(kebabOpen, () => setKebabOpen(false), [kebabRef]);
  useEffect(() => {
    if (!kebabOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKebabOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [kebabOpen]);

  // HousingActionBar.tsx の onReportClick と同形 (未ログインならログイン案内、それ以外はモーダルを開く)。
  const onReportClick = () => {
    if (!viewerUid) {
      showToast(t('housing.detail.login_required'), 'info');
      return;
    }
    setReportOpen(true);
  };

  return (
    <div className="housing-kebab" ref={kebabRef}>
      <button
        type="button"
        aria-label={t('housing.detail.kebab.aria_label')}
        aria-haspopup="menu"
        aria-expanded={kebabOpen}
        className="housing-kebab-trigger housinger-page-kebab-trigger"
        onClick={() => setKebabOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="5" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="19" r="2" fill="currentColor" />
        </svg>
      </button>
      {kebabOpen && (
        <div role="menu" className="housing-kebab-menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setKebabOpen(false);
              onReportClick();
            }}
          >
            {t('housing.housinger.report.menuItem')}
          </button>
        </div>
      )}
      {reportOpen && (
        <HousingerReportModal
          open={reportOpen}
          housingerUid={housingerUid}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
};
