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

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Raw event object returned from the FFLogs GraphQL API. */
export interface FFLogsRawEvent {
    /** Milliseconds from fight start */
    timestamp: number;
    type: string;
    sourceID?: number;
    targetID?: number;
    /** Ability info (available when useAbilityIDs: false) */
    abilityGameID?: number;
    ability?: {
        name: string;
        guid: number;
        type: number;
        abilityIcon: string;
    };
    /** Damage that actually hit HP (post-mitigation, post-shield) */
    amount?: number;
    /** Full unmitigated damage (before any buffs/shields) */
    unmitigatedAmount?: number;
    /** Damage multiplier (e.g. 0.8 = 20% mitigation applied) */
    multiplier?: number;
    /** Mitigated damage portion */
    mitigated?: number;
    /** Hit type: 0=normal, 1=crit, 2=direct, 3=direct+crit */
    hitType?: number;
    /** Absorbed amount (shields) */
    absorbed?: number;
    /** Whether the hit was blocked */
    blocked?: number;
    /** packetID for deduplication */
    packetID?: number;
    /** Actor ID of the source NPC */
    sourceInstance?: number;
    targetInstance?: number;
    /** true = DoT tick (damage-over-time periodic event) */
    tick?: boolean;
}

/** Fight metadata returned from FFLogs */
export interface FFLogsFight {
    id: number;
    startTime: number;
    endTime: number;
    name: string;
    difficulty?: number;
    kill?: boolean;
}

/** Paginated events result from GraphQL */
interface ReportEvents {
    data: FFLogsRawEvent[];
    nextPageTimestamp: number | null;
}

// ─────────────────────────────────────────────────────────────
// Token Cache (session-level, not persisted)
// ─────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenExpiresAt: number = 0;

/**
 * Obtain an OAuth2 access token using the client_credentials flow.
 *
 * - Production: calls /api/fflogs/token (Vercel serverless proxy) so the
 *   client_secret is never exposed in the browser bundle.
 * - Development: falls back to VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET
 *   from .env.local for local testing convenience.
 */
export async function getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (subtract 60s for safety margin)
    if (_cachedToken && now < _tokenExpiresAt - 60_000) {
        return _cachedToken;
    }

    // ── Production: use server-side proxy ──
    if (import.meta.env.PROD) {
        const response = await fetch('/api/fflogs/token', { method: 'POST' });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`FFLogs token proxy failed (${response.status}): ${body}`);
        }

        const json = await response.json() as { access_token: string; expires_in: number };
        _cachedToken = json.access_token;
        _tokenExpiresAt = now + json.expires_in * 1000;

        return _cachedToken;
    }

    // ── Development: use env vars directly ──
    const clientId = import.meta.env.VITE_FFLOGS_CLIENT_ID as string | undefined;
    const clientSecret = import.meta.env.VITE_FFLOGS_CLIENT_SECRET as string | undefined;

    if (!clientId || !clientSecret) {
        throw new Error(
            'FFLogs API credentials are not configured.\n' +
            'Please add VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET to your .env.local file.'
        );
    }

    const response = await fetch('https://www.fflogs.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`FFLogs token request failed (${response.status}): ${body}`);
    }

    const json = await response.json() as { access_token: string; expires_in: number };
    _cachedToken = json.access_token;
    _tokenExpiresAt = now + json.expires_in * 1000;

    return _cachedToken;
}

// ─────────────────────────────────────────────────────────────
// GraphQL helper
// ─────────────────────────────────────────────────────────────

const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`FFLogs GraphQL request failed (${response.status}): ${body}`);
    }

    const json = await response.json() as { data?: T; errors?: { message: string }[] };

    if (json.errors?.length) {
        throw new Error(`FFLogs GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
        throw new Error('FFLogs GraphQL returned no data.');
    }

    return json.data;
}

// ─────────────────────────────────────────────────────────────
// Fight metadata query
// ─────────────────────────────────────────────────────────────

const FIGHTS_QUERY = /* graphql */`
  query GetFights($reportCode: String!) {
    reportData {
      report(code: $reportCode) {
        fights(killType: Kills) {
          id
          startTime
          endTime
          name
          difficulty
          kill
        }
      }
    }
  }
`;

interface FightsQueryResult {
    reportData: { report: { fights: FFLogsFight[] } };
}

/**
 * Fetch the list of fights (boss encounters) for a given report.
 * Returns fights filtered to kills only (killType: Kills in the query).
 */
export async function fetchFights(reportCode: string): Promise<FFLogsFight[]> {
    const token = await getAccessToken();
    const data = await gql<FightsQueryResult>(token, FIGHTS_QUERY, { reportCode });
    return data.reportData.report.fights;
}

// ─────────────────────────────────────────────────────────────
// Damage event query (paginated)
// ─────────────────────────────────────────────────────────────

/**
 * Build a GraphQL query for enemy damage done TO players.
 *
 * - dataType: DamageDone + hostilityType: Enemies = damage dealt by enemies
 * - useAbilityIDs: false → get full ability objects
 * - translate: when true, returns ability names in the report's native language;
 *   when false (default), returns English names.
 */
function buildDamageEventsQuery(translate: boolean): string {
    return /* graphql */`
      query GetEnemyDamageDone(
        $reportCode: String!
        $fightIds: [Int]!
        $startTime: Float!
        $endTime: Float!
      ) {
        reportData {
          report(code: $reportCode) {
            events(
              dataType: DamageDone
              fightIDs: $fightIds
              hostilityType: Enemies
              startTime: $startTime
              endTime: $endTime
              limit: 10000
              useAbilityIDs: false
              includeResources: false
              translate: ${translate}
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
}

interface EventsQueryResult {
    reportData: { report: { events: ReportEvents } };
}

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
// Death events query
// ─────────────────────────────────────────────────────────────

export interface DeathEvent {
    timestamp: number;
    targetID: number;
}

function buildDeathEventsQuery(): string {
    return /* graphql */`
      query GetDeathEvents(
        $reportCode: String!
        $fightIds: [Int]!
        $startTime: Float!
        $endTime: Float!
      ) {
        reportData {
          report(code: $reportCode) {
            events(
              dataType: Deaths
              fightIDs: $fightIds
              startTime: $startTime
              endTime: $endTime
              limit: 10000
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
}

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
// Convenience: resolve fightId string → FFLogsFight
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a fightId string (may be "last", "1", "2", etc.) to a concrete FFLogsFight.
 * Returns the last kill if fightId is null / "last".
 */
export async function resolveFight(
    reportCode: string,
    fightId: string | null
): Promise<FFLogsFight> {
    const fights = await fetchFights(reportCode);

    if (!fights.length) {
        throw new Error('No kill fights found in this report. Make sure the fight is a completed kill.');
    }

    if (!fightId || fightId === 'last') {
        // Return the last kill
        return fights[fights.length - 1];
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
