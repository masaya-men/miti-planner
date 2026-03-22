import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { MITIGATIONS } from '../data/mockData';

export interface AutoPlannerResult {
    mitigations: AppliedMitigation[];
    warnings: string[];
}

// ====================================================================
// SA法（焼きなまし法）による全体最適化オートプランナー
//
// 従来の「降順貪欲法」に代わり、タイムライン全体の「生存率」と
// 「パッケージ運用の整合性」を最大化する焼きなまし法エンジン。
//
// 設計:
//   決定ベクトル = AoEブロックのルート(A/B)割り当て + TBパターン選択
//   コンパイル   = 決定ベクトル → 具体的な軽減配置（AppliedMitigation[]）
//   スコアリング = 生存・リキャスト・パッケージ・戦略的無敵を評価
//   探索         = マルチスタートSAで最良解を発見
// ====================================================================

interface DamageBlock {
    id: string;
    target: 'AoE' | 'MT' | 'ST';
    startTime: number;
    endTime: number;
    events: TimelineEvent[];
    isTB: boolean;
    maxDamageRatio: number;
}

// SA法の決定ベクトル
interface SADecision {
    aoeRoutes: ('A' | 'B')[];   // AoEブロックごとのルート割り当て
    tbPatterns: number[];        // TBブロックごとのパターンインデックス(0-5)
}

