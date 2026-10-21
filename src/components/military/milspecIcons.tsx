import type { ReactElement } from 'react';

// MIL-SPEC v11 サイドバーのアイコン(見本 milspec-v11.js の ICON と ops / fold の SVG)。
// 線の色・太さは CSS 側で決める。ここは形だけ。

export const MsIcon = {
  plus: () => <svg viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" /></svg>,
  share: () => <svg viewBox="0 0 16 16"><path d="M11 5 5 8l6 3" /><circle cx="12" cy="4" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="4" cy="8" r="1.6" /></svg>,
  multi: () => <svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M5.5 8.2l1.8 1.8 3.4-3.6" /></svg>,
  imp: () => <svg viewBox="0 0 16 16"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2 12v2h12v-2" /></svg>,
  save: () => <svg viewBox="0 0 16 16"><path d="M3 3h8l2 2v8H3zM5.5 3v3h4V3M5 13v-3.5h6V13" /></svg>,
  rest: () => <svg viewBox="0 0 16 16"><path d="M8 12V4M4.5 7.5 8 4l3.5 3.5M2 13.5h12" /></svg>,
  dup: () => <svg viewBox="0 0 10 10"><path d="M3 3h5v5H3zM2 7H1V1h6v1" /></svg>,
  rename: () => <svg viewBox="0 0 10 10"><path d="M2 8l.5-2L7 1.5 8.5 3 4 7.5z" /></svg>,
  close: () => <svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2 2 8" /></svg>,
  fold: () => <svg viewBox="0 0 8 8"><path d="M1 2.5 4 5.5 7 2.5" /></svg>,
} satisfies Record<'plus' | 'share' | 'multi' | 'imp' | 'save' | 'rest' | 'dup' | 'rename' | 'close' | 'fold', () => ReactElement>;
