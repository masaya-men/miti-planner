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
 * 画面全体を覆い、ターゲット領域だけclipPathでくり抜く。
 * 画面を暗くしない（スポットライト廃止）。
 */
export function TutorialBlocker({ targetRect, active }: TutorialBlockerProps) {
  if (!active) return null;

  // ターゲットがない場合は全画面ブロック
  const clipPath = targetRect
    ? buildClipPath(targetRect)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[10001]"
      style={{
        pointerEvents: 'auto',
        clipPath,
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

/**
 * evenodd clipPathでターゲット領域をくり抜く。
 * 外側の矩形が全画面、内側の矩形がターゲット。
 */
function buildClipPath(rect: TargetRect): string {
  const pad = 4;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 8; // 角丸
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // SVG path: 外側（全画面を時計回り）+ 内側（角丸矩形を反時計回り）
  // clip-path: path() ではvw/vh単位が使えないためピクセル値を使用
  return `path(evenodd, "\
M 0 0 L ${vw} 0 L ${vw} ${vh} L 0 ${vh} Z \
M ${x + r} ${y} \
L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} \
L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} \
L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} \
L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z")`;
}
