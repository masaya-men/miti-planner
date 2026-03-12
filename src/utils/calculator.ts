import type { PartyMember } from '../types';
import { LEVEL_MODIFIERS, type LevelModifier } from '../data/levelModifiers';

const TRAIT_MOD = 1.3; // Maim and Mend II etc.

interface StatInput {
    mainStat: number; // STR or MND
    det: number;
    crt: number;
    ten: number;
    ss: number;
    wd: number;
    jobMod?: number; // Job specific Main Stat modifier
}

// Math.floor logic for FF14 (truncates to integer)
const floor = Math.floor;

// Helper for column widths
export const getColumnWidth = (role: string) => {
    if (role === 'tank' || role === 'healer') return 125; // 25px * 5 slots
    return 50; // 25px * 2 slots for DPS
};

/**
 * Calculates the function f(POT) - Potency Multiplier (always 1 for base calcs, but conceptually exists)
 */

/**
 * Calculates f(WD) - Weapon Damage Multiplier
 */
const getWdMultiplier = (wd: number, modifiers: LevelModifier, jobMod: number = 115): number => {
    const base = floor((modifiers.main * jobMod) / 1000) + wd;
    return base / 100;
};

/**
 * Calculates f(STR) or f(MND) - Main Stat Multiplier
 */
const getMainStatMultiplier = (mainStat: number, modifiers: LevelModifier): number => {
    const val = floor(100 * (mainStat - modifiers.main) / 268);
    return (100 + val) / 100;
};

/**
 * Calculates f(DET) - Determination Multiplier
 */
const getDetMultiplier = (det: number, modifiers: LevelModifier): number => {
    const val = floor(140 * (det - modifiers.main) / modifiers.div);
    return (1000 + val) / 1000;
};

/**
 * Calculates f(TNC) - Tenacity Multiplier
 */
const getTenMultiplier = (ten: number, modifiers: LevelModifier): number => {
    const val = floor(100 * (ten - modifiers.sub) / modifiers.div);
    return (1000 + val) / 1000;
};

/**
 * Calculates f(CRIT) - Critical Hit Multiplier (for expected value?)
 * For base heal, we generally don't include crit unless checking "Crit Heal".
 * We'll define it but maybe not use it for "Base" output.
 */
// const getCritMultiplier = (crt: number): number => {
//     // Formula: ( 1400 + floor( 200 * (crt - LevelModSub) / LevelModDiv ) ) / 1000
//     const val = floor(200 * (crt - LEVEL_MOD_SUB) / LEVEL_MOD_DIV);
//     return (1400 + val) / 1000;
// };

/**
 * Calculate Base Heal / Shield Value
 * potency: Skill potency (e.g. 300)
 */
export const calculatePotencyValue = (input: StatInput, potency: number, roleOrIsTank: string | boolean = false, modifiers: LevelModifier): number => {
    // const fPot = potency / 100;
    const isTank = typeof roleOrIsTank === 'string' ? roleOrIsTank === 'tank' : roleOrIsTank;

    const fWd = getWdMultiplier(input.wd, modifiers);
    const fMain = getMainStatMultiplier(input.mainStat, modifiers);
    const fDet = getDetMultiplier(input.det, modifiers);
    const fTnc = isTank ? getTenMultiplier(input.ten, modifiers) : 1;
    const fTrait = TRAIT_MOD; // 1.3 for healers usually

    // Formula sequence:
    // 1. Base = floor( Potency * f(Main) * f(Det) ) / 100   <-- Wait, standard structure is slightly different
    // Standard Damage:
    // D1 = floor( floor( floor( Potency * f(Main) * f(Det) ) / 100 ) / 1000 )
    // D2 = floor( D1 * f(Tnc) ) / 1000
    // D3 = floor( D2 * f(WD) ) / 100
    // D4 = floor( D3 * f(Trait) ) / 100

    // Let's approximate since we need a "Good Enough" simulation for now.
    // Value = Potency * fMain * fDet * fTnc * fWd * fTrait

    // Strict order (approx):
    // 1. Math.floor(potency * fMain * fDet) / 100
    // const step1 = floor(floor(floor(potency * fMain * 100) * fDet) / 100); // *100 to handle float? No, multipliers are 1.xxx

    // Re-evaluating multipliers:
    // mainStatMult is 1.23 (example)
    // detMult is 1.10 (example)
    // wdMult is 1.50 (example)

    // Better Formula (Allagan Studies style):
    // D1 = floor( floor( floor( Potency * fMain ) * fDet ) / 100 )  / 1000 
    // We need integer math steps.

    // Let's use a simpler float calc for the first MVP to verify UI:
    let val = potency;
    val *= fMain;
    val *= fDet;
    val *= fTnc;
    val *= fWd;
    val *= fTrait;

    return floor(val);
};

/**
 * Calculate Critical Heal / Shield Value
 * Applies critical multiplier to the base value
 */
export const calculateCriticalValue = (baseValue: number): number => {
    // Spec: Barrier = Math.floor( Barrier * CriticalMultiplier )
    // Multiplier approx 1.60 for now (User's values align with ~1.6)
    return floor(baseValue * CRIT_MULTIPLIER);
};

