import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import { getPhaseName } from '../../types';
import type { useMitigations } from '../../hooks/useSkillsData';
import type { useTutorialStore } from '../../store/useTutorialStore';
import { Tooltip } from '../ui/Tooltip';
import { stripVariantSuffix } from './stripVariantSuffix';

type Mitigations = ReturnType<typeof useMitigations>;
type TutorialState = ReturnType<typeof useTutorialStore.getState>;

interface EventFormMitigationPickerProps {
    MITIGATIONS: Mitigations;
    sortedMitigations: Mitigations;
    selectedMitigations: string[];
    mitigationTargets: Record<string, 'MT' | 'ST'>;
    mitigationGridRef: RefObject<HTMLDivElement | null>;
    variant: 'modal' | 'pip';
    contentLanguage: string;
    isTutorialActive: boolean;
    currentStep: ReturnType<TutorialState['getCurrentStep']> | null;
    tutorialState: TutorialState;
    visibleMitigations: Set<string>;
    recitationIcon: string;
    protractionIcon: string;
    deploymentIcon: string;
    toggleMitigation: (id: string) => void;
    setMitigationTarget: (id: string, target: 'MT' | 'ST') => void;
    getTooltipText: (mit: Mitigations[0]) => string;
}

// 逆算入力で使う軽減の選択(選択済みアイコンの一覧・軽減グリッド・チュートリアルのスクロール案内)。
export const EventFormMitigationPicker: React.FC<EventFormMitigationPickerProps> = ({
    MITIGATIONS, sortedMitigations, selectedMitigations, mitigationTargets, mitigationGridRef,
    variant, contentLanguage, isTutorialActive, currentStep, tutorialState, visibleMitigations,
    recitationIcon, protractionIcon, deploymentIcon, toggleMitigation, setMitigationTarget, getTooltipText,
}) => {
    const { t } = useTranslation();
    return (
                        <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <label className="block text-app-lg font-medium text-app-text shrink-0">{t('mechanic_modal.calc_mitigations')}</label>
                                {selectedMitigations.length > 0 && (
                                  <div className="flex flex-wrap items-center justify-end gap-x-0.5 gap-y-1 min-w-0">
                                    {selectedMitigations.map(mitId => {
                                      const baseId = stripVariantSuffix(mitId);
                                      const mit = MITIGATIONS.find(m => m.id === baseId);
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
                                  </div>
                                )}
                            </div>
                            <div
                                ref={mitigationGridRef}
                                id="mitigation-grid-container"
                                className={clsx(
                                    "grid gap-2 overflow-y-auto p-2 rounded-xl border custom-scrollbar shadow-inner transition-colors relative",
                                    // pip (動画モーダル) は右パネルが狭いため 6 列固定 + 高さ広めでアイコンを窮屈にしない
                                    variant === 'pip' ? "grid-cols-6 max-h-[300px]" : "grid-cols-6 sm:grid-cols-8 max-h-[160px]",
                                    "bg-app-surface2 border-app-border"
                                )}
                            >
                                {sortedMitigations.flatMap((mit: typeof MITIGATIONS[0]) => {
                                    const hasBurst = !!(mit.burstValue && mit.burstDuration);
                                    const isDeployTactics = mit.id === 'deployment_tactics';

                                    const variants: Array<{ id: string; burst: boolean; deployVariant?: 'plain' | 'crit' | 'crit_protraction' }> =
                                        isDeployTactics
                                            ? [
                                                { id: 'deployment_tactics', burst: false, deployVariant: 'plain' },
                                                { id: 'deployment_tactics:crit', burst: false, deployVariant: 'crit' },
                                                { id: 'deployment_tactics:crit_protraction', burst: false, deployVariant: 'crit_protraction' },
                                            ]
                                            : hasBurst
                                                ? [{ id: mit.id, burst: false }, { id: `${mit.id}:burst`, burst: true }]
                                                : [{ id: mit.id, burst: false }];

                                    return variants.map(mitVariant => {
                                        const isTutorialTarget = isTutorialActive && !mitVariant.burst && (
                                            (currentStep?.id === 'add-3-miti' && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en) && !selectedMitigations.includes(mit.id)) ||
                                            (currentStep?.id === 'create-8-miti' && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id))
                                        );
                                        const shouldHighlight = isTutorialTarget && (tutorialState.isActive || visibleMitigations.has(mit.id));

                                        return (
                                            <div key={mitVariant.id} className="flex flex-col items-center gap-0.5">
                                                <button
                                                    data-mitigation-id={mitVariant.id}
                                                    data-tutorial={
                                                        !mitVariant.burst && isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
                                                            ? 'tutorial-skill-reprisal'
                                                            : shouldHighlight ? 'tutorial-skill-target' : undefined
                                                    }
                                                    type="button"
                                                    onClick={() => toggleMitigation(mitVariant.id)}
                                                    className={clsx(
                                                        "relative group p-1.5 rounded-lg border transition-all flex items-center justify-center transform active:scale-95 cursor-pointer w-full",
                                                        selectedMitigations.includes(mitVariant.id)
                                                            ? "bg-app-text/15 border-app-text ring-1 ring-app-text/30"
                                                            : "bg-app-surface border-app-border hover:bg-app-surface2 hover:border-app-border opacity-80 hover:opacity-100"
                                                    )}
                                                >
                                                    <Tooltip content={
                                                        mitVariant.deployVariant === 'plain' ? t('mechanic_modal.deployment_variants.plain') :
                                                        mitVariant.deployVariant === 'crit' ? t('mechanic_modal.deployment_variants.crit') :
                                                        mitVariant.deployVariant === 'crit_protraction' ? t('mechanic_modal.deployment_variants.crit_protraction') :
                                                        getTooltipText(mit) + (mitVariant.burst ? ` (${mit.burstDuration}s)` : '')
                                                    }>
                                                        <div className="relative">
                                                            {mitVariant.deployVariant === 'plain' || mitVariant.deployVariant === undefined ? (
                                                                <>
                                                                    <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                                    {mitVariant.burst && (
                                                                        <img
                                                                            src={mit.icon}
                                                                            alt=""
                                                                            className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                        />
                                                                    )}
                                                                </>
                                                            ) : (
                                                                // 鼓舞展開バリアント: 展開戦術ベース + 右上に秘策バッジ (+ crit_protraction なら右下に生命回生バッジ)
                                                                <div className="relative w-7 h-7">
                                                                    <img
                                                                        src={deploymentIcon}
                                                                        alt={getPhaseName(mit.name, contentLanguage)}
                                                                        className="w-7 h-7 object-contain drop-shadow"
                                                                    />
                                                                    {/* 右上: 秘策（crit と crit_protraction の両方） */}
                                                                    <img
                                                                        src={recitationIcon}
                                                                        alt=""
                                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                    />
                                                                    {/* 右下: 生命回生法（crit_protraction のみ） */}
                                                                    {mitVariant.deployVariant === 'crit_protraction' && (
                                                                        <img
                                                                            src={protractionIcon}
                                                                            alt=""
                                                                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                </button>
                                                {/* MT/ST トグル: 単体バフ選択時のみ表示 */}
                                                {mit.scope === 'target' && selectedMitigations.includes(mitVariant.id) && (
                                                    <div className="flex gap-px text-app-sm font-bold rounded overflow-hidden border border-app-border" onClick={(e) => e.stopPropagation()}>
                                                        {(['MT', 'ST'] as const).map(tgt => {
                                                            const isActive = (mitigationTargets[mitVariant.id] ?? 'MT') === tgt;
                                                            return (
                                                                <button
                                                                    key={tgt}
                                                                    type="button"
                                                                    onClick={() => setMitigationTarget(mitVariant.id, tgt)}
                                                                    className={clsx(
                                                                        "px-1.5 py-0.5 transition-colors cursor-pointer",
                                                                        isActive ? "bg-app-text text-app-bg" : "bg-app-surface text-app-text-muted hover:bg-app-surface2"
                                                                    )}
                                                                >
                                                                    {tgt}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
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
    );
};
