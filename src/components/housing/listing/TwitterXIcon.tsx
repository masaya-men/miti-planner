/**
 * FB第6弾follow-up改良1: X (Twitter) アイコン。 hover でわずかに回転+拡大するアニメ付き。
 *
 * 形状は Tabler Icons の "brand-x" (MIT license) を移植。
 * アニメーションは framer-motion v12 の useAnimate で制御する。
 *
 * follow-up改良(ユーザーFB): アニメの発火は SVG 自身の hover ではなく、
 * 親のボタン全体の hover に合わせたい要望のため、 ref 経由の命令的 API
 * (`startAnimation` / `stopAnimation`) を公開する forwardRef に変更。
 * 呼び出し元 (HousingShareButton) がボタンの onMouseEnter/onMouseLeave 等から呼ぶ。
 */
import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { motion, useAnimate } from 'framer-motion';

export interface TwitterXIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export interface TwitterXIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export const TwitterXIcon = forwardRef<TwitterXIconHandle, TwitterXIconProps>(
  ({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }, ref) => {
    const [scope, animate] = useAnimate();

    const startAnimation = useCallback(() => {
      void animate('.x-icon', { scale: [1, 1.1, 1], rotate: [0, -10, 10, 0] }, { duration: 0.5, ease: 'easeInOut' });
    }, [animate]);

    const stopAnimation = useCallback(() => {
      void animate('.x-icon', { scale: 1, rotate: 0 }, { duration: 0.2, ease: 'easeOut' });
    }, [animate]);

    useImperativeHandle(ref, () => ({ startAnimation, stopAnimation }), [startAnimation, stopAnimation]);

    return (
      <motion.svg
        ref={scope}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <motion.g className="x-icon" style={{ transformOrigin: 'center' }}>
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
          <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
        </motion.g>
      </motion.svg>
    );
  },
);

TwitterXIcon.displayName = 'TwitterXIcon';
