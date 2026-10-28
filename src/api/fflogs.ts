/**
 * src/api/fflogs.ts
 *
 * FFLogs API v2 (GraphQL) communication module.
 *
 * Design notes:
 * - No React / store imports — this file is pure TypeScript so it can be
 *   migrated to a Vercel Serverless Function in the future with minimal changes.
 * - Credentials are read from Vite env vars (VITE_FFLOGS_CLIENT_ID /
 *   VITE_FFLOGS_CLIENT_SECRET) in dev. In production, replace the fetch
 *   calls below with calls to your own /api/fflogs proxy endpoint and
 *   remove the credential references entirely from the frontend.
 */

import { getAccessToken } from './fflogsToken';
import { gql } from './fflogsGql';
import {
    FIGHTS_QUERY,
    buildDamageEventsQuery,
    buildCastEventsQuery,
    buildDeathEventsQuery,
    PLAYER_DETAILS_QUERY,
} from './fflogsQueries';
import type {
    FFLogsRawEvent,
    FFLogsFight,
    FightsQueryResult,
    EventsQueryResult,
    DeathEvent,
    PlayerDetails,
    PlayerDetailsQueryResult,
} from './fflogsTypes';

// ─────────────────────────────────────────────────────────────
// Fight metadata query
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the list of fights (boss encounters) for a given report.
 * Returns all boss pulls (killType: Encounters) — both kills and wipes.
 * Trash fights are excluded by the Encounters filter.
 */
async function fetchFights(reportCode: string): Promise<FFLogsFight[]> {
    const token = await getAccessToken();
    const data = await gql<FightsQueryResult>(token, FIGHTS_QUERY, { reportCode });
    const fights = data.reportData.report.fights;
    const phaseInfos = data.reportData.report.phases ?? [];

    // encounterIDでフェーズ名を紐付け
    for (const fight of fights) {
        if (fight.encounterID) {
            const info = phaseInfos.find(p => p.encounterID === fight.encounterID);
            if (info?.phases.length) {
                fight.phaseNames = info.phases;
            }
        }
    }

    return fights;
}

// ─────────────────────────────────────────────────────────────
// Damage event query (paginated)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch ALL enemy DamageDone events for a specific fight, handling pagination.
 *
 * @param reportCode - The FFLogs report code
 * @param fight      - The fight object (for startTime / endTime bounds)
 * @param translate  - If true, returns native-language ability names; false = English
 * @returns          - Flat array of all raw events across all pages
 */
export async function fetchFightEvents(
    reportCode: string,
    fight: FFLogsFight,
    translate: boolean = false
): Promise<FFLogsRawEvent[]> {
    const token = await getAccessToken();
    const allEvents: FFLogsRawEvent[] = [];
    const query = buildDamageEventsQuery(translate);

    let pageStart = fight.startTime;
    const fightEnd = fight.endTime;

    // Pagination loop — FFLogs returns nextPageTimestamp when there are more events
    while (true) {
        const data = await gql<EventsQueryResult>(token, query, {
            reportCode,
            fightIds: [fight.id],
            startTime: pageStart,
            endTime: fightEnd,
        });

        const page = data.reportData.report.events;
        allEvents.push(...page.data);

        if (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined) {
            break;
        }

        pageStart = page.nextPageTimestamp;
    }

    return allEvents;
}

// ─────────────────────────────────────────────────────────────
// Cast events query (敵の詠唱イベント取得)
// ─────────────────────────────────────────────────────────────

/**
 * 敵のキャスト（詠唱）イベントを取得する。
 * ダメージが発生しないギミック（フェーズ移行など）をタイムラインに含めるために使用。
 */
