// ─────────────────────────────────────────────
// Content Registry — Master Data
// ─────────────────────────────────────────────
// All high-end content for Lv70–100.
//
// To add new content:
//   1. Add a ContentSeries entry to CONTENT_SERIES
//   2. Add ContentDefinition entries to CONTENT_DEFINITIONS
//      with matching seriesId
//   3. Data will automatically appear in the Sidebar
//
// ─────────────────────────────────────────────

import type {
    ContentCategory,
    ContentDefinition,
    ContentLevel,
    ContentSeries,
    LocalizedString,
} from '../types';

// ─────────────────────────────────────────────
// Category Labels (for UI display)
// ─────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ContentCategory, LocalizedString> = {
    extreme: { ja: '極', en: 'Extreme' },
    savage: { ja: '零式', en: 'Savage' },
    chaotic: { ja: 'ヴァリアントD', en: 'Chaotic' },
    ultimate: { ja: '絶', en: 'Ultimate' },
    raid: { ja: '大人数コンテンツ', en: 'Large-Scale' },
    custom: { ja: 'カスタム', en: 'Custom' },
};

export const LEVEL_LABELS: Record<ContentLevel, LocalizedString> = {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)' },
};

// ─────────────────────────────────────────────
// Series Definitions
// ─────────────────────────────────────────────

