import type { useMitigations } from '../../hooks/useSkillsData';
import type { useTutorialStore } from '../../store/useTutorialStore';
import { stripVariantSuffix } from './stripVariantSuffix';

type Mitigations = ReturnType<typeof useMitigations>;
type TutorialState = ReturnType<typeof useTutorialStore.getState>;

// チュートリアルの対象ステップ中、対象外の軽減は押せない(押しても何も起きない)。true なら無視する。
export function isMitigationToggleBlocked(
    id: string,
    isTutorialActive: boolean,
    currentStep: ReturnType<TutorialState['getCurrentStep']> | null,
    MITIGATIONS: Mitigations,
): boolean {
    if (isTutorialActive && (currentStep?.id === 'add-3-miti' || currentStep?.id === 'create-8-miti')) {
        const baseId = stripVariantSuffix(id);
        const mit = MITIGATIONS.find(m => m.id === baseId);
        if (currentStep?.id === 'create-8-miti') {
            if (!mit || mit.name.en !== 'Reprisal') return true;
        } else {
            const isTargetSkill = mit && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en);
            if (!isTargetSkill) return true;
        }
    }
    return false;
}

// 軽減を押した時の、選択済み一覧の次の状態。
export function toggleMitigationSelection(prev: string[], id: string): string[] {
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
}
