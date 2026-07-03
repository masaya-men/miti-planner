/**
 * ハウジング用カスタム日時ピッカーの純関数群 (D5)。
 * ネイティブ datetime-local はポップアップの見た目を変更できないため、
 * LoPo (ハウジング) 世界観のカレンダー + 時刻手入力を自作する。
 * timestamp は epoch ms の number で持つ方針 (Global Constraint) を踏襲。
 */

export interface CalendarCell {
  y: number;
  /** 0-11 */
  m: number;
  d: number;
  /** 表示中の月に属する日か (前後月の埋めセルは false) */
  inMonth: boolean;
}

/**
 * 指定月のカレンダーグリッド (日曜開始・6週=42セル固定) を組む。
 * 42 固定にすると月によって行数が変わらず、ポップアップの高さが安定する。
 */
export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 日曜=0
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 + (i - startOffset));
    cells.push({
      y: date.getFullYear(),
      m: date.getMonth(),
      d: date.getDate(),
      inMonth: date.getMonth() === month && date.getFullYear() === year,
    });
  }
  return cells;
}

/** 全角数字/コロンを半角へ寄せる (スマホ IME 対策)。 */
function toHalfWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':');
}

/**
 * 時刻テキストを {h, min} に解釈する。許容形式:
 * - "18:30" / "8:5" (コロン区切り)
 * - "18" (裸の時 → 18:00)
 * - "1830" / "0805" (4桁数字)
 * 解釈できない/範囲外は null。
 */
export function parseTimeText(text: string): { h: number; min: number } | null {
  const t = toHalfWidth(text.trim());
  if (t === '') return null;

  let h: number;
  let min: number;
  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    h = Number(colon[1]);
    min = Number(colon[2]);
  } else if (/^\d{4}$/.test(t)) {
    h = Number(t.slice(0, 2));
    min = Number(t.slice(2));
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    min = 0;
  } else {
    return null;
  }

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

/** ローカル日時成分から epoch ms を組む。 */
export function composeLocalMs(y: number, m: number, d: number, h: number, min: number): number {
  return new Date(y, m, d, h, min, 0, 0).getTime();
}

/** "2026/07/31 (金) 18:30" 形式 (ロケール曜日入り) に整形する。 */
export function formatDateTimeWithWeekday(ms: number, locale: string): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} (${weekday}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "18:30" 形式 (時刻入力欄の表示用)。 */
export function formatTimeText(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ロケールの短い曜日ラベル (日曜開始 7 個)。2023-01-01 は日曜。 */
export function weekdayLabels(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
}
