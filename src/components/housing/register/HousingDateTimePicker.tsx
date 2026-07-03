import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  buildCalendarGrid,
  parseTimeText,
  composeLocalMs,
  formatDateTimeWithWeekday,
  formatTimeText,
  weekdayLabels,
} from '../../../lib/housing/dateTimePicker';

interface Props {
  /** epoch ms。未設定は null。 */
  valueMs: number | null;
  onChange: (ms: number | null) => void;
}

/** 日付だけ選んだときの既定時刻 = その日いっぱい (公開終了の意味に合わせる)。 */
const DEFAULT_H = 23;
const DEFAULT_MIN = 59;

/**
 * ハウジング世界観のカスタム日時ピッカー (D5)。
 * ネイティブ datetime-local はポップアップの見た目を変更できない (ブラウザ chrome) ため、
 * カレンダー + 時刻手入力 (18:30 形式) を自作する。表示は曜日入り
 * 「2026/07/31 (金) 18:30」。ロジックは lib/housing/dateTimePicker の純関数群。
 */
export const HousingDateTimePicker: React.FC<Props> = ({ valueMs, onChange }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(false);
  const now = new Date();
  const base = valueMs != null ? new Date(valueMs) : now;
  const [viewY, setViewY] = useState(base.getFullYear());
  const [viewM, setViewM] = useState(base.getMonth());
  const [timeText, setTimeText] = useState(valueMs != null ? formatTimeText(valueMs) : '');
  const rootRef = useRef<HTMLDivElement>(null);

  // 外側クリック / Escape で閉じる (開いている間だけ購読)。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 親からの value 変化 (復元等) に時刻欄を追随させる。
  useEffect(() => {
    setTimeText(valueMs != null ? formatTimeText(valueMs) : '');
  }, [valueMs]);

  const grid = useMemo(() => buildCalendarGrid(viewY, viewM), [viewY, viewM]);
  const weekdays = useMemo(() => weekdayLabels(lang), [lang]);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long' }).format(new Date(viewY, viewM, 1)),
    [lang, viewY, viewM],
  );

  const selected = valueMs != null ? new Date(valueMs) : null;
  const isSelected = (y: number, m: number, d: number) =>
    !!selected && selected.getFullYear() === y && selected.getMonth() === m && selected.getDate() === d;
  const isToday = (y: number, m: number, d: number) =>
    now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;

  const moveMonth = (delta: number) => {
    const next = new Date(viewY, viewM + delta, 1);
    setViewY(next.getFullYear());
    setViewM(next.getMonth());
  };

  /** 日付セル選択: 既存の時刻 (無ければ 23:59) を保って合成。 */
  const pickDay = (y: number, m: number, d: number) => {
    const h = selected ? selected.getHours() : DEFAULT_H;
    const min = selected ? selected.getMinutes() : DEFAULT_MIN;
    onChange(composeLocalMs(y, m, d, h, min));
  };

  /** 時刻欄の確定 (blur / Enter)。不正入力は現値へ静かに戻す。 */
  const commitTime = () => {
    const parsed = parseTimeText(timeText);
    if (!parsed) {
      setTimeText(valueMs != null ? formatTimeText(valueMs) : '');
      return;
    }
    const d = selected ?? now;
    onChange(composeLocalMs(d.getFullYear(), d.getMonth(), d.getDate(), parsed.h, parsed.min));
  };

  const pickToday = () => {
    const h = selected ? selected.getHours() : DEFAULT_H;
    const min = selected ? selected.getMinutes() : DEFAULT_MIN;
    onChange(composeLocalMs(now.getFullYear(), now.getMonth(), now.getDate(), h, min));
    setViewY(now.getFullYear());
    setViewM(now.getMonth());
  };

  return (
    <div className="housing-dtp" ref={rootRef}>
      <button
        type="button"
        className="housing-dtp-trigger housing-input"
        data-testid="housing-dtp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={15} aria-hidden="true" className="housing-dtp-trigger-icon" />
        {valueMs != null ? (
          <span>{formatDateTimeWithWeekday(valueMs, lang)}</span>
        ) : (
          <span className="housing-dtp-placeholder">{t('housing.register.visibility.picker.placeholder')}</span>
        )}
      </button>

      {open && (
        <div className="housing-dtp-popover" role="dialog" data-testid="housing-dtp-popover">
          <div className="housing-dtp-header">
            <span className="housing-dtp-month">{monthLabel}</span>
            <div className="housing-dtp-nav">
              <button
                type="button"
                className="housing-dtp-nav-btn"
                aria-label={t('housing.register.visibility.picker.prev_month')}
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="housing-dtp-nav-btn"
                aria-label={t('housing.register.visibility.picker.next_month')}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="housing-dtp-weekdays" aria-hidden="true">
            {weekdays.map((w, i) => (
              <span key={w} className="housing-dtp-weekday" data-dow={i}>{w}</span>
            ))}
          </div>

          <div className="housing-dtp-grid">
            {grid.map((c) => (
              <button
                key={`${c.y}-${c.m}-${c.d}`}
                type="button"
                className="housing-dtp-day"
                data-in-month={c.inMonth ? 'true' : 'false'}
                data-selected={isSelected(c.y, c.m, c.d) ? 'true' : 'false'}
                data-today={isToday(c.y, c.m, c.d) ? 'true' : 'false'}
                onClick={() => pickDay(c.y, c.m, c.d)}
              >
                {c.d}
              </button>
            ))}
          </div>

          <div className="housing-dtp-time-row">
            <label className="housing-dtp-time-label" htmlFor="housing-dtp-time">
              {t('housing.register.visibility.picker.time_label')}
            </label>
            <input
              id="housing-dtp-time"
              type="text"
              inputMode="numeric"
              className="housing-input housing-dtp-time-input"
              data-testid="housing-dtp-time-input"
              placeholder="23:59"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              onBlur={commitTime}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTime();
                }
              }}
            />
          </div>

          <div className="housing-dtp-actions">
            <button type="button" className="housing-dtp-action" onClick={() => onChange(null)}>
              {t('housing.register.visibility.picker.clear')}
            </button>
            <button type="button" className="housing-dtp-action" onClick={pickToday}>
              {t('housing.register.visibility.picker.today')}
            </button>
            <button
              type="button"
              className="housing-dtp-action housing-dtp-action-primary"
              onClick={() => setOpen(false)}
            >
              {t('housing.register.visibility.picker.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
