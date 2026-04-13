/**
 * LoPoブランドボタン — カプセル描画 + スキャンラインアニメーション
 * テーマ別に色を直接指定（ダーク: 白→黒反転、ライト: 黒→白反転）
 */
import React, { useRef, useState, useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

export const LoPoButton: React.FC<{
    size?: 'sm' | 'lg';
    onClick?: () => void;
}> = ({ size = 'lg', onClick }) => {
    const fontSize = size === 'lg' ? 'text-app-6xl' : 'text-app-4xl-plus';
    const h = size === 'lg' ? 56 : 40;
    const px = size === 'lg' ? 32 : 16;
    const textClass = `${fontSize} font-black tracking-tight select-none whitespace-nowrap`;
    const { theme } = useThemeStore();
    const isDark = theme === 'dark';

    // ダーク: テキスト白、塗り白、反転テキスト黒
    // ライト: テキスト黒、塗り黒、反転テキスト白
    const textColor = isDark ? '#ffffff' : '#000000';
    const fillColor = isDark ? '#ffffff' : '#000000';
    const invertedTextColor = isDark ? '#000000' : '#ffffff';

    const containerRef = useRef<HTMLDivElement>(null);
    const [w, setW] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        setW(el.offsetWidth);
        const ro = new ResizeObserver(() => setW(el.offsetWidth));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // カプセル枠線: 中央から左右に描画するため2本のパス
    const r = h / 2 - 0.75;
    const mid = w / 2;

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center justify-center cursor-pointer group"
            style={{ height: h, paddingLeft: px, paddingRight: px }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick(); }}
        >
            {/* カプセル枠線（ホバー時に中央から左右へストローク描画） */}
            {w > 0 && (
            <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width={w}
                height={h}
                fill="none"
            >
                {/* 右半分: 中央上 → 右上 → 右弧 → 右下 → 中央下 */}
                <path
                    d={`M ${mid} 0.75 L ${w - h / 2} 0.75 A ${r} ${r} 0 0 1 ${w - 0.75} ${h / 2} A ${r} ${r} 0 0 1 ${w - h / 2} ${h - 0.75} L ${mid} ${h - 0.75}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="lopo-capsule-path"
                    pathLength="1"
                />
                {/* 左半分: 中央上 → 左上 → 左弧 → 左下 → 中央下 */}
                <path
                    d={`M ${mid} 0.75 L ${h / 2} 0.75 A ${r} ${r} 0 0 0 0.75 ${h / 2} A ${r} ${r} 0 0 0 ${h / 2} ${h - 0.75} L ${mid} ${h - 0.75}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="lopo-capsule-path"
                    pathLength="1"
                />
            </svg>
            )}

            {/* 通常テキスト */}
            <span className={`${textClass} relative z-10`} style={{ color: textColor, fontFamily: "'Rajdhani', sans-serif" }}>
                LoPo
            </span>

            {/* スキャン塗り + スキャンライン + 反転テキスト */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-20" style={{ borderRadius: h / 2 }}>
                <div className="lopo-scan-fill absolute inset-x-0 bottom-0" style={{ background: fillColor }} />
                <div className="lopo-scan-line absolute inset-x-0" />
                <div className="lopo-scan-clip absolute inset-0 flex items-center justify-center">
                    <span className={textClass} style={{ color: invertedTextColor, fontFamily: "'Rajdhani', sans-serif" }}>
                        LoPo
                    </span>
                </div>
            </div>
        </div>
    );
};
