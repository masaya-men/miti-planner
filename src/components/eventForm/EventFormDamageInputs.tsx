import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import { NumericInput } from '../ui/NumericInput';
import { EventFormMitigationPicker } from './EventFormMitigationPicker';

type PickerProps = React.ComponentProps<typeof EventFormMitigationPicker>;

interface EventFormDamageInputsProps {
    inputMode: 'direct' | 'reverse';
    damageAmount: number;
    setDamageAmount: (v: number) => void;
    calcActualDamage: number;
    setCalcActualDamage: (v: number) => void;
    compact: boolean;
    MITIGATIONS: PickerProps['MITIGATIONS'];
    sortedMitigations: PickerProps['sortedMitigations'];
    selectedMitigations: string[];
    mitigationTargets: Record<string, 'MT' | 'ST'>;
    mitigationGridRef: RefObject<HTMLDivElement | null>;
    variant: 'modal' | 'pip';
    contentLanguage: string;
    isTutorialActive: boolean;
    currentStep: PickerProps['currentStep'];
    tutorialState: PickerProps['tutorialState'];
    visibleMitigations: Set<string>;
    recitationIcon: string;
    protractionIcon: string;
    deploymentIcon: string;
    toggleMitigation: (id: string) => void;
    setMitigationTarget: (id: string, target: 'MT' | 'ST') => void;
    getTooltipText: PickerProps['getTooltipText'];
}

// ダメージ量の入力部分(直接入力 / 逆算入力+軽減の選択)。
export const EventFormDamageInputs: React.FC<EventFormDamageInputsProps> = ({
    inputMode, damageAmount, setDamageAmount, calcActualDamage, setCalcActualDamage, compact,
    MITIGATIONS, sortedMitigations, selectedMitigations, mitigationTargets, mitigationGridRef,
    variant, contentLanguage, isTutorialActive, currentStep, tutorialState, visibleMitigations,
    recitationIcon, protractionIcon, deploymentIcon, toggleMitigation, setMitigationTarget, getTooltipText,
}) => {
    const { t } = useTranslation();
    return (
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
    );
};