export function generateAutoPlan(
    timeline: TimelineEvent[],
    party: PartyMember[],
    level: number,
    settings?: { tankHp: number; dpsHp: number }
): AutoPlannerResult {

    // ================================================================
    // 初期化
    // ================================================================
    const defaultTankHp = party.find(m => m.role === 'tank' && m.computedValues?.hp)?.computedValues?.hp ?? 299000;
    const defaultDpsHp = party.find(m => m.role === 'dps' && m.computedValues?.hp)?.computedValues?.hp ?? 199000;
    const hpBase = {
        tank: settings?.tankHp ?? defaultTankHp,
        dps: settings?.dpsHp ?? defaultDpsHp,
    };

    // スキルキャッシュ（高速ルックアップ用）
    const mitiCache = new Map<string, Mitigation>();
    for (const m of MITIGATIONS) mitiCache.set(m.id, m);
    const getMiti = (id: string) => mitiCache.get(id);

    // パッセージ・オブ・アームズはオート配置から除外
    const EXCLUDED = new Set(['passage_of_arms']);

    // メンバーごとの所持スキル（レベル・ジョブでフィルタ）
    const memberSkills = new Map<string, Mitigation[]>();
    for (const member of party) {
        const skills = MITIGATIONS.filter(m => {
            if (m.minLevel !== undefined && level < m.minLevel) return false;
            if (m.maxLevel !== undefined && level > m.maxLevel) return false;
            return m.jobId === member.jobId || m.jobId === member.role || m.jobId === 'role_action';
        }).filter(m => !EXCLUDED.has(m.id));
        memberSkills.set(member.id, skills);
    }

    // ポジションマッピング
    const tanks = { mt: party.find(m => m.id === 'MT'), st: party.find(m => m.id === 'ST') };
    const healers = { h1: party.find(m => m.id === 'H1'), h2: party.find(m => m.id === 'H2') };
    const d1 = party.find(m => m.id === 'D1');
    const d2 = party.find(m => m.id === 'D2');
    const d3 = party.find(m => m.id === 'D3');
    const d4 = party.find(m => m.id === 'D4');
    const schMember = party.find(m => m.jobId === 'sch');

    // ================================================================
    // ヘルパー関数
    // ================================================================
    let idCounter = 0;
    const genId = () => `sa_${++idCounter}`;

    // ダメージシミュレーション（軽減・シールド・無敵を考慮）
    const simDamage = (
        eventTime: number,
        rawDmg: number,
        target: 'MT' | 'ST' | 'AoE',
        state: AppliedMitigation[]
    ): number => {
        let mult = 1;
        let shield = 0;
        for (const a of state) {
            const m = getMiti(a.mitigationId);
            if (!m) continue;
            if (eventTime < a.time || eventTime > a.time + a.duration) continue;

            // 無敵スキル判定
            if (m.isInvincible && (a.ownerId === target || a.targetId === target)) return 0;

            if ((m.value > 0 || m.isShield) &&
                (m.scope === 'party' || m.scope === undefined || a.ownerId === target || a.targetId === target)) {
                if (m.isShield) {
                    shield += (target === 'AoE' ? hpBase.dps : hpBase.tank) * (m.value / 100);
                } else if (m.value > 0) {
                    mult *= (1 - m.value / 100);
                }
            }
        }
        return Math.max(0, rawDmg * mult - shield);
    };

    // ブロック致死判定
    const isLethal = (block: DamageBlock, state: AppliedMitigation[]): boolean => {
        const base = block.target === 'AoE' ? hpBase.dps : hpBase.tank;
        let total = 0;
        for (const e of block.events) {
            total += simDamage(e.time, e.damageAmount || 0, block.target, state);
        }
        return total >= base;
    };

    // 致死率: 0=無傷, 1=ちょうど致死, >1=超過
    const lethalityRatio = (block: DamageBlock, state: AppliedMitigation[]): number => {
        const base = block.target === 'AoE' ? hpBase.dps : hpBase.tank;
        let total = 0;
        for (const e of block.events) {
            total += simDamage(e.time, e.damageAmount || 0, block.target, state);
        }
        return total / base;
    };

    // ================================================================
    // タイムライン前処理（AA除去 → ブロック化）
    // ================================================================
    const validEvents = timeline.filter(t => {
        if ((t.damageType as string) === 'AA' || (t.damageType as string)?.toLowerCase() === 'aa') return false;
        const en = (t.name.en || '').toLowerCase();
        const ja = t.name.ja || '';
        if (en.includes('aa') || en.includes('auto attack') || en.includes('auto-attack')) return false;
        if (ja === 'aa' || ja.includes('オートアタック')) return false;
        return (t.target === 'AoE' || t.target === 'MT' || t.target === 'ST') && (t.damageAmount || 0) > 0;
    }).sort((a, b) => a.time - b.time);

    // 4秒以内の同種イベントを1ブロックに圧縮
    const blocks: DamageBlock[] = [];
    for (const ev of validEvents) {
        if (!ev.target) continue;
        const base = ev.target === 'AoE' ? hpBase.dps : hpBase.tank;
        const ratio = (ev.damageAmount || 0) / base;
        const isTB = ev.target === 'MT' || ev.target === 'ST';
        const last = blocks.length > 0 ? blocks[blocks.length - 1] : null;

        if (last && last.target === ev.target && ev.time - last.endTime <= 4) {
            last.events.push(ev);
            last.endTime = ev.time;
            if (ratio > last.maxDamageRatio) last.maxDamageRatio = ratio;
            last.isTB = isTB;
        } else {
            blocks.push({
                id: ev.id, target: ev.target,
                startTime: ev.time, endTime: ev.time,
                events: [ev], isTB, maxDamageRatio: ratio,
            });
        }
    }

    // ダメージ比率降順でソート（高ダメージ優先で配置）
    const aoeBlocks = blocks.filter(b => b.target === 'AoE').sort((a, b) => b.maxDamageRatio - a.maxDamageRatio);
    const tbBlocks = blocks.filter(b => b.isTB).sort((a, b) => b.maxDamageRatio - a.maxDamageRatio);

    // ================================================================
    // リキャスト・制約チェック
    // ================================================================
    const isAvail = (
        memberId: string, mitiId: string, time: number,
        uMap: Map<string, number[]>, state: AppliedMitigation[]
    ): boolean => {
        const m = getMiti(mitiId);
        if (!m) return false;

        // 学者妖精ロックアウト（転化後30秒間は妖精スキル使用不可）
        if (schMember && memberId === schMember.id) {
            const fairyIds = ['summon_seraph', 'fey_illumination', 'whispering_dawn',
                'fey_blessing', 'fey_union', 'fey_union_stop', 'consolation'];
            if (fairyIds.some(f => mitiId.includes(f))) {
                for (const a of state) {
                    if (a.mitigationId.includes('dissipation') &&
                        time >= a.time && time <= a.time + 30) {
                        return false;
                    }
                }
            }
        }

        // 前提スキル（requires）の確認
        if (m.requires) {
            const reqKey = `${memberId}_${m.requires}`;
            const reqTimes = uMap.get(reqKey) || [];
            const reqM = getMiti(m.requires);
            const dur = reqM ? reqM.duration : 20;
            if (!reqTimes.some(t => time >= t && time <= t + dur)) return false;
        }

        // リキャスト判定
        const key = `${memberId}_${mitiId}`;
        const times = uMap.get(key) || [];
        for (const t of times) {
            if (Math.abs(time - t) < m.recast) return false;
        }

        return true;
    };

    // スキル検索ヘルパー
    const findSkill = (
        mId: string | undefined | null,
        fn: (m: Mitigation) => boolean,
        time: number, uMap: Map<string, number[]>,
        state: AppliedMitigation[]
    ): string | null => {
        if (!mId) return null;
        const skills = memberSkills.get(mId) || [];
        const s = skills.find(m => fn(m) && isAvail(mId, m.id, time, uMap, state));
        return s ? s.id : null;
    };

    const findFamily = (mId: string | undefined | null, family: string, t: number, u: Map<string, number[]>, s: AppliedMitigation[]) =>
        findSkill(mId, m => m.family === family, t, u, s);

    const findRole = (mId: string | undefined | null, base: string, t: number, u: Map<string, number[]>, s: AppliedMitigation[]) =>
        findSkill(mId, m => m.family === 'role_action' && m.id.includes(base), t, u, s);

    // ================================================================
    // 配置ヘルパー
    // ================================================================
    const place = (
        state: AppliedMitigation[], uMap: Map<string, number[]>,
        ownerId: string, mitiId: string, time: number, targetId?: string
    ): boolean => {
        const m = getMiti(mitiId);
        if (!m) return false;

        // scope に基づくターゲット管理
        const tgt = (m.scope === 'self' || m.scope === 'party') ? undefined : targetId;
        state.push({
            id: genId(), mitigationId: m.id,
            time, duration: m.duration,
            ownerId, targetId: tgt,
        });

        const key = `${ownerId}_${mitiId}`;
        const times = uMap.get(key) || [];
        times.push(time);
        uMap.set(key, times);
        return true;
    };

    const tryPlace = (
        state: AppliedMitigation[], uMap: Map<string, number[]>,
        ownerId: string | undefined | null, mitiId: string | null,
        time: number, targetId?: string
    ) => {
        if (ownerId && mitiId) place(state, uMap, ownerId, mitiId, time, targetId);
    };

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
        const t40 = findFamily(tank.id, 'tank_40', t, uMap, state);
        const tShort = findFamily(tank.id, 'tank_short', t, uMap, state);
        const tSub = findFamily(tank.id, 'tank_sub_targeted', t, uMap, state);
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
                    if (m) test.push({ id: 'test', mitigationId: m.id, time: t, duration: m.duration, ownerId: tank.id, targetId: tgt });
                }
                if (isLethal(block, test)) return false;
            }

            for (const id of ids) place(state, uMap, tank.id, id, t, tgt);
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

    // ================================================================
    // コンパイル: 決定ベクトル → 具体的な軽減配置
    // ================================================================
    const compile = (decision: SADecision): AppliedMitigation[] => {
        const state: AppliedMitigation[] = [];
        const uMap = new Map<string, number[]>();

        // 学者の開幕転化（固定配置）
        if (schMember) {
            const diss = (memberSkills.get(schMember.id) || []).find(m => m.id.includes('dissipation'));
            if (diss) place(state, uMap, schMember.id, diss.id, 0);
        }

        // AoEブロック配置（ダメージ降順）
        for (let i = 0; i < aoeBlocks.length; i++) {
            const route = i < decision.aoeRoutes.length ? decision.aoeRoutes[i] : 'A';
            deployAoe(aoeBlocks[i], route, state, uMap);
        }

        // TBブロック配置（ダメージ降順）
        for (let i = 0; i < tbBlocks.length; i++) {
            const pattern = i < decision.tbPatterns.length ? decision.tbPatterns[i] : 0;
            deployTB(tbBlocks[i], pattern, state, uMap);
        }

        return state;
    };

    // ================================================================
    // スコアリング関数
    //
    // 優先順位:
    //   1. 絶対生存（最優先）: 全ブロック生存 → 巨大ボーナス
    //   2. リキャスト遵守: 違反があれば大幅減点
    //   3. パッケージ運用: Route A/Bの完全配置 → 加点
    //   4. 戦略的無敵: バフ枯渇TBへの無敵割り当て → 加点
    //   5. リソース効率: 過剰な軽減使用 → 微小減点
    // ================================================================
    const scoreState = (state: AppliedMitigation[]): number => {
        let s = 0;

        // 1. 絶対生存（最優先）
        for (const block of blocks) {
            const ratio = lethalityRatio(block, state);
            if (ratio < 1.0) {
                s += 10000;
                // HP余裕に応じた微小ボーナス（効率的な配置を促進）
                s += Math.floor((1.0 - ratio) * 500);
            } else {
                // 致死ペナルティ（超過量に比例）
                s -= 50000 + Math.floor((ratio - 1.0) * 10000);
            }
        }

        // 2. リキャスト遵守
        const groups = new Map<string, { mitiId: string; times: number[] }>();
        for (const a of state) {
            const key = `${a.ownerId}_${a.mitigationId}`;
            let group = groups.get(key);
            if (!group) {
                group = { mitiId: a.mitigationId, times: [] };
                groups.set(key, group);
            }
            group.times.push(a.time);
        }
        for (const [, group] of groups) {
            const m = getMiti(group.mitiId);
            if (!m) continue;
            group.times.sort((a, b) => a - b);
            for (let i = 1; i < group.times.length; i++) {
                if (group.times[i] - group.times[i - 1] < m.recast) {
                    s -= 8000;
                }
            }
        }

        // 3. パッケージ運用ボーナス
        for (const block of aoeBlocks) {
            const owners = new Set(
                state.filter(a => Math.abs(a.time - block.startTime) <= 1).map(a => a.ownerId)
            );
            const routeA = ['MT', 'H1', 'D1', 'D3'].filter(m => owners.has(m)).length;
            const routeB = ['ST', 'H2', 'D2', 'D4'].filter(m => owners.has(m)).length;
            const best = Math.max(routeA, routeB);
            s += best * 150;
            if (best >= 4) s += 500;  // 完全パッケージボーナス
        }

        // 4. 戦略的無敵ボーナス
        for (const block of tbBlocks) {
            const blockMitis = state.filter(a => Math.abs(a.time - block.startTime) <= 1);
            const hasInvuln = blockMitis.some(a => getMiti(a.mitigationId)?.isInvincible);
            if (hasInvuln && !isLethal(block, state)) s += 300;
        }

        // 5. リソース効率（使用スキル数の微小ペナルティ）
        s -= state.length * 5;

        return s;
    };

    // ================================================================
    // 近傍操作（ミューテーション）
    // ================================================================
    const mutate = (d: SADecision): SADecision => {
        const nd: SADecision = {
            aoeRoutes: [...d.aoeRoutes],
            tbPatterns: [...d.tbPatterns],
        };

        const r = Math.random();

        if (r < 0.35 && nd.aoeRoutes.length > 0) {
            // 単一AoEブロックのルート反転
            const idx = Math.floor(Math.random() * nd.aoeRoutes.length);
            nd.aoeRoutes[idx] = nd.aoeRoutes[idx] === 'A' ? 'B' : 'A';

        } else if (r < 0.55 && nd.aoeRoutes.length >= 2) {
            // 隣接AoEブロックのルート交換
            const idx = Math.floor(Math.random() * (nd.aoeRoutes.length - 1));
            [nd.aoeRoutes[idx], nd.aoeRoutes[idx + 1]] = [nd.aoeRoutes[idx + 1], nd.aoeRoutes[idx]];

        } else if (r < 0.80 && nd.tbPatterns.length > 0) {
            // TBパターン変更
            const idx = Math.floor(Math.random() * nd.tbPatterns.length);
            nd.tbPatterns[idx] = Math.floor(Math.random() * 6);

        } else if (nd.aoeRoutes.length > 0) {
            // 2つのAoEブロックを同時反転
            const idx1 = Math.floor(Math.random() * nd.aoeRoutes.length);
            let idx2 = Math.floor(Math.random() * nd.aoeRoutes.length);
            if (idx2 === idx1 && nd.aoeRoutes.length > 1) {
                idx2 = (idx1 + 1) % nd.aoeRoutes.length;
            }
            nd.aoeRoutes[idx1] = nd.aoeRoutes[idx1] === 'A' ? 'B' : 'A';
            if (idx1 !== idx2) {
                nd.aoeRoutes[idx2] = nd.aoeRoutes[idx2] === 'A' ? 'B' : 'A';
            }
        }

        return nd;
    };

    // ================================================================
    // SA実行エンジン
    // ================================================================
    const runSA = (
        initial: SADecision,
        iterations: number,
        t0: number,
        cooling: number
    ): { decision: SADecision; score: number } => {
        let current = initial;
        let currentScore = scoreState(compile(current));
        let best: SADecision = {
            aoeRoutes: [...current.aoeRoutes],
            tbPatterns: [...current.tbPatterns],
        };
        let bestScore = currentScore;
        let temp = t0;

        for (let i = 0; i < iterations; i++) {
            const neighbor = mutate(current);
            const nScore = scoreState(compile(neighbor));
            const delta = nScore - currentScore;

            // メトロポリス基準: 改善なら必ず採用、悪化なら確率的に採用
            if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
                current = neighbor;
                currentScore = nScore;
                if (currentScore > bestScore) {
                    best = {
                        aoeRoutes: [...current.aoeRoutes],
                        tbPatterns: [...current.tbPatterns],
                    };
                    bestScore = currentScore;
                }
            }

            temp *= cooling;
        }

        return { decision: best, score: bestScore };
    };

    // ================================================================
    // マルチスタートSA実行
    //
    // 3つの異なる初期解からSAを並列実行し、最良解を採用。
    // 合計 9000回 のシミュレーションで全体最適を探索。
    // ================================================================
    const ITERATIONS_PER_RUN = 3000;
    const T0 = 500;
    const COOLING = 0.998;

    // 初期決定ベクトルの生成
    const makeInitial = (startRoute: 'A' | 'B', randomize: boolean): SADecision => {
        const routes: ('A' | 'B')[] = [];
        let r = startRoute;
        for (let i = 0; i < aoeBlocks.length; i++) {
            if (randomize) {
                routes.push(Math.random() < 0.5 ? 'A' : 'B');
            } else {
                routes.push(r);
                r = r === 'A' ? 'B' : 'A';
            }
        }
        const patterns: number[] = [];
        for (let i = 0; i < tbBlocks.length; i++) {
            patterns.push(randomize ? Math.floor(Math.random() * 6) : 0);
        }
        return { aoeRoutes: routes, tbPatterns: patterns };
    };

    // 3つの初期解: A始動交互, B始動交互, ランダム
    const starts: SADecision[] = [
        makeInitial('A', false),
        makeInitial('B', false),
        makeInitial('A', true),
    ];

    let globalBest: { decision: SADecision; score: number } | null = null;
    for (const start of starts) {
        const result = runSA(start, ITERATIONS_PER_RUN, T0, COOLING);
        if (!globalBest || result.score > globalBest.score) {
            globalBest = result;
        }
    }

    // ================================================================
    // 最終結果の生成
    // ================================================================
    const finalState = globalBest ? compile(globalBest.decision) : [];

    // 最終結果にユニークIDを付与
    for (const a of finalState) {
        a.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'ap_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    }

    // 致死警告の生成
    const warnings = new Set<string>();
    for (const block of blocks) {
        if (isLethal(block, finalState)) {
            block.events.forEach(e => warnings.add(e.id));
        }
    }

    return {
        mitigations: finalState.sort((a, b) => a.time - b.time),
        warnings: Array.from(warnings),
    };
}
