import { RAID_CONTENTS } from './contents';
import type {
    ContentCategory,
    ContentDefinition,
    ContentLevel,
    ContentSeries,
    LocalizedString,
} from '../types';
import { useMasterDataStore } from '../store/useMasterDataStore';

// ==========================================
// 静的データ（モジュール読み込み時に計算）
// ==========================================

const STATIC_CATEGORY_LABELS: Record<ContentCategory, LocalizedString> = {
    savage: { ja: '零式', en: 'Savage', zh: '零式', ko: '영식' },
    ultimate: { ja: '絶', en: 'Ultimate', zh: '绝境战', ko: '절' },
    dungeon: { ja: 'ダンジョン', en: 'Dungeon', zh: '迷宫挑战', ko: '던전' },
    raid: { ja: 'レイド', en: 'Raid', zh: '大型任务', ko: '레이드' },
    custom: { ja: 'その他', en: 'Misc', zh: '其他', ko: '기타' },
};

const STATIC_LEVEL_LABELS: Record<ContentLevel, LocalizedString> = {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)', zh: 'Lv70 (红莲)', ko: 'Lv70 (홍련)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)', zh: 'Lv80 (暗影)', ko: 'Lv80 (칠흑)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)', zh: 'Lv90 (晓月)', ko: 'Lv90 (효월)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)', zh: 'Lv100 (金曦)', ko: 'Lv100 (황금)' },
};

const STATIC_PROJECT_LABELS: Record<string, LocalizedString> = {
    'aac': { ja: '至天の座アルカディア零式', en: 'AAC', zh: '至天之座零式', ko: '지천의 좌 아르카디아 영식' },
    'pandaemonium': { ja: '万魔殿パンデモニウム零式', en: 'Pandaemonium', zh: '万魔殿零式', ko: '만마전 판데모니움 영식' },
    'eden': { ja: '希望の園エデン零式', en: 'Eden', zh: '伊甸零式', ko: '희망의 동산 에덴 영식' },
    'omega': { ja: '次元の狭間オメガ零式', en: 'Omega', zh: '欧米茄零式', ko: '차원의 틈 오메가 영식' },
};

// ==========================================
// Dynamic Series Generation Logic
// ==========================================
// Parses the prefix of the ID from RAID_CONTENTS to group floors into Series.
function getSeriesMetadata(id: string, category: ContentCategory): { seriesId: string; seriesJa: string; seriesEn: string; order: number; shortJa: string; shortEn: string } {
    if (category === 'ultimate') {
        // dsr_p1 → seriesId: "dsr", shortJa: "DSR\nP1", order: 0.1
        const baseId = id.replace(/_p\d+$/, '');
        const pMatch = id.match(/_p(\d+)$/);
        const uppercase = baseId.toUpperCase();
        if (pMatch) {
            const pNum = parseInt(pMatch[1], 10);
            return { seriesId: baseId, seriesJa: '', seriesEn: '', order: pNum * 0.1, shortJa: `${uppercase}\nP${pNum}`, shortEn: `${uppercase}\nP${pNum}` };
        }
        return { seriesId: baseId, seriesJa: '', seriesEn: '', order: 1, shortJa: uppercase, shortEn: uppercase };
    }

    // Match patterns like "m4s", "p12s_p1", "o8s_p2"
    const floorMatch = id.match(/(\d+)s(?:_p(\d+))?$/);
    let absoluteOrder = 1;
    let phaseOffset = 0;

    if (floorMatch) {
        absoluteOrder = parseInt(floorMatch[1], 10);
        if (floorMatch[2]) {
            phaseOffset = parseInt(floorMatch[2], 10) * 0.1; // e.g. .1 or .2 to maintain sorting
        }
    }

    let relativeOrder = absoluteOrder;
    let seriesInfo = { seriesId: 'misc', seriesJa: 'その他', seriesEn: 'Misc' };

    if (id.startsWith('m')) {
        if (absoluteOrder < 5) {
            seriesInfo = { seriesId: 'aac_lhw', seriesJa: 'ライトヘビー級', seriesEn: 'Light-heavyweight' };
            relativeOrder = absoluteOrder;
        } else if (absoluteOrder < 9) {
            seriesInfo = { seriesId: 'aac_cruiser', seriesJa: 'クルーザー級', seriesEn: 'Cruiserweight' };
            relativeOrder = absoluteOrder - 4;
        } else {
            seriesInfo = { seriesId: 'aac_heavy', seriesJa: 'ヘビー級', seriesEn: 'Heavyweight' };
            relativeOrder = absoluteOrder - 8;
        }
    } else if (id.startsWith('p')) {
        if (absoluteOrder <= 4) {
            seriesInfo = { seriesId: 'pandaemonium_asphodelos', seriesJa: '辺獄編', seriesEn: 'Asphodelos' };
            relativeOrder = absoluteOrder;
        } else if (absoluteOrder <= 8) {
            seriesInfo = { seriesId: 'pandaemonium_abyssos', seriesJa: '煉獄編', seriesEn: 'Abyssos' };
            relativeOrder = absoluteOrder - 4;
        } else {
            seriesInfo = { seriesId: 'pandaemonium_anabaseios', seriesJa: '天獄編', seriesEn: 'Anabaseios' };
            relativeOrder = absoluteOrder - 8;
        }
    } else if (id.startsWith('e')) {
        if (absoluteOrder <= 4) {
            seriesInfo = { seriesId: 'eden_gate', seriesJa: '覚醒編', seriesEn: 'Gate' };
            relativeOrder = absoluteOrder;
        } else if (absoluteOrder <= 8) {
            seriesInfo = { seriesId: 'eden_verse', seriesJa: '共鳴編', seriesEn: 'Verse' };
            relativeOrder = absoluteOrder - 4;
        } else {
            seriesInfo = { seriesId: 'eden_promise', seriesJa: '再生編', seriesEn: 'Promise' };
            relativeOrder = absoluteOrder - 8;
        }
    } else if (id.startsWith('o')) {
        if (absoluteOrder <= 4) {
            seriesInfo = { seriesId: 'omega_deltascape', seriesJa: 'デルタ編', seriesEn: 'Deltascape' };
            relativeOrder = absoluteOrder;
        } else if (absoluteOrder <= 8) {
            seriesInfo = { seriesId: 'omega_sigmascape', seriesJa: 'シグマ編', seriesEn: 'Sigmascape' };
            relativeOrder = absoluteOrder - 4;
        } else {
            seriesInfo = { seriesId: 'omega_alphascape', seriesJa: 'アルファ編', seriesEn: 'Alphascape' };
            relativeOrder = absoluteOrder - 8;
        }
    }

    const shortJa = Math.floor(relativeOrder) + '層' + (phaseOffset === 0.1 ? '\n前半' : phaseOffset === 0.2 ? '\n後半' : '');
    const shortEn = id.toUpperCase().replace('_', '\n').replace(' ', '\n');
    const orderForSorting = relativeOrder + phaseOffset;

    return { ...seriesInfo, order: orderForSorting, shortJa, shortEn };
}

