import React from 'react';
import { useTranslation } from 'react-i18next';
import './EmptyPlanState.css';

/** プラン未選択時 — 抽象イラスト + テキスト（ガラスはTimeline内に配置済み） */
export const EmptyPlanState: React.FC<{ isMobile: boolean }> = ({ isMobile }) => {
    const { t } = useTranslation();
    return (
        <div className="absolute inset-0 pb-16 md:pb-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="text-center empty-text-in">
                {/* ハンバーガーメニューアイコン — PC:左からスライドイン / スマホ:上からスライドイン */}
                <svg
                    className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} mx-auto mb-4`}
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-1' : 'empty-burger-left-1'}`} />
                    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-2' : 'empty-burger-left-2'}`} />
                    <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-3' : 'empty-burger-left-3'}`} />
                </svg>
                <p className={`${isMobile ? 'text-app-2xl' : 'text-app-2xl-plus'} text-app-text font-medium tracking-[0.15em]`}>
                    {t(isMobile ? 'app.empty_state_mobile' : 'app.empty_state_pc')}
                </p>
            </div>
        </div>
    );
};
