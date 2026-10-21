import { useEffect } from 'react';
import { onPower } from './power';

/**
 * 電源投入のランプ順点灯(見本 js:1166)。点灯中のランプ(NET 以外)を一旦消し、180 + i*45ms で点灯 + flick。
 * 対象はヘッダー・サイドバーなど MIL-SPEC の画面にある MilspecLed のうち is-on のもの(DOM を直接拾う)。
 * 戻り値 = 途中で止める関数
 */
export function sequenceLamps(): () => void {
  const lamps = [...document.querySelectorAll<HTMLElement>('.milspec-app .milspec-led.is-on')]
    .filter((l) => !l.closest('[data-lamp="net"]'));
  lamps.forEach((l) => l.classList.remove('is-on'));
  const timers = lamps.map((l, i) => window.setTimeout(() => l.classList.add('is-on', 'is-flick'), 180 + i * 45));
  return () => timers.forEach((id) => window.clearTimeout(id));
}

/** MilspecLayout が 1 度だけ呼ぶ。電源が入ったとき(動きを減らす場合を除く)にランプを順に点ける */
export function useLampSequence(): void {
  useEffect(() => {
    let cancel: () => void = () => {};
    const off = onPower((e) => {
      if (e.state !== 'on' || e.reduced) return;
      cancel();
      cancel = sequenceLamps();
    });
    return () => { off(); cancel(); };
  }, []);
}
