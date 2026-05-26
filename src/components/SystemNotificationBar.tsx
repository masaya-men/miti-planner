import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useSystemNotifications } from '../store/useSystemNotifications';
import { SystemNotificationModal } from './SystemNotificationModal';
import { resolveLocalized } from '../lib/localizedText';

interface Props {
  /** Sidebar が折りたたまれているとき true。 マーキー非表示、 ベルのみに */
  isCollapsed: boolean;
}

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';
function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

// マーキー速度: 60 px/sec = 日本語 ~4 文字/sec、 業界標準的なニュースティッカー速度
const MARQUEE_SPEED_PX_PER_SEC = 60;
// 短文での「速すぎ」 防止用の下限
const MARQUEE_MIN_DURATION_S = 8;

export const SystemNotificationBar: React.FC<Props> = ({ isCollapsed }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const { latestUnread, markRead } = useSystemNotifications();
  const [open, setOpen] = useState(false);
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  // バーはタイトルのみ流す (本文はクリックでモーダル展開、 長文時に速度爆発する問題を構造的に解消)
  // latestUnread null 時も hooks 順序を保つため空文字で受ける
  const marqueeText = latestUnread ? resolveLocalized(latestUnread.title, lang) : '';

  // span の実幅から速度可変で duration を算出 (元: 18s 固定で本文長に応じ爆速化していた)
  // early return より前に置く: latestUnread の有無で hook 数が変わると Rules of Hooks 違反 (React #310)
  React.useLayoutEffect(() => {
    const el = spanRef.current;
    const parent = el?.parentElement;
    if (!el || !parent || !marqueeText) return;
    const compute = () => {
      setDuration(Math.max(el.scrollWidth / MARQUEE_SPEED_PX_PER_SEC, MARQUEE_MIN_DURATION_S));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [marqueeText]);

  // 未読 0 → バー枠ごと描画しない (Sidebar が縮む)。 hooks 全部の後で early return
  if (!latestUnread) return null;

  function handleClose() {
    setOpen(false);
    if (latestUnread) markRead(latestUnread.id);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('system_notif.bar.aria_bell')}
        className="w-full border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none cursor-pointer hover:bg-app-text/5 transition-colors text-left"
      >
        <span className="shrink-0 px-3 py-1.5 flex items-center text-app-text">
          <Bell size={16} aria-hidden="true" />
        </span>
        {!isCollapsed && (
          <span className="flex-1 min-w-0 overflow-hidden py-1.5">
            <span
              ref={spanRef}
              className="text-app-sm text-app-text-muted system-notif-marquee"
              style={duration ? { animationDuration: `${duration}s` } : undefined}
            >
              {marqueeText}
            </span>
          </span>
        )}
      </button>
      <SystemNotificationModal isOpen={open} notif={latestUnread} onClose={handleClose} />
    </>
  );
};
