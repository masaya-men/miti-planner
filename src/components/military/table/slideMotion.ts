// 並び替えの滑り(見本 v11 js:640-647 効果アイコン / js:653-664 差込口)。WAAPI のキーフレームと再生。
// 抜ける → 浮いたまま重く滑る → 差さってガチッ。dx = 前の x - 今の x(今の位置から見た元の位置)。

const keys = (dx: number, lift: number, scale: number, sink: number, settle: number, sinkScale: number): Keyframe[] => [
  { transform: `translate(${dx}px, 0px)`, easing: 'cubic-bezier(.3,0,.2,1)' },
  { transform: `translate(${dx}px, ${lift}px) scale(${scale})`, offset: 0.2, easing: 'cubic-bezier(.65,0,.35,1)' },
  { transform: `translate(0px, ${lift}px) scale(${scale})`, offset: 0.74, easing: 'cubic-bezier(.6,0,1,.6)' },
  { transform: `translate(0px, ${sink}px) scale(${sinkScale})`, offset: 0.86 },
  { transform: `translate(0px, ${settle}px)`, offset: 0.94 },
  { transform: 'none' },
];

/** 差込口(880ms) */
export const jackSlideKeyframes = (dx: number): Keyframe[] => keys(dx, -3.4, 1.04, 0.9, -0.3, 0.985);
/** 効果アイコン(820ms) */
export const mitSlideKeyframes = (dx: number): Keyframe[] => keys(dx, -3, 1.06, 0.8, -0.25, 0.99);

export const JACK_SLIDE_MS = 880;
export const MIT_SLIDE_MS = 820;

/** 差込口を滑らせる。要素が animate を持たない環境では何もしない */
export function playJackSlide(el: Element, dx: number, delay: number): void {
  if (typeof el.animate !== 'function') return;
  el.animate(jackSlideKeyframes(dx), { duration: JACK_SLIDE_MS, delay, fill: 'backwards' });
}
/** 効果アイコンを滑らせる */
export function playMitSlide(el: Element, dx: number, delay: number): void {
  if (typeof el.animate !== 'function') return;
  el.animate(mitSlideKeyframes(dx), { duration: MIT_SLIDE_MS, delay, fill: 'backwards' });
}
