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
  party: () => <svg viewBox="0 0 16 16"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5M11 3a2.3 2.3 0 0 1 0 4.6M12.5 9.6c1.3.5 2 1.7 2 4.4" /></svg>,
  stat: () => <svg viewBox="0 0 16 16"><path d="M1.5 8h3l2-5 3 10 2-5h3" /></svg>,
  more: () => <svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="0.8" /><circle cx="8" cy="8" r="0.8" /><circle cx="12.5" cy="8" r="0.8" /></svg>,
  gear: () => <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.3" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" /></svg>,
  tut: () => <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.3v.2" /></svg>,
  globe: () => <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>,
  login: () => <svg viewBox="0 0 16 16"><path d="M9 2h4v12H9M2 8h8M7 5l3 3-3 3" /></svg>,
  // 同期(見本にない。円弧 2 本 + 矢じり。線の太さは他と同じ CSS 任せ)
  sync: () => <svg viewBox="0 0 16 16"><path d="M3 8a5 5 0 0 1 8.6-3.4M12 2v3H9M13 8a5 5 0 0 1-8.6 3.4M4 14v-3h3" /></svg>,
  // 表の操作列(見本 js:266-272)
  undo: () => <svg viewBox="0 0 16 16"><path d="M5.5 3 2.5 6l3 3M3 6h7a3.8 3.8 0 0 1 0 7.6H7" /></svg>,
  redo: () => <svg viewBox="0 0 16 16"><path d="m10.5 3 3 3-3 3M13 6H6a3.8 3.8 0 0 0 0 7.6h3" /></svg>,
  trash: () => <svg viewBox="0 0 16 16"><path d="M2.5 4h9M5.5 4V2.5h3V4M3.5 4l.7 9.5h5.6l.7-9.5" /><path d="M12.5 9.5l1.5 1.5 1.5-1.5" strokeWidth="1.3" /></svg>,
  aa: () => <svg viewBox="0 0 16 16"><path d="M2 13 6 3l4 10M3.5 9.5h5M12.5 5v6M9.5 8h6" /></svg>,
} satisfies Record<'plus' | 'share' | 'multi' | 'imp' | 'save' | 'rest' | 'dup' | 'rename' | 'close' | 'fold' | 'party' | 'stat' | 'more' | 'gear' | 'tut' | 'globe' | 'login' | 'sync' | 'undo' | 'redo' | 'trash' | 'aa', () => ReactElement>;
