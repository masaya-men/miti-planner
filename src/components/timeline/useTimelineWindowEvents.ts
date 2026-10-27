import { useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTutorialStore } from '../../store/useTutorialStore';

/*
 * 画面全体(window)のイベントを受ける effect。Timeline 本体から移したもの。
 * 本体では他の effect の間に挟まっていたため、effect の相対順を保つよう元の位置ごとに複数のフックへ割っている。
 * 本体では元と同じ位置で呼ぶこと(順序を入れ替えない)。
 */

/** ヘッダーからのイベント(オートプラン・取り込み・列グリッド取り込み)を受ける */
export function useTimelineHeaderEvents({ handleAutoPlan, setImportModalOpen, setShowGridImport }: {
    handleAutoPlan: () => void;
    setImportModalOpen: Dispatch<SetStateAction<boolean>>;
    setShowGridImport: Dispatch<SetStateAction<boolean>>;
}) {
    // Consolidated Header Event Listeners
    useEffect(() => {
        const handleAutoPlanEvent = () => handleAutoPlan();
        const handleImportEvent = () => setImportModalOpen(true);
        const handleGridImportEvent = () => setShowGridImport(true);
        window.addEventListener('timeline:autoplan', handleAutoPlanEvent);
        window.addEventListener('timeline:import', handleImportEvent);
        window.addEventListener('timeline:grid-import', handleGridImportEvent);
        return () => {
            window.removeEventListener('timeline:autoplan', handleAutoPlanEvent);
            window.removeEventListener('timeline:import', handleImportEvent);
            window.removeEventListener('timeline:grid-import', handleGridImportEvent);
        };
    }, [handleAutoPlan]);
}

interface TutorialEventsArgs {
    tutorialActive: boolean;
    tutorialStepIndex: number;
    mobilePartyOpen: boolean;
    isMobileView: boolean;
    setIsAaModeEnabled: Dispatch<SetStateAction<boolean>>;
    setAaSettingsOpen: Dispatch<SetStateAction<boolean>>;
    setPartySettingsOpenLocal: Dispatch<SetStateAction<boolean>>;
    setMobilePartyOpen: (open: boolean) => void;
    setMitigationSelectorOpen: Dispatch<SetStateAction<boolean>>;
    setIsModalOpen: Dispatch<SetStateAction<boolean>>;
    setPhaseDropdownOpen: Dispatch<SetStateAction<boolean>>;
    setGimmickDropdownOpen: Dispatch<SetStateAction<boolean>>;
    setMechanicSearchOpen: Dispatch<SetStateAction<boolean>>;
}