// Map flat RawContentData into strictly-typed ContentDefinitions
const STATIC_CONTENT_DEFINITIONS: ContentDefinition[] = RAID_CONTENTS.map(rc => {
    const { seriesId, order, shortJa, shortEn } = getSeriesMetadata(rc.id, rc.category);
    return {
        id: rc.id,
        name: { ja: rc.ja, en: rc.en },
        shortName: { ja: rc.shortNameJa || shortJa, en: shortEn },
        seriesId,
        category: rc.category,
        level: rc.level,
        patch: rc.patch,
        order
    };
});

// Build unique ContentSeries parent nodes
// _p1等のサフィックスがないコンテンツの名前をシリーズ名として優先する
const seriesMap = new Map<string, ContentSeries>();
RAID_CONTENTS.forEach(rc => {
    const { seriesId, seriesJa, seriesEn } = getSeriesMetadata(rc.id, rc.category);
    const hasPhaseSuffix = /_p\d+$/.test(rc.id);
    if (!seriesMap.has(seriesId) || (!hasPhaseSuffix && seriesMap.has(seriesId))) {
        seriesMap.set(seriesId, {
            id: seriesId,
            name: rc.category === 'ultimate' ? { ja: rc.ja, en: rc.en } : { ja: seriesJa, en: seriesEn },
            category: rc.category,
            level: rc.level
        });
    }
});
const STATIC_CONTENT_SERIES: ContentSeries[] = Array.from(seriesMap.values());

// ==========================================
// 既存コードの互換性のため静的データもexport（直接参照している箇所がある）
// ==========================================
export const CONTENT_DEFINITIONS = STATIC_CONTENT_DEFINITIONS;
export const CONTENT_SERIES = STATIC_CONTENT_SERIES;
export const CATEGORY_LABELS = STATIC_CATEGORY_LABELS;
export const LEVEL_LABELS = STATIC_LEVEL_LABELS;
export const PROJECT_LABELS = STATIC_PROJECT_LABELS;

// ==========================================
// Firestore対応アクセサ（ストアにデータがあればそちらを優先）
// ==========================================

export function getContentDefinitions(): ContentDefinition[] {
    const store = useMasterDataStore.getState();
    return store.contents?.items ?? STATIC_CONTENT_DEFINITIONS;
}

function getContentSeriesList(): ContentSeries[] {
    const store = useMasterDataStore.getState();
    return store.contents?.series ?? STATIC_CONTENT_SERIES;
}

// ==========================================
// Registry Helper Functions
// ==========================================

export function getContentByLevel(level: ContentLevel): ContentDefinition[] {
    return getContentDefinitions().filter(c => c.level === level);
}

export function getSeriesByLevel(level: ContentLevel): ContentSeries[] {
    return getContentSeriesList().filter(s => s.level === level);
}

export function getContentBySeries(seriesId: string): ContentDefinition[] {
    return getContentDefinitions().filter(c => c.seriesId === seriesId).sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): ContentSeries | undefined {
    return getContentSeriesList().find(s => s.id === seriesId);
}

export function getContentById(contentId: string): ContentDefinition | undefined {
    return getContentDefinitions().find(c => c.id === contentId);
}

export function getCategoriesByLevel(_level: ContentLevel): ContentCategory[] {
    // Return all standard categories in preferred order, even if empty
    return ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
}

/**
 * Gets the project label (e.g. "至天の座アルカディア") for a given level and category.
 */
export function getProjectLabel(level: ContentLevel, category: ContentCategory): LocalizedString | null {
    if (category !== 'savage') return null;

    // Savage projects map strictly to levels
    const levelToProjectKey: Record<number, string> = {
        100: 'aac',
        90: 'pandaemonium',
        80: 'eden',
        70: 'omega'
    };

    const key = levelToProjectKey[level];
    return key ? PROJECT_LABELS[key] : null;
}

// ==========================================
// Firestore対応ラベルアクセサ（新規export）
// ==========================================

export function getCategoryLabel(category: ContentCategory): LocalizedString {
    const store = useMasterDataStore.getState();
    return store.config?.categoryLabels?.[category] ?? STATIC_CATEGORY_LABELS[category];
}

export function getLevelLabel(level: ContentLevel): LocalizedString {
    const store = useMasterDataStore.getState();
    return store.config?.levelLabels?.[level] ?? STATIC_LEVEL_LABELS[level];
}
