import { backdropClose } from '../utils/backdropClose';
import { useIsMobile } from '../hooks/useIsMobile';
import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMitigations, useJobs } from '../hooks/useSkillsData';
import type { Mitigation, AppliedMitigation } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { matchesCopiesShieldSource } from '../utils/scholarShieldRules';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import { MitigationSkillButton } from './mitigationSelector/MitigationSkillButton';
import { MitigationTargetPicker } from './mitigationSelector/MitigationTargetPicker';
import { MitigationShieldPicker } from './mitigationSelector/MitigationShieldPicker';
import { MitigationSelectorHeader } from './mitigationSelector/MitigationSelectorHeader';
import { useAdjustedPanelPosition } from './mitigationSelector/useAdjustedPanelPosition';
import { getAvailableMitigations } from './mitigationSelector/getAvailableMitigations';

interface MitigationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => void;
    onRemove?: (mitigationId: string) => void; // 👈 追加：削除用コールバック
    ownerId?: string | null; // 👈 追加：使用者自身（自己対象不可の判定用）
    jobId: string | null;
    position: { x: number; y: number };
    activeMitigations?: AppliedMitigation[];
    selectedTime?: number;
    isCentered?: boolean; // 👈 追加：中央表示モードのフラグ
}

export const MitigationSelector: React.FC<MitigationSelectorProps> = ({
    isOpen, onClose, onSelect, onRemove, ownerId, jobId, position, activeMitigations = [], selectedTime = 0,
    isCentered = false // 👈 デフォルトはfalse（今まで通り）
}) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const panelRef = React.useRef<HTMLDivElement>(null);

    const [selectedSingleTargetMit, setSelectedSingleTargetMit] = React.useState<Mitigation | null>(null);
    const [selectedCopyShieldMit, setSelectedCopyShieldMit] = React.useState<Mitigation | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(scrollContainerRef);
    const { partyMembers, currentLevel, timelineMitigations } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const isMobile = useIsMobile();

    // Escape: 対象選択中→スキル一覧に戻る、スキル一覧→モーダルを閉じる
    useEscapeClose(isOpen, () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
        }
    });

    const adjustedPos = useAdjustedPanelPosition(isOpen, panelRef, position, isMobile, isCentered);

    React.useEffect(() => {
        if (!isOpen) {
            setSelectedSingleTargetMit(null);
            setSelectedCopyShieldMit(null);
            return;
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const allJobMitigations = jobId ? MITIGATIONS.filter(m => m.jobId === jobId) : [];

    const getResourceStatus = (m: Mitigation) => {
        return validateMitigationPlacement(m, selectedTime, activeMitigations, t);
    };

    const isSeraphActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'summon_seraph' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );

    const isSeraphismActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'seraphism' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );

    const availableMitigations = getAvailableMitigations({
        allJobMitigations, currentLevel, activeMitigations, selectedTime, isSeraphActive, isSeraphismActive, MITIGATIONS,
    });

    const handleMitigationClick = (mitigation: Mitigation) => {
        const existingInstance = activeMitigations.find(am => am.mitigationId === mitigation.id && am.time === selectedTime);
        if (existingInstance && onRemove) {
            onRemove(existingInstance.id);
            return;
        }

        // copiesShield: 展開戦術 → 有効な鼓舞を検索してUI分岐
        if (mitigation.copiesShield) {
            const availableShields = timelineMitigations.filter(l =>
                matchesCopiesShieldSource(l.mitigationId, mitigation.copiesShield!) &&
                l.time <= selectedTime &&
                l.time + l.duration > selectedTime
            );

            if (availableShields.length === 1) {
                // 自動選択: 1つだけなら直接onSelect
                onSelect({ ...mitigation, _linkedMitigationId: availableShields[0].id });
                return;
            }

            // 0個 or 2+個: 選択UIを表示（0個でも配置は許可、バリア値0警告）
            setSelectedCopyShieldMit(mitigation);
            setTimeout(() => {
                const el = document.getElementById(`miti-btn-${mitigation.id}`);
                const container = scrollContainerRef.current;
                if (el && container) {
                    const topPos = el.offsetTop - 4;
                    container.scrollTo({ top: topPos, behavior: 'smooth' });
                }
            }, 50);
            return;
        }

        if (mitigation.scope === 'target') {
            setSelectedSingleTargetMit(mitigation);
            setTimeout(() => {
                const el = document.getElementById(`miti-btn-${mitigation.id}`);
                const container = scrollContainerRef.current;
                if (el && container) {
                    const topPos = el.offsetTop - 4;
                    container.scrollTo({
                        top: topPos,
                        behavior: 'smooth'
                    });
                }
            }, 50);
        } else {
            onSelect(mitigation);
        }
    };

    const handleTargetSelect = (targetId: string) => {
        if (selectedSingleTargetMit) {
            onSelect({ ...selectedSingleTargetMit, _targetId: targetId });
        }
    };

    const handleShieldSelect = (linkedMitigationId?: string) => {
        if (selectedCopyShieldMit) {
            onSelect({ ...selectedCopyShieldMit, _linkedMitigationId: linkedMitigationId });
        }
    };

    // 背景クリックで閉じる(チュートリアル中は閉じない)
    const handleBackdropClose = () => {
        if (useTutorialStore.getState().isActive) return;
        onClose();
    };

    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
        }
    };

    return (
        // 👇 修正：isCenteredがtrueなら、画面全体を覆うオーバーレイにしてド真ん中に配置！
        <div
            className={clsx(
                "fixed z-[9999] pointer-events-none",
                isCentered ? "inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-auto" : ""
            )}
            style={!isCentered ? { top: 0, left: 0 } : {}}
            {...(isCentered ? backdropClose(handleBackdropClose) : {})} // 背景クリックで閉じる(押し始めも離しも外側のときだけ)
        >
            {/* 非センター表示: 透明な全画面の背景がクリック・ホバーを受け止め、下の要素へは一切届かせない */}
            {!isCentered && (
                <div
                    className="fixed inset-0 pointer-events-auto cursor-default"
                    {...backdropClose(handleBackdropClose)}
                />
            )}
            <div
                key="mitigation-modal-content" // アニメーション等のために全体コンテナにも念のため付与
                ref={panelRef}
                data-tutorial-modal
                data-lenis-prevent
                onClick={e => e.stopPropagation()} // 中身のクリックで閉じないように
                className={clsx(
                    "pointer-events-auto p-2 flex flex-col float-surface",
                    isMobile && !isCentered
                        ? "fixed bottom-0 left-0 right-0 w-full rounded-t-sheet rounded-b-none glass-border-b-0 translate-y-0"
                        : "rounded-xl w-64",
                    !isCentered && !isMobile ? "fixed" : "relative"
                )}
                style={isMobile && !isCentered
                    ? { maxHeight: '75vh' }
                    : {
                        ...(!isCentered ? { left: adjustedPos.x || position.x, top: adjustedPos.y || position.y, maxHeight: '50vh' } : { maxHeight: '60vh' }),
                    }}
            >
                {isMobile && !isCentered && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mb-3 shrink-0" />}
                <MitigationSelectorHeader
                    selectedCopyShieldMit={selectedCopyShieldMit}
                    selectedSingleTargetMit={selectedSingleTargetMit}
                    setSelectedCopyShieldMit={setSelectedCopyShieldMit}
                    setSelectedSingleTargetMit={setSelectedSingleTargetMit}
                    handleClose={handleClose}
                />

                <div className="relative h-[280px] sm:h-[320px] overflow-hidden rounded-lg">
                    {/* 背景のスキルリスト */}
                    <div
                        className={clsx(
                            "absolute inset-0 flex flex-col transition-all duration-300 pr-1 custom-scrollbar space-y-1",
                            selectedSingleTargetMit ? "pointer-events-none overflow-hidden pb-[140px]" : "overflow-y-auto opacity-100 blur-0 pb-1"
                        )}
                        ref={scrollContainerRef}
                    >
                        {availableMitigations.length === 0 ? (
                            <div className="text-app-lg text-app-text-sec p-4 text-center">{t('mitigation.no_mitigations')}</div>
                        ) : (
                            availableMitigations.map(mitigation => {
                                const status = getResourceStatus(mitigation);
                                const isAlreadyPlaced = activeMitigations.some(am => am.mitigationId === mitigation.id && am.time === selectedTime);

                                const isClickable = (status.available || status.conflictOverride || isAlreadyPlaced);
                                const isSelectedTargetMit = selectedSingleTargetMit?.id === mitigation.id;
                                const isSelectedShieldMit = selectedCopyShieldMit?.id === mitigation.id;
                                const isBlurred = (selectedSingleTargetMit !== null && !isSelectedTargetMit) ||
                                                  (selectedCopyShieldMit !== null && !isSelectedShieldMit);

                                return (
                                    <React.Fragment key={mitigation.id}>
                                    <MitigationSkillButton
                                        mitigation={mitigation}
                                        status={status}
                                        contentLanguage={contentLanguage}
                                        isClickable={isClickable}
                                        isAlreadyPlaced={isAlreadyPlaced}
                                        isSelectedTargetMit={isSelectedTargetMit}
                                        isSelectedShieldMit={isSelectedShieldMit}
                                        isBlurred={isBlurred}
                                        selectedCopyShieldMit={selectedCopyShieldMit}
                                        onClick={() => isClickable && handleMitigationClick(mitigation)}
                                    />

                                    {/* 💥 修正：選択されたスキルの直下にインラインでパネルを展開する */}
                                    {isSelectedTargetMit && (
                                        <MitigationTargetPicker
                                            partyMembers={partyMembers}
                                            JOBS={JOBS}
                                            selectedSingleTargetMit={selectedSingleTargetMit}
                                            ownerId={ownerId}
                                            onSelect={handleTargetSelect}
                                        />
                                    )}

                                    {/* copiesShield: 鼓舞選択パネル */}
                                    {selectedCopyShieldMit?.id === mitigation.id && (
                                        <MitigationShieldPicker
                                            mitigation={mitigation}
                                            selectedTime={selectedTime}
                                            timelineMitigations={timelineMitigations}
                                            partyMembers={partyMembers}
                                            JOBS={JOBS}
                                            MITIGATIONS={MITIGATIONS}
                                            onSelect={handleShieldSelect}
                                        />
                                    )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};