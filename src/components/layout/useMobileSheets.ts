import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

/** スマホのシート類の開閉と、下ナビ(MobileBottomNav)の排他トグル。 */
export function useMobileSheets(isTutorialActive: boolean) {
    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [mobilePartyOpen, setMobilePartyOpen] = React.useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = React.useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [mobileLoginModalOpen, setMobileLoginModalOpen] = React.useState(false);
    const [mobileAccountOpen, setMobileAccountOpen] = React.useState(false);
    const [mobileShareOpen, setMobileShareOpen] = React.useState(false);
    const [mobileCueSheet, setMobileCueSheet] = React.useState(false);

    // チュートリアル中はモバイル用シートをすべて閉じる
    React.useEffect(() => {
        if (isTutorialActive) {
            setMobileMenuOpen(false);
            setMobilePartyOpen(false);
            setMobileStatusOpen(false);
            setMobileToolsOpen(false);
            setMobileAccountOpen(false);
        }
    }, [isTutorialActive]);

    // スマホ用カンペビューイベント
    React.useEffect(() => {
        const open = () => setMobileCueSheet(true);
        window.addEventListener('mobile:open-cue-sheet', open);
        return () => window.removeEventListener('mobile:open-cue-sheet', open);
    }, []);

    // 下ナビ — 排他制御付きトグル
    const navHandlers = {
        onMenuToggle: () => {
            const next = !mobileMenuOpen;
            setMobileMenuOpen(next);
            if (next) { setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
        },
        onImportToggle: () => {
            const next = !mobileToolsOpen;
            setMobileToolsOpen(next);
            if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
        },
        onCueToggle: () => {
            setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false);
            window.dispatchEvent(new Event('mobile:open-cue-sheet'));
        },
        onShareToggle: () => {
            const next = !mobileShareOpen;
            setMobileShareOpen(next);
            if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
        },
        onLoginOpen: () => {
            const authUser = useAuthStore.getState().user;
            if (authUser) {
                const next = !mobileAccountOpen;
                setMobileAccountOpen(next);
                if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
            } else {
                setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false);
                window.dispatchEvent(new Event('mobile:close-miti-flow'));
                setMobileLoginModalOpen(true);
            }
        },
        activeTab: (mobileMenuOpen ? 'menu' : mobileToolsOpen ? 'import' : mobileShareOpen ? 'share' : mobileAccountOpen ? 'login' : undefined) as 'menu' | 'import' | 'share' | 'login' | undefined,
    };

    return {
        mobilePartyOpen, setMobilePartyOpen,
        mobileStatusOpen, setMobileStatusOpen,
        mobileToolsOpen, setMobileToolsOpen,
        mobileMenuOpen, setMobileMenuOpen,
        mobileLoginModalOpen, setMobileLoginModalOpen,
        mobileAccountOpen, setMobileAccountOpen,
        mobileShareOpen, setMobileShareOpen,
        mobileCueSheet, setMobileCueSheet,
        navHandlers,
    };
}

export type MobileSheets = ReturnType<typeof useMobileSheets>;
