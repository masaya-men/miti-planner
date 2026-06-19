/**
 * 活動日数/時間のドラッグスクラブ入力。数字を左右ドラッグで増減（感度 16px=1・低感度）。
 * 箱なし・装飾なし（点線下線・±ボタンは撤去）。数字は固定幅（tabular-nums + min-width）で
 * 桁が変わってもレイアウトがガタつかない。
 * ドラッグ中はローカル state で表示更新し、pointerup で onChange へコミット（毎フレームの親再レンダー回避）。
 */
import { useRef, useState } from 'react';
import { clampActivity } from '../../lib/progressLogic';

const PX_PER_UNIT = 16; // 16px ドラッグで 1 変化（低感度＝細かく合わせやすい）

export function ActivityScrub({ label, value, unit, onChange }: {
  label?: string; value: number | undefined; unit: string; onChange: (n: number) => void;
}) {
  const base = value ?? 0;
  const [draft, setDraft] = useState<number | null>(null);
  const startRef = useRef({ x: 0, v: 0 });
  const display = draft ?? base;

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, v: base };
    setDraft(base);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (draft === null) return;
    const d = Math.round((e.clientX - startRef.current.x) / PX_PER_UNIT);
    setDraft(clampActivity(startRef.current.v + d));
  };
  const onPointerUp = () => {
    if (draft !== null) { onChange(draft); setDraft(null); }
  };

  return (
    <div className="flex items-baseline gap-1.5">
      {label && <span className="text-app-2xs text-app-text-muted font-bold">{label}</span>}
      <span
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        className="font-black text-app-lg text-app-text cursor-ew-resize select-none"
        style={{ textShadow: '0 0 10px rgba(120,200,255,.45)' }}
        title={unit}
      >
        {/* 固定幅・右寄せ（桁が増えても左の要素が動かない=ガタつき防止） */}
        <span className="tabular-nums inline-block text-right" style={{ minWidth: '2ch' }}>{display}</span>
        <span className="text-app-2xs text-app-text-muted ml-0.5">{unit}</span>
      </span>
    </div>
  );
}
