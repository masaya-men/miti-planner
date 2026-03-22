import React from 'react';
import { X, ChevronLeft } from 'lucide-react';
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
    ownerId?: string | null; // 👈 追加：使用者自身（自己対象不可の判定用）
    jobId: string | null;
    position: { x: number; y: number };
    activeMitigations?: AppliedMitigation[];
    selectedTime?: number;
    schAetherflowPattern?: 1 | 2;
    isCentered?: boolean; // 👈 追加：中央表示モードのフラグ
}

export const MitigationSelector: React.FC<MitigationSelectorProps> = ({
    isOpen, onClose, onSelect, onRemove, ownerId, jobId, position, activeMitigations = [], selectedTime = 0, schAetherflowPattern = 1,
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

    // ビューポート内に収めるための計算
    React.useLayoutEffect(() => {
        if (!isOpen || !panelRef.current || isCentered || isMobile) {
            return;
        }

        const rect = panelRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        let nx = position.x;
        let ny = position.y;

        // 右端チェック
        if (nx + rect.width > vw - 12) {
            nx = Math.max(12, vw - rect.width - 12);
        }
        // 下端チェック
        if (ny + rect.height > vh - 12) {
            ny = Math.max(12, vh - rect.height - 12);
        }

        // 差分がある場合のみ更新
        if (Math.abs(nx - adjustedPos.x) > 1 || Math.abs(ny - adjustedPos.y) > 1) {
            setAdjustedPos({ x: nx, y: ny });
        }
    }, [isOpen, position.x, position.y, isMobile, isCentered]);

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
    }, [isOpen]);

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
                    "pointer-events-auto shadow-sm p-2 flex flex-col glass-panel",
                    isMobile && !isCentered
                        ? "fixed bottom-0 left-0 right-0 w-full rounded-t-2xl rounded-b-none border-b-0 translate-y-0"
                        : "rounded-xl w-64",
                    !isCentered && !isMobile ? "fixed" : "relative"
                )}
                style={isMobile && !isCentered ? { maxHeight: '75vh' } : !isCentered ? { left: adjustedPos.x || position.x, top: adjustedPos.y || position.y, maxHeight: '50vh' } : { maxHeight: '60vh' }}
            >
                {isMobile && !isCentered && <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-black/5 dark:border-white/[0.03] px-1 shrink-0 relative z-[101]">
                    <div className="flex items-center pl-1">
                        <div className="flex flex-col justify-center min-w-0">
                            {selectedSingleTargetMit ? (
                                <button
                                    onClick={() => setSelectedSingleTargetMit(null)}
                                    className="group flex items-center gap-1 text-[10px] font-black text-app-text-secondary uppercase tracking-tighter leading-none hover:text-app-text transition-colors cursor-pointer text-left"
                                >
                                    <ChevronLeft 
                                        size={12} 
                                        className="transition-transform duration-200 group-hover:-translate-x-0.5" 
                                    />
                                    <span>{t('mitigation.select_target', '対象を選択')}</span>
                                </button>
                            ) : (
                                <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-tighter leading-none">
                                    {t('mitigation.select')}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-app-text-muted hover:text-app-text transition-colors cursor-pointer shrink-0">
                        <X size={14} />
                    </button>
                </div>

                <div className="relative h-[280px] sm:h-[320px] overflow-hidden rounded-lg">
                    {/* 背景のスキルリスト */}
                    <div 
                        className={clsx(
                            "absolute inset-0 flex flex-col transition-all duration-300 pr-1 custom-scrollbar overflow-y-auto space-y-1",
                            selectedSingleTargetMit ? "pointer-events-none pb-[140px]" : "opacity-100 blur-0 pb-1"
                        )}
                        ref={scrollContainerRef}
                    >
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
                                const isSelectedTargetMit = selectedSingleTargetMit?.id === mitigation.id;
                                const isBlurred = selectedSingleTargetMit !== null && !isSelectedTargetMit;

                                return (
                                    <React.Fragment key={mitigation.id}>
                                    <button
                                        id={`miti-btn-${mitigation.id}`}
                                        data-tutorial={tutorialSkillDataAttr}
                                        onClick={() => isClickable && handleMitigationClick(mitigation)}
                                        disabled={!isClickable}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-300 text-left group border text-app-text",
                                            isBlurred ? "opacity-30 blur-[2px] grayscale" : "",
                                            isSelectedTargetMit ? "z-10 shadow-md bg-white/10 dark:bg-white/5 border-white/20" : 
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
                                                    "w-8 h-8 object-contain rounded border transition-opacity",
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
                                        <div className="overflow-hidden">
                                            <div className={`text-xs font-black transition-colors truncate ${!status.available
                                                ? 'text-red-600 dark:text-red-400'
                                                : status.warning
                                                    ? 'text-amber-600 dark:text-amber-300'
                                                    : 'text-app-text'
                                                }`}>
                                                {contentLanguage === 'en' ? mitigation.name.en : mitigation.name.ja}
                                                {isAlreadyPlaced && <span className="ml-2 text-[8px] bg-red-600 text-white px-1 rounded uppercase tracking-tighter shrink-0">{t('mitigation.remove')}</span>}
                                                {mitigation.scope === 'target' && !isAlreadyPlaced && (
                                                    <span className="ml-2 text-[10px] text-app-text-secondary transition-transform group-hover:translate-x-0.5 inline-block shrink-0">
                                                        {isSelectedTargetMit ? '▼' : '▶'}
                                                    </span>
                                                )}
                                            </div>
                                            {!status.available ? (
                                                <div className="text-[10px] text-red-600 dark:text-red-400 font-bold truncate">
                                                    {status.message}
                                                </div>
                                            ) : status.warning && (
                                                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold truncate">
                                                    ⚠ {status.message}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                    
                                    {/* 💥 修正：選択されたスキルの直下にインラインでパネルを展開する */}
                                    {isSelectedTargetMit && (
                                        <div
                                            className={clsx(
                                                "w-full mt-1 mb-2 p-3 rounded-xl border-t-white/20",
                                                "glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]",
                                                "animate-in slide-in-from-top-2 fade-in duration-300 relative z-20"
                                            )}
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            <div className="grid grid-cols-4 grid-rows-2 gap-2 pb-1 pt-1">
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

                                                    const isSelfTargetRestricted = selectedSingleTargetMit?.targetCannotBeSelf && member.id === ownerId;
                                                    const isDisabled = isTargetBlockedByTutorial || isSelfTargetRestricted;

                                                    return (
                                                        <button
                                                            key={`target-${member.id}`}
                                                            data-tutorial={tutorialTargetDataAttr}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!isDisabled) handleTargetSelect(member.id);
                                                            }}
                                                            disabled={isDisabled}
                                                            className={clsx(
                                                                "flex items-center justify-center p-2 rounded-lg border transition-all duration-200",
                                                                "bg-slate-100/50 dark:bg-white/[0.03] border-black/5 dark:border-white/5",
                                                                "hover:bg-slate-200/50 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/10",
                                                                "shadow-sm dark:shadow-none hover:shadow-md",
                                                                isDisabled ? "opacity-30 cursor-not-allowed grayscale shadow-none" : "cursor-pointer active:scale-95 hover:scale-[1.03]"
                                                            )}
                                                        >
                                                            {job ? (
                                                                <img 
                                                                    src={job.icon} 
                                                                    alt={job.name?.en || job.id} 
                                                                    className="w-8 h-8 object-contain drop-shadow-md" 
                                                                />
                                                            ) : (
                                                                <span className={clsx(
                                                                    "text-[14px] font-black tracking-tighter uppercase drop-shadow-sm",
                                                                    member.role === 'tank' ? 'text-blue-500 dark:text-blue-400' : 
                                                                    member.role === 'healer' ? 'text-green-500 dark:text-green-400' : 
                                                                    'text-red-500 dark:text-red-400'
                                                                )}>
                                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
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