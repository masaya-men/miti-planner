import type { RippleInstance } from '../../lib/housing/useRipple';

export interface HousingRippleProps {
  ripples: RippleInstance[];
}

/**
 * useRipple() の状態を描画するだけの共有コンポーネント。
 * 呼び出し側は `position: relative; overflow: hidden` なボタンの中に置く。
 * 座標/直径はクリック位置由来の実行時値のため、CSS カスタムプロパティで渡す
 * (housing.css の .housing-ripple / --ripple-* / --housing-ripple token を参照)。
 */
export const HousingRipple: React.FC<HousingRippleProps> = ({ ripples }) => (
  <>
    {ripples.map((r) => (
      <span
        key={r.id}
        aria-hidden="true"
        className="housing-ripple"
        style={{
          ['--ripple-x' as string]: `${r.x}px`,
          ['--ripple-y' as string]: `${r.y}px`,
          ['--ripple-size' as string]: `${r.size}px`,
        }}
      />
    ))}
  </>
);
