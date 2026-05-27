/**
 * 長押し確定ボタン (= 「ちがった」 用、 再利用前提)。
 *
 * - 2 秒長押しで onConfirm 発火
 * - 横向き bar fill の進捗 UI (= 左から右へ赤透過で塗りつぶし)
 * - mobile: touch-action: manipulation + user-select: none + onPointerDown preventDefault
 * - PC: pointerdown/up/leave で start/cancel + keyboard (Space/Enter 長押し)
 *
 * 設計書: docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2
 */
import { useLongPressConfirm } from '../../../lib/housing/useLongPressConfirm';

export interface HousingLongPressButtonProps {
  label: string;
  /** ホバー/長押し中のヒント文字 (例「2 秒長押しで非表示」) */
  hint?: string;
  /** 確定時の callback (= 通報 fetch 呼び出し等) */
  onConfirm: () => void;
  disabled?: boolean;
  durationMs?: number;
  className?: string;
}

export const HousingLongPressButton: React.FC<HousingLongPressButtonProps> = ({
  label,
  hint,
  onConfirm,
  disabled = false,
  durationMs = 2000,
  className,
}) => {
  const { start, cancel, isPressing, progress } = useLongPressConfirm({
    duration: durationMs,
    onConfirm,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    start();
  };
  const handlePointerEnd = () => {
    if (!isPressing) return;
    cancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isPressing) start();
    }
  };
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') cancel();
  };

  return (
    <button
      type="button"
      className={`housing-longpress-btn${className ? ` ${className}` : ''}`}
      data-pressing={isPressing || undefined}
      disabled={disabled}
      aria-pressed={isPressing}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{ ['--housing-longpress-progress' as string]: `${progress}` }}
    >
      <span className="housing-longpress-btn-label">{label}</span>
      {hint && <span className="housing-longpress-btn-hint">{hint}</span>}
      <span className="housing-longpress-btn-ring" aria-hidden="true" />
    </button>
  );
};
