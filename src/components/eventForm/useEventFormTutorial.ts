import { useState, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PartyMember, LocalizedString } from '../../types';
import { getPhaseName } from '../../types';
import type { useTutorialStore } from '../../store/useTutorialStore';
import type { useMitigations } from '../../hooks/useSkillsData';

type TutorialState = ReturnType<typeof useTutorialStore.getState>;

interface UseEventFormTutorialArgs {
    isTutorialActive: boolean;
    currentStep: ReturnType<TutorialState['getCurrentStep']> | null;
    tutorialState: TutorialState;
    partyMembers: PartyMember[];
    name: LocalizedString;
    contentLanguage: string;
    calcActualDamage: number;
    selectedMitigations: string[];
    MITIGATIONS: ReturnType<typeof useMitigations>;
    mitiPresetDoneRef: MutableRefObject<boolean>;
    setInputMode: Dispatch<SetStateAction<'direct' | 'reverse'>>;
    setSelectedMitigations: Dispatch<SetStateAction<string[]>>;
}

// チュートリアル進行の見張り(名前入力・ダメージ入力・軽減選択・スクロール・プリセット)。
export function useEventFormTutorial({
    isTutorialActive, currentStep, tutorialState, partyMembers, name, contentLanguage,
    calcActualDamage, selectedMitigations, MITIGATIONS, mitiPresetDoneRef,
    setInputMode, setSelectedMitigations,
}: UseEventFormTutorialArgs) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- チュートリアル進行の副作用。列挙した値が変わった時だけ走らせる(MITIGATIONS は Reprisal の id 検索にしか使わない)
    }, [name, contentLanguage, calcActualDamage, selectedMitigations, isTutorialActive, currentStep?.id, targetActualDamage, tutorialState]);
}
