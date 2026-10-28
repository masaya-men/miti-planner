
import React, { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { getPhaseName } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { useMitigations, useJobs } from '../hooks/useSkillsData';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTutorialStore } from '../store/useTutorialStore';
import { SegmentButton } from './ui/SegmentButton';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import { computeInitialDamageState } from '../lib/eventFormDamageState';
import { calculateRawDamage } from './eventForm/calculateRawDamage';
import { useEventFormMitigationList } from './eventForm/useEventFormMitigationList';
import { useEventFormTutorial } from './eventForm/useEventFormTutorial';
import { EventFormAttackFields } from './eventForm/EventFormAttackFields';
import { EventFormDamageInputs } from './eventForm/EventFormDamageInputs';
import { useVisibleMitigations } from './eventForm/useVisibleMitigations';
import { isMitigationToggleBlocked, toggleMitigationSelection } from './eventForm/mitigationToggle';
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

    // Mobile Detection
    const isMobile = useIsMobile();

    // pip variant / mobile はコンパクト表示にする
    const compact = variant === 'pip' || isMobile;

    const visibleMitigations = useVisibleMitigations();

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
        if (isMitigationToggleBlocked(id, isTutorialActive, currentStep, MITIGATIONS)) return;
        setSelectedMitigations(prev => toggleMitigationSelection(prev, id));
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

            <EventFormAttackFields
                time={time}
                setTime={setTime}
                name={name}
                setName={setName}
                altName={altName}
                setAltName={setAltName}
                damageType={damageType}
                setDamageType={setDamageType}
                target={target}
                setTarget={setTarget}
                ignoresDebuffMitigation={ignoresDebuffMitigation}
                setIgnoresDebuffMitigation={setIgnoresDebuffMitigation}
                contentLanguage={contentLanguage}
                compact={compact}
            />

            <div className={clsx(
                "w-full h-px transition-colors",
                compact ? "my-3" : "my-6",
                "bg-app-surface2"
            )} />

            {/* Dynamic Inputs Area */}
            <EventFormDamageInputs
                inputMode={inputMode}
                damageAmount={damageAmount}
                setDamageAmount={setDamageAmount}
                calcActualDamage={calcActualDamage}
                setCalcActualDamage={setCalcActualDamage}
                compact={compact}
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