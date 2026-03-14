export type LocalizedString = {
    ja: string;
    en: string;
};

export interface Job {
    id: string;
    name: LocalizedString;
    role: 'tank' | 'healer' | 'dps';
    icon: string;
}

export interface Mitigation {
    id: string;
    jobId: string;
    name: LocalizedString;
    icon: string;
    recast: number; // in seconds
    duration: number; // in seconds
    type: 'magical' | 'physical' | 'all';
    value: number; // percentage (e.g., 10 for 10%)
    valuePhysical?: number; // Optional override for Physical specific value
    valueMagical?: number; // Optional override for Magical specific value
    isShield?: boolean;
    valueType?: 'hp' | 'potency';
    shieldPotency?: number; // Added for recovery-based shields
    shieldScale?: string;   // Added for HP-based shields (e.g., "10% HP")
    minLevel?: number;      // Added for level sync
    maxLevel?: number;      // Added for level sync
    note?: string; // Optional description/details
    scope?: 'self' | 'party' | 'target'; // Scope of the mitigation
    isInvincible?: boolean; // Damages becomes 0
    healingIncrease?: number; // Healing potency increase (e.g. 10 for 10%)
    healingIncreaseSelfOnly?: boolean; // If true, only applies to the caster's own heals (e.g. Dissipation, Neutral Sect)
    requires?: string; // Prerequisite mitigation ID that must be active
    resourceCost?: { type: 'aetherflow' | 'addersgall'; amount: number };
    maxCharges?: number; // For charge-based skills (e.g. Oblation=2, Consolation=2, Sun Sign=1)
    family?: string; // Compatibility family for job migration mappings
    stacks?: number; // Max stacks for multi-layer barriers (e.g. Haima=5)
    reapplyOnAbsorption?: boolean; // If true, shield reapplies using a stack when broken
    onExpiryHealingPotency?: number; // Healing per remaining stack when duration expires
    burstValue?: number; // Additional mitigation % during initial burst window (e.g., 10 for extra 10%)
    burstDuration?: number; // Duration in seconds for the burst mitigation window (e.g., 4)
    hidden?: boolean; // If true, the mitigation is not shown in the selector modal
}

export interface AppliedMitigation {
    id: string;
    mitigationId: string;
    time: number;
    duration: number; // Snapshot of duration at application time
    ownerId: string; // Party Member ID (e.g. "MT")
    targetId?: string; // Party Member ID of the target (e.g. "ST") for single-target buffs
}

export interface TimelineEvent {
    id: string;
    time: number; // seconds from start
    name: LocalizedString;
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    damageAmount?: number;
    target?: 'AoE' | 'MT' | 'ST';
    warning?: boolean; // Indicates mitigation is insufficient
}

export interface Phase {
    id: string;
    name: string;
    endTime: number;
}

export interface PlayerStats {
    hp: number;
    mainStat: number; // STR or MND
    det: number;
    crt: number;
    ten: number;
    ss: number;
    wd: number;
}

export type Role = 'tank' | 'healer' | 'dps';

export interface PartyMember {
    id: string; // "MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"
    jobId: string | null; // Nullable if not selected
    role: Role;
    stats: PlayerStats;
    computedValues: Record<string, number>; // "Adloquium": 5000, "TBN": 30000
}

// ─────────────────────────────────────────────
// Content Registry Types
// ─────────────────────────────────────────────

/** Content difficulty category */
export type ContentCategory =
    | 'savage'    // 零式
    | 'dungeon'   // ダンジョン
    | 'ultimate'  // 絶
    | 'raid'      // 大人数コンテンツ
    | 'custom';   // ユーザー自作

/** Supported level tiers */
export type ContentLevel = 70 | 80 | 90 | 100;

/** A single piece of content (boss / floor) */
export interface ContentDefinition {
    /** Unique ID (e.g. 'aac_lhw_m4s') */
    id: string;
    /** Boss / floor name */
    name: LocalizedString;
    /** Short name for sidebar display */
    shortName: LocalizedString;
    /** Parent series ID */
    seriesId: string;
    /** Difficulty category */
    category: ContentCategory;
    /** Level tier */
    level: ContentLevel;
    /** Patch introduced */
    patch: string;
    /** Sort order within series (1-based) */
    order: number;
}

/** A series grouping multiple floors/bosses */
export interface ContentSeries {
    /** Unique ID (e.g. 'aac_lhw') */
    id: string;
    /** Series display name */
    name: LocalizedString;
    /** Difficulty category */
    category: ContentCategory;
    /** Level tier */
    level: ContentLevel;
}
