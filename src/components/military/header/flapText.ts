// 銘板の文字: パタパタ(発車標)式に 1 文字ずつめくれて切り替わる。
// 見本 milspec-v11.js:732-750 の flapText をそのまま移す(時間・乱数の幅は見本のまま)。
// 違いは 2 点だけ: ① 文字幅は document.fonts.ready の後に測る ② 戻り値の cancel でタイマーを全部止められる。

const GLY = 'アイウエオカキクケコサシスセソタチツテトナハマヤラワ零式絶天座級層機甲0123456789';

/** 次の描画で CSS アニメを頭から再生し直す(見本の void c.offsetWidth と同じ) */
const restart = (c: HTMLElement, on: 'f' | 's') => {
  c.classList.remove('f', 's');
  void c.offsetWidth;
  c.classList.add(on);
};

/** node の中身を text に切り替える。reduced なら即時。戻り値 = 途中で止める関数 */
export function flapText(node: HTMLElement | null, text: string, delay = 0, reduced = false): () => void {
  if (!node) return () => {};
  if (reduced) { node.textContent = text; return () => {}; }
  let cancelled = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };
  node.classList.add('flap');
  const ch = [...text];
  node.innerHTML = ch.map((c) => `<i>${c === ' ' ? '&nbsp;' : c}</i>`).join('');
  const go = () => {
    if (cancelled) return;
    const cells = [...node.querySelectorAll('i')] as HTMLElement[];
    const ws = cells.map((c) => c.getBoundingClientRect().width);
    cells.forEach((c, i) => { c.style.width = ws[i] + 'px'; c.textContent = ''; });
    cells.forEach((c, i) => {
      let n = 2 + Math.floor(Math.random() * 3);
      const step = () => {
        if (n-- > 0) {
          c.textContent = GLY[Math.floor(Math.random() * GLY.length)];
          restart(c, 'f');
          later(step, 48);
        } else {
          c.innerHTML = ch[i] === ' ' ? '&nbsp;' : ch[i];
          restart(c, 's');
        }
      };
      later(step, delay + i * 26);
    });
  };
  // 文字幅はフォントが読み込まれてから測る(測り終わるまでは元の文字がそのまま見える)
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (fonts?.ready) void fonts.ready.then(go); else go();
  return () => { cancelled = true; timers.forEach((id) => window.clearTimeout(id)); timers.clear(); };
}
