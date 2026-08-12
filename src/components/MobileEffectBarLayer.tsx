import clsx from 'clsx';
import type { MobileEffectBarItem } from '../utils/mobileEffectBar';
import {
  MOBILE_EFFECT_BAR_ICON_SIZE,
  MOBILE_EFFECT_BAR_WIDTH,
  MOBILE_EFFECT_BAR_SLOT_PITCH,
  MOBILE_EFFECT_BAR_ROW_INSET,
} from '../utils/mobileEffectBar';

interface MobileEffectBarLayerProps {
  bars: MobileEffectBarItem[];
}

/**
 * モバイル軽減表: スクロール中だけ表示するエフェクト棒のオーバーレイ層。
 * 位置・可視性の切り替えは親(Timeline.tsx)の `data-mobile-scrolling` 属性 + CSS が担当するため、
 * このコンポーネント自身は常時マウントし続ける(表示制御はopacityのみ)。
 */
export const MobileEffectBarLayer: React.FC<MobileEffectBarLayerProps> = ({ bars }) => {
  if (bars.length === 0) return null;

  return (
    <div className="mobile-effect-bar-layer absolute inset-0 pointer-events-none md:hidden" style={{ zIndex: 5 }}>
      {bars.map(bar => (
        <div
          key={bar.id}
          className={clsx(
            'absolute rounded-b-sm border-x',
            bar.colors.bg,
            bar.colors.border,
            bar.colors.shadow,
          )}
          style={{
            top: `${bar.top}px`,
            height: `${bar.height}px`,
            width: `${MOBILE_EFFECT_BAR_WIDTH}px`,
            right: `${MOBILE_EFFECT_BAR_ROW_INSET + bar.slotIndex * MOBILE_EFFECT_BAR_SLOT_PITCH}px`,
          }}
        >
          <img
            src={bar.iconUrl}
            alt=""
            className="absolute rounded object-cover"
            style={{
              width: `${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              height: `${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              top: `-${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      ))}
    </div>
  );
};
