export interface Job {
    id: string;
    name: string;
    nameEn?: string;
    role: 'tank' | 'healer' | 'dps';
    icon: string;
}

export interface Mitigation {
    id: string;
    jobId: string;
    name: string;
    nameEn?: string;
    icon: string;
    cooldown: number; // in seconds
    duration: number; // in seconds
    recast?: number; // Optional override or default logic
    type: 'magical' | 'physical' | 'all';
    value: number; // percentage (e.g., 10 for 10%)
    valuePhysical?: number; // Optional override for Physical specific value
    valueMagical?: number; // Optional override for Magical specific value
    isShield?: boolean;
    note?: string; // Optional description/details
    scope?: 'self' | 'party'; // Scope of the mitigation
    isInvincible?: boolean; // Damages becomes 0
    healingIncrease?: number; // Healing potency increase (e.g. 10 for 10%)
    requires?: string; // Prerequisite mitigation ID that must be active
    resourceCost?: { type: 'aetherflow' | 'addersgall'; amount: number };
    maxCharges?: number; // For charge-based skills (e.g. Oblation=2, Consolation=2, Sun Sign=1)
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
    name: string;
    nameEn?: string;
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    damageAmount?: number;
    target?: 'AoE' | 'MT' | 'ST';
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