export async function fetchCastEvents(
    reportCode: string,
    fight: FFLogsFight,
    translate: boolean = false
): Promise<FFLogsRawEvent[]> {
    const token = await getAccessToken();
    const allEvents: FFLogsRawEvent[] = [];
    const query = buildCastEventsQuery(translate);

    let pageStart = fight.startTime;
    const fightEnd = fight.endTime;

    while (true) {
        const data = await gql<EventsQueryResult>(token, query, {
            reportCode,
            fightIds: [fight.id],
            startTime: pageStart,
            endTime: fightEnd,
        });

        const page = data.reportData.report.events;
        allEvents.push(...page.data);

        if (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined) {
            break;
        }
        pageStart = page.nextPageTimestamp;
    }

    return allEvents;
}

// ─────────────────────────────────────────────────────────────
// Death events query
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all death events for a specific fight.
 * Returns a list of { timestamp, targetID } for each player death.
 */
export async function fetchDeathEvents(
    reportCode: string,
    fight: FFLogsFight
): Promise<DeathEvent[]> {
    const token = await getAccessToken();
    const query = buildDeathEventsQuery();

    const data = await gql<EventsQueryResult>(token, query, {
        reportCode,
        fightIds: [fight.id],
        startTime: fight.startTime,
        endTime: fight.endTime,
    });

    const rawDeaths = data.reportData.report.events.data;
    return rawDeaths
        .filter((e) => e.targetID !== undefined)
        .map((e) => ({
            timestamp: e.timestamp,
            targetID: e.targetID as number,
        }));
}

// ─────────────────────────────────────────────────────────────
// Player Details (role breakdown: tanks / healers / dps)
// ─────────────────────────────────────────────────────────────

export async function fetchPlayerDetails(
    reportCode: string,
    fightId: number
): Promise<PlayerDetails> {
    const token = await getAccessToken();
    const data = await gql<PlayerDetailsQueryResult>(token, PLAYER_DETAILS_QUERY, {
        reportCode,
        fightIDs: [fightId],
    });
    const raw = data.reportData.report.playerDetails;

    // FFLogs playerDetails は {data: {playerDetails: {tanks, healers, dps}}} の場合がある
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = (raw as any)?.data?.playerDetails ?? raw;
    return {
        tanks: details?.tanks ?? [],
        healers: details?.healers ?? [],
        dps: details?.dps ?? [],
    };
}

// ─────────────────────────────────────────────────────────────
// Convenience: resolve fightId string → FFLogsFight
// ─────────────────────────────────────────────────────────────

/**
 * Pure selection logic: pick a concrete fight from a list given a fightId string.
 *
 * - fightId が数値文字列 → 該当 fight (撃破・全滅どちらでも)。無ければエラー。
 * - fightId が null / "last" → 最後の撃破があればそれ、無ければ最後の pull。
 *   (撃破ログ従来挙動を維持しつつ、全滅のみのログにも対応)
 *
 * ネットワークに触れない純粋関数なのでユニットテスト可能。
 */
export function selectFight(
    fights: FFLogsFight[],
    fightId: string | null
): FFLogsFight {
    if (!fights.length) {
        throw new Error('No boss fights found in this report.');
    }

    if (!fightId || fightId === 'last') {
        // 最後の撃破を優先。無ければ最後の pull (全滅のみのログ)。
        const lastKill = [...fights].reverse().find(f => f.kill);
        return lastKill ?? fights[fights.length - 1];
    }

    const id = parseInt(fightId, 10);
    const found = fights.find(f => f.id === id);
    if (!found) {
        throw new Error(
            `Fight ID ${fightId} not found in this report.\n` +
            `Available fight IDs: ${fights.map(f => f.id).join(', ')}`
        );
    }
    return found;
}

/**
 * Resolve a fightId string (may be "last", "1", "2", etc.) to a concrete FFLogsFight.
 * Fetches the report's fights, then delegates selection to selectFight.
 */
export async function resolveFight(
    reportCode: string,
    fightId: string | null
): Promise<FFLogsFight> {
    const fights = await fetchFights(reportCode);
    return selectFight(fights, fightId);
}
