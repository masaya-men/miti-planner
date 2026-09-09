import React from 'react';

/**
 * 排熱ファン/タービンの遊びギミック — 正典 milspec-mockup.html の
 * createTurbineRig / spawnSparks / spawnSteam / makeTrickle(2396-2519 行)を
 * React フックへそのまま移植したもの。実用機能ゼロの Easter egg。
 *
 * mockup の物理仕様(masaya が 3 往復かけて調整した確定値):
 * - タービンはアイドル中も rAF で低速回転(22s / 1回転相当)。スイッチ押下で
 *   スピンアップ(ease-out cubic)→ホールド→スピンダウンの起動シーケンスを回す。
 * - 火花は加速後半 55% からじわじわトリクル → 最高速到達の瞬間に一気にバースト。
 * - 蒸気はスピンダウン開始時に 5〜9 個を時間差で「もわっ」と。
 * - フッターは 2 基。各ファンに専属 rig を持たせ、起動を最大 550ms ずらす(双発の個体差)。
 * - prefers-reduced-motion: 何も動かない(rAF も張らない・スイッチは無反応)。
 *
 * DOM 生成(火花/蒸気)は mockup と同じく frame 要素へ直接 append + animationend で除去。
 * frame の React 子(bolt×4 + turbine)はキーレスの静的要素なので、末尾に足した
 * 未知ノードを React が撤去することはない(mockup と同じ前提)。
 */

interface RigCallbacks {
  onProgress?: (p: number) => void;
  onMax?: () => void;
  onSpindown?: () => void;
}

interface Rig {
  vanes: HTMLElement;
  angle: number;
  mode: 'idle' | 'spinup' | 'hold' | 'spindown';
  modeStart: number;
  idleV: number;
  maxV: number;
  spinupMs: number;
  holdMs: number;
  spindownMs: number;
  totalMs: number;
  cbs: RigCallbacks;
}

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

function makeRig(vanes: HTMLElement, idleV: number, maxV: number, totalMs: number): Rig {
  const spinupMs = Math.round(totalMs * 0.318);
  const holdMs = Math.round(totalMs * 0.091);
  const spindownMs = totalMs - spinupMs - holdMs;
  vanes.style.animation = 'none';
  return {
    vanes,
    angle: 0,
    mode: 'idle',
    modeStart: 0,
    idleV,
    maxV,
    spinupMs,
    holdMs,
    spindownMs,
    totalMs: spinupMs + holdMs + spindownMs,
    cbs: {},
  };
}

/** count 個の火花を今すぐ(spreadMs の範囲でごくわずかにばらけて)まき散らす。 */
function spawnSparks(host: HTMLElement, count: number, spreadMs: number) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'milspec-tb-spark';
    s.style.setProperty('--ms-ang', `${Math.random() * 360}deg`);
    s.style.setProperty('--ms-dist', `${12 + Math.random() * 26}px`);
    s.style.setProperty('--ms-delay', `${Math.round(Math.random() * (spreadMs || 0))}ms`);
    host.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  }
}

/** スピンダウン開始時に 5〜9 個の蒸気を時間差で積み重ねる。 */
function spawnSteam(host: HTMLElement) {
  const puffs = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < puffs; i++) {
    const delay = i * (70 + Math.random() * 90) + Math.random() * 60;
    window.setTimeout(() => {
      const puff = document.createElement('span');
      puff.className = 'milspec-tb-steam';
      puff.style.setProperty('--ms-puff-scale', (0.9 + Math.random() * 1.0).toFixed(2));
      puff.style.left = `${28 + Math.random() * 44}%`;
      host.appendChild(puff);
      puff.addEventListener('animationend', () => puff.remove());
    }, delay);
  }
}

/** 加速の前半 55% は無音、後半だけ確率 0→ほぼ確実で立ち上がる「じわじわ」トリクル。 */
function makeTrickle(host: HTMLElement) {
  let last = -9999;
  const START_AT = 0.55;
  return function onProgress(p: number) {
    if (p < START_AT) return;
    const q = (p - START_AT) / (1 - START_AT);
    const now = performance.now();
    if (now - last < 300 - q * 240) return;
    if (Math.random() < q * q * 0.9) {
      last = now;
      spawnSparks(host, Math.random() < 0.3 ? 2 : 1, 0);
    }
  };
}

