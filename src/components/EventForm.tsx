
import React, { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { getPhaseName } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { useMitigations, useJobs } from '../hooks/useSkillsData';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';
import { useTutorialStore } from '../store/useTutorialStore';
import { SegmentButton } from './ui/SegmentButton';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import { computeInitialDamageState } from '../lib/eventFormDamageState';
import { NumericInput } from './ui/NumericInput';
import { TimeInput } from './ui/TimeInput';
import { INPUT_CLASS } from './ui/ModalParts';
import { stripVariantSuffix } from './eventForm/stripVariantSuffix';
import { calculateRawDamage } from './eventForm/calculateRawDamage';
import { useEventFormMitigationList } from './eventForm/useEventFormMitigationList';
import { useEventFormTutorial } from './eventForm/useEventFormTutorial';
import { EventFormMitigationPicker } from './eventForm/EventFormMitigationPicker';
import { EventFormActions } from './eventForm/EventFormActions';


interface EventFormLabels {
    /** 保存ボタンの文言(i18n キー)。未指定なら 'mechanic_modal.add_button' */
    saveButtonKey?: string;
}

interface EventFormProps {
    onSave: (event: Omit<TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    /** 指定時のみキャンセルボタンを表示(PiP 用) */
    onCancel?: () => void;
    initialData?: TimelineEvent | null;
    initialTime?: number;
    variant?: 'modal' | 'pip';   // default 'modal'
    reverseOnly?: boolean;       // true: hide reverse/direct toggle, force inputMode='reverse'
    labels?: EventFormLabels;
}

/**
 * EventModal / VideoRecorderModal 共通のイベント入力フォーム本体。
 * `<form id="event-modal-form">` を直接返す (Portal / backdrop は持たない)。
 * チュートリアルは DOM id / data-tutorial-* / data-mitigation-id を参照するため、それらは厳守する。
 */
export const EventForm: React.FC<EventFormProps> = ({ onSave, onDelete, onCancel, initialData, initialTime, variant = 'modal', reverseOnly = false, labels }) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const [name, setName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [altName, setAltName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [time, setTime] = useState(0);
    const [damageType, setDamageType] = useState<TimelineEvent['damageType']>('magical');
    const [damageAmount, setDamageAmount] = useState<number>(() => computeInitialDamageState(initialData, reverseOnly).damageAmount);
    const [target, setTarget] = useState<TimelineEvent['target']>('AoE');
    const [ignoresDebuffMitigation, setIgnoresDebuffMitigation] = useState(false);

    // Calculator State
    const [inputMode, setInputMode] = useState<'direct' | 'reverse'>(() => computeInitialDamageState(initialData, reverseOnly).inputMode);
    const [calcActualDamage, setCalcActualDamage] = useState<number>(0);
    const [selectedMitigations, setSelectedMitigations] = useState<string[]>([]);
    const [mitigationTargets, setMitigationTargets] = useState<Record<string, 'MT' | 'ST'>>({});

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

    // pip variant / mobile はコンパクト表示にする
    const compact = variant === 'pip' || isMobile;

    // IntersectionObserver for tracking visible mitigations
    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setAltName(initialData.altName ?? { ja: '', en: '' });
            setTime(initialData.time);
            setDamageType(initialData.damageType);
            setIgnoresDebuffMitigation(!!initialData.ignoresDebuffMitigation);
            setTarget(initialData.target || 'AoE');

            // すでにダメージが入っている場合は、電卓 (逆算) が上書きしないように「直接入力 (Direct)」モードで開く。
            // 初期 useState の lazy initializer と同じ純関数を使い、初期化と再初期化で挙動を一致させる。
            const initDamage = computeInitialDamageState(initialData, reverseOnly);
            setDamageAmount(initDamage.damageAmount);
            setInputMode(initDamage.inputMode);
            setCalcActualDamage(0);
            setSelectedMitigations([]);
            setMitigationTargets({});
        } else {
            setName({ ja: '', en: '' });
            setAltName({ ja: '', en: '' });
            setTime(initialTime || 0);
            setDamageType('magical');
            setIgnoresDebuffMitigation(false);
            setDamageAmount(0);
            setTarget('AoE');
            // Reset calculator state
            setInputMode('reverse');
            setCalcActualDamage(0);
            setSelectedMitigations([]);
            setMitigationTargets({});
        }
        mitiPresetDoneRef.current = false;
    }, [initialData, initialTime, reverseOnly]);

    const { partyMembers, currentLevel } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();

    const tutorialState = useTutorialStore();
    const isTutorialActive = tutorialState.isActive;
    const currentStep = isTutorialActive ? tutorialState.getCurrentStep() : null;
    const mitiPresetDoneRef = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    useSmoothWheelScroll(formRef, { enabled: true });
    const mitigationGridRef = useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(mitigationGridRef, { stiffness: 25, wheelMultiplier: 0.4, stopPropagation: true, enabled: true });

    // Toggle mitigation selection
    const toggleMitigation = (id: string) => {
        if (isTutorialActive && (currentStep?.id === 'add-3-miti' || currentStep?.id === 'create-8-miti')) {
            const baseId = stripVariantSuffix(id);
            const mit = MITIGATIONS.find(m => m.id === baseId);
            if (currentStep?.id === 'create-8-miti') {
                if (!mit || mit.name.en !== 'Reprisal') return;
            } else {
                const isTargetSkill = mit && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en);
                if (!isTargetSkill) return;
            }
        }
        setSelectedMitigations(prev => {
            if (prev.includes(id)) return prev.filter(m => m !== id);
            const baseId = stripVariantSuffix(id);

            // deployment_tactics ファミリー (素 / 秘策 / 秘策+生命回生): 3 バリアント排他選択
            if (baseId === 'deployment_tactics') {
                return [
                    ...prev.filter(m => stripVariantSuffix(m) !== 'deployment_tactics'),
                    id,
                ];
            }

            // burst バリアント: base/burst を排他
            const isBurst = id.endsWith(':burst');
            const counterpart = isBurst ? baseId : `${id}:burst`;
            return [...prev.filter(m => m !== counterpart), id];
        });
    };

    const setMitigationTarget = (id: string, target: 'MT' | 'ST') => {
        setMitigationTargets(prev => ({ ...prev, [id]: target }));
    };

    const { sortedMitigations, recitationIcon, protractionIcon, deploymentIcon } = useEventFormMitigationList(MITIGATIONS, JOBS, currentLevel);

    // Calculate Raw Damage
    const handleCalculate = () => calculateRawDamage({
        calcActualDamage, selectedMitigations, MITIGATIONS, JOBS, target, damageType,
        mitigationTargets, partyMembers, currentLevel, ignoresDebuffMitigation,
    });

    // Auto-calculate running effect
    useEffect(() => {
        if (inputMode === 'reverse') {
            const calculated = handleCalculate();
            setDamageAmount(calculated);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleCalculate は毎回作り直される関数。列挙した入力値が変わった時だけ逆算して damageAmount を更新する
    }, [calcActualDamage, selectedMitigations, mitigationTargets, damageType, inputMode, target, ignoresDebuffMitigation]);

    useEventFormTutorial({
        isTutorialActive, currentStep, tutorialState, partyMembers, name, contentLanguage,
        calcActualDamage, selectedMitigations, MITIGATIONS, mitiPresetDoneRef,
        setInputMode, setSelectedMitigations,
    });

    const getTooltipText = (mit: typeof MITIGATIONS[0]) => {
        return getPhaseName(mit.name, contentLanguage);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const hasAltName = !!(altName.ja?.trim() || altName.en?.trim() || altName.zh?.trim() || altName['zh-Hant']?.trim() || altName.ko?.trim());
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target,
            ignoresDebuffMitigation,
            ...(hasAltName ? { altName } : {}),
        });
        useTutorialStore.getState().completeEvent('create:event-saved');
    };

    return (
        <form ref={formRef} id="event-modal-form" onSubmit={handleSubmit} className={clsx("overflow-y-auto custom-scrollbar", compact ? "p-4 space-y-4" : "p-6 space-y-6", variant === 'pip' ? "h-full" : "max-h-[75vh]")}>
            {/* Input Mode Toggle */}
            {!reverseOnly && (
                <SegmentButton
                    options={[
                        { value: 'reverse', label: t('modal.mode_reverse', '逆算入力 (Reverse)'), icon: <Calculator size={14} /> },
                        { value: 'direct', label: t('modal.mode_direct', '直接入力 (Direct)') },
                    ]}
                    value={inputMode}
                    onChange={setInputMode}
                    className={compact ? 'mb-3' : 'mb-6'}
                />
            )}

            {/* 時間（M:SS でも 裸の秒数でも入力可。幅控えめ・全幅にすると間延びするため上限を設ける） */}
            <div className="max-w-[200px]">
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.time')}</label>
                <TimeInput
                    value={time}
                    onChange={(sec) => setTime(sec ?? 0)}
                    data-testid="event-time-input"
                    placeholder={t('modal.time_placeholder')}
                    className={INPUT_CLASS}
                />
                <p className="mt-1 text-app-sm text-app-text-muted">{t('modal.time_format_hint')}</p>
            </div>

            {/* 攻撃名 ＋ 2択攻撃の別名（任意）— 別名を攻撃名の直下に密着させ、続きの欄だと分かるようにする */}
            <div>
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.name_label')}</label>
                <input
                    data-tutorial="event-name-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? name.en : name.ja}
                    onChange={(e) => setName({ ...name, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={INPUT_CLASS}
                    required
                    placeholder={t('mechanic_modal.placeholder')}
                />
                {/* 淡色サブラベル＋密着配置（mt-2）で「攻撃名の続き＝もう一方の名前」と伝える */}
                <label className="block text-app-sm text-app-text-muted mt-2 mb-1">{t('event.alt_name_label')}</label>
                <input
                    data-testid="event-altname-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? altName.en : altName.ja}
                    onChange={(e) => setAltName({ ...altName, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder={t('event.alt_name_placeholder')}
                />
            </div>

            {/* Type & Target Row */}
            <div className={clsx("grid grid-cols-2", compact ? "gap-3" : "gap-4")}>
                {/* Damage Type */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.damage_type')}</label>
                    <SegmentButton
                        options={[
                            { value: 'magical', label: t('modal.magical'), icon: '/icons/type_magic.png' },
                            { value: 'physical', label: t('modal.physical'), icon: '/icons/type_phys.png' },
                            { value: 'unavoidable', label: t('modal.unavoidable'), icon: '/icons/type_dark.png' },
                        ]}
                        value={damageType}
                        onChange={(v) => setDamageType(v as TimelineEvent['damageType'])}
                        size={compact ? 'sm' : 'md'}
                        layout="vertical"
                        className="flex-1"
                    />
                </div>

                {/* Target Selection */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.target')}</label>
                    <SegmentButton
                        options={[
                            { value: 'AoE', label: t('modal.aoe') },
                            { value: 'MT', label: t('modal.mt') },
                            { value: 'ST', label: t('modal.st') },
                        ]}
                        value={target ?? 'AoE'}
                        onChange={(v) => setTarget(v as TimelineEvent['target'])}
                        size={compact ? 'sm' : 'md'}
                        className="flex-1"
                    />
                </div>
            </div>

            {/* デバフ軽減不可(外周攻撃など) */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    data-testid="ignores-debuff-mit"
                    checked={ignoresDebuffMitigation}
                    onChange={(e) => setIgnoresDebuffMitigation(e.target.checked)}
                    className="w-4 h-4 accent-app-red cursor-pointer"
                />
                <span className="text-app-base text-app-text">{t('modal.ignores_debuff_mitigation')}</span>
                <span className="text-app-sm text-app-text-muted">{t('modal.ignores_debuff_mitigation_desc')}</span>
            </label>

            <div className={clsx(
                "w-full h-px transition-colors",
                compact ? "my-3" : "my-6",
                "bg-app-surface2"
            )} />

            {/* Dynamic Inputs Area */}
            <div className={compact ? "space-y-4" : "space-y-6"}>
                {inputMode === 'direct' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.damage_amount')}</label>
                        <NumericInput
                            value={damageAmount}
                            onChange={setDamageAmount}
                            thousandSeparator
                            className={clsx(
                                "w-full rounded-lg p-2.5 text-[16px] md:text-app-3xl font-mono transition-all font-bold border focus:outline-none focus:ring-1",
                                "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                            )}
                        />
                    </div>
                ) : (
                    <div className={clsx("animate-in fade-in slide-in-from-bottom-2 duration-300", compact ? "space-y-4" : "space-y-6")}>
                        <div className={clsx(
                            "rounded-xl border shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] transition-colors",
                            compact ? "p-3" : "p-5",
                            "bg-app-surface2 border-app-border"
                        )}>
                            <div className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
                                <div>
                                    <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.actual_damage')}</label>
                                    <div className="flex gap-2">
                                        <NumericInput
                                            data-tutorial="event-actual-damage-input"
                                            value={calcActualDamage}
                                            onChange={setCalcActualDamage}
                                            thousandSeparator
                                            className={clsx(
                                                "flex-1 border rounded-lg px-4 py-2.5 text-[16px] md:text-app-3xl font-mono outline-none transition-all",
                                                "bg-app-surface border-app-border text-app-text focus:border-app-text"
                                            )}
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

                        <EventFormMitigationPicker
                            MITIGATIONS={MITIGATIONS}
                            sortedMitigations={sortedMitigations}
                            selectedMitigations={selectedMitigations}
                            mitigationTargets={mitigationTargets}
                            mitigationGridRef={mitigationGridRef}
                            variant={variant}
                            contentLanguage={contentLanguage}
                            isTutorialActive={isTutorialActive}
                            currentStep={currentStep}
                            tutorialState={tutorialState}
                            visibleMitigations={visibleMitigations}
                            recitationIcon={recitationIcon}
                            protractionIcon={protractionIcon}
                            deploymentIcon={deploymentIcon}
                            toggleMitigation={toggleMitigation}
                            setMitigationTarget={setMitigationTarget}
                            getTooltipText={getTooltipText}
                        />
                    </div>
                )}
            </div>

            {/* Actions */}
            <EventFormActions
                compact={compact}
                variant={variant}
                onCancel={onCancel}
                onDelete={onDelete}
                initialData={initialData}
                saveButtonKey={labels?.saveButtonKey}
                handleSubmit={handleSubmit}
            />
        </form>
    );
};