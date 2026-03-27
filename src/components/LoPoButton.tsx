/**
 * LoPoブランドボタン — カプセル描画 + スキャンラインアニメーション
 * テーマ別に色を直接指定（ダーク: 白→黒反転、ライト: 黒→白反転）
 */
import React from 'react';
import { useThemeStore } from '../store/useThemeStore';

export const LoPoButton: React.FC<{
    size?: 'sm' | 'lg';
    onClick?: () => void;
}> = ({ size = 'lg', onClick }) => {
    const fontSize = size === 'lg' ? 'text-4xl' : 'text-2xl';
    const h = size === 'lg' ? 56 : 40;
    const px = size === 'lg' ? 32 : 16;
    const textClass = `${fontSize} font-black tracking-widest select-none whitespace-nowrap`;
    const { theme } = useThemeStore();
    const isDark = theme === 'dark';

    // ダーク: テキスト白、塗り白、反転テキスト黒
    // ライト: テキスト黒、塗り黒、反転テキスト白
    const textColor = isDark ? '#ffffff' : '#000000';
    const fillColor = isDark ? '#ffffff' : '#000000';
    const invertedTextColor = isDark ? '#000000' : '#ffffff';

    return (
        <div
            className="relative inline-flex items-center justify-center cursor-pointer group"
            style={{ height: h, paddingLeft: px, paddingRight: px }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); }}
        >
            {/* カプセル枠線 */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                fill="none"
            >
                <path
                    d={`M 50% 0.75 L calc(100% - ${h / 2}px) 0.75 A ${h / 2 - 0.75} ${h / 2 - 0.75} 0 0 1 calc(100% - 0.75px) ${h / 2} A ${h / 2 - 0.75} ${h / 2 - 0.75} 0 0 1 calc(100% - ${h / 2}px) ${h - 0.75} L 50% ${h - 0.75}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="lopo-capsule-path"
                    pathLength="1"
                />
                <path
                    d={`M 50% 0.75 L ${h / 2}px 0.75 A ${h / 2 - 0.75} ${h / 2 - 0.75} 0 0 0 0.75 ${h / 2} A ${h / 2 - 0.75} ${h / 2 - 0.75} 0 0 0 ${h / 2}px ${h - 0.75} L 50% ${h - 0.75}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="lopo-capsule-path"
                    pathLength="1"
                />
            </svg>

            {/* 通常テキスト */}
            <span className={`${textClass} relative z-10`} style={{ color: textColor }}>
                LoPo
            </span>

            {/* スキャン塗り + スキャンライン + 反転テキスト */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-20" style={{ borderRadius: h / 2 }}>
                <div className="lopo-scan-fill absolute inset-x-0 bottom-0" style={{ background: fillColor }} />
                <div className="lopo-scan-line absolute inset-x-0" />
                <div className="lopo-scan-clip absolute inset-0 flex items-center justify-center">
                    <span className={textClass} style={{ color: invertedTextColor }}>
                        LoPo
                    </span>
                </div>
            </div>
        </div>
    );
};
