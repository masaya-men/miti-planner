import clsx from 'clsx';
import type { MobileEffectBarItem } from '../utils/mobileEffectBar';
import {
  MOBILE_EFFECT_BAR_WIDTH,
  MOBILE_EFFECT_BAR_SLOT_PITCH,
  MOBILE_EFFECT_BAR_ROW_INSET,
} from '../utils/mobileEffectBar';

interface MobileEffectBarLayerProps {
  bars: MobileEffectBarItem[];
}

/**
 * モバイル軽減表: スクロール量に連動して専用行アイコンから変身するエフェクト棒のオーバーレイ層。
 * 変身の進み具合(0〜1)は親(Timeline.tsx)がコンテナに設定する `--mobile-effect-bar-progress`
 * というCSS変数で、伸縮・拡大縮小・横スライドはすべてCSS側(index.css)のtransformで行う
 * (React再レンダーなしでスクロールに追従させるため、このコンポーネント自身は常時マウントし続ける)。
 * 棒本体(mobile-effect-bar-fill)とアイコンを別要素にしているのは、棒の伸び(scaleY)がアイコンの
 * 縮小(scale)に干渉しないようにするため(子要素は親のtransformの影響を受けてしまう)。
 */
export const MobileEffectBarLayer: React.FC<MobileEffectBarLayerProps> = ({ bars }) => {
  return (
    <div className="mobile-effect-bar-layer absolute inset-0 pointer-events-none md:hidden">
      {bars.map(bar => (
        <div
          key={bar.id}
          className="mobile-effect-bar-item absolute"
          style={{
            top: `${bar.top}px`,
            height: `${bar.height}px`,
            width: `${MOBILE_EFFECT_BAR_WIDTH}px`,
            right: `${MOBILE_EFFECT_BAR_ROW_INSET}px`,
            '--mobile-effect-bar-slot-x': `${bar.slotIndex * MOBILE_EFFECT_BAR_SLOT_PITCH}px`,
          } as React.CSSProperties}
        >
          <div
            className={clsx(
              'mobile-effect-bar-fill absolute inset-0 rounded-b-sm border-x',
              bar.colors.bg,
              bar.colors.border,
              bar.colors.shadow,
            )}
          />
          <img
            src={bar.iconUrl}
            alt=""
            className="mobile-effect-bar-icon absolute rounded object-cover max-w-none"
            style={{
              // 使用した秒の行より上(=前の行)にアイコンがはみ出さないよう、bar.top(=使用時刻の行)
              // を基準に真下へ描画する(実機FB: 前の行に配置されて見える不具合の修正)。
              top: '0px',
              left: '50%',
            }}
          />
        </div>
      ))}
    </div>
  );
};
