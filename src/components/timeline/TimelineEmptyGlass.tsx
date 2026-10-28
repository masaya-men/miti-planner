import React from 'react';

/** プラン未選択時 — Liquid Glass オーバーレイ（CSSクラス .no-plan で表示制御） */
export const TimelineEmptyGlass: React.FC = () => (
    <div className="empty-liquid-glass">
        <div className="empty-glass-corner empty-glass-corner-tl" />
        <div className="empty-glass-corner empty-glass-corner-tr" />
        <div className="empty-glass-corner empty-glass-corner-bl" />
        <div className="empty-glass-corner empty-glass-corner-br" />
        <div className="empty-glass-sheen" />
        {/* PC: 左端の呼吸する光 */}
        <div className="hidden md:block">
            <div className="empty-glow-left" />
            <div className="empty-glow-left-spread" />
        </div>
        {/* スマホ: 左下L字の呼吸する光 */}
        <div className="md:hidden">
            <div className="empty-glow-bl-h" />
            <div className="empty-glow-bl-v" />
            <div className="empty-glow-bl-spread" />
        </div>
    </div>
);
