/**
 * 光の粒エンジン(MIL-SPEC v11 見本 js:298-365, 531-583 の移植)。
 * 経路は DOM の `.milspec-app path[data-trace="名前"]` から引く。
 * 時間・イージング・キーフレーム・乱数の幅・既定値は見本のまま(変えない)。
 */

export type PulseOpts = {
  from?: number; to?: number; rev?: boolean; len?: number; delay?: number;
  dur?: number; speed?: number; ease?: string; cls?: string; chain?: boolean;
};

type Trace = { p: SVGPathElement; pc: string; next: string | null; end: [number, number] | null };

const esc = (s: string) => s.replace(/["\\]/g, '\\$&');

/** 光を出してよいか(動きを減らす・タブ非表示・電源 off では出さない)。呼ぶ時点で評価する */
export function isFxActive(): boolean {
  if (typeof window === 'undefined') return false;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || document.hidden) return false;
  return document.documentElement.dataset.msPower !== 'off';
}

function toTrace(p: Element | null): Trace | null {
  if (!p) return null;
  const e = p.getAttribute('data-trace-end');
  const end = e ? (e.split(',').map(Number) as [number, number]) : null;
  return {
    p: p as SVGPathElement,
    pc: p.getAttribute('data-trace-pc') || '',
    next: p.getAttribute('data-trace-next'),
    end: end && end.length === 2 && end.every(Number.isFinite) ? end : null,
  };
}
const getTrace = (name: string): Trace | null =>
  toTrace(document.querySelector(`.milspec-app path[data-trace="${esc(name)}"]`));
const traceNames = (prefix: string): string[] =>
  [...document.querySelectorAll(`.milspec-app path[data-trace^="${esc(prefix)}"]`)].map((e) => e.getAttribute('data-trace') as string);

// ---- NET ランプ(区画②のヘッダーが購読する)----
let signalListener: (() => void) | null = null;
export function setFxSignalListener(fn: (() => void) | null): void { signalListener = fn; }
let netT = 0;
function netBlink(delay = 0): void {
  setTimeout(() => {
    if (!signalListener || !isFxActive()) return;
    const now = performance.now();
    if (now - netT < 70) return;
    netT = now;
    signalListener();
  }, delay);
}

export function pulse(name: string, o: PulseOpts = {}): number {
  const t = getTrace(name);
  if (!t || !isFxActive() || !t.p.isConnected) return 0;
  const p = t.p;
  const L = p.getTotalLength();
  if (!L) return 0;
  let from = o.from ?? 0, to = o.to ?? L;
  if (o.rev) { from = L; to = 0; }
  const len = o.len ?? 12, fwd = to >= from, delay = o.delay ?? 0;
  const dur = o.dur ?? Math.max(360, Math.abs(to - from) * (o.speed ?? 2.4));
  const k0 = fwd ? len - from : -from, k1 = fwd ? -to : len - to;
  const cls = [t.pc, o.cls].filter(Boolean).join(' ');
  ['milspec-pz-g', 'milspec-pz-c'].forEach((c) => {
    const q = p.cloneNode(false) as SVGPathElement;
    // 複製が経路として拾われないよう識別属性は外す
    ['data-trace', 'data-trace-pc', 'data-trace-next', 'data-trace-end'].forEach((a) => q.removeAttribute(a));
    q.setAttribute('class', c + (cls ? ' ' + cls : ''));
    q.style.strokeDasharray = `${len} ${L + len * 3}`;
    q.style.strokeDashoffset = String(k0);
    p.parentNode!.appendChild(q);
    const a = q.animate([{ strokeDashoffset: k0 }, { strokeDashoffset: k1 }], { duration: dur, delay, easing: o.ease ?? 'cubic-bezier(.3,0,.25,1)', fill: 'both' });
    a.onfinish = () => q.remove();
  });
  if (o.cls !== 'faint') netBlink(delay);
  if (o.chain !== false && t.next && fwd && Math.abs(to - L) < 1) {
    const next = t.next;
    setTimeout(() => pulse(next, { cls: o.cls, len, speed: o.speed }), delay + dur * 0.8);
  }
  return dur + delay;
}

/** 束の何本かに、少しずつずらして光を流す */
export function burst(prefix: string, o: PulseOpts & { n?: number; stagger?: number; jit?: number } = {}): void {
  const keys = traceNames(prefix);
  if (!keys.length) return;
  for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  keys.slice(0, o.n ?? keys.length).forEach((k, i) => pulse(k, {
    ...o,
    delay: (o.delay || 0) + i * (o.stagger ?? 20) + Math.random() * (o.jit ?? 25),
    len: (o.len ?? 11) * (0.6 + Math.random() * 0.8),
    speed: (o.speed ?? 2.6) * (0.8 + Math.random() * 0.45),
  }));
}

/** path 上で (x,y) にいちばん近い位置の長さ(121 点で探す) */
export function lenAt(p: SVGPathElement, x: number, y: number): number {
  const L = p.getTotalLength();
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 120; i++) {
    const l = L * i / 120, q = p.getPointAtLength(l), d = Math.hypot(q.x - x, q.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

/** 画面座標 → その path の座標(getScreenCTM の逆行列) */
export function toPathSpace(path: SVGPathElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = path.getScreenCTM?.();
  if (!ctm) return null; // 変換できないときは誤った位置を返さない
  const m = ctm.inverse();
  return { x: m.a * clientX + m.c * clientY + m.e, y: m.b * clientX + m.d * clientY + m.f };
}

export function emit(node: Element | null, name: string, o: PulseOpts & { both?: boolean } = {}): number {
  const t = getTrace(name);
  if (!t || !node) return 0;
  const r = node.getBoundingClientRect();
  const c = toPathSpace(t.p, r.left + r.width / 2, r.top + r.height / 2);
  if (!c) return 0;
  const from = lenAt(t.p, c.x, c.y);
  if (o.both) { const L = t.p.getTotalLength(); pulse(name, { ...o, from, to: L }); return pulse(name, { ...o, from, to: 0 }); }
  return pulse(name, { ...o, from });
}

/** ジョブの基板に信号が流れる */
export function trafficBp(d = 0, o: PulseOpts = {}): void {
  burst('bp:b', { n: 4, delay: d, stagger: 45, speed: 2.1, len: 16, ...o });
  burst('bp:f', { n: 22, delay: d + 240, stagger: 10, speed: 3.4, len: 7, ...o });
  burst('bp:m', { n: 8, delay: d + 300, stagger: 26, speed: 2.8, len: 8, ...o });
}

export const leak = (name: string, delay = 0, o: PulseOpts = {}): number =>
  pulse(name, { delay, len: 26, speed: 1.05, chain: false, ...o });

const SVG_NS = 'http://www.w3.org/2000/svg';
export function dotFlash(svg: SVGElement | null, x: number, y: number, delay: number): void {
  if (!svg || !isFxActive()) return;
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '1.4');
  c.setAttribute('class', 'milspec-tdot-f');
  svg.appendChild(c);
  const a = c.animate(
    [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1.5)', offset: 0.22 }, { opacity: 0.5, transform: 'scale(1)', offset: 0.5 }, { opacity: 0, transform: 'scale(0.8)' }],
    { duration: 780, delay: Math.max(0, delay), easing: 'ease-out', fill: 'both' },
  );
  a.onfinish = () => c.remove();
}

const OFFS_N = 6; // 見本 OFFS(扇 1 方向あたり 6 本)

/** IC が灯り、4 方向の扇へ一斉に光を放つ(中心に近い線から少し早く)。端に届くと端子が灯る */
export function coreFire(d: number, o: { dim?: boolean } = {}): void {
  const s = document.querySelector('.milspec-app .milspec-plan-core');
  if (!s || !isFxActive()) return;
  const glow = s.querySelector('.milspec-core-glow');
  if (glow) glow.animate([{ opacity: 0 }, { opacity: o.dim ? 0.45 : 1, offset: 0.18 }, { opacity: o.dim ? 0.15 : 0.35, offset: 0.5 }, { opacity: 0 }], { duration: 1100, delay: d, easing: 'ease-out' });
  ['L', 'R', 'T', 'B'].forEach((sd, gi) => {
    for (let k = 0; k < OFFS_N; k++) {
      if (o.dim && Math.random() < 0.5) continue;
      const n = 's2' + sd + k, t = getTrace(n);
      if (!t) continue;
      const dl = d + 40 + gi * 20 + Math.abs(k - 2.5) * 30 + Math.random() * 40;
      const tot = pulse(n, { delay: dl, len: 8 + Math.random() * 6, speed: 1.5 + Math.random() * 0.5, cls: o.dim ? 'faint' : '' });
      if (t.end && tot) dotFlash(t.p.parentNode as SVGElement, t.end[0], t.end[1], tot - 60);
    }
  });
}

/** 選んだ瞬間のエネルギー: 選んだ所 → 幹線 → IC → 4 方向 → 枠の下から漏れ → レール → ヘッダー → ジョブの基板 */
export function energy(src: Element | null): void {
  if (!isFxActive()) return;
  const inTree = src && src.closest && src.closest('[data-ms-tree]');
  let d = 0;
  if (inTree) {
    const t = getTrace('s2k0');
    if (t) {
      const r = src!.getBoundingClientRect();
      const c = toPathSpace(t.p, r.left + r.width / 2, r.top + r.height / 2);
      if (!c) return;
      const from = lenAt(t.p, 3.6, c.y);
      for (let k = 0; k < 4; k++) pulse('s2k' + k, { from, delay: k * 28, len: 12, speed: 1.3 });
      d = Math.max(360, (t.p.getTotalLength() - from) * 1.3) + 40;
    }
  } else if (src) {
    emit(src, 's1', { both: true, len: 14 });
    leak('lk:s1s2', 240);
    for (let k = 0; k < 4; k++) pulse('s2k' + k, { delay: 460 + k * 28, len: 12, speed: 1.15 });
    d = 460 + 380 * 1.15 + 40;
  }
  coreFire(d);
  for (let k = 0; k < 4; k++) pulse('s2x' + k, { rev: true, delay: d + 140 + k * 30, len: 11, speed: 1.25 });
  const up = d + 140 + 380 * 1.25;
  leak('lk:s1s2', up, { rev: true }); pulse('s1', { delay: up + 220, len: 14, rev: true });
  const d2 = d + 460;
  leak('lk:s2rail', d2); leak('lk:s2s3', d2 + 90); pulse('s3', { delay: d2 + 300, len: 14 });
  for (let k = 0; k < 8; k++) pulse('rail:a' + k, { rev: true, chain: false, cls: 'faint', delay: d2 + 220 + k * 24 + Math.random() * 40, len: 8 + Math.random() * 8, speed: 1.5 });
  leak('lk:hdr', d2 + 820); leak('lk:tb', d2 + 900);
  pulse('h5a', { delay: d2 + 860, len: 14 }); pulse('h5b', { delay: d2 + 960, len: 14 });
  burst('ventL:', { cls: 'faint', delay: d2 + 900, stagger: 26, speed: 2 }); burst('ventR:', { cls: 'faint', delay: d2 + 960, stagger: 26, speed: 2 });
  trafficBp(d2 + 1100, { cls: 'faint' });
}

// ---- 光の玉(通気口のランプ列。見本 js:1054-1069)----
let ballIdx = 0;
let ballBusy = false;
/** ランプ列の光の玉を端から端へ往復させる。端に着くたびに溝へ光を流す。動きを減らす・電源 off・往復中は何もしない */
export function scanBall(row: HTMLElement): void {
  if (!row || !isFxActive() || ballBusy) return;
  ballBusy = true;
  const lamps = [...row.querySelectorAll<HTMLElement>('.milspec-led')];
  const n = lamps.length;
  const go = (from: number, to: number, cb: () => void) => {
    const dir = Math.sign(to - from);
    lamps.forEach((lp, k) => {
      const x = k < to ? 14 : k > to ? -14 : 0;
      const s = lp.querySelector<HTMLElement>('.milspec-led-src');
      if (!s) return;
      s.style.setProperty('--dl', Math.max(0, (k - from) * dir) * 38 + 'ms');
      s.style.setProperty('--x', x + 'px');
    });
    setTimeout(cb, Math.abs(to - from) * 38 + 200);
  };
  go(ballIdx, n - 1, () => {
    burst('ventR:', { stagger: 22, len: 9, speed: 2 });
    go(n - 1, 0, () => { ballIdx = 0; ballBusy = false; burst('ventL:', { stagger: 22, len: 9, speed: 2 }); });
  });
}

/** ホバーで光の玉が軽く身じろぎする(往復中は何もしない) */
export function nudgeBall(row: HTMLElement): void {
  if (!row || !isFxActive() || ballBusy) return;
  const srcs = [...row.querySelectorAll<HTMLElement>('.milspec-led-src')];
  const set = (i: number) => srcs.forEach((s, k) => { s.style.setProperty('--dl', '0ms'); s.style.setProperty('--x', (k < i ? 14 : k > i ? -14 : 0) + 'px'); });
  set(1);
  setTimeout(() => set(0), 170);
  setTimeout(() => srcs.forEach((s) => s.style.setProperty('--x', '14px')), 340);
}

const AMB: [string, number][] = [['rail:a', 3], ['rail:b', 3], ['ventL:', 2], ['ventR:', 2], ['bp:b', 1.5], ['bp:f', 3], ['bp:m', 2], ['s2L', 1], ['s2R', 1], ['s2T', 1], ['s2B', 1], ['s2k', 0.8], ['s2x', 0.8], ['s1', 0.5], ['h3', 0.4], ['h5a', 0.3], ['s3', 0.3]];

/** 常時: どこかの束を数本、細い光が走る(0.8〜2.5 秒ごと)。戻り値で停止 */
export function startAmbient(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    if (isFxActive()) {
      const tot = AMB.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * tot;
      for (const [g, w] of AMB) {
        r -= w;
        if (r <= 0) {
          burst(g, { n: 1 + Math.floor(Math.random() * (g === 'bp:f' ? 7 : 3)), stagger: 34, cls: g.startsWith('s2') ? 'faint' : '', speed: 3.4, chain: false, rev: Math.random() < 0.3 });
          break;
        }
      }
      if (Math.random() < 0.05) coreFire(0, { dim: true });
    }
    timer = setTimeout(tick, 800 + Math.random() * 1700);
  };
  timer = setTimeout(tick, 1600); // 最初の 1 発は見本 js:1227 と同じ 1600ms 固定
  return () => { stopped = true; if (timer !== undefined) clearTimeout(timer); };
}
