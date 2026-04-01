// src/components/tutorial/TutorialBlocker.tsx

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialBlockerProps {
  targetRect: TargetRect | null;
  active: boolean;
}

/**
 * クリックブロック層。
 * SVGオーバーレイで画面全体を覆い、ターゲット領域だけくり抜く。
 * 画面を暗くしない（スポットライト廃止）。
 * fill-rule="evenodd" で外側パスと内側パスの間だけが塗られる。
 */
export function TutorialBlocker({ targetRect, active }: TutorialBlockerProps) {
  if (!active) return null;

  return (
    <svg
      className="fixed inset-0 z-[10001]"
      style={{ width: '100vw', height: '100vh', pointerEvents: 'none' }}
    >
      <path
        fillRule="evenodd"
        d={buildPath(targetRect)}
        fill="transparent"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
    </svg>
  );
}

/**
 * evenoddパスを構築。
 * 外側: 画面全体（時計回り）、内側: ターゲット領域（反時計回り・角丸）。
 * ターゲットがなければ画面全体のみ（全面ブロック）。
 */
function buildPath(rect: TargetRect | null): string {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const outer = `M0,0 L${vw},0 L${vw},${vh} L0,${vh} Z`;

  if (!rect) return outer;

  const pad = 6;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 8;

  // 反時計回りの角丸矩形
  const inner = `M${x + r},${y} `
    + `L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} `
    + `L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} `
    + `L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} `
    + `L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;

  return `${outer} ${inner}`;
}