export const calculateHpValue = (hp: number, percent: number): number => {
    // Spec: Wrapper for floor(hp * percent)
    return floor(hp * (percent / 100));
};

export const CRIT_MULTIPLIER = 1.60;


export const SKILL_DATA = {
    // --- Paladin ---
    "ディヴァインヴェール": { "percent": 10, "type": "hp", "jobs": ["pld"], "icon": "Divine_Veil.png", "nameEn": "Divine Veil" },

    // --- Pictomancer ---
    "テンペラグラッサ": { "percent": 10, "type": "hp", "jobs": ["pct"], "icon": "Tempera_Grassa.png", "nameEn": "Tempera Grassa" },

    // --- Dark Knight ---
    "ブラックナイト": { "percent": 25, "type": "hp", "jobs": ["drk"], "icon": "The_Blackest_Night.png", "nameEn": "The Blackest Night" },

    // --- Scholar ---
    // Note: CSV lists Accession, Concitation, Consolation, Adloquium
    "アクセッション": { "potency": 240, "type": "potency", "multiplier": 1.8, "jobs": ["sch"], "icon": "Accession.png", "nameEn": "Accession" },
    "意気軒高の策": { "potency": 200, "type": "potency", "multiplier": 1.8, "jobs": ["sch"], "icon": "Concitation.png", "nameEn": "Concitation" },
    "コンソレイション": { "potency": 250, "type": "potency", "multiplier": 1, "jobs": ["sch"], "icon": "Consolation.png", "nameEn": "Consolation" },
    "鼓舞激励の策": { "potency": 300, "type": "potency", "multiplier": 1.8, "jobs": ["sch"], "icon": "Adloquium.png", "nameEn": "Adloquium" },
    "展開戦術": { "jobs": ["sch"], "type": "special", "note": "鼓舞の1.6倍", "icon": "Deployment_Tactics.png", "nameEn": "Deployment Tactics" }, // Custom handling logic needed
    "秘策：展開戦術": { "potency": 300, "type": "potency", "multiplier": 2.88, "jobs": ["sch"], "icon": "Deployment_Tactics.png", "nameEn": "Recitation Deployment" }, // 300 * 1.6 (Crit) * 1.8 (Galvanize) = 864 (2.88x)

    // --- Sage ---
    "エウクラシア・プログノシスII": { "potency": 100, "type": "potency", "multiplier": 3.6, "jobs": ["sge"], "icon": "Eukrasian_Prognosis_II.png", "nameEn": "Eukrasian Prognosis II" },
    "ホーリズム": { "potency": 300, "type": "potency", "multiplier": 1, "jobs": ["sge"], "icon": "Holos.png", "nameEn": "Holos" },
    "パンハイマ": { "potency": 200, "type": "potency", "multiplier": 1, "jobs": ["sge"], "icon": "Panhaima.png", "nameEn": "Panhaima" },

    // --- Warrior ---
    "原初の血気": { "potency": 400, "type": "potency", "multiplier": 1, "jobs": ["war"], "icon": "Bloodwhetting.png", "nameEn": "Bloodwhetting" },
    "シェイクオフ": { "percent": 15, "type": "hp", "jobs": ["war"], "icon": "Shake_It_Off.png", "nameEn": "Shake It Off" },
    "原初の猛り": { "potency": 400, "type": "potency", "multiplier": 1, "jobs": ["war"], "icon": "Nascent_Flash.png", "nameEn": "Nascent Flash" },

    // --- White Mage ---
    "ディヴァインカレス": { "potency": 400, "type": "potency", "multiplier": 1, "jobs": ["whm"], "icon": "Divine_Caress.png", "nameEn": "Divine Caress" },

    // --- Dancer ---
    "インプロビゼーション": { "percent": 5, "type": "hp", "jobs": ["dnc"], "icon": "Improvisation.png", "nameEn": "Improvisation" },

    // --- Astrologian ---
    "コンジャンクション・ヘリオス": { "potency": 250, "type": "potency", "multiplier": 1.25, "jobs": ["ast"], "icon": "Helios_Conjunction.png", "nameEn": "Helios Conjunction" },

    // --- Others from CSV ---
    // e.g. Divine Veil (listed above), Tempera Grassa (above), TBN (above)

    // Keeping "Legacy" or "Hidden" entries as safeguards if needed, or if referenced by name in mockData that differs?
    // CSV Names seem to match keys used here.
};

// Test constants export (will be removed in phase 3)
export const CONSTANTS = {
    // Leaving placeholder for any test passing for now
};

export const calculateMemberValues = (member: PartyMember, currentLevel: number = 100): Record<string, number> => {
    const results: Record<string, number> = {};
    const modifiers = LEVEL_MODIFIERS[currentLevel] || LEVEL_MODIFIERS[100];

    Object.entries(SKILL_DATA).forEach(([name, data]: [string, any]) => {
        if (data.type === 'hp') {
            if (data.percent) results[name] = calculateHpValue(member.stats.hp, data.percent);
        } else if (data.type === 'potency') {
            if (data.potency) {
                let val = calculatePotencyValue(member.stats, data.potency, member.role, modifiers);
                if (data.multiplier) val = Math.floor(val * data.multiplier);
                results[name] = val;
            }
        }
    });
    return results;
};
