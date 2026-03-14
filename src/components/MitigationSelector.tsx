import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MITIGATIONS, getMitigationPriority, JOBS } from '../data/mockData';
import type { Mitigation, AppliedMitigation, PartyMember } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';

interface MitigationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mitigation: Mitigation & { _targetId?: string }) => void;
    onRemove?: (mitigationId: string) => void; // 👈 追加：削除用コールバック
    jobId: string | null;
    position: { x: number; y: number };
    activeMitigations?: AppliedMitigation[];
    selectedTime?: number;
    schAetherflowPattern?: 1 | 2;
    isCentered?: boolean; // 👈 追加：中央表示モードのフラグ
}

export const MitigationSelector: React.FC<MitigationSelectorProps> = ({
    isOpen, onClose, onSelect, onRemove, jobId, position, activeMitigations = [], selectedTime = 0, schAetherflowPattern = 1,
    isCentered = false // 👈 デフォルトはfalse（今まで通り）
}) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const panelRef = React.useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = React.useState(position);

    const [selectedSingleTargetMit, setSelectedSingleTargetMit] = React.useState<Mitigation | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const { partyMembers, currentLevel } = useMitigationStore();
    const tutorialState = useTutorialStore();

    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    React.useEffect(() => {
        if (!isOpen || !panelRef.current || isCentered) { // 👈 isCenteredの時は座標計算をスキップ
            setAdjustedPos(position);
            return;
        }
        if (isMobile) return;

        requestAnimationFrame(() => {
            if (!panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let x = position.x;
            let y = position.y;
            if (y + rect.height > vh - 8) {
                y = Math.max(8, vh - rect.height - 8);
            }
            if (x + rect.width > vw - 8) {
                x = Math.max(8, vw - rect.width - 8);
            }
            setAdjustedPos({ x, y });
        });
    }, [isOpen, position, isMobile, isCentered]);

    React.useEffect(() => {
        if (!isOpen) {
            setSelectedSingleTargetMit(null);
            return;
        }
        const handleMouseDown = (e: MouseEvent) => {
            // Tutorial: block closing the selector if tutorial is active
            if (useTutorialStore.getState().isActive) return;

            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen, onClose]);

    React.useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [isOpen, selectedSingleTargetMit]);

    if (!isOpen) return null;

    const allJobMitigations = jobId ? MITIGATIONS.filter(m => m.jobId === jobId) : [];

    const getResourceStatus = (m: Mitigation) => {
        return validateMitigationPlacement(m, selectedTime, activeMitigations, schAetherflowPattern, t);
    };

    const isSeraphActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'summon_seraph' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );

    const availableMitigations = allJobMitigations
        .filter((m: Mitigation) => {
            // Level sync filtering
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;

            // Filter out hidden skills (e.g., Adloquium)
            if (m.hidden) return false;

            if (!m.requires) return true;
            return activeMitigations.some(am => {
                const isNeutSect = am.mitigationId === 'neutral_sect';
                const isHoroscope = am.mitigationId === 'horoscope';
                const isActive = selectedTime >= am.time && selectedTime < am.time + am.duration;
                if (!isActive) return false;

                // Special handling for Astrologian conditional skills
                if (m.requires === 'neutral_sect') {
                    // Sun Sign MUST have Neutral Sect active
                    if (m.id === 'sun_sign') {
                        return isNeutSect;
                    }
                    // Helios-based skills can use either Neutral Sect or Horoscope
                    return isNeutSect || isHoroscope;
                }

                return am.mitigationId === m.requires;
            });
        })
        .map((m: Mitigation) => {
            // Scholar Seraph dynamic changes
            if (isSeraphActive) {
                if (m.id === 'whispering_dawn') {
                    return { ...m, name: { ...m.name, ja: '光輝の囁き', en: 'Angel\'s Whisper' }, icon: '/icons/Angel\'s_Whisper.png' };
                }
                if (m.id === 'fey_illumination') {
                    return { ...m, name: { ...m.name, ja: 'セラフィックイルミネーション', en: 'Seraphic Illumination' }, icon: '/icons/Seraphic_Illumination.png' };
                }
            }
            return m;
        })
        .sort((a: Mitigation, b: Mitigation) => getMitigationPriority(a.id) - getMitigationPriority(b.id));

    const handleMitigationClick = (mitigation: Mitigation) => {
        const existingInstance = activeMitigations.find(am => am.mitigationId === mitigation.id && am.time === selectedTime);
        if (existingInstance && onRemove) {
            onRemove(existingInstance.id);
            return;
        }

        if (mitigation.scope === 'target') {
            setSelectedSingleTargetMit(mitigation);
            useTutorialStore.getState().completeEvent('tutorial:selected-target-miti');
        } else {
            onSelect(mitigation);
        }
    };

    const handleTargetSelect = (targetId: string) => {
        if (selectedSingleTargetMit) {
            onSelect({ ...selectedSingleTargetMit, _targetId: targetId });
        }
    };

    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else {
            onClose();
        }
    };

    return (
        // 👇 修正：isCenteredがtrueなら、画面全体を覆うオーバーレイにしてド真ん中に配置！
        <div
            className={clsx(
                "fixed z-[9999] pointer-events-none",
                isCentered ? "inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto" : ""
            )}
            style={!isCentered ? { top: 0, left: 0 } : {}}
            onClick={isCentered ? onClose : undefined} // 背景クリックで閉じる
        >
            <div
                key="mitigation-modal-content" // アニメーション等のために全体コンテナにも念のため付与
                ref={panelRef}
                data-tutorial-modal
                onClick={e => e.stopPropagation()} // 中身のクリックで閉じないように
                className={clsx(
                    "pointer-events-auto shadow-2xl p-2 overflow-hidden flex flex-col transition-transform duration-300 glass-panel",
                    isMobile && !isCentered
                        ? "fixed bottom-0 left-0 right-0 w-full rounded-t-2xl rounded-b-none border-b-0 translate-y-0"
                        : "rounded-xl w-64",
                    !isCentered && !isMobile ? "fixed" : "relative animate-in zoom-in-95 fade-in duration-200"
                )}
                style={isMobile && !isCentered ? { maxHeight: '75vh' } : !isCentered ? { left: adjustedPos.x, top: adjustedPos.y, maxHeight: '50vh' } : { maxHeight: '60vh' }}
            >
                {isMobile && !isCentered && <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-black/5 dark:border-white/[0.03] px-1 shrink-0">
                    <span className="text-xs font-black text-app-text-secondary uppercase tracking-wider">
                        {selectedSingleTargetMit ? t('mitigation.select_target', '対象を選択してください') : t('mitigation.select')}
                    </span>
                    <button onClick={handleClose} className="text-app-text-muted hover:text-app-text transition-colors cursor-pointer">
                        <X size={14} />
                    </button>
                </div>

                {!selectedSingleTargetMit ? (
                    <div ref={scrollContainerRef} key="mitigations-list" className="space-y-1 overflow-y-auto pr-1 custom-scrollbar shrink">
                        {availableMitigations.length === 0 ? (
                            <div className="text-xs text-app-text-secondary p-4 text-center">{t('mitigation.no_mitigations')}</div>
                        ) : (
                            availableMitigations.map(mitigation => {
                                const status = getResourceStatus(mitigation);
                                const isAlreadyPlaced = activeMitigations.some(am => am.mitigationId === mitigation.id && am.time === selectedTime);

                                let isClickBlockedByTutorial = false;
                                let tutorialSkillDataAttr: string | undefined = undefined;

                                if (tutorialState.isActive) {
                                    const currentStep = TUTORIAL_STEPS[tutorialState.currentStepIndex];
                                    if (currentStep) {
                                        if (currentStep.id === 'tutorial-7c-aoe-skill') {
                                            const isAoEMiti = mitigation.family === 'role_action' && mitigation.scope === 'party';
                                            if (isAoEMiti) {
                                                tutorialSkillDataAttr = 'tutorial-skill-reprisal';
                                            } else {
                                                isClickBlockedByTutorial = true;
                                            }
                                        } else if (currentStep.id === 'tutorial-8c-tb-skill') {
                                            const isTargetBuff = mitigation.scope === 'target';
                                            if (isTargetBuff) {
                                                tutorialSkillDataAttr = 'tutorial-skill-intervention';
                                            } else {
                                                isClickBlockedByTutorial = true;
                                            }
                                        }
                                    }
                                }

                                const isClickable = (status.available || isAlreadyPlaced) && !isClickBlockedByTutorial;

                                return (
                                    <button
                                        key={mitigation.id}
                                        data-tutorial={tutorialSkillDataAttr}
                                        onClick={() => isClickable && handleMitigationClick(mitigation)}
                                        disabled={!isClickable}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left group border",
                                            isAlreadyPlaced
                                                ? ("bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/40 dark:hover:bg-red-500/20")
                                                : !status.available
                                                    ? ("border-red-100 bg-red-50/50 cursor-not-allowed opacity-50 dark:border-red-500/20 dark:bg-red-500/[0.06] dark:cursor-not-allowed dark:opacity-70")
                                                    : status.warning
                                                        ? ("hover:bg-amber-50 border-amber-200 dark:hover:bg-amber-500/[0.06] dark:border-amber-500/30")
                                                        : ("hover:bg-slate-50 border-transparent hover:border-slate-200 dark:hover:bg-white/[0.08] dark:border-transparent dark:hover:border-white/[0.03]"),
                                            isClickable ? "cursor-pointer" : "cursor-not-allowed"
                                        )}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={mitigation.icon}
                                                alt={contentLanguage === 'en' ? mitigation.name.en : mitigation.name.ja}
                                                className={clsx(
                                                    "w-8 h-8 object-contain rounded border",
                                                    !status.available
                                                        ? ("bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-500/30")
                                                        : status.warning
                                                            ? ("bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/30")
                                                            : ("bg-slate-100 border-slate-200 dark:bg-black/30 dark:border-white/5")
                                                )}
                                            />
                                            {status.badge && (
                                                <span className={`absolute -top-1.5 -right-1.5 text-[8px] font-black leading-none px-1 py-0.5 rounded-full shadow-lg ring-1 ${status.badgeColor === 'red'
                                                    ? 'bg-red-600/90 text-red-100 ring-red-400/50'
                                                    : status.badgeColor === 'amber'
                                                        ? 'bg-amber-600/90 text-amber-100 ring-amber-400/50'
                                                        : 'bg-cyan-600/90 text-cyan-100 ring-cyan-400/50'
                                                    }`}>
                                                    {status.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className={`text-xs font-black transition-colors ${!status.available
                                                ? 'text-red-600 dark:text-red-400'
                                                : status.warning
                                                    ? 'text-amber-600 dark:text-amber-300'
                                                    : 'text-app-text'
                                                }`}>
                                                {contentLanguage === 'en' ? mitigation.name.en : mitigation.name.ja}
                                                {isAlreadyPlaced && <span className="ml-2 text-[8px] bg-red-600 text-white px-1 rounded uppercase">{t('mitigation.remove')}</span>}
                                                {mitigation.scope === 'target' && !isAlreadyPlaced && (
                                                    <span className="ml-1 text-[9px] bg-black/5 dark:bg-white/10 px-1 rounded text-app-text-secondary">▶</span>
                                                )}
                                            </div>
                                            {!status.available ? (
                                                <div className="text-[10px] text-red-600 dark:text-red-400 font-bold">
                                                    {status.message}
                                                </div>
                                            ) : status.warning && (
                                                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                                                    ⚠ {status.message}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div key="targets-list" className="flex flex-col gap-1.5 overflow-y-auto pr-1 custom-scrollbar shrink">
                        {partyMembers.map((member: PartyMember) => {
                            const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;

                            let isTargetBlockedByTutorial = false;
                            let tutorialTargetDataAttr: string | undefined = undefined;

                            if (tutorialState.isActive) {
                                const currentStep = TUTORIAL_STEPS[tutorialState.currentStepIndex];
                                if (currentStep && currentStep.id === 'tutorial-8d-tb-target') {
                                    if (member.id === 'MT') {
                                        tutorialTargetDataAttr = 'tutorial-target-mt';
                                    } else {
                                        isTargetBlockedByTutorial = true;
                                    }
                                }
                            }

                            return (
                                <button
                                    key={member.id}
                                    data-tutorial={tutorialTargetDataAttr}
                                    onClick={() => !isTargetBlockedByTutorial && handleTargetSelect(member.id)}
                                    disabled={isTargetBlockedByTutorial}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left",
                                        isTargetBlockedByTutorial ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.08]",
                                        "bg-transparent border-transparent hover:border-slate-200 dark:hover:border-white/[0.03]"
                                    )}
                                >
                                    {job ? (
                                        <div className="w-8 h-8 rounded border bg-slate-100 border-slate-200 dark:bg-black/30 dark:border-white/5 flex-shrink-0 flex items-center justify-center">
                                            <img src={job.icon} alt={contentLanguage === 'en' ? job.name.en : job.name.ja} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded border bg-slate-100 border-slate-200 dark:bg-black/30 dark:border-white/5 flex items-center justify-center opacity-50" />
                                    )}
                                    <span className={`text-xs font-black tracking-widest ${member.role === 'tank' ? 'text-blue-500' : member.role === 'healer' ? 'text-green-500' : 'text-red-500'}`}>
                                        {member.id}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};