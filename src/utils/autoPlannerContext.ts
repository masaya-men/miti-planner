import type { TimelineEvent, PartyMember, AppliedMitigation, Mitigation } from '../types';
import { getMitigationsFromStore } from '../hooks/useSkillsData';
import { resolveMitigation, getMode } from './mitigationResolver';
import type { DamageBlock } from './autoPlannerTypes';

// 前処理(ヘルパー・ブロック化・スキル可用性判定・配置)。generateAutoPlan から最初に1回呼ばれる。
export function createPlannerContext(
    timeline: TimelineEvent[],
    party: PartyMember[],
    level: number,
    settings?: { tankHp: number; dpsHp: number }
) {

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
    const mitigations = getMitigationsFromStore();
    const mitiCache = new Map<string, Mitigation>();
    for (const m of mitigations) mitiCache.set(m.id, m);
    const getMiti = (id: string) => mitiCache.get(id);

    // パッセージ・オブ・アームズはオート配置から除外
    const EXCLUDED = new Set(['passage_of_arms']);

    // メンバーごとの所持スキル（レベル・ジョブ・モードでフィルタ）
    const memberSkills = new Map<string, Mitigation[]>();
    for (const member of party) {
        const mode = getMode(member);
        const skills = mitigations
            .filter(m => {
                if (m.isTankSwap) return false; // 挑発は手動専用・自動配置しない
                if (m.minLevel !== undefined && level < m.minLevel) return false;
                if (m.maxLevel !== undefined && level > m.maxLevel) return false;
                return m.jobId === member.jobId || m.jobId === member.role || m.jobId === 'role_action';
            })
            .filter(m => !EXCLUDED.has(m.id))
            .map(m => resolveMitigation(m, mode))
            .filter((m): m is Mitigation => m !== null); // disabled スキル除外
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
            const rawMiti = getMiti(a.mitigationId);
            if (!rawMiti) continue;
            // owner のモードで解決
            const owner = party.find(p => p.id === a.ownerId);
            const mode = owner ? getMode(owner) : 'reborn';
            const m = resolveMitigation(rawMiti, mode);
            if (!m) continue; // disabled
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

            // フェイブレッシング/エーテルパクトはエオス・セレネ専用(セラフィムには実行不可)。
            // 光の囁き/フェイイルミネーションは名称が変わるだけで実際は使えるため対象外。
            if (mitiId === 'fey_blessing' || mitiId === 'aetherpact') {
                for (const a of state) {
                    if (a.mitigationId === 'summon_seraph' &&
                        time >= a.time && time < a.time + a.duration) {
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

        // targetCannotBeSelf: 自分自身を対象にできないスキル（インターベンション等）
        if (m.targetCannotBeSelf && targetId === ownerId) return false;

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

    return {
        getMiti, memberSkills, tanks, healers, d1, d2, d3, d4, schMember,
        isLethal, lethalityRatio, blocks, aoeBlocks, tbBlocks,
        isAvail, findSkill, findFamily, findRole, place, tryPlace,
    };
}

export type PlannerContext = ReturnType<typeof createPlannerContext>;