/** チュートリアル・モバイルのメニューまわりのイベント(effect 3 本) */
export function useTimelineTutorialEvents({
    tutorialActive, tutorialStepIndex, mobilePartyOpen, isMobileView,
    setIsAaModeEnabled, setAaSettingsOpen, setPartySettingsOpenLocal, setMobilePartyOpen,
    setMitigationSelectorOpen, setIsModalOpen, setPhaseDropdownOpen, setGimmickDropdownOpen, setMechanicSearchOpen,
}: TutorialEventsArgs) {
    // Tutorial auto-open logic
    useEffect(() => {
        if (tutorialActive && tutorialStepIndex === 0) {
            setIsAaModeEnabled(false);
            setAaSettingsOpen(false);
        }
    }, [tutorialActive, tutorialStepIndex]);

    // 旧チュートリアルのparty-slots自動オープンロジックは削除済み（TutorialBlocker方式に移行）

    // モバイルでパーティが開かれたらチュートリアルイベントを通知
    useEffect(() => {
        if (mobilePartyOpen) {
            useTutorialStore.getState().completeEvent('party:opened');
        }
    }, [mobilePartyOpen]);

    // チュートリアル戻るボタン用: ストアからモーダル制御するカスタムイベント
    useEffect(() => {
        const handleCloseAll = () => {
            setPartySettingsOpenLocal(false);
            setMobilePartyOpen(false);
            setMitigationSelectorOpen(false);
            setIsModalOpen(false);
        };
        const handleOpenParty = () => {
            if (isMobileView) {
                setMobilePartyOpen(true);
            } else {
                setPartySettingsOpenLocal(true);
            }
        };
        const handlePartySettings = (e: Event) => {
            const open = (e as CustomEvent).detail?.open ?? true;
            if (isMobileView) {
                setMobilePartyOpen(open);
            } else {
                setPartySettingsOpenLocal(open);
            }
        };
        const handlePhaseJump = () => setPhaseDropdownOpen(prev => !prev);
        const handleLabelJump = () => setGimmickDropdownOpen(prev => !prev);
        const handleMechanicSearch = () => setMechanicSearchOpen(prev => !prev);
        window.addEventListener('tutorial:close-all-modals', handleCloseAll);
        window.addEventListener('tutorial:open-party-modal', handleOpenParty);
        window.addEventListener('timeline:party-settings', handlePartySettings);
        window.addEventListener('mobile:phase-jump', handlePhaseJump);
        window.addEventListener('mobile:label-jump', handleLabelJump);
        window.addEventListener('mobile:mechanic-search', handleMechanicSearch);
        return () => {
            window.removeEventListener('tutorial:close-all-modals', handleCloseAll);
            window.removeEventListener('tutorial:open-party-modal', handleOpenParty);
            window.removeEventListener('timeline:party-settings', handlePartySettings);
            window.removeEventListener('mobile:phase-jump', handlePhaseJump);
            window.removeEventListener('mobile:label-jump', handleLabelJump);
            window.removeEventListener('mobile:mechanic-search', handleMechanicSearch);
        };
    }, []);
}

/** 記録パネルからのフェーズジャンプ */
export function useTimelineProgressJump({ handleNavJump, timeToYMapRef }: {
    handleNavJump: (time: number) => void;
    timeToYMapRef: RefObject<Map<number, number>>;
}) {
    // 記録パネルからのフェーズジャンプ: 独立 useEffect で既存リスナに干渉しない。
    // handleNavJump が useCallback で安定しているため、deps に含めて stale closure を防ぐ。
    useEffect(() => {
        const handleProgressJump = (e: Event) => {
            const { time } = (e as CustomEvent<{ time: number }>).detail ?? {};
            if (typeof time !== 'number') return;
            // 道クリックの任意時間 → timeToYMap に存在する最寄りの時間へスナップ（厳密さ不要）
            const map = timeToYMapRef.current;
            if (map.has(time)) { handleNavJump(time); return; }
            let nearest: number | null = null, best = Infinity;
            map.forEach((_y, tk) => { const d = Math.abs(tk - time); if (d < best) { best = d; nearest = tk; } });
            if (nearest !== null) handleNavJump(nearest);
        };
        window.addEventListener('progress:jump-to-time', handleProgressJump);
        return () => window.removeEventListener('progress:jump-to-time', handleProgressJump);
    }, [handleNavJump]);
}

/** チュートリアルの UI リセットイベントで AA モードを終了 */
export function useTimelineResetUiEvent({ setIsAaModeEnabled }: {
    setIsAaModeEnabled: Dispatch<SetStateAction<boolean>>;
}) {
    useEffect(() => {
        const handleReset = () => {
            setIsAaModeEnabled(false);
        };
        window.addEventListener('tutorial:reset-ui', handleReset);
        return () => {
            window.removeEventListener('tutorial:reset-ui', handleReset);
        };
    }, []);
}

/** 全消去メニューが開いている間、外側クリックで閉じる */
export function useTimelineClearMenuOutsideClick({ clearMenuOpen, setClearMenuOpen }: {
    clearMenuOpen: boolean;
    setClearMenuOpen: Dispatch<SetStateAction<boolean>>;
}) {
    useEffect(() => {
        if (!clearMenuOpen) return;
        const handleClick = () => setClearMenuOpen(false);
        const timer = setTimeout(() => {
            window.addEventListener('click', handleClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleClick);
        };
    }, [clearMenuOpen]);
}
