import type { AppliedMitigation, PartyMember } from '../types';
import type { DamageBlock } from './autoPlannerTypes';
import type { PlannerContext } from './autoPlannerContext';

// AoEルート配置(Route A/B)とタンク強攻撃(TB)パターン配置。
export function createDeployers(ctx: PlannerContext) {
    const {
        getMiti, memberSkills, tanks, healers, d1, d2, d3, d4,
        isLethal, isAvail, findSkill, findFamily, findRole, place, tryPlace,
    } = ctx;

    // ================================================================
    // AoEルート配置（Route A: MT組 / Route B: ST組）
    // ================================================================
    const deployAoe = (
        block: DamageBlock, route: 'A' | 'B',
        state: AppliedMitigation[], uMap: Map<string, number[]>
    ) => {
        const t = block.startTime;
        if (block.maxDamageRatio < 1.0) return;
        const tier = block.maxDamageRatio >= 1.75 ? 4 : (block.maxDamageRatio >= 1.2 ? 3 : 2);

        if (route === 'A') {
            // --- Route A (MT組): MT, H1, D1, D3 ---
            tryPlace(state, uMap, tanks.mt?.id,
                findRole(tanks.mt?.id, 'reprisal', t, uMap, state), t);
            tryPlace(state, uMap, tanks.mt?.id,
                findSkill(tanks.mt?.id, m => m.family === 'tank_party_miti' || m.family === 'tank_party_miti_sub', t, uMap, state), t);
            tryPlace(state, uMap, d1?.id,
                findRole(d1?.id, 'feint', t, uMap, state), t);
            tryPlace(state, uMap, d3?.id,
                findFamily(d3?.id, 'ranged_party_15', t, uMap, state), t);
            tryPlace(state, uMap, healers.h1?.id,
                findFamily(healers.h1?.id, 'ph_60_aoe', t, uMap, state), t);

            if (tier >= 3 && healers.h2) {
                // H2: バブル配置
                const h2Skills = memberSkills.get(healers.h2.id) || [];
                for (const sk of h2Skills) {
                    if (sk.family === 'healer_bubble' && isAvail(healers.h2.id, sk.id, t, uMap, state)) {
                        place(state, uMap, healers.h2.id, sk.id, t);
                    }
                }
                // H2: 120秒スキル + サブスキル
                const bh120a = findFamily(healers.h2.id, 'bh_120_a', t, uMap, state);
                if (bh120a) {
                    place(state, uMap, healers.h2.id, bh120a, t);
                    const subs = h2Skills.filter(m => m.family === 'bh_sub_a' && isAvail(healers.h2!.id, m.id, t, uMap, state));
                    for (const sub of subs) place(state, uMap, healers.h2.id, sub.id, t);
                } else {
                    const bh120b = findFamily(healers.h2.id, 'bh_120_b', t, uMap, state);
                    if (bh120b) place(state, uMap, healers.h2.id, bh120b, t);
                }
            }

            // Tier 4: DPSフレックス軽減
            if (tier >= 4) {
                for (const dps of [d1, d3, d2, d4].filter(Boolean) as PartyMember[]) {
                    if (!isLethal(block, state)) break;
                    const flex = findSkill(dps.id, m => m.family !== 'role_action' && m.scope !== 'self', t, uMap, state);
                    if (flex) place(state, uMap, dps.id, flex, t);
                }
            }
        } else {
            // --- Route B (ST組): ST, H2, D2, D4 ---
            tryPlace(state, uMap, tanks.st?.id,
                findRole(tanks.st?.id, 'reprisal', t, uMap, state), t);
            tryPlace(state, uMap, tanks.st?.id,
                findSkill(tanks.st?.id, m => m.family === 'tank_party_miti' || m.family === 'tank_party_miti_sub', t, uMap, state), t);
            tryPlace(state, uMap, d2?.id,
                findRole(d2?.id, 'feint', t, uMap, state), t);
            tryPlace(state, uMap, d4?.id,
                findRole(d4?.id, 'addle', t, uMap, state), t);
            tryPlace(state, uMap, healers.h2?.id,
                findFamily(healers.h2?.id, 'healer_bubble', t, uMap, state), t);

            if (tier >= 3 && healers.h1) {
                // H1: 120秒スキル + サブスキル
                const ph120 = findFamily(healers.h1.id, 'ph_120_aoe', t, uMap, state);
                if (ph120) {
                    place(state, uMap, healers.h1.id, ph120, t);
                    const h1Skills = memberSkills.get(healers.h1.id) || [];
                    const subs = h1Skills.filter(m => m.family === 'ph_sub_120' && isAvail(healers.h1!.id, m.id, t, uMap, state));
                    for (const sub of subs) place(state, uMap, healers.h1.id, sub.id, t);
                }
            }

            // Tier 4: DPSフレックス軽減
            if (tier >= 4) {
                for (const dps of [d2, d4, d1, d3].filter(Boolean) as PartyMember[]) {
                    if (!isLethal(block, state)) break;
                    const flex = findSkill(dps.id, m => m.family !== 'role_action' && m.scope !== 'self', t, uMap, state);
                    if (flex) place(state, uMap, dps.id, flex, t);
                }
            }
        }
    };

    // ================================================================
    // タンク強攻撃（TB）パターン配置
    // ================================================================
    const deployTB = (
        block: DamageBlock, preferPattern: number,
        state: AppliedMitigation[], uMap: Map<string, number[]>
    ): void => {
        const t = block.startTime;
        const tgt = block.target;
        const tank = tgt === 'MT' ? tanks.mt : tanks.st;
        if (!tank || block.maxDamageRatio < 1.0) return;

        // 利用可能なバフを検索
        // 相方タンク（インターベンション等の対象）
        const partner = tgt === 'MT' ? tanks.st : tanks.mt;

        const t40 = findFamily(tank.id, 'tank_40', t, uMap, state);
        const tShort = findFamily(tank.id, 'tank_short', t, uMap, state);
        // tank_sub_targeted は相方タンクから検索（相方が対象タンクにかけるスキル）
        const tSub = findFamily(partner?.id, 'tank_sub_targeted', t, uMap, state);
        const tRampart = findRole(tank.id, 'rampart', t, uMap, state);
        const tSubSelf = findFamily(tank.id, 'tank_sub_self', t, uMap, state);
        const tInvuln = findFamily(tank.id, 'tank_invuln', t, uMap, state);

        // 6つのTBパターン（優先度順）
        const patterns: { req: (string | null)[]; opt: (string | null)[]; checkSurvival: boolean }[] = [
            { req: [t40, tShort], opt: [tSub], checkSurvival: true },
            { req: [tRampart, tSubSelf, tShort], opt: [tSub], checkSurvival: true },
            { req: [t40, tRampart, tSubSelf, tShort], opt: [tSub], checkSurvival: true },
            { req: [t40, tShort], opt: [], checkSurvival: true },
            { req: [tRampart, tSubSelf, tShort], opt: [], checkSurvival: true },
            { req: [tInvuln], opt: [], checkSurvival: false },
        ];

        const tryPattern = (p: typeof patterns[0]): boolean => {
            if (p.req.some(r => r === null)) return false;
            // 1回のTBに対するバフは最大4つまで
            const ids = [...(p.req as string[]), ...(p.opt.filter(Boolean) as string[])].slice(0, 4);
            if (ids.length === 0) return false;

            // 生存テスト
            if (p.checkSurvival) {
                const test = [...state];
                for (const id of ids) {
                    const m = getMiti(id);
                    // tSub は相方タンクが使用者
                    const owner = (id === tSub && partner) ? partner.id : tank.id;
                    if (m) test.push({ id: 'test', mitigationId: m.id, time: t, duration: m.duration, ownerId: owner, targetId: tgt });
                }
                if (isLethal(block, test)) return false;
            }

            for (const id of ids) {
                // tSub は相方タンクが使用者、ターゲットは対象タンク
                const owner = (id === tSub && partner) ? partner.id : tank.id;
                place(state, uMap, owner, id, t, tgt);
            }
            return true;
        };

        // 指定パターンを優先試行
        if (preferPattern >= 0 && preferPattern < patterns.length) {
            if (tryPattern(patterns[preferPattern])) return;
        }
        // フォールバック: 全パターンを順次試行
        for (const p of patterns) {
            if (tryPattern(p)) return;
        }
    };

    return { deployAoe, deployTB };
}

export type Deployers = ReturnType<typeof createDeployers>;
