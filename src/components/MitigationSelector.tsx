import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MITIGATIONS, getMitigationPriority, JOBS } from '../data/mockData';
import type { Mitigation, AppliedMitigation } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';

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
    const { theme, contentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const panelRef = React.useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = React.useState(position);

    const [selectedSingleTargetMit, setSelectedSingleTargetMit] = React.useState<Mitigation | null>(null);
    const { partyMembers } = useMitigationStore();

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

    if (!isOpen) return null;

    const allJobMitigations = jobId ? MITIGATIONS.filter(m => m.jobId === jobId) : [];

    const getResourceStatus = (m: Mitigation) => {
        return validateMitigationPlacement(m, selectedTime, activeMitigations, schAetherflowPattern, t);
    };

    const SINGLE_TARGET_BUFFS = ['the_blackest_night', 'heart_of_corundum', 'intervention', 'oblation', 'aquaveil', 'exaltation', 'protraction', 'taurochole', 'haima', 'aurora', 'nascent_flash'];

    const availableMitigations = allJobMitigations.filter(m => {
        if (!m.requires) return true;
        return activeMitigations.some(am => {
            if (am.mitigationId !== m.requires) return false;
            const start = am.time;
            const end = am.time + am.duration;
            return selectedTime >= start && selectedTime < end;
        });
    }).sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id));

    const handleMitigationClick = (mitigation: Mitigation) => {
        const isAlreadyPlaced = activeMitigations.some(am => am.mitigationId === mitigation.id && am.time === selectedTime);
        if (isAlreadyPlaced && onRemove) {
            onRemove(mitigation.id);
            return;
        }

        if (SINGLE_TARGET_BUFFS.includes(mitigation.id)) {
            setSelectedSingleTargetMit(mitigation);
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
                ref={panelRef}
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
                {isMobile && !isCentered && <div className="w-12 h-1 bg-slate-900/10 dark:bg-white/10 rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-black/5 dark:border-white/[0.03] px-1 shrink-0">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        {selectedSingleTargetMit ? t('mitigation.select_target', '対象を選択してください') : t('mitigation.select')}
                    </span>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        <X size={14} />
                    </button>
                </div>

                {!selectedSingleTargetMit ? (
                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar shrink">
                        {availableMitigations.length === 0 ? (
                            <div className="text-xs text-slate-400 p-4 text-center">{t('mitigation.no_mitigations')}</div>
                        ) : (
                            availableMitigations.map(mitigation => {
                                const status = getResourceStatus(mitigation);
                                const isAlreadyPlaced = activeMitigations.some(am => am.mitigationId === mitigation.id && am.time === selectedTime);
                                const isClickable = status.available || isAlreadyPlaced;

                                return (
                                    <button
                                        key={mitigation.id}
                                        onClick={() => isClickable && handleMitigationClick(mitigation)}
                                        disabled={!isClickable}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left group border",
                                            isAlreadyPlaced
                                                ? (theme === 'dark' ? "bg-red-500/10 border-red-500/40 hover:bg-red-500/20" : "bg-red-50 border-red-200 hover:bg-red-100")
                                                : !status.available
                                                    ? (theme === 'dark' ? 'border-red-500/20 bg-red-500/[0.06] cursor-not-allowed opacity-70' : 'border-red-100 bg-red-50/50 cursor-not-allowed opacity-50')
                                                    : status.warning
                                                        ? (theme === 'dark' ? 'hover:bg-amber-500/[0.06] border-amber-500/30' : 'hover:bg-amber-50 border-amber-200')
                                                        : (theme === 'dark' ? 'hover:bg-white/[0.08] border-transparent hover:border-white/[0.03]' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'),
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
                                                        ? (theme === 'dark' ? 'bg-red-900/30 border-red-500/30' : 'bg-red-50 border-red-200')
                                                        : status.warning
                                                            ? (theme === 'dark' ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200')
                                                            : (theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200')
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
                                            <div className={`text-xs font-bold transition-colors ${!status.available
                                                ? 'text-red-600 dark:text-red-400'
                                                : status.warning
                                                    ? 'text-amber-600 dark:text-amber-300'
                                                    : 'text-slate-800 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white'
                                                }`}>
                                                {contentLanguage === 'en' ? mitigation.name.en : mitigation.name.ja}
                                                {isAlreadyPlaced && <span className="ml-2 text-[8px] bg-red-600 text-white px-1 rounded uppercase">{t('mitigation.remove')}</span>}
                                                {SINGLE_TARGET_BUFFS.includes(mitigation.id) && !isAlreadyPlaced && (
                                                    <span className="ml-1 text-[9px] bg-black/5 dark:bg-white/10 px-1 rounded text-slate-600 dark:text-white/70">▶</span>
                                                )}
                                            </div>
                                            {!status.available ? (
                                                <div className="text-[10px] text-red-600 dark:text-red-400/80 font-medium">
                                                    {status.message}
                                                </div>
                                            ) : status.warning && (
                                                <div className="text-[10px] text-amber-700 dark:text-amber-400/80 font-medium">
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
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1 shrink">
                        {partyMembers.map((member: import('../types').PartyMember) => {
                            const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                            return (
                                <button
                                    key={member.id}
                                    onClick={() => handleTargetSelect(member.id)}
                                    className={clsx(
                                        "flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer",
                                        theme === 'dark'
                                            ? "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.05]"
                                            : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                    )}
                                >
                                    {job ? (
                                        <img src={job.icon} alt={contentLanguage === 'en' ? job.name.en : job.name.ja} className="w-8 h-8 object-contain opacity-90 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-slate-900/10 dark:bg-white/10 border border-white/20" />
                                    )}
                                    <span className={`text-sm font-black tracking-widest ${member.role === 'tank' ? 'text-blue-400' : member.role === 'healer' ? 'text-green-400' : 'text-red-400'}`}>
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