import React from 'react';

/**
 * PCB 配線ハーネス — フッターの情報プレート(fp-info)と計器プレート(fp-inst)の間を繋ぐ
 * 装飾用インライン SVG。正典: docs/.private/theme-refs/milspec-mockup.html
 * DOM 2234-2274(<svg class="fp-harness">)。JSX 化のみ(構造・数値は無改変)。
 * 直角トレース(暗い溝 + 明るい金属エッジの二重ストローク)・ヴィア・端子パッド・
 * ジャンクションブロック(J-04)・1本だけ通電中のシアン点灯(モック側コメント参照)。
 * 色は概ねモックの実値のまま。通電トレース起点の circle 2 点のみ、値が --ms-cyan(#82ccdf)と
 * 完全一致するためトークン参照に置換(判断: brief で明示許可された任意置換)。
 * id は他 SVG との衝突を避けるため milspec 接頭に変更(モックは harnessShadow/traceGrad)。
 */
export const MilspecHarness: React.FC = () => (
  <svg
    className="milspec-harness"
    width="92"
    height="52"
    viewBox="0 0 92 52"
    style={{ overflow: 'visible', pointerEvents: 'none' }}
    aria-hidden="true"
  >
    <defs>
      <filter id="milspecHarnessShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.1" stdDeviation="0.7" floodColor="#000" floodOpacity="0.6" />
      </filter>
      <linearGradient id="milspecTraceGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6a7580" />
        <stop offset="100%" stopColor="#30383f" />
      </linearGradient>
    </defs>
    <g filter="url(#milspecHarnessShadow)">
      <path d="M5 10 H24 V20 H38" fill="none" stroke="#04070a" strokeWidth={4} strokeLinecap="square" />
      <path d="M5 10 H24 V20 H38" fill="none" stroke="url(#milspecTraceGrad)" strokeWidth={2.1} strokeLinecap="square" />
      <path d="M5 41 H28 V31 H38" fill="none" stroke="#04070a" strokeWidth={4} strokeLinecap="square" />
      <path d="M5 41 H28 V31 H38" fill="none" stroke="url(#milspecTraceGrad)" strokeWidth={2.1} strokeLinecap="square" />
      <path d="M87 13 H63 V20 H53" fill="none" stroke="#04070a" strokeWidth={4} strokeLinecap="square" />
      <path d="M87 13 H63 V20 H53" fill="none" stroke="url(#milspecTraceGrad)" strokeWidth={2.1} strokeLinecap="square" />
      <path d="M87 38 H59 V32 H53" fill="none" stroke="#04070a" strokeWidth={4} strokeLinecap="square" />
      <path d="M87 38 H59 V32 H53" fill="none" stroke="url(#milspecTraceGrad)" strokeWidth={2.1} strokeLinecap="square" />
      <circle cx={24} cy={20} r={2} fill="var(--ms-cyan)" opacity={0.9} />
      <circle cx={24} cy={10} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={24} cy={20} r={1.5} fill="#151c22" stroke="var(--ms-cyan)" strokeWidth={0.7} opacity={0.9} />
      <circle cx={28} cy={41} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={28} cy={31} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={63} cy={13} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={63} cy={20} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={59} cy={38} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <circle cx={59} cy={32} r={1.5} fill="#20262d" stroke="#5c6771" strokeWidth={0.7} />
      <rect x={3} y={8.5} width={3} height={3} fill="#2a323a" stroke="#0a0e12" strokeWidth={0.6} />
      <rect x={3} y={39.5} width={3} height={3} fill="#2a323a" stroke="#0a0e12" strokeWidth={0.6} />
      <rect x={86} y={11.5} width={3} height={3} fill="#2a323a" stroke="#0a0e12" strokeWidth={0.6} />
      <rect x={86} y={36.5} width={3} height={3} fill="#2a323a" stroke="#0a0e12" strokeWidth={0.6} />
      <rect x={38} y={17} width={15} height={19} rx={1.5} fill="#333c45" stroke="#0a0e12" strokeWidth={1} />
      <rect x={39.5} y={18.5} width={12} height={16} rx={0.8} fill="none" stroke="#5c6771" strokeWidth={0.6} opacity={0.55} />
      <rect x={40.5} y={20.3} width={10} height={1.3} fill="#1c232a" />
      <rect x={40.5} y={23.2} width={10} height={1.3} fill="#1c232a" />
      <rect x={40.5} y={26.1} width={10} height={1.3} fill="#1c232a" />
      <rect x={40.5} y={29} width={10} height={1.3} fill="#1c232a" />
      <text
        x={45.5}
        y={46}
        textAnchor="middle"
        fontFamily="'Share Tech Mono',monospace"
        fontSize={3.6}
        letterSpacing={0.4}
        fill="#7a8c9c"
        opacity={0.5}
      >
        J-04
      </text>
    </g>
  </svg>
);
