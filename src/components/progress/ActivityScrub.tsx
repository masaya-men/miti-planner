/**
 * 活動日数/時間の入力。2通り:
 *  - 数字を左右ドラッグで増減（感度 16px=1・低感度）。ドラッグ中はローカル state で表示更新し
 *    pointerup で onChange へコミット（毎フレームの親再レンダー回避）。
 *  - ダブルクリックで直接編集（input 化）。Enter / フォーカス外しで確定、Esc でキャンセル。
 * 箱なし・装飾なし（点線下線・±ボタンは撤去）。数字は固定幅（tabular-nums + min-width）で
 * 桁が変わってもレイアウトがガタつかない。
 */
import { useRef, useState } from 'react';
import { clampActivity } from '../../lib/progressLogic';

const PX_PER_UNIT = 16; // 16px ドラッグで 1 変化（低感度＝細かく合わせやすい）

export function ActivityScrub({ label, value, unit, onChange }: {
  label?: string; value: number | undefined; unit: string; onChange: (n: number) => void;
}) {
  const base = value ?? 0;
  const [draft, setDraft] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const startRef = useRef({ x: 0, v: 0 });
  const display = draft ?? base;

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
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
    if (draft !== null) {
      if (draft !== base) onChange(draft); // 変化したときだけコミット（クリック/ダブルクリックの空振りを無視）
      setDraft(null);
    }
  };

  // ダブルクリック → 直接編集
  const beginEdit = () => { setDraft(null); setEditText(String(base)); setEditing(true); };
  const commitEdit = () => {
    const n = parseInt(editText, 10);
    if (!Number.isNaN(n)) onChange(clampActivity(n));
    setEditing(false);
  };

  return (
    <div className="flex items-baseline gap-1.5">
      {label && <span className="text-app-2xs text-app-text-muted font-bold">{label}</span>}
      <span
        className="font-black text-app-lg text-app-text select-none"
        style={{ textShadow: '0 0 10px rgba(120,200,255,.45)' }}
        title={unit}
      >
        {editing ? (
          <input
            autoFocus
            value={editText}
            inputMode="numeric"
            onChange={(e) => setEditText(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              else if (e.key === 'Escape') setEditing(false);
            }}
            className="tabular-nums inline-block text-right font-black text-app-lg text-app-text bg-transparent outline-none border-b border-app-blue p-0 m-0 align-baseline"
            style={{ width: '2.5ch' }}
          />
        ) : (
          // 固定幅・右寄せ（桁が増えても左の要素が動かない=ガタつき防止）。ドラッグ/ダブルクリック入力。
          <span
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onDoubleClick={beginEdit}
            className="tabular-nums inline-block text-right cursor-ew-resize"
            style={{ minWidth: '2ch' }}
          >{display}</span>
        )}
        <span className="text-app-2xs text-app-text-muted ml-0.5">{unit}</span>
      </span>
    </div>
  );
}
