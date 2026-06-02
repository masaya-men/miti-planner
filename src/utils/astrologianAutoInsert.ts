import type { AppliedMitigation, TimelineEvent } from '../types';

/**
 * 占星術師のドロー自動挿入ロジック。
 *
 * 仕様:
 * - 戦闘前 Astral Draw (t=-3): autoHidden:true で配置 (タイムライン表示から除外、 計算には含める)
 * - t=9 で Umbral Draw、 t=65 で Astral Draw、 以降 60 秒毎に交互に最終イベント時刻まで
 * - 既に astral_draw or umbral_draw が 1 つでもあれば「初回投入済み」 とみなしスキップ
 *   (ユーザーが削除/移動した結果を尊重するため)
 */

const PREPULL_ASTRAL_TIME = -3;
const FIRST_UMBRAL_TIME = 9;
const SECOND_ASTRAL_TIME = 65;
const DRAW_INTERVAL = 60;

function genId(): string {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ast_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 該当 AST メンバーが既にドロー (astral_draw or umbral_draw) を 1 つでも持っているか。
 * true なら「初回投入済み」 とみなし、 自動配置はスキップする。
 */
export function hasAnyAstrologianDraw(
    memberId: string,
    mitigations: AppliedMitigation[]
): boolean {
    return mitigations.some(
        m => m.ownerId === memberId &&
            (m.mitigationId === 'astral_draw' || m.mitigationId === 'umbral_draw')
    );
}

/**
 * memberId の占星術師向けに必要な自動配置分を返す。
 * 既存配置に追加する形で新規挿入分だけ返すので、 呼び出し側は配列を結合すればよい。
 */
export function buildAstrologianAutoInserts(
    memberId: string,
    existingMitigations: AppliedMitigation[],
    timelineEvents: TimelineEvent[]
): AppliedMitigation[] {
    // 既にドローを持っていればユーザー編集尊重でスキップ
    if (hasAnyAstrologianDraw(memberId, existingMitigations)) {
        return [];
    }

    const inserts: AppliedMitigation[] = [];

    // 1. 戦闘前 Astral Draw (t=-3、 autoHidden で行展開トリガーにしない)
    inserts.push({
        id: genId(),
        mitigationId: 'astral_draw',
        ownerId: memberId,
        time: PREPULL_ASTRAL_TIME,
        duration: 1,
        autoHidden: true,
    });

    // 最大時刻 (戦闘終了想定)
    // 白紙プラン (timelineEvents が空) の場合は 20分 (1200秒) まで配置する
    const maxTime = timelineEvents.length > 0
        ? timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : 1200;

    // 2. t=9 Umbral Draw
    if (FIRST_UMBRAL_TIME <= maxTime) {
        inserts.push({
            id: genId(),
            mitigationId: 'umbral_draw',
            ownerId: memberId,
            time: FIRST_UMBRAL_TIME,
            duration: 1,
        });
    }

    // 3. t=65 Astral Draw + 以降 60 秒毎に交互
    for (let t = SECOND_ASTRAL_TIME, isAstral = true; t <= maxTime; t += DRAW_INTERVAL, isAstral = !isAstral) {
        inserts.push({
            id: genId(),
            mitigationId: isAstral ? 'astral_draw' : 'umbral_draw',
            ownerId: memberId,
            time: t,
            duration: 1,
        });
    }

    return inserts;
}

/**
 * 手動でドロー (astral_draw or umbral_draw) を置いたあと、その時刻以降のリキャストごと
 * 交互配置分を返す。
 * - startTime + 60s から DRAW_INTERVAL (60s) 間隔で配置
 * - 各時刻のスキルは「直前と逆」 (= startKind と異なるものから始まり、 以降交互)
 * - 既存の astral_draw / umbral_draw との時刻差が DRAW_INTERVAL 未満ならスキップ
 *   (リキャスト違反位置には絶対配置しない)
 */
export function buildAstrologianDrawChainFrom(
    memberId: string,
    startTime: number,
    startKind: 'astral_draw' | 'umbral_draw',
    existingMitigations: AppliedMitigation[],
    timelineEvents: TimelineEvent[]
): AppliedMitigation[] {
    const memberMits = existingMitigations.filter(m => m.ownerId === memberId);
    const inserts: AppliedMitigation[] = [];
    const maxTime = timelineEvents.length > 0
        ? timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : 1200;

    let isAstral = startKind === 'umbral_draw'; // 次は startKind と逆
    for (let t = startTime + DRAW_INTERVAL; t <= maxTime; t += DRAW_INTERVAL, isAstral = !isAstral) {
        const dup = memberMits.some(
            m => (m.mitigationId === 'astral_draw' || m.mitigationId === 'umbral_draw') &&
                Math.abs(m.time - t) < DRAW_INTERVAL
        );
        if (dup) continue;
        inserts.push({
            id: genId(),
            mitigationId: isAstral ? 'astral_draw' : 'umbral_draw',
            ownerId: memberId,
            time: t,
            duration: 1,
        });
    }

    return inserts;
}
