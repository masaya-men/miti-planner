import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Sidebar } from '../Sidebar';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { MobilePartyWithTabs } from '../MobilePartySettings';
import type { MobileSheets } from './useMobileSheets';

/** スマホのメニュー(サイドバー)とパーティ編成のシート */
export const MobileTopSheets: React.FC<{ sheets: MobileSheets }> = ({ sheets }) => {
    const { t } = useTranslation();
    const { mobileMenuOpen, setMobileMenuOpen, mobilePartyOpen, setMobilePartyOpen } = sheets;
    return (
        <>
            {/* Mobile sidebar — slides up from bottom as a sheet */}
            <MobileBottomSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                title={t('sidebar.menu')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
                fillContent
                swipeArea="handle"
                headerAction={
                    <button
                        onClick={() => { setMobileMenuOpen(false); setMobilePartyOpen(true); }}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-full border border-app-border text-app-text hover:bg-app-text/10 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                        <Users size={15} />
                        <span className="text-app-sm font-bold whitespace-nowrap">{t('nav.party')}</span>
                    </button>
                }
            >
                <div className="flex-1 min-h-0 flex flex-col">
                    <Sidebar
                        isOpen={true}
                        fullWidth
                        onClose={() => setMobileMenuOpen(false)}
                        onAutoPlan={() => { setMobileMenuOpen(false); window.dispatchEvent(new CustomEvent('timeline:autoplan')); }}
                    />
                </div>
            </MobileBottomSheet>

            {/* Mobile: パーティ編成（タブでステータスも表示） */}
            <MobileBottomSheet
                isOpen={mobilePartyOpen}
                onClose={() => setMobilePartyOpen(false)}
                title={t('nav.party')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
                swipeArea="handle"
            >
                <MobilePartyWithTabs />
            </MobileBottomSheet>
        </>
    );
};