interface UseTurbineClusterResult {
  /** .milspec-tb-vanes へ張る ref(fanCount 個) */
  vaneRefs: React.RefObject<HTMLSpanElement | null>[];
  /** .milspec-tb-frame へ張る ref(火花/蒸気の生成先・fanCount 個) */
  frameRefs: React.RefObject<HTMLDivElement | null>[];
  /** スイッチが点灯 + disabled 状態か */
  active: boolean;
  /** 起動シーケンスを回す(スイッチ onClick) */
  start: () => void;
}

export function useTurbineCluster(fanCount: number): UseTurbineClusterResult {
  const vaneRefs = React.useMemo(
    () => Array.from({ length: fanCount }, () => React.createRef<HTMLSpanElement>()),
    [fanCount],
  );
  const frameRefs = React.useMemo(
    () => Array.from({ length: fanCount }, () => React.createRef<HTMLDivElement>()),
    [fanCount],
  );
  const [active, setActive] = React.useState(false);
  const rigsRef = React.useRef<Rig[]>([]);
  const rafRef = React.useRef<number | null>(null);
  const lastTRef = React.useRef<number | null>(null);
  const reducedRef = React.useRef(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mq.matches;
    if (mq.matches) return; // 何も動かさない

    // 各ファンに専属 rig。idle 速度・最高速・総尺は個体差(mockup と同じ乱数レンジ)。
    const rigs: Rig[] = [];
    vaneRefs.forEach((ref) => {
      if (ref.current) {
        rigs.push(
          makeRig(
            ref.current,
            360 / (24 + Math.random() * 6),
            1700 + Math.random() * 500,
            9000 + Math.random() * 1000,
          ),
        );
      }
    });
    rigsRef.current = rigs;
    if (!rigs.length) return;

    const frame = (t: number) => {
      if (lastTRef.current == null) lastTRef.current = t;
      const dt = Math.min(0.05, (t - lastTRef.current) / 1000);
      lastTRef.current = t;
      for (const rig of rigs) {
        const elapsed = t - rig.modeStart;
        let v = rig.idleV;
        if (rig.mode === 'spinup') {
          const p = Math.min(1, elapsed / rig.spinupMs);
          v = rig.idleV + (rig.maxV - rig.idleV) * easeOutCubic(p);
          rig.cbs.onProgress?.(p);
          if (p >= 1) {
            rig.mode = 'hold';
            rig.modeStart = t;
            rig.cbs.onMax?.();
          }
        } else if (rig.mode === 'hold') {
          v = rig.maxV;
          if (elapsed >= rig.holdMs) {
            rig.mode = 'spindown';
            rig.modeStart = t;
            rig.cbs.onSpindown?.();
          }
        } else if (rig.mode === 'spindown') {
          const p = Math.min(1, elapsed / rig.spindownMs);
          v = rig.maxV - (rig.maxV - rig.idleV) * easeOutCubic(p);
          if (p >= 1) rig.mode = 'idle';
        }
        rig.angle = (rig.angle + v * dt) % 360;
        rig.vanes.style.transform = `rotate(${rig.angle}deg)`;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTRef.current = null;
      rigsRef.current = [];
    };
  }, [vaneRefs, frameRefs]);

  const start = React.useCallback(() => {
    if (reducedRef.current) return;
    const rigs = rigsRef.current;
    if (!rigs.length) return;
    if (rigs.some((r) => r.mode !== 'idle')) return; // 既に回っている

    let maxFinish = 0;
    rigs.forEach((rig, idx) => {
      const delay = idx === 0 ? 0 : Math.random() * 550;
      const host = frameRefs[idx]?.current;
      window.setTimeout(() => {
        if (rig.mode !== 'idle') return;
        rig.cbs = {
          onProgress: host ? makeTrickle(host) : undefined,
          onMax: host ? () => spawnSparks(host, 20 + Math.floor(Math.random() * 16), 90) : undefined,
          onSpindown: host ? () => spawnSteam(host) : undefined,
        };
        rig.mode = 'spinup';
        rig.modeStart = performance.now();
      }, delay);
      maxFinish = Math.max(maxFinish, delay + rig.totalMs);
    });

    setActive(true);
    window.setTimeout(() => setActive(false), maxFinish + 80);
  }, [frameRefs]);

  return { vaneRefs, frameRefs, active, start };
}