export const CONTENT_SERIES: ContentSeries[] = [
    // ────── Lv100 ──────
    {
        id: 'aac_lhw',
        name: { ja: 'AAC ライトヘビー級', en: 'AAC Light Heavyweight' },
        category: 'savage',
        level: 100,
    },
    {
        id: 'fru',
        name: { ja: '絶もう一つの未来', en: 'Futures Rewritten (Ultimate)' },
        category: 'ultimate',
        level: 100,
    },

    // ────── Lv90 ──────
    {
        id: 'pandaemonium_asphodelos',
        name: { ja: '万魔殿パンデモニウム：辺獄編', en: 'Pandaemonium: Asphodelos' },
        category: 'savage',
        level: 90,
    },
    {
        id: 'pandaemonium_abyssos',
        name: { ja: '万魔殿パンデモニウム：煉獄編', en: 'Pandaemonium: Abyssos' },
        category: 'savage',
        level: 90,
    },
    {
        id: 'pandaemonium_anabaseios',
        name: { ja: '万魔殿パンデモニウム：天獄編', en: 'Pandaemonium: Anabaseios' },
        category: 'savage',
        level: 90,
    },
    {
        id: 'top',
        name: { ja: '絶オメガ検証戦', en: 'The Omega Protocol (Ultimate)' },
        category: 'ultimate',
        level: 90,
    },
    {
        id: 'dsr',
        name: { ja: '絶竜詩戦争', en: 'Dragonsong\'s Reprise (Ultimate)' },
        category: 'ultimate',
        level: 90,
    },

    // ────── Lv80 ──────
    {
        id: 'eden_promise',
        name: { ja: '希望の園エデン：再生編', en: 'Eden\'s Promise' },
        category: 'savage',
        level: 80,
    },
    {
        id: 'eden_verse',
        name: { ja: '希望の園エデン：共鳴編', en: 'Eden\'s Verse' },
        category: 'savage',
        level: 80,
    },
    {
        id: 'eden_gate',
        name: { ja: '希望の園エデン：覚醒編', en: 'Eden\'s Gate' },
        category: 'savage',
        level: 80,
    },
    {
        id: 'tea',
        name: { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander (Ultimate)' },
        category: 'ultimate',
        level: 80,
    },

    // ────── Lv70 ──────
    {
        id: 'omega_alphascape',
        name: { ja: '次元の狭間オメガ：アルファ編', en: 'Omega: Alphascape' },
        category: 'savage',
        level: 70,
    },
    {
        id: 'omega_sigmascape',
        name: { ja: '次元の狭間オメガ：シグマ編', en: 'Omega: Sigmascape' },
        category: 'savage',
        level: 70,
    },
    {
        id: 'omega_deltascape',
        name: { ja: '次元の狭間オメガ：デルタ編', en: 'Omega: Deltascape' },
        category: 'savage',
        level: 70,
    },
    {
        id: 'ucob',
        name: { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut (Ultimate)' },
        category: 'ultimate',
        level: 70,
    },
    {
        id: 'uwu',
        name: { ja: '絶アルテマウェポン破壊作戦', en: 'The Weapon\'s Refrain (Ultimate)' },
        category: 'ultimate',
        level: 70,
    },
];

// ─────────────────────────────────────────────
// Content (Floor / Boss) Definitions
// ─────────────────────────────────────────────

export const CONTENT_DEFINITIONS: ContentDefinition[] = [
    // ────── Lv100: AAC Light Heavyweight (Savage) ──────
    { id: 'aac_lhw_m1s', name: { ja: 'AAC ライトヘビー級1', en: 'AAC LHW M1S' }, shortName: { ja: '1層', en: 'M1S' }, seriesId: 'aac_lhw', category: 'savage', level: 100, order: 1 },
    { id: 'aac_lhw_m2s', name: { ja: 'AAC ライトヘビー級2', en: 'AAC LHW M2S' }, shortName: { ja: '2層', en: 'M2S' }, seriesId: 'aac_lhw', category: 'savage', level: 100, order: 2 },
    { id: 'aac_lhw_m3s', name: { ja: 'AAC ライトヘビー級3', en: 'AAC LHW M3S' }, shortName: { ja: '3層', en: 'M3S' }, seriesId: 'aac_lhw', category: 'savage', level: 100, order: 3 },
    { id: 'aac_lhw_m4s', name: { ja: 'AAC ライトヘビー級4', en: 'AAC LHW M4S' }, shortName: { ja: '4層', en: 'M4S' }, seriesId: 'aac_lhw', category: 'savage', level: 100, order: 4 },

    // ────── Lv100: FRU (Ultimate) ──────
    { id: 'fru', name: { ja: '絶もう一つの未来', en: 'Futures Rewritten (Ultimate)' }, shortName: { ja: 'FRU', en: 'FRU' }, seriesId: 'fru', category: 'ultimate', level: 100, order: 1 },

    // ────── Lv90: Asphodelos (Savage) ──────
    { id: 'p1s', name: { ja: '辺獄編1', en: 'Asphodelos P1S' }, shortName: { ja: '1層', en: 'P1S' }, seriesId: 'pandaemonium_asphodelos', category: 'savage', level: 90, order: 1 },
    { id: 'p2s', name: { ja: '辺獄編2', en: 'Asphodelos P2S' }, shortName: { ja: '2層', en: 'P2S' }, seriesId: 'pandaemonium_asphodelos', category: 'savage', level: 90, order: 2 },
    { id: 'p3s', name: { ja: '辺獄編3', en: 'Asphodelos P3S' }, shortName: { ja: '3層', en: 'P3S' }, seriesId: 'pandaemonium_asphodelos', category: 'savage', level: 90, order: 3 },
    { id: 'p4s', name: { ja: '辺獄編4', en: 'Asphodelos P4S' }, shortName: { ja: '4層', en: 'P4S' }, seriesId: 'pandaemonium_asphodelos', category: 'savage', level: 90, order: 4 },

    // ────── Lv90: Abyssos (Savage) ──────
    { id: 'p5s', name: { ja: '煉獄編1', en: 'Abyssos P5S' }, shortName: { ja: '1層', en: 'P5S' }, seriesId: 'pandaemonium_abyssos', category: 'savage', level: 90, order: 1 },
    { id: 'p6s', name: { ja: '煉獄編2', en: 'Abyssos P6S' }, shortName: { ja: '2層', en: 'P6S' }, seriesId: 'pandaemonium_abyssos', category: 'savage', level: 90, order: 2 },
    { id: 'p7s', name: { ja: '煉獄編3', en: 'Abyssos P7S' }, shortName: { ja: '3層', en: 'P7S' }, seriesId: 'pandaemonium_abyssos', category: 'savage', level: 90, order: 3 },
    { id: 'p8s', name: { ja: '煉獄編4', en: 'Abyssos P8S' }, shortName: { ja: '4層', en: 'P8S' }, seriesId: 'pandaemonium_abyssos', category: 'savage', level: 90, order: 4 },

    // ────── Lv90: Anabaseios (Savage) ──────
    { id: 'p9s', name: { ja: '天獄編1', en: 'Anabaseios P9S' }, shortName: { ja: '1層', en: 'P9S' }, seriesId: 'pandaemonium_anabaseios', category: 'savage', level: 90, order: 1 },
    { id: 'p10s', name: { ja: '天獄編2', en: 'Anabaseios P10S' }, shortName: { ja: '2層', en: 'P10S' }, seriesId: 'pandaemonium_anabaseios', category: 'savage', level: 90, order: 2 },
    { id: 'p11s', name: { ja: '天獄編3', en: 'Anabaseios P11S' }, shortName: { ja: '3層', en: 'P11S' }, seriesId: 'pandaemonium_anabaseios', category: 'savage', level: 90, order: 3 },
    { id: 'p12s', name: { ja: '天獄編4', en: 'Anabaseios P12S' }, shortName: { ja: '4層', en: 'P12S' }, seriesId: 'pandaemonium_anabaseios', category: 'savage', level: 90, order: 4 },

    // ────── Lv90: Ultimates ──────
    { id: 'top', name: { ja: '絶オメガ検証戦', en: 'The Omega Protocol (Ultimate)' }, shortName: { ja: 'TOP', en: 'TOP' }, seriesId: 'top', category: 'ultimate', level: 90, order: 1 },
    { id: 'dsr', name: { ja: '絶竜詩戦争', en: 'Dragonsong\'s Reprise (Ultimate)' }, shortName: { ja: 'DSR', en: 'DSR' }, seriesId: 'dsr', category: 'ultimate', level: 90, order: 1 },

    // ────── Lv80: Eden's Promise (Savage) ──────
    { id: 'e9s', name: { ja: '再生編1', en: 'Eden\'s Promise E9S' }, shortName: { ja: '1層', en: 'E9S' }, seriesId: 'eden_promise', category: 'savage', level: 80, order: 1 },
    { id: 'e10s', name: { ja: '再生編2', en: 'Eden\'s Promise E10S' }, shortName: { ja: '2層', en: 'E10S' }, seriesId: 'eden_promise', category: 'savage', level: 80, order: 2 },
    { id: 'e11s', name: { ja: '再生編3', en: 'Eden\'s Promise E11S' }, shortName: { ja: '3層', en: 'E11S' }, seriesId: 'eden_promise', category: 'savage', level: 80, order: 3 },
    { id: 'e12s', name: { ja: '再生編4', en: 'Eden\'s Promise E12S' }, shortName: { ja: '4層', en: 'E12S' }, seriesId: 'eden_promise', category: 'savage', level: 80, order: 4 },

    // ────── Lv80: Eden's Verse (Savage) ──────
    { id: 'e5s', name: { ja: '共鳴編1', en: 'Eden\'s Verse E5S' }, shortName: { ja: '1層', en: 'E5S' }, seriesId: 'eden_verse', category: 'savage', level: 80, order: 1 },
    { id: 'e6s', name: { ja: '共鳴編2', en: 'Eden\'s Verse E6S' }, shortName: { ja: '2層', en: 'E6S' }, seriesId: 'eden_verse', category: 'savage', level: 80, order: 2 },
    { id: 'e7s', name: { ja: '共鳴編3', en: 'Eden\'s Verse E7S' }, shortName: { ja: '3層', en: 'E7S' }, seriesId: 'eden_verse', category: 'savage', level: 80, order: 3 },
    { id: 'e8s', name: { ja: '共鳴編4', en: 'Eden\'s Verse E8S' }, shortName: { ja: '4層', en: 'E8S' }, seriesId: 'eden_verse', category: 'savage', level: 80, order: 4 },

    // ────── Lv80: Eden's Gate (Savage) ──────
    { id: 'e1s', name: { ja: '覚醒編1', en: 'Eden\'s Gate E1S' }, shortName: { ja: '1層', en: 'E1S' }, seriesId: 'eden_gate', category: 'savage', level: 80, order: 1 },
    { id: 'e2s', name: { ja: '覚醒編2', en: 'Eden\'s Gate E2S' }, shortName: { ja: '2層', en: 'E2S' }, seriesId: 'eden_gate', category: 'savage', level: 80, order: 2 },
    { id: 'e3s', name: { ja: '覚醒編3', en: 'Eden\'s Gate E3S' }, shortName: { ja: '3層', en: 'E3S' }, seriesId: 'eden_gate', category: 'savage', level: 80, order: 3 },
    { id: 'e4s', name: { ja: '覚醒編4', en: 'Eden\'s Gate E4S' }, shortName: { ja: '4層', en: 'E4S' }, seriesId: 'eden_gate', category: 'savage', level: 80, order: 4 },

    // ────── Lv80: TEA (Ultimate) ──────
    { id: 'tea', name: { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander (Ultimate)' }, shortName: { ja: 'TEA', en: 'TEA' }, seriesId: 'tea', category: 'ultimate', level: 80, order: 1 },

    // ────── Lv70: Alphascape (Savage) ──────
    { id: 'o9s', name: { ja: 'アルファ編1', en: 'Alphascape O9S' }, shortName: { ja: '1層', en: 'O9S' }, seriesId: 'omega_alphascape', category: 'savage', level: 70, order: 1 },
    { id: 'o10s', name: { ja: 'アルファ編2', en: 'Alphascape O10S' }, shortName: { ja: '2層', en: 'O10S' }, seriesId: 'omega_alphascape', category: 'savage', level: 70, order: 2 },
    { id: 'o11s', name: { ja: 'アルファ編3', en: 'Alphascape O11S' }, shortName: { ja: '3層', en: 'O11S' }, seriesId: 'omega_alphascape', category: 'savage', level: 70, order: 3 },
    { id: 'o12s', name: { ja: 'アルファ編4', en: 'Alphascape O12S' }, shortName: { ja: '4層', en: 'O12S' }, seriesId: 'omega_alphascape', category: 'savage', level: 70, order: 4 },

    // ────── Lv70: Sigmascape (Savage) ──────
    { id: 'o5s', name: { ja: 'シグマ編1', en: 'Sigmascape O5S' }, shortName: { ja: '1層', en: 'O5S' }, seriesId: 'omega_sigmascape', category: 'savage', level: 70, order: 1 },
    { id: 'o6s', name: { ja: 'シグマ編2', en: 'Sigmascape O6S' }, shortName: { ja: '2層', en: 'O6S' }, seriesId: 'omega_sigmascape', category: 'savage', level: 70, order: 2 },
    { id: 'o7s', name: { ja: 'シグマ編3', en: 'Sigmascape O7S' }, shortName: { ja: '3層', en: 'O7S' }, seriesId: 'omega_sigmascape', category: 'savage', level: 70, order: 3 },
    { id: 'o8s', name: { ja: 'シグマ編4', en: 'Sigmascape O8S' }, shortName: { ja: '4層', en: 'O8S' }, seriesId: 'omega_sigmascape', category: 'savage', level: 70, order: 4 },

    // ────── Lv70: Deltascape (Savage) ──────
    { id: 'o1s', name: { ja: 'デルタ編1', en: 'Deltascape O1S' }, shortName: { ja: '1層', en: 'O1S' }, seriesId: 'omega_deltascape', category: 'savage', level: 70, order: 1 },
    { id: 'o2s', name: { ja: 'デルタ編2', en: 'Deltascape O2S' }, shortName: { ja: '2層', en: 'O2S' }, seriesId: 'omega_deltascape', category: 'savage', level: 70, order: 2 },
    { id: 'o3s', name: { ja: 'デルタ編3', en: 'Deltascape O3S' }, shortName: { ja: '3層', en: 'O3S' }, seriesId: 'omega_deltascape', category: 'savage', level: 70, order: 3 },
    { id: 'o4s', name: { ja: 'デルタ編4', en: 'Deltascape O4S' }, shortName: { ja: '4層', en: 'O4S' }, seriesId: 'omega_deltascape', category: 'savage', level: 70, order: 4 },

    // ────── Lv70: Ultimates ──────
    { id: 'ucob', name: { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut (Ultimate)' }, shortName: { ja: 'UCoB', en: 'UCoB' }, seriesId: 'ucob', category: 'ultimate', level: 70, order: 1 },
    { id: 'uwu', name: { ja: '絶アルテマウェポン破壊作戦', en: 'The Weapon\'s Refrain (Ultimate)' }, shortName: { ja: 'UWU', en: 'UWU' }, seriesId: 'uwu', category: 'ultimate', level: 70, order: 1 },
];

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

/** Get all content for a specific level tier */
export function getContentByLevel(level: ContentLevel): ContentDefinition[] {
    return CONTENT_DEFINITIONS.filter(c => c.level === level);
}

/** Get all series for a specific level tier */
export function getSeriesByLevel(level: ContentLevel): ContentSeries[] {
    return CONTENT_SERIES.filter(s => s.level === level);
}

/** Get all content within a specific series */
export function getContentBySeries(seriesId: string): ContentDefinition[] {
    return CONTENT_DEFINITIONS.filter(c => c.seriesId === seriesId).sort((a, b) => a.order - b.order);
}

/** Get a series by its ID */
export function getSeriesById(seriesId: string): ContentSeries | undefined {
    return CONTENT_SERIES.find(s => s.id === seriesId);
}

/** Get a content definition by its ID */
export function getContentById(contentId: string): ContentDefinition | undefined {
    return CONTENT_DEFINITIONS.find(c => c.id === contentId);
}

/** Get all unique categories available for a level */
export function getCategoriesByLevel(level: ContentLevel): ContentCategory[] {
    const categories = new Set(CONTENT_SERIES.filter(s => s.level === level).map(s => s.category));
    // Sort in display order
    const order: ContentCategory[] = ['savage', 'ultimate', 'extreme', 'chaotic', 'raid'];
    return order.filter(c => categories.has(c));
}
