import type { AppliedMitigation, TimelineEvent } from '../types';

/**
 * 学者の転化＋エーテルフロー自動挿入ロジック。
 *
 * 仕様:
 * - 転化 (Dissipation): t=1 に 1 回だけ（既存配置があれば追加しない）
 * - エーテルフロー (Aetherflow): t=13 から 60 秒毎に最終イベント時刻まで配置
 *   既存配置が近傍にある時刻はスキップ（±30 秒以内で重複判定）
 */

const DISSIPATION_INITIAL_TIME = 1;
const AETHERFLOW_INITIAL_TIME = 13;
const AETHERFLOW_INTERVAL = 60;
const AETHERFLOW_DUPLICATE_WINDOW = 30;
const DISSIPATION_DUPLICATE_WINDOW = 15;

function genId(): string {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'evt_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 該当 SCH メンバーが既にエーテルフローを 1 つでも持っているか。
 * true なら「初回投入済み」とみなし、自動配置はスキップする
 * （ユーザーが削除/移動した結果を尊重するため）。
 */
export function hasAnyAetherflow(
    memberId: string,
    mitigations: AppliedMitigation[]
): boolean {
    return mitigations.some(
        m => m.ownerId === memberId && m.mitigationId === 'aetherflow'
    );
}

/**
 * memberId の学者向けに必要な転化・エーテルフロー自動挿入分を返す。
 * 既存配置に追加する形で新規挿入分だけ返すので、呼び出し側は配列を結合すればよい。
 */
export function buildScholarAutoInserts(
    memberId: string,
    existingMitigations: AppliedMitigation[],
    timelineEvents: TimelineEvent[]
): AppliedMitigation[] {
    const memberMits = existingMitigations.filter(m => m.ownerId === memberId);
    const inserts: AppliedMitigation[] = [];

    // 1. 転化: 開幕付近に既存があるならスキップ
    const hasInitialDissipation = memberMits.some(
        m => m.mitigationId === 'dissipation' && Math.abs(m.time - DISSIPATION_INITIAL_TIME) <= DISSIPATION_DUPLICATE_WINDOW
    );
    if (!hasInitialDissipation) {
        inserts.push({
            id: genId(),
            mitigationId: 'dissipation',
            ownerId: memberId,
            time: DISSIPATION_INITIAL_TIME,
            duration: 30,
        });
    }

    // 2. エーテルフロー: t=13, 73, 133... 最終イベント時刻まで
    const maxTime = timelineEvents.length > 0
        ? timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : 0;

    for (let t = AETHERFLOW_INITIAL_TIME; t <= maxTime; t += AETHERFLOW_INTERVAL) {
        const existingAtTime = memberMits.some(
            m => m.mitigationId === 'aetherflow' && Math.abs(m.time - t) <= AETHERFLOW_DUPLICATE_WINDOW
        );
        if (existingAtTime) continue;
        inserts.push({
            id: genId(),
            mitigationId: 'aetherflow',
            ownerId: memberId,
            time: t,
            duration: 1,
        });
    }

    return inserts;
}

/**
 * 手動でエーテルフローを置いたあと、その時刻以降のリキャストごと配置分を返す。
 * 重複判定: 既存の aetherflow との時刻差が ±30s 以下ならスキップ。
 */
export function buildAetherflowChainFrom(
    memberId: string,
    startTime: number,
    existingMitigations: AppliedMitigation[],
    timelineEvents: TimelineEvent[]
): AppliedMitigation[] {
    const memberMits = existingMitigations.filter(m => m.ownerId === memberId);
    const inserts: AppliedMitigation[] = [];
    const maxTime = timelineEvents.length > 0
        ? timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : 0;

    for (let t = startTime + AETHERFLOW_INTERVAL; t <= maxTime; t += AETHERFLOW_INTERVAL) {
        const dup = memberMits.some(
            m => m.mitigationId === 'aetherflow' && Math.abs(m.time - t) <= AETHERFLOW_DUPLICATE_WINDOW
        );
        if (dup) continue;
        inserts.push({
            id: genId(),
            mitigationId: 'aetherflow',
            ownerId: memberId,
            time: t,
            duration: 1,
        });
    }

    return inserts;
}
