import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

export interface AutoPlannerResult {
    mitigations: AppliedMitigation[];
    warnings: string[];
}

// 完全にゼロベースで設計された高精度オートプラン・エンジン
export function generateAutoPlan(
    timeline: TimelineEvent[],
    party: PartyMember[],
    level: number, // Added level for skill selection
    settings?: { tankHp: number; dpsHp: number }
): AutoPlannerResult {
    const assignments: AppliedMitigation[] = [];
    const warnings = new Set<string>();

    const defaultTankHp = party.find(m => m.role === 'tank' && m.computedValues?.hp)?.computedValues?.hp ?? 299000;
    const defaultDpsHp = party.find(m => m.role === 'dps' && m.computedValues?.hp)?.computedValues?.hp ?? 199000;

    const safeSettings = {
        tankHp: settings?.tankHp ?? defaultTankHp,
        dpsHp: settings?.dpsHp ?? defaultDpsHp,
    };

    // メンバーごとの所持スキル（パッセージ・オブ・アームズは通常計算から除外）
    const EXCLUDED_MITIGATIONS = new Set(['passage_of_arms']);
    const memberMitigations = new Map<string, Mitigation[]>();
    for (const member of party) {
        const mitis = MITIGATIONS.filter(m => {
            // Level filtering
            if (m.minLevel !== undefined && level < m.minLevel) return false;
            if (m.maxLevel !== undefined && level > m.maxLevel) return false;

            if (m.jobId === member.jobId) return true;
            if (m.jobId === member.role) return true;
            if (m.jobId === 'role_action') return true;
            return false;
        }).filter(m => !EXCLUDED_MITIGATIONS.has(m.id));
        memberMitigations.set(member.id, mitis);
    }

    const usageTimes = new Map<string, number[]>();
    let dissipationTime = -1;
    const schMember = party.find(m => m.jobId === 'sch');

    // =========================================================================
    // ヘルパー関数
    // =========================================================================

    function genId(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'ap_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    }

    function getMitigation(id: string): Mitigation | undefined {
        return MITIGATIONS.find(m => m.id === id);
    }

    // リキャスト、妖精ロックアウト、および【前提スキル（requires）】判定
    const isCooldownAvailable = (memberId: string, mitiId: string, time: number): boolean => {
        const miti = getMitigation(mitiId);
        if (!miti) return false;

        // フェーズ5: 学者の妖精ロックアウト（転化後30秒間）
        if (schMember && memberId === schMember.id && dissipationTime >= 0) {
            const timeSinceDissipation = time - dissipationTime;
            if (timeSinceDissipation >= 0 && timeSinceDissipation <= 30) {
                const schFairySkills = ['summon_seraph', 'fey_illumination', 'whispering_dawn', 'fey_blessing', 'fey_union', 'fey_union_stop', 'consolation'];
                if (schFairySkills.includes(mitiId) || schFairySkills.includes(mitiId.replace('_sch', ''))) {
                    return false;
                }
            }
        }

        // 前提スキル（requires）の確認：親スキルが効果時間中であるかチェック
        if (miti.requires) {
            const reqUsedTimes = usageTimes.get(`${memberId}_${miti.requires}`) || [];
            const reqMiti = getMitigation(miti.requires);
            const reqDuration = reqMiti ? reqMiti.duration : 20;
            const isReqActive = reqUsedTimes.some(t => time >= t && time <= t + reqDuration);
            if (!isReqActive) return false;
        }

        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        for (const usedTime of times) {
            if (Math.abs(time - usedTime) < miti.recast) return false;
        }

        return true;
    };

    // アサインメントの確定
    const commitMitigation = (memberId: string, mitiId: string, time: number, targetId?: string): void => {
        const miti = getMitigation(mitiId);
        if (!miti) return;

        // 【修正要求2】 scopeに基づく厳密なターゲット管理
        // モックデータ上で scope === 'self' または scope === 'party' の場合は targetId を強制的に解除し、UI側の誤爆を防ぐ
        let finalTargetId = targetId;
        if (miti.scope === 'self' || miti.scope === 'party') {
            finalTargetId = undefined;
        }

        assignments.push({
            id: genId(),
            mitigationId: miti.id,
            time: time,
            duration: miti.duration,
            ownerId: memberId,
            targetId: finalTargetId,
        });

        const key = `${memberId}_${mitiId}`;
        const times = usageTimes.get(key) || [];
        times.push(time);
        usageTimes.set(key, times);

        if (mitiId === 'dissipation' || mitiId.startsWith('dissipation_')) {
            dissipationTime = time;
        }
    };

    // リスト内から該当スキルを探す関数群
    const getSkillByFamily = (memberId: string | undefined | null, family: string, time: number): string | null => {
        if (!memberId) return null;
        const memberMitis = memberMitigations.get(memberId) || [];
        const miti = memberMitis.find(m => m.family === family && isCooldownAvailable(memberId, m.id, time));
        return miti ? miti.id : null;
    };

    const getRoleAction = (memberId: string | undefined | null, baseId: string, time: number): string | null => {
        if (!memberId) return null;
        const memberMitis = memberMitigations.get(memberId) || [];
        const miti = memberMitis.find(m => m.family === 'role_action' && m.id.includes(baseId) && isCooldownAvailable(memberId, m.id, time));
        return miti ? miti.id : null;
    };

    const findAvailableSkill = (memberId: string | undefined | null, filterFn: (m: Mitigation) => boolean, time: number): string | null => {
        if (!memberId) return null;
        const memberMitis = memberMitigations.get(memberId) || [];
        const miti = memberMitis.find(m => filterFn(m) && isCooldownAvailable(memberId, m.id, time));
        return miti ? miti.id : null;
    };

    // 指定Familyのスキルを"すべて"配置する（イルミとコンソレの同時配置用など）
    const deployAllByFamily = (memberId: string | undefined | null, family: string, time: number) => {
        if (!memberId) return;
        const memberMitis = memberMitigations.get(memberId) || [];
        const mitis = memberMitis.filter(m => m.family === family && isCooldownAvailable(memberId, m.id, time));
        for (const m of mitis) {
            commitMitigation(memberId, m.id, time);
        }
    };

    // シミュレーション（致死量判定）
    const simulateDamage = (eventTime: number, rawDamage: number, eventTarget: 'MT' | 'ST' | 'AoE', simAssignments: AppliedMitigation[]): number => {
        let mitigationMultiplier = 1;
        let totalShieldValue = 0;

        for (const a of simAssignments) {
            const miti = getMitigation(a.mitigationId);
            if (!miti) continue;

            const isCoveringEvent = eventTime >= a.time && eventTime <= a.time + a.duration;
            if (!isCoveringEvent) continue;

            if (miti.isInvincible && (a.ownerId === eventTarget || a.targetId === eventTarget)) return 0;

            if (miti.value > 0 || miti.isShield) {
                if (miti.scope === 'party' || miti.scope === undefined || a.ownerId === eventTarget || a.targetId === eventTarget) {
                    if (miti.isShield) {
                        const targetMaxHp = eventTarget === 'AoE' ? safeSettings.dpsHp : safeSettings.tankHp;
                        const shieldAmount = targetMaxHp * (miti.value / 100);
                        totalShieldValue += shieldAmount;
                    } else if (miti.value > 0) {
                        mitigationMultiplier *= (1 - miti.value / 100);
                    }
                }
            }
        }

        let finalDamage = rawDamage * mitigationMultiplier;
        finalDamage = Math.max(0, finalDamage - totalShieldValue);
        return finalDamage;
    };

    const isBlockLethal = (events: TimelineEvent[], target: 'MT' | 'ST' | 'AoE', simAssignments: AppliedMitigation[]): boolean => {
        const hpBase = target === 'AoE' ? safeSettings.dpsHp : safeSettings.tankHp;
        const totalDamage = events.map(e => simulateDamage(e.time, e.damageAmount || 0, target, simAssignments)).reduce((a, b) => a + b, 0);
        return totalDamage >= hpBase;
    };

    // ポジションマッピング
    const tanks = { mt: party.find(m => m.id === 'MT'), st: party.find(m => m.id === 'ST') };
    const healers = { h1: party.find(m => m.id === 'H1'), h2: party.find(m => m.id === 'H2') };
    const d1 = party.find(m => m.id === 'D1');
    const d2 = party.find(m => m.id === 'D2');
    const d3 = party.find(m => m.id === 'D3');
    const d4 = party.find(m => m.id === 'D4');
    const mtGroupDPS = [d1, d3].filter(Boolean) as PartyMember[];
    const stGroupDPS = [d2, d4].filter(Boolean) as PartyMember[];

    // フェーズ5: 学者の開幕転化強制配置
    if (schMember) {
        const diss = memberMitigations.get(schMember.id)?.find(m => m.id.includes('dissipation'));
        if (diss) commitMitigation(schMember.id, diss.id, 0);
    }

    // =========================================================================
    // フェーズ1: タイムラインの圧縮とグループ化
    // =========================================================================

    // 大前提1: AAの完全無視を徹底
    const validEvents = timeline.filter(t => {
        if ((t.damageType as string) === 'AA' || (t.damageType as string)?.toLowerCase() === 'aa') return false;
        const lEn = (t.name.en || '').toLowerCase();
        const lJa = t.name.ja || '';
        if (lEn.includes('aa') || lEn.includes('auto attack') || lEn.includes('auto-attack')) return false;
        if (lJa === 'aa' || lJa.includes('オートアタック')) return false;
        return (t.target === 'AoE' || t.target === 'MT' || t.target === 'ST') && (t.damageAmount || 0) > 0;
    }).sort((a, b) => a.time - b.time);

    interface DamageBlock {
        id: string;
        target: 'AoE' | 'MT' | 'ST';
        startTime: number;
        endTime: number;
        events: TimelineEvent[];
        isTB: boolean;
        maxDamageRatio: number;
    }

    const blocks: DamageBlock[] = [];
    for (const ev of validEvents) {
        if (!ev.target) continue;
        const eventTarget = ev.target;
        const hpBase = eventTarget === 'AoE' ? safeSettings.dpsHp : safeSettings.tankHp;
        const dmgRatio = (ev.damageAmount || 0) / hpBase;

        // 【修正】名前判定ではなく、ターゲット情報から確実に強攻撃と判定する
        const isTB = eventTarget === 'MT' || eventTarget === 'ST';

        const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
        if (lastBlock && lastBlock.target === eventTarget && ev.time - lastBlock.endTime <= 4) {
            lastBlock.events.push(ev);
            lastBlock.endTime = ev.time;
            if (dmgRatio > lastBlock.maxDamageRatio) lastBlock.maxDamageRatio = dmgRatio;
            lastBlock.isTB = isTB;
        } else {
            blocks.push({
                id: ev.id,
                target: eventTarget,
                startTime: ev.time,
                endTime: ev.time,
                events: [ev],
                isTB: isTB,
                maxDamageRatio: dmgRatio,
            });
        }
    }

    // =========================================================================
    // フェーズ2・3: 全体攻撃（AoE）への固定セット配置
    // =========================================================================
    const aoeBlocks = blocks.filter(b => b.target === 'AoE').sort((a, b) => b.maxDamageRatio - a.maxDamageRatio);
    let aoeRoute: 'A' | 'B' = 'A';

    for (const block of aoeBlocks) {
        const time = block.startTime;
        const maxRatio = block.maxDamageRatio;

        if (maxRatio < 1.0) continue;

        const tier = maxRatio >= 1.75 ? 4 : (maxRatio >= 1.2 ? 3 : 2);

        const deploy = (roleId: string | undefined | null, mitiId: string | null) => {
            if (roleId && mitiId) commitMitigation(roleId, mitiId, time);
        };

        const deployFlex = (dpsGroup: PartyMember[]) => {
            for (const dps of dpsGroup) {
                if (!isBlockLethal(block.events, block.target, assignments)) break;
                const flexMiti = findAvailableSkill(dps.id, m => m.family !== 'role_action' && m.scope !== 'self', time);
                if (flexMiti) deploy(dps.id, flexMiti);
            }
        };

        if (aoeRoute === 'A') {
            deploy(tanks.mt?.id, getRoleAction(tanks.mt?.id, 'reprisal', time));
            deploy(tanks.mt?.id, findAvailableSkill(tanks.mt?.id, m => m.family === 'tank_party_miti' || m.family === 'tank_party_miti_sub', time));
            deploy(d1?.id, getRoleAction(d1?.id, 'feint', time));
            deploy(d3?.id, getSkillByFamily(d3?.id, 'ranged_party_15', time));
            deploy(healers.h1?.id, getSkillByFamily(healers.h1?.id, 'ph_60_aoe', time));

            if (tier >= 3) {
                deployAllByFamily(healers.h2?.id, 'healer_bubble', time);
                const bh120a = getSkillByFamily(healers.h2?.id, 'bh_120_a', time);
                const bh120b = getSkillByFamily(healers.h2?.id, 'bh_120_b', time);

                if (bh120a) {
                    deploy(healers.h2?.id, bh120a);
                    // 【修正】親スキル配置後にサブを評価することで、requiresを確実に通過させる
                    deployAllByFamily(healers.h2?.id, 'bh_sub_a', time);
                } else if (bh120b) {
                    deploy(healers.h2?.id, bh120b);
                }
            }

            if (tier >= 4) {
                if (isBlockLethal(block.events, block.target, assignments)) deployFlex(mtGroupDPS);
                if (isBlockLethal(block.events, block.target, assignments)) deployFlex(stGroupDPS);
            }
            aoeRoute = 'B';
        } else {
            deploy(tanks.st?.id, getRoleAction(tanks.st?.id, 'reprisal', time));
            deploy(tanks.st?.id, findAvailableSkill(tanks.st?.id, m => m.family === 'tank_party_miti' || m.family === 'tank_party_miti_sub', time));
            deploy(d2?.id, getRoleAction(d2?.id, 'feint', time));
            deploy(d4?.id, getRoleAction(d4?.id, 'addle', time));
            deploy(healers.h2?.id, getSkillByFamily(healers.h2?.id, 'healer_bubble', time));

            if (tier >= 3) {
                const ph120 = getSkillByFamily(healers.h1?.id, 'ph_120_aoe', time);
                if (ph120) {
                    deploy(healers.h1?.id, ph120);
                    // 【修正】親スキル配置後にサブを評価する
                    deployAllByFamily(healers.h1?.id, 'ph_sub_120', time);
                }
            }

            if (tier >= 4) {
                if (isBlockLethal(block.events, block.target, assignments)) deployFlex(stGroupDPS);
                if (isBlockLethal(block.events, block.target, assignments)) deployFlex(mtGroupDPS);
            }
            aoeRoute = 'A';
        }
    }

    // =========================================================================
    // フェーズ4: タンク強攻撃（TB）のバフローテーション
    // =========================================================================
    const tbBlocks = blocks.filter(b => b.target !== 'AoE').sort((a, b) => b.maxDamageRatio - a.maxDamageRatio);

    for (const block of tbBlocks) {
        if (block.target === 'AoE' || !block.isTB) continue;

        const time = block.startTime;
        const targetId = block.target;
        const targetTank = targetId === 'MT' ? tanks.mt : tanks.st;
        if (!targetTank) continue;

        if (block.maxDamageRatio < 1.0) continue;

        const t40 = getSkillByFamily(targetTank.id, 'tank_40', time);
        const tShort = getSkillByFamily(targetTank.id, 'tank_short', time);
        const tSubTargeted = getSkillByFamily(targetTank.id, 'tank_sub_targeted', time);
        const tRoleAction = getRoleAction(targetTank.id, 'rampart', time);
        const tSubSelf = getSkillByFamily(targetTank.id, 'tank_sub_self', time);
        const tInvuln = getSkillByFamily(targetTank.id, 'tank_invuln', time);

        const evaluatePattern = (required: (string | null)[], optional: (string | null)[], requireSurvival: boolean): boolean => {
            if (required.some(r => r === null)) return false;

            let candidateIds = [...(required as string[]), ...(optional.filter(Boolean) as string[])];
            if (candidateIds.length === 0) return false;

            // 【修正要求3】 1回の強攻撃に対するバフの数は「最大4つまで」という制約を必ず守る
            candidateIds = candidateIds.slice(0, 4);

            const testAssignments = [...assignments];
            for (const cId of candidateIds) {
                const miti = getMitigation(cId);
                if (miti) {
                    // ここでの targetId は生存テスト用であり、最終的なUI展開時には commitMitigation 内の scope 洗い替えで処理される
                    testAssignments.push({ id: 'fake', mitigationId: miti.id, time, duration: miti.duration, ownerId: targetTank.id, targetId: targetId });
                }
            }

            if (requireSurvival && isBlockLethal(block.events, targetId, testAssignments)) {
                return false;
            }

            for (const cId of candidateIds) {
                commitMitigation(targetTank.id, cId, time, targetId);
            }
            return true;
        };

        if (evaluatePattern([t40, tShort], [tSubTargeted], true)) continue;
        if (evaluatePattern([tRoleAction, tSubSelf, tShort], [tSubTargeted], true)) continue;
        if (evaluatePattern([t40, tRoleAction, tSubSelf, tShort], [tSubTargeted], true)) continue;
        if (evaluatePattern([t40, tShort], [], true)) continue;
        if (evaluatePattern([tRoleAction, tSubSelf, tShort], [], true)) continue;
        if (evaluatePattern([tInvuln], [], false)) continue;
    }

    // =========================================================================
    // 最終警告（致死量到達）の判定
    // =========================================================================
    for (const block of blocks) {
        if (isBlockLethal(block.events, block.target, assignments)) {
            block.events.forEach(e => warnings.add(e.id));
        }
    }

    return { mitigations: assignments.sort((a, b) => a.time - b.time), warnings: Array.from(warnings) };
}