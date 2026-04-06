
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Calculator, Save } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { getPhaseName } from '../types';
import { useMitigationStore, DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from '../store/useMitigationStore';
import { useMitigations, useJobs, useLevelModifiers } from '../hooks/useSkillsData';
import { calculateHpValue, calculatePotencyValue } from '../utils/calculator';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';
import { useTutorialStore } from '../store/useTutorialStore';
import { Tooltip } from './ui/Tooltip';

/** 全角数字→半角変換し、数字と小数点以外を除去 */
function toHalfWidthNumber(str: string): string {
    return str.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
              .replace(/[^0-9.]/g, '');
}

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    initialData?: TimelineEvent | null;
    initialTime?: number;
    position?: { x: number; y: number };
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData, initialTime, position }) => {
    useEscapeClose(isOpen, onClose);
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const [name, setName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [time, setTime] = useState(0);
    const [damageType, setDamageType] = useState<TimelineEvent['damageType']>('magical');
    const [damageAmount, setDamageAmount] = useState<number>(0);
    const [target, setTarget] = useState<TimelineEvent['target']>('AoE');

    // Visible mitigations state for Tutorial Step 20
    const [visibleMitigations, setVisibleMitigations] = useState<Set<string>>(new Set());

    // Mobile Detection
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // IntersectionObserver for tracking visible mitigations
    useEffect(() => {
        if (!isOpen) {
            setVisibleMitigations(new Set());
            return;
        }

        const container = document.getElementById('mitigation-grid-container');
        if (!container) return;

        const observer = new IntersectionObserver((entries) => {
            setVisibleMitigations(prev => {
                const next = new Set(prev);
                entries.forEach(entry => {
                    const id = entry.target.getAttribute('data-mitigation-id');
                    if (id) {
                        if (entry.isIntersecting) {
                            next.add(id);
                        } else {
                            next.delete(id);
                        }
                    }
                });
                return next;
            });
        }, {
            root: container,
            threshold: 0.1 // 10% visible is enough
        });

        // Small delay to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            const items = container.querySelectorAll('[data-mitigation-id]');
            items.forEach(item => observer.observe(item));
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [isOpen]);

    // ... (rest of logic same until return)

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setTime(initialData.time);
                setDamageType(initialData.damageType);
                setDamageAmount(initialData.damageAmount || 0);
                setTarget(initialData.target || 'AoE');

                // 👇 修正：すでにダメージが入っている場合は、電卓が上書きしないように「直接入力(Direct)」モードで開く
                if (initialData.damageAmount && initialData.damageAmount > 0) {
                    setInputMode('direct');
                } else {
                    setInputMode('reverse');
                }
                setCalcActualDamage(0);
                setSelectedMitigations([]);
            } else {
                setName({ ja: '', en: '' });
                setTime(initialTime || 0);
                setDamageType('magical');
                setDamageAmount(0);
                setTarget('AoE');
                // Reset calculator state
                setInputMode('reverse');
                setCalcActualDamage(0);
                setSelectedMitigations([]);
            }
            mitiPresetDoneRef.current = false;
        }
    }, [isOpen, initialData, initialTime]);

    // Calculator State
    const [inputMode, setInputMode] = useState<'direct' | 'reverse'>('reverse');
    const [calcActualDamage, setCalcActualDamage] = useState<number>(0);
    const [selectedMitigations, setSelectedMitigations] = useState<string[]>([]);

    const { partyMembers, currentLevel } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const LEVEL_MODIFIERS = useLevelModifiers();

    const tutorialState = useTutorialStore();
    const isTutorialActive = tutorialState.isActive;
    const currentStep = isTutorialActive ? tutorialState.getCurrentStep() : null;
    const mitiPresetDoneRef = useRef(false);

    // Toggle mitigation selection
    const toggleMitigation = (id: string) => {
        if (isTutorialActive && (currentStep?.id === 'add-3-miti' || currentStep?.id === 'create-8-miti')) {
            const mit = MITIGATIONS.find(m => m.id === id);
            if (currentStep?.id === 'create-8-miti') {
                // create-plan: リプライザルのみ許可
                if (!mit || mit.name.en !== 'Reprisal') return;
            } else {
                // main: Reprisal, Addle, Sacred Soil のみ許可
                const isTargetSkill = mit && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en);
                if (!isTargetSkill) return;
            }
        }
        setSelectedMitigations(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    // Sorting Logic
    const TANK_AOE_IDS = [
        'heart_of_light', 'dark_missionary', 'shake_it_off', 'divine_veil', 'passage_of_arms'
    ];

    const getMitigationRole = (jobId: string) => {
        const job = JOBS.find(j => j.id === jobId);
        return job?.role || 'dps';
    };

    const getSortPriority = (mit: typeof MITIGATIONS[0]) => {
        const role = getMitigationRole(mit.jobId);

        // 1. Tank
        if (role === 'tank') {
            const isAoE = TANK_AOE_IDS.includes(mit.id) || mit.name.ja.includes('リプライザル');
            // Tank AoE (0) -> Tank Single (1)
            return isAoE ? 0 : 1;
        }

        // 2. Healer (2)
        if (role === 'healer') return 2;

        // 3. DPS (3)
        return 3;
    };

    const EXCLUDED_IDS = [
        'aurora', 'thrill_of_battle', 'holmgang', 'living_dead', 'superbolide', 'hallowed_ground',
        'helios_conjunction', 'summon_seraph', 'seraphism', 'philosophia', 'macrocosmos',
        'mantra', 'nature_s_minne', 'deployment_tactics'
    ];

    // Deduplicate mitigations by English name so role actions (Addle, Feint, Reprisal) only appear once
    const uniqueMitigations = useMemo(() => {
        const seenNames = new Set<string>();
        return MITIGATIONS.filter(mit => {
            // Level sync filtering
            if (mit.minLevel !== undefined && currentLevel < mit.minLevel) return false;
            if (mit.maxLevel !== undefined && currentLevel > mit.maxLevel) return false;

            // Filter out excluded IDs first
            if (EXCLUDED_IDS.includes(mit.id)) return false;

            const nameEN = mit.name.en;
            if (seenNames.has(nameEN)) return false;
            seenNames.add(nameEN);
            return true;
        });
    }, [currentLevel]);

    const sortedMitigations = useMemo(() => {
        return [...uniqueMitigations].sort((a, b) => {
            const prioA = getSortPriority(a);
            const prioB = getSortPriority(b);

            if (prioA !== prioB) return prioA - prioB;

            // If same priority, sort by display order if possible, else name.ja
            return (a.name.ja || "").localeCompare(b.name.ja || "");
        });
    }, [uniqueMitigations]);

    // Calculate Raw Damage
    const handleCalculate = () => {
        const actual = calcActualDamage;
        let shieldTotal = 0;
        let mitigationMult = 1;

        // 1. Calculate Shields & Mitigation Multipliers
        selectedMitigations.forEach(mitId => {
            const def = MITIGATIONS.find(m => m.id === mitId);
            if (!def) return;

            // Percentage Mitigation
            if (!def.isShield) {
                let val = def.value;
                if (damageType === 'physical' && def.valuePhysical !== undefined) val = def.valuePhysical;
                if (damageType === 'magical' && def.valueMagical !== undefined) val = def.valueMagical;

                // Check type validity
                if (def.type === 'physical' && damageType === 'magical') val = 0;
                if (def.type === 'magical' && damageType === 'physical') val = 0;

                mitigationMult *= (1 - val / 100);
            }

            // Shield Calculation
            if (def.isShield) {
                const member = partyMembers.find(m => m.jobId === def.jobId);
                let shieldVal = 0;

                if (member && member.computedValues) {
                    shieldVal = member.computedValues[getPhaseName(def.name, contentLanguage)] || 0;
                } else {
                    // Fallback to average calculation if member not found in computedValues
                    let stats = DEFAULT_HEALER_STATS;
                    let role = 'healer';

                    if (def.jobId) {
                        const m2 = partyMembers.find(m => m.jobId === def.jobId);
                        if (m2) {
                            stats = m2.stats;
                            role = m2.role;
                        } else {
                            const job = JOBS.find(j => j.id === def.jobId);
                            if (job?.role === 'tank') stats = DEFAULT_TANK_STATS;
                        }
                    }

                    if (def.valueType === 'hp') {
                        shieldVal = calculateHpValue(stats.hp, def.value || 0);
                    } else if (def.valueType === 'potency') {
                        let val = calculatePotencyValue({ ...stats, wd: stats.wd }, def.value || 0, role, LEVEL_MODIFIERS[currentLevel]);
                        if (def.healingIncrease) val = Math.floor(val * def.healingIncrease);
                        shieldVal = val;
                    }
                }

                shieldTotal += shieldVal;
            }
        });

        // Formula: Raw = (Actual + Shields) / Mult
        if (mitigationMult === 0) mitigationMult = 0.01; // Avoid divide by zero
        const raw = Math.ceil((actual + shieldTotal) / mitigationMult);

        return raw;
    };

    // Auto-calculate running effect
    useEffect(() => {
        if (inputMode === 'reverse') {
            const calculated = handleCalculate();
            setDamageAmount(calculated);
        }
    }, [calcActualDamage, selectedMitigations, damageType, inputMode, target]);

    // --- Tutorial Progression Logic ---
    const [targetActualDamage, setTargetActualDamage] = useState(0);

    // Compute expected damage for Step 9C
    useEffect(() => {
        if (isTutorialActive && currentStep?.id === 'add-2-damage') {
            const h1 = partyMembers.find(m => m.id === 'H1');
            setTargetActualDamage(Math.floor(h1 ? h1.stats.hp * 0.8 : 80000));
        }
    }, [isTutorialActive, currentStep?.id, partyMembers]);

    // Watchers for tutorial steps
    useEffect(() => {
        if (!isTutorialActive) return;

        // 9B: Name Input
        if (currentStep?.id === 'add-1-name') {
            setInputMode('reverse');
            const val = getPhaseName(name, contentLanguage).toLowerCase();
            if (val.includes('アルテマ') || val.includes('ultima')) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:name-entered'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9C: Damage Input
        if (currentStep?.id === 'add-2-damage' && targetActualDamage > 0) {
            if (calcActualDamage === targetActualDamage) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:damage-entered'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9D: Mitigation Selection
        if (currentStep?.id === 'add-3-miti') {
            const selectedENNames = selectedMitigations.map(id => MITIGATIONS.find(m => m.id === id)?.name.en);
            const hasReprisal = selectedENNames.includes('Reprisal');
            const hasAddle = selectedENNames.includes('Addle');
            const hasSoil = selectedENNames.includes('Sacred Soil');

            if (hasReprisal && hasAddle && hasSoil) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:miti-selected'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9D: Auto-scroll to mitigations area
        if (currentStep?.id === 'add-3-miti') {
            const container = document.getElementById('event-modal-form');
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // 9E: Auto-scroll to bottom (save button)
        if (currentStep?.id === 'add-4-save') {
            const container = document.getElementById('event-modal-form');
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // create-plan: ステップ8 — 軽減プリセット + リプライザル検知
        if (currentStep?.id === 'create-8-miti') {
            // プリセットは一度だけ、少し遅延させて isOpen リセットと競合しないようにする
            if (!mitiPresetDoneRef.current) {
                mitiPresetDoneRef.current = true;
                const presetTimer = setTimeout(() => {
                    const sacredSoilId = MITIGATIONS.find(m => m.name.en === 'Sacred Soil')?.id;
                    const divineVeilId = MITIGATIONS.find(m => m.name.en === 'Divine Veil')?.id;
                    const presets = [sacredSoilId, divineVeilId].filter((id): id is string => !!id);
                    setSelectedMitigations(prev => {
                        const newSet = new Set([...prev, ...presets]);
                        return Array.from(newSet);
                    });
                    // プリセット追加後にスクロール
                    setTimeout(() => {
                        const container = document.getElementById('event-modal-form');
                        if (container) {
                            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                        }
                    }, 50);
                }, 200);
                return () => clearTimeout(presetTimer);
            }

            // リプライザル選択で即座に次ステップへ（カードが上に流れるのを防止）
            const reprisalId = MITIGATIONS.find(m => m.name.en === 'Reprisal')?.id;
            if (reprisalId && selectedMitigations.includes(reprisalId)) {
                tutorialState.completeEvent('create:miti-selected');
            }
        }
    }, [name, contentLanguage, calcActualDamage, selectedMitigations, isTutorialActive, currentStep?.id, targetActualDamage, tutorialState]);

    const getTooltipText = (mit: typeof MITIGATIONS[0]) => {
        return getPhaseName(mit.name, contentLanguage);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target
        });
        useTutorialStore.getState().completeEvent('create:event-saved');
        onClose();
    };

    const handleBackdropClick = () => {
        // Tutorial: block closing the modal during the tutorial
        if (useTutorialStore.getState().isActive) return;

        if (name.ja.trim() || name.en.trim()) {
            onSave({ name, time, damageType, damageAmount, target });
        }
        onClose();
    };

    // Right-side positioning logic (offset by 20px from cursor)
    const x = position ? Math.min(position.x + 20, window.innerWidth - 520) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 600) : '50%'; // Approx height

    // Style logic: 
    // 1. Mobile -> Full width bottom sheet
    // 2. Tutorial Active -> Force Center
    // 3. Desktop with position -> Follow cursor
    // 4. Desktop without position -> Center
    const style = isMobile
        ? { maxHeight: '85vh', bottom: 0, left: 0, right: 0, width: '100%', transform: 'none' }
        : (isTutorialActive
            ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            : (position
                ? { left: x, top: y }
                : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            )
        );

    return createPortal(
        <div className="fixed inset-0 z-[9999] text-left pointer-events-none display-flex flex-col justify-end">
            {/* Transparent Backdrop */}
            <div className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}`} onClick={handleBackdropClick} />

            <div
                data-tutorial-modal
                onClick={(e) => e.stopPropagation()}
                className={clsx(
                    "absolute transition-all duration-200 flex flex-col overflow-hidden shadow-sm ring-1 ring-inset pointer-events-auto glass-tier3",
                    "ring-black/[0.02] dark:ring-white/5",
                    isMobile ? "w-full rounded-t-2xl rounded-b-none border-b-0" : "w-[500px] rounded-xl"
                )}
                style={style}
            >
                {/* Mobile Drag Handle Indicator */}
                {isMobile && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mt-3 shrink-0" />}

                <div className={clsx(
                    "flex justify-between items-center px-6 py-4 border-b flex-shrink-0 transition-colors",
                    "border-app-border bg-app-surface2"
                )}>
                    <h2 className={clsx(
                        "text-app-2xl font-bold transition-colors",
                        "text-app-text"
                    )}>
                        {initialData ? t('modal.edit_event') : t('modal.add_event')}
                    </h2>
                    <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                        <X size={16} />
                    </button>
                </div>

                <form id="event-modal-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    {/* Input Mode Toggle (Segmented Control) */}
                    <div className={clsx(
                        "flex p-1 rounded-lg border mb-6 transition-colors",
                        "bg-app-surface2 border-app-border"
                    )}>
                        <button
                            type="button"
                            onClick={() => setInputMode('reverse')}
                            className={clsx(
                                "flex-1 py-2 px-4 text-app-lg font-bold rounded-md transition-all flex items-center justify-center cursor-pointer",
                                inputMode === 'reverse'
                                    ? "bg-app-text text-app-bg border border-app-text"
                                    : "text-app-text border border-transparent"
                            )}
                        >
                            <Calculator size={14} className="inline-block mr-2" />
                            {t('modal.mode_reverse', '逆算入力 (Reverse)')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setInputMode('direct')}
                            className={clsx(
                                "flex-1 py-2 px-4 text-app-lg font-bold rounded-md transition-all flex items-center justify-center cursor-pointer",
                                inputMode === 'direct'
                                    ? "bg-app-text text-app-bg border border-app-text"
                                    : "text-app-text border border-transparent"
                            )}
                        >
                            {t('modal.mode_direct', '直接入力 (Direct)')}
                        </button>
                    </div>

                    {/* Common Event Properties */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.time')}</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={time}
                                onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setTime(v === '' ? 0 : Number(v)); }}
                                onFocus={(e) => e.target.select()}
                                className={clsx(
                                    "w-full rounded-lg p-2.5 text-app-2xl transition-all font-barlow border focus:outline-none focus:ring-1",
                                    "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                )}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.name_label')}</label>
                            <input
                                data-tutorial="event-name-input"
                                type="text"
                                lang={t('app.language') === 'English' ? 'en' : 'ja'}
                                value={contentLanguage === 'en' ? name.en : name.ja}
                                onChange={(e) => setName({ ...name, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                                className={clsx(
                                    "w-full rounded-lg p-2.5 text-app-2xl transition-all border focus:outline-none focus:ring-1",
                                    "bg-app-surface2 border-app-border text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                )}
                                required
                                placeholder={t('mechanic_modal.placeholder')}
                            />
                        </div>
                    </div>

                    {/* Type & Target Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Damage Type */}
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-2">{t('modal.damage_type')}</label>
                            <div className="flex gap-2">
                                {[
                                    { type: 'magical', icon: '/icons/type_magic.png', label: t('modal.magical') },
                                    { type: 'physical', icon: '/icons/type_phys.png', label: t('modal.physical') },
                                    { type: 'unavoidable', icon: '/icons/type_dark.png', label: t('modal.unavoidable') }
                                ].map((item) => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => setDamageType(item.type as any)}
                                        className={`
                                            relative group p-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 flex-1 transition-all h-[52px] cursor-pointer
                                            ${damageType === item.type
                                                ? 'border-app-text bg-app-text/10'
                                                : 'border-app-border bg-app-surface2 hover:bg-app-surface2 hover:border-app-border'}
                                        `}
                                    >
                                        <Tooltip content={item.label}>
                                            <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                                        </Tooltip>
                                        <span className={`text-app-sm font-bold ${damageType === item.type ? 'text-app-text' : 'text-app-text group-hover:text-app-text'}`}>
                                            {item.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Selection */}
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-2">{t('modal.target')}</label>
                            <div className="flex gap-2 h-[52px] items-center">
                                {[
                                    { value: 'AoE', label: t('modal.aoe') },
                                    { value: 'MT', label: t('modal.mt') },
                                    { value: 'ST', label: t('modal.st') }
                                ].map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setTarget(t.value as any)}
                                        className={`
                                            h-full flex-1 rounded text-app-lg font-medium transition-all border flex items-center justify-center cursor-pointer
                                            ${target === t.value
                                                ? 'bg-app-text text-app-bg border-app-text'
                                                : 'bg-app-surface2 border-app-border text-app-text hover:bg-app-surface2'}
                                        `}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={clsx(
                        "w-full h-px my-6 transition-colors",
                        "bg-app-surface2"
                    )} />

                    {/* Dynamic Inputs Area */}
                    <div className="space-y-6">
                        {inputMode === 'direct' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.damage_amount')}</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={damageAmount}
                                    onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setDamageAmount(v === '' ? 0 : Number(v)); }}
                                    onFocus={(e) => e.target.select()}
                                    className={clsx(
                                        "w-full rounded-lg p-2.5 text-app-3xl font-mono transition-all font-bold border focus:outline-none focus:ring-1",
                                        "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                    )}
                                />
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className={clsx(
                                    "p-5 rounded-xl border shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] transition-colors",
                                    "bg-app-surface2 border-app-border"
                                )}>
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.actual_damage')}</label>
                                            <div className="flex gap-2">
                                                <input
                                                    data-tutorial="event-actual-damage-input"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={calcActualDamage}
                                                    onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setCalcActualDamage(v === '' ? 0 : Number(v)); }}
                                                    onFocus={(e) => e.target.select()}
                                                    className={clsx(
                                                        "flex-1 border rounded-lg px-4 py-2.5 text-app-3xl font-mono outline-none transition-all",
                                                        "bg-app-surface border-app-border text-app-text focus:border-app-text"
                                                    )}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                            "bg-app-text/5 border-app-border"
                                        )}>
                                            <span className="text-app-lg font-bold text-app-text uppercase tracking-widest">{t('mechanic_modal.estimated_raw')}</span>
                                            <span className="text-app-4xl font-mono font-bold text-app-text tracking-tight">{damageAmount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-app-lg font-medium text-app-text">{t('mechanic_modal.calc_mitigations')}</label>
                                        {selectedMitigations.length > 0 && (
                                          <div className="flex items-center gap-0.5">
                                            {selectedMitigations.slice(0, 4).map(mitId => {
                                              const mit = MITIGATIONS.find(m => m.id === mitId);
                                              if (!mit) return null;
                                              const lang = t('app.language') === 'English' ? 'en' : 'ja';
                                              return (
                                                <img
                                                  key={mitId}
                                                  src={mit.icon}
                                                  alt={mit.name[lang] || mit.name.ja}
                                                  className="w-5 h-5 rounded object-contain"
                                                />
                                              );
                                            })}
                                            {selectedMitigations.length > 4 && (
                                              <span className="text-app-base text-app-text-muted ml-0.5">
                                                +{selectedMitigations.length - 4}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                    <div
                                        id="mitigation-grid-container"
                                        className={clsx(
                                            "grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-2 rounded-xl border custom-scrollbar shadow-inner transition-colors relative",
                                            "bg-app-surface2 border-app-border"
                                        )}
                                    >
                                        {sortedMitigations.map((mit: typeof MITIGATIONS[0]) => {
                                            const isTutorialTarget = isTutorialActive && (
                                                (currentStep?.id === 'add-3-miti' && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en) && !selectedMitigations.includes(mit.id)) ||
                                                (currentStep?.id === 'create-8-miti' && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id))
                                            );
                                            // チュートリアル中はvisibleMitigationsチェックをスキップ（IntersectionObserverのタイミング問題回避）
                                            const shouldHighlight = isTutorialTarget && (tutorialState.isActive || visibleMitigations.has(mit.id));

                                            return (
                                                <button
                                                    key={mit.id}
                                                    data-mitigation-id={mit.id}
                                                    data-tutorial={
                                                        isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
                                                            ? 'tutorial-skill-reprisal'
                                                            : shouldHighlight ? 'tutorial-skill-target' : undefined
                                                    }
                                                    type="button"
                                                    onClick={() => toggleMitigation(mit.id)}
                                                    className={clsx(
                                                        "relative group p-1.5 rounded-lg border transition-all flex items-center justify-center transform active:scale-95 cursor-pointer",
                                                        selectedMitigations.includes(mit.id)
                                                            ? "bg-app-text/15 border-app-text ring-1 ring-app-text/30"
                                                            : "bg-app-surface border-app-border hover:bg-app-surface2 hover:border-app-border opacity-80 hover:opacity-100"
                                                    )}
                                                >
                                                    <Tooltip content={getTooltipText(mit)}>
                                                        <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                    </Tooltip>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Tutorial scroll hint for Step 9D */}
                                    {currentStep?.id === 'add-3-miti' && selectedMitigations.length < 3 && (
                                        <div className="flex flex-col items-center gap-1 py-2 text-cyan-400 animate-bounce">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14M5 12l7 7 7-7" />
                                            </svg>
                                            <span className="text-app-base font-bold uppercase tracking-wider opacity-80">
                                                {t('mechanic_modal.scroll_hint')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className={clsx(
                        "flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 mt-6 border-t transition-colors",
                        "border-app-border"
                    )}>
                        {onDelete && initialData ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(t('timeline.delete_event_confirm'))) {
                                        onDelete();
                                        onClose();
                                    }
                                }}
                                className="w-full sm:w-auto px-4 py-2 text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-lg flex items-center justify-center gap-1.5 transition-colors text-app-lg font-bold cursor-pointer"
                            >
                                <Trash2 size={16} />
                                <span>{t('modal.delete')}</span>
                            </button>
                        ) : <div className="hidden sm:block"></div>}

                        <button
                            data-tutorial="event-save-btn"
                            type="submit"
                            className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-app-blue text-white hover:bg-app-blue-hover rounded-lg text-app-2xl font-bold transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-wider cursor-pointer"
                        >
                            <Save size={16} />
                            {t('mechanic_modal.add_button')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
