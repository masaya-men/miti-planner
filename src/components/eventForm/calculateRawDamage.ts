import type { PartyMember, TimelineEvent } from '../../types';
import { DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from '../../store/useMitigationStore';
import type { useMitigations, useJobs } from '../../hooks/useSkillsData';
import { calculateMemberValues, CRIT_MULTIPLIER } from '../../utils/calculator';
import { isMitigationBlockedByEvent } from '../../utils/damageTypeLogic';
import { stripVariantSuffix } from './stripVariantSuffix';

interface CalculateRawDamageArgs {
    calcActualDamage: number;
    selectedMitigations: string[];
    MITIGATIONS: ReturnType<typeof useMitigations>;
    JOBS: ReturnType<typeof useJobs>;
    target: TimelineEvent['target'];
    damageType: TimelineEvent['damageType'];
    mitigationTargets: Record<string, 'MT' | 'ST'>;
    partyMembers: PartyMember[];
    currentLevel: number;
    ignoresDebuffMitigation: boolean;
}

// 逆算入力: 実ダメージ + シールド合計を、選んだ軽減の乗算で割って元のダメージを求める。
export const calculateRawDamage = ({
    calcActualDamage, selectedMitigations, MITIGATIONS, JOBS, target, damageType,
    mitigationTargets, partyMembers, currentLevel, ignoresDebuffMitigation,
}: CalculateRawDamageArgs): number => {
        const actual = calcActualDamage;
        let shieldTotal = 0;
        let mitigationMult = 1;

        // healingIncrease: 選択スキル中の回復効果アップを先に集計
        let healingMultiplier = 1;
        selectedMitigations.forEach(mitId => {
            const baseId = stripVariantSuffix(mitId);
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def || !def.healingIncrease) return;
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;
            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }
            healingMultiplier += (def.healingIncrease / 100);
        });

        selectedMitigations.forEach(mitId => {
            const isBurst = mitId.endsWith(':burst');
            const baseId = stripVariantSuffix(mitId);
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def) return;

            // 鼓舞展開バリアント分岐 (deployment_tactics / :crit / :crit_protraction)
            if (baseId === 'deployment_tactics') {
                const variant = mitId.includes(':') ? mitId.split(':')[1] : 'plain';
                const schMember = partyMembers.find(m => m.jobId === 'sch');
                let baseShield = schMember?.computedValues['鼓舞激励の策'] ?? 0;

                // フォールバック: 学者不在 or computedValues 未生成のとき、デフォルトステータスで計算
                if (baseShield === 0) {
                    const tempComputed = calculateMemberValues(
                        { id: 'temp', jobId: 'sch', role: 'healer', stats: DEFAULT_HEALER_STATS, computedValues: {} } as PartyMember,
                        currentLevel
                    );
                    baseShield = tempComputed['鼓舞激励の策'] ?? 0;
                }

                if (baseShield > 0) {
                    let shield = baseShield;
                    if (variant === 'crit' || variant === 'crit_protraction') {
                        shield *= CRIT_MULTIPLIER;
                    }
                    if (variant === 'crit_protraction') {
                        const protractionDef = MITIGATIONS.find(m => m.id === 'protraction');
                        const hi = protractionDef?.healingIncrease ?? 10;
                        shield *= (1 + hi / 100);
                    }
                    shieldTotal += Math.floor(shield * healingMultiplier);
                }
                return; // 通常の value/isShield 集計をスキップ
            }

            // ニュートラルセクト分岐: 押下時にコンジャ/アスペクト・ヘリオスのバリアを自動加算
            // healingIncrease (selfOnly: 20%) は既存ロジックで自動適用される
            // 注: キー名は calculator.ts の SKILL_DATA で「(Nセクト)」付きで登録されている
            if (baseId === 'neutral_sect') {
                const heliosName = currentLevel >= 96
                    ? 'コンジャンクション・ヘリオス (Nセクト)'
                    : 'アスペクト・ヘリオス (Nセクト)';
                const astMember = partyMembers.find(m => m.jobId === 'ast');
                let baseShield = astMember?.computedValues[heliosName] ?? 0;

                // フォールバック: 占星不在 or computedValues 未生成のときデフォルトステータス計算
                if (baseShield === 0) {
                    const tempComputed = calculateMemberValues(
                        { id: 'temp', jobId: 'ast', role: 'healer', stats: DEFAULT_HEALER_STATS, computedValues: {} } as PartyMember,
                        currentLevel
                    );
                    baseShield = tempComputed[heliosName] ?? 0;
                }

                if (baseShield > 0) {
                    shieldTotal += Math.floor(baseShield * healingMultiplier);
                }
                return;
            }

            // Scope filtering: AoE attacks only use party-wide mitigations
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;

            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }

            // デバフ軽減不可フラグONなら、デバフ系軽減の % は逆算に含めない。
            // 本関数は%とバリアを単一ループで処理するため return はバリア寄与もスキップするが、
            // デバフ4系は全て isShield:false のため本体計算(Timeline.tsx の%ループのみ)と結果一致。
            // 将来デバフ系のシールドを追加する場合はここを%スキップのみに分離すること。
            if (isMitigationBlockedByEvent({ ignoresDebuffMitigation }, def)) return;

            // Percentage Mitigation (apply for ALL skills with value > 0, including shield+mitigation hybrids)
            if (def.value > 0) {
                let val = def.value;
                if (damageType === 'physical' && def.valuePhysical !== undefined) {
                    val = def.valuePhysical;
                } else if (damageType === 'magical' && def.valueMagical !== undefined) {
                    val = def.valueMagical;
                } else {
                    if (def.type === 'physical' && damageType === 'magical') val = 0;
                    if (def.type === 'magical' && damageType === 'physical') val = 0;
                }

                mitigationMult *= (1 - val / 100);

                // Burst: apply additional mitigation from the enhanced window
                if (isBurst && def.burstValue) {
                    mitigationMult *= (1 - def.burstValue / 100);
                }
            }

            // Shield Calculation
            if (def.isShield) {
                // Always use Japanese name for computedValues lookup (SKILL_DATA keys are Japanese)
                const jaName = typeof def.name === 'string' ? def.name : (def.name.ja || '');
                const member = partyMembers.find(m => m.jobId === def.jobId);
                let shieldVal = 0;

                if (member && member.computedValues) {
                    shieldVal = member.computedValues[jaName] || 0;
                }

                // Fallback: use calculateMemberValues with default stats
                if (shieldVal === 0) {
                    let stats = DEFAULT_HEALER_STATS;
                    let role = 'healer';

                    if (def.jobId) {
                        const m2 = partyMembers.find(m => m.jobId === def.jobId);
                        if (m2) {
                            stats = m2.stats;
                            role = m2.role;
                        } else {
                            const job = JOBS.find(j => j.id === def.jobId);
                            if (job?.role === 'tank') { stats = DEFAULT_TANK_STATS; role = 'tank'; }
                        }
                    }

                    const tempComputed = calculateMemberValues(
                        { id: 'temp', jobId: def.jobId || null, role, stats, computedValues: {} } as PartyMember,
                        currentLevel
                    );
                    shieldVal = tempComputed[jaName] || 0;
                }

                // healingIncrease を適用
                shieldTotal += Math.floor(shieldVal * healingMultiplier);
            }
        });

        // Formula: Raw = (Actual + Shields) / Mult
        if (mitigationMult === 0) mitigationMult = 0.01;
        const raw = Math.ceil((actual + shieldTotal) / mitigationMult);

        return raw;
};
