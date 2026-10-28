/** FFLogs API v2 の型定義(src/api/fflogs.ts から分離)。 */

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
    encounterID?: number;
    phaseTransitions?: { id: number; startTime: number }[];
    /** report.phasesから紐付けたフェーズ名 */
    phaseNames?: { id: number; name: string }[];
}

/** Paginated events result from GraphQL */
export interface ReportEvents {
    data: FFLogsRawEvent[];
    nextPageTimestamp: number | null;
}

export interface FightsQueryResult {
    reportData: {
        report: {
            fights: FFLogsFight[];
            phases?: { encounterID: number; phases: { id: number; name: string }[] }[];
        };
    };
}

export interface EventsQueryResult {
    reportData: { report: { events: ReportEvents } };
}

export interface DeathEvent {
    timestamp: number;
    targetID: number;
}

interface PlayerInfo {
    id: number;
    name: string;
    type: string;
}

export interface PlayerDetails {
    tanks: PlayerInfo[];
    healers: PlayerInfo[];
    dps: PlayerInfo[];
}

export interface PlayerDetailsQueryResult {
    reportData: { report: { playerDetails: PlayerDetails } };
}
