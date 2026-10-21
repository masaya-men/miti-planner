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

const running = new WeakMap<Element, Animation>();

/** 再生中の滑りがあれば止め、今の見かけの横ずれ(px)を返す。なければ 0 */
function cancelRunning(el: Element): number {
  const a = running.get(el);
  if (!a) return 0;
  running.delete(el);
  if (a.playState === 'finished' || a.playState === 'idle') return 0;
  const before = el.getBoundingClientRect().left;
  a.cancel();
  return before - el.getBoundingClientRect().left;
}

function play(el: Element, dx: number, delay: number, kf: (dx: number) => Keyframe[], ms: number): void {
  if (typeof el.animate !== 'function') return;
  // アニメ途中の再並び替え: 前のを止めて、今の見かけの位置から始める
  const a = el.animate(kf(dx + cancelRunning(el)), { duration: ms, delay, fill: 'backwards' });
  if (a) running.set(el, a);
}

/** 差込口を滑らせる。要素が animate を持たない環境では何もしない */
export const playJackSlide = (el: Element, dx: number, delay: number): void => play(el, dx, delay, jackSlideKeyframes, JACK_SLIDE_MS);
/** 効果アイコンを滑らせる */
export const playMitSlide = (el: Element, dx: number, delay: number): void => play(el, dx, delay, mitSlideKeyframes, MIT_SLIDE_MS);
