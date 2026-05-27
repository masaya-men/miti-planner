/**
 * 長押し確定ボタン (= 「ちがった」 用、 再利用前提)。
 *
 * - 2 秒長押しで onConfirm 発火
 * - 底辺の細いバー (4px) が左→右に伸びる進捗 UI (= プログレスバー標準形状)
 * - 押下中はヒントを「あと X 秒で非表示」 に切替 (= 誤削除回避のため残時間が明確に)
 * - pointerleave では cancel しない (= マウスが微細に動いて button 外に出ても継続)
 * - pointerup/pointercancel は window level で listen (= button 外で離しても確実に止める)
 * - PC: pointerdown で start + keyboard (Space/Enter 長押し)
 *
 * 設計書: docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { start, cancel, isPressing, progress } = useLongPressConfirm({
    duration: durationMs,
    onConfirm,
  });

  // 押下中の間だけ window level で pointerup/pointercancel を listen。
  // button 外で離しても確実に cancel される。 pointerleave に頼らないので、
  // マウスが微細に動いて button 外に出ても進捗は止まらない。
  useEffect(() => {
    if (!isPressing) return;
    const handleEnd = () => cancel();
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [isPressing, cancel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    start();
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

  // 押下中は「あと X 秒」 表示、 通常時は hint 表示
  const remainingSeconds = Math.max(0, (durationMs * (1 - progress)) / 1000);
  const displayHint = isPressing
    ? t('housing.detail.duplicates.long_press_remaining', {
        seconds: remainingSeconds.toFixed(1),
      })
    : hint;

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
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{ ['--housing-longpress-progress' as string]: `${progress}` }}
    >
      <span className="housing-longpress-btn-label">{label}</span>
      {displayHint && <span className="housing-longpress-btn-hint">{displayHint}</span>}
      <span className="housing-longpress-btn-ring" aria-hidden="true" />
    </button>
  );
};
