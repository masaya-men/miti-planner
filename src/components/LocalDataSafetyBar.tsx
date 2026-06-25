import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { useLocalSafetySeenStore } from '../store/useLocalSafetySeenStore';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';

// マーキー速度: SystemNotificationBar と同じニュースティッカー速度 (60 px/sec)
const MARQUEE_SPEED_PX_PER_SEC = 60;
const MARQUEE_MIN_DURATION_S = 8;

interface Props {
  /** Sidebar 折りたたみ時 true。 アイコンのみ表示 */
  isCollapsed: boolean;
  /** 説明モーダルから既存バックアップ書き出しモーダルを開く */
  onOpenBackup: () => void;
}

export const LocalDataSafetyBar: React.FC<Props> = ({ isCollapsed, onOpenBackup }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const seen = useLocalSafetySeenStore((s) => s.seen);
  const markSeen = useLocalSafetySeenStore((s) => s.markSeen);
  const [open, setOpen] = useState(false);
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const label = t('local_safety.bar.label');

  // span の実幅から速度可変で marquee duration を算出 (SystemNotificationBar と同方式)。
  // early return より前に置く: hooks 順序を保つ (Rules of Hooks)。
  React.useLayoutEffect(() => {
    const el = spanRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const compute = () => {
      setDuration(Math.max(el.scrollWidth / MARQUEE_SPEED_PX_PER_SEC, MARQUEE_MIN_DURATION_S));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [label, isCollapsed]);

  // 非ログイン且つ表1件以上のときだけ常設。 hooks 全部の後で early return。
  if (user || planCount === 0) return null;

  const handleOpen = () => {
    setOpen(true);
    if (!seen) markSeen();
  };

  const handleBackup = () => {
    setOpen(false);
    onOpenBackup();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('local_safety.bar.aria')}
        className="w-full border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none cursor-pointer hover:bg-app-text/5 transition-colors text-left"
      >
        <span className="shrink-0 px-3 py-1.5 flex items-center text-app-text">
          <span className="relative flex">
            <ShieldAlert size={16} aria-hidden="true" />
            {!seen && (
              <span
                data-testid="local-safety-unread-dot"
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-app-bg"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
        {!isCollapsed && (
          <span className="flex-1 min-w-0 overflow-hidden py-1.5">
            <span
              ref={spanRef}
              className="text-app-sm text-app-text-muted system-notif-marquee"
              style={duration ? { animationDuration: `${duration}s` } : undefined}
            >
              {label}
            </span>
          </span>
        )}
      </button>
      <LocalDataSafetyModal isOpen={open} onClose={() => setOpen(false)} onOpenBackup={handleBackup} />
    </>
  );
};
