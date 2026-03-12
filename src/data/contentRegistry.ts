import { RAID_CONTENTS } from './contents';
import type {
    ContentCategory,
    ContentDefinition,
    ContentLevel,
    ContentSeries,
    LocalizedString,
} from '../types';

export const CATEGORY_LABELS: Record<ContentCategory, LocalizedString> = {
    savage: { ja: '零式', en: 'Savage' },
    ultimate: { ja: '絶', en: 'Ultimate' },
    dungeon: { ja: 'ダンジョン', en: 'Dungeon' },
    raid: { ja: 'レイド', en: 'Raid' },
    custom: { ja: 'その他', en: 'Misc' },
};

export const LEVEL_LABELS: Record<ContentLevel, LocalizedString> = {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)' },
};

export const PROJECT_LABELS: Record<string, LocalizedString> = {
    'aac': { ja: '至天の座アルカディア零式', en: 'AAC' },
    'pandaemonium': { ja: '万魔殿パンデモニウム零式', en: 'Pandaemonium' },
    'eden': { ja: '希望の園エデン零式', en: 'Eden' },
    'omega': { ja: '次元の狭間オメガ零式', en: 'Omega' },
};

// ==========================================
// Dynamic Series Generation Logic
// ==========================================
// Parses the prefix of the ID from RAID_CONTENTS to group floors into Series.
function getSeriesMetadata(id: string, category: ContentCategory): { seriesId: string; seriesJa: string; seriesEn: string; order: number; shortJa: string; shortEn: string } {
    if (category === 'ultimate') {
        const uppercase = id.toUpperCase();
        return { seriesId: id, seriesJa: '', seriesEn: '', order: 1, shortJa: uppercase, shortEn: uppercase };
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
export const CONTENT_DEFINITIONS: ContentDefinition[] = RAID_CONTENTS.map(rc => {
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
const seriesMap = new Map<string, ContentSeries>();
RAID_CONTENTS.forEach(rc => {
    const { seriesId, seriesJa, seriesEn } = getSeriesMetadata(rc.id, rc.category);
    if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, {
            id: seriesId,
            name: rc.category === 'ultimate' ? { ja: rc.ja, en: rc.en } : { ja: seriesJa, en: seriesEn },
            category: rc.category,
            level: rc.level
        });
    }
});
export const CONTENT_SERIES: ContentSeries[] = Array.from(seriesMap.values());

// ==========================================
// Registry Helper Functions
// ==========================================

export function getContentByLevel(level: ContentLevel): ContentDefinition[] {
    return CONTENT_DEFINITIONS.filter(c => c.level === level);
}

export function getSeriesByLevel(level: ContentLevel): ContentSeries[] {
    return CONTENT_SERIES.filter(s => s.level === level);
}

export function getContentBySeries(seriesId: string): ContentDefinition[] {
    return CONTENT_DEFINITIONS.filter(c => c.seriesId === seriesId).sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): ContentSeries | undefined {
    return CONTENT_SERIES.find(s => s.id === seriesId);
}

export function getContentById(contentId: string): ContentDefinition | undefined {
    return CONTENT_DEFINITIONS.find(c => c.id === contentId);
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
