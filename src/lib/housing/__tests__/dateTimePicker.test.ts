import { describe, it, expect } from 'vitest';
import {
  buildCalendarGrid,
  parseTimeText,
  composeLocalMs,
  formatDateTimeWithWeekday,
} from '../dateTimePicker';

describe('buildCalendarGrid', () => {
  it('2026年7月 (水曜始まり) を日曜開始 42 セルで組む', () => {
    const grid = buildCalendarGrid(2026, 6); // month は 0-11
    expect(grid).toHaveLength(42);
    // 2026-07-01 は水曜 → 先頭は前月 6/28 (日)
    expect(grid[0]).toMatchObject({ y: 2026, m: 5, d: 28, inMonth: false });
    expect(grid[3]).toMatchObject({ y: 2026, m: 6, d: 1, inMonth: true });
    expect(grid[33]).toMatchObject({ y: 2026, m: 6, d: 31, inMonth: true });
    expect(grid[34]).toMatchObject({ y: 2026, m: 7, d: 1, inMonth: false });
  });

  it('月初が日曜の月 (2026年11月) は先頭が当月 1 日', () => {
    const grid = buildCalendarGrid(2026, 10);
    expect(grid[0]).toMatchObject({ y: 2026, m: 10, d: 1, inMonth: true });
  });

  it('うるう年 2 月 (2028) は 29 日を含む', () => {
    const grid = buildCalendarGrid(2028, 1);
    expect(grid.some((c) => c.inMonth && c.d === 29)).toBe(true);
    expect(grid.some((c) => c.inMonth && c.d === 30)).toBe(false);
  });

  it('年跨ぎ: 2026年1月の先頭は 2025年12月', () => {
    const grid = buildCalendarGrid(2026, 0);
    // 2026-01-01 は木曜 → 先頭は 2025-12-28 (日)
    expect(grid[0]).toMatchObject({ y: 2025, m: 11, d: 28, inMonth: false });
  });
});

describe('parseTimeText', () => {
  it('HH:MM を解釈する', () => {
    expect(parseTimeText('18:30')).toEqual({ h: 18, min: 30 });
    expect(parseTimeText('8:5')).toEqual({ h: 8, min: 5 });
    expect(parseTimeText('00:00')).toEqual({ h: 0, min: 0 });
    expect(parseTimeText('23:59')).toEqual({ h: 23, min: 59 });
  });

  it('全角コロン・全角数字も許容する (スマホ IME 対策)', () => {
    expect(parseTimeText('１８：３０')).toEqual({ h: 18, min: 30 });
  });

  it('裸の時 (18) は 18:00 と解釈する', () => {
    expect(parseTimeText('18')).toEqual({ h: 18, min: 0 });
  });

  it('4桁数字 (1830) は 18:30 と解釈する', () => {
    expect(parseTimeText('1830')).toEqual({ h: 18, min: 30 });
    expect(parseTimeText('0805')).toEqual({ h: 8, min: 5 });
  });

  it('範囲外・不正は null', () => {
    expect(parseTimeText('24:00')).toBeNull();
    expect(parseTimeText('12:60')).toBeNull();
    expect(parseTimeText('')).toBeNull();
    expect(parseTimeText('abc')).toBeNull();
    expect(parseTimeText('12:34:56')).toBeNull();
  });
});

describe('composeLocalMs / formatDateTimeWithWeekday', () => {
  it('ローカル日時から epoch ms を組み、表示に曜日が入る (ja)', () => {
    const ms = composeLocalMs(2026, 6, 31, 18, 30);
    const d = new Date(ms);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()])
      .toEqual([2026, 6, 31, 18, 30]);
    const text = formatDateTimeWithWeekday(ms, 'ja');
    expect(text).toContain('2026');
    expect(text).toContain('18:30');
    expect(text).toMatch(/金/); // 2026-07-31 は金曜
  });

  it('en ロケールでも曜日入りで整形される', () => {
    const ms = composeLocalMs(2026, 6, 31, 18, 30);
    const text = formatDateTimeWithWeekday(ms, 'en');
    expect(text).toMatch(/Fri/);
  });
});
