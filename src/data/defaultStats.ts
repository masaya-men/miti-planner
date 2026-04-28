import type { TemplateStats } from '../types/index.js';

export type { TemplateStats };

/**
 * 編集時の注意:
 * ここで定義する4項目以外(crt, ten, ss)は、システム内部でレベルごとのベース値が自動補完されます。
 */

// ============================================================================
// 1. 拡張パッケージごとの定義
// ============================================================================

// --- 黄金のレガシー (DT / Lv100) ---
export const DT_PATCH_STATS: Record<string, TemplateStats> = {
    "7.40": {
        tank: { hp: 296194, mainStat: 6217, det: 2410, wd: 154 },
        other: { hp: 186846, mainStat: 6317, det: 2987, wd: 154 }
    },
    "7.20": {
        tank: { hp: 244551, mainStat: 5361, det: 2467, wd: 148 },
        other: { hp: 154429, mainStat: 5430, det: 2129, wd: 148 }
    },
    "7.11": {
        tank: { hp: 233328, mainStat: 5140, det: 2707, wd: 146 },
        other: { hp: 147024, mainStat: 5172, det: 2319, wd: 146 }
    },
    "7.05": {
        tank: { hp: 201121, mainStat: 4611, det: 3141, wd: 141 },
        other: { hp: 126827, mainStat: 4652, det: 1908, wd: 141 }
    }
};

// --- 暁月のフィナーレ (EW / Lv90) ---
export const EW_PATCH_STATS: Record<string, TemplateStats> = {
    "6.40": {
        tank: { hp: 152020, mainStat: 3330, det: 2534, wd: 128 },
        other: { hp: 96478, mainStat: 3370, det: 2222, wd: 128 }
    },
    "6.31": {
        tank: { hp: 110076, mainStat: 2963, det: 2441, wd: 126 },
        other: { hp: 69950, mainStat: 3003, det: 2130, wd: 126 }
    },
    "6.20": {
        tank: { hp: 152020, mainStat: 3330, det: 2534, wd: 122 },
        other: { hp: 96478, mainStat: 3370, det: 2222, wd: 122 }
    },
    "6.11": {
        tank: { hp: 93052, mainStat: 2584, det: 2324, wd: 122 },
        other: { hp: 59064, mainStat: 2624, det: 2032, wd: 122 }
    },
    "6.05": {
        tank: { hp: 152020, mainStat: 3330, det: 2534, wd: 115 },
        other: { hp: 96478, mainStat: 3370, det: 2222, wd: 115 }
    }
};

// --- 漆黒のヴィランズ (SHB / Lv80) ---
export const SHB_PATCH_STATS: Record<string, TemplateStats> = {
    "5.40": {
        tank: { hp: 61708, mainStat: 1877, det: 1863, wd: 106 },
        other: { hp: 39111, mainStat: 1912, det: 1638, wd: 106 }
    },
    "5.20": {
        tank: { hp: 61708, mainStat: 1877, det: 1863, wd: 106 },
        other: { hp: 39111, mainStat: 1912, det: 1638, wd: 106 }
    },
    "5.11": {
        tank: { hp: 43976, mainStat: 1674, det: 1708, wd: 106 },
        other: { hp: 27762, mainStat: 1709, det: 1502, wd: 106 }
    },
    "5.05": {
        tank: { hp: 61708, mainStat: 1877, det: 1863, wd: 106 },
        other: { hp: 39111, mainStat: 1912, det: 1638, wd: 106 }
    }
};

// --- 紅蓮のリベレーター (SB / Lv70) ---
export const SB_PATCH_STATS: Record<string, TemplateStats> = {
    "4.40": {
        tank: { hp: 32635, mainStat: 1363, det: 1376, wd: 99 },
        other: { hp: 21663, mainStat: 1393, det: 1204, wd: 99 }
    },
    "4.31": {
        tank: { hp: 24676, mainStat: 1295, det: 1315, wd: 99 },
        other: { hp: 16345, mainStat: 1325, det: 1153, wd: 99 }
    },
    "4.20": {
        tank: { hp: 32635, mainStat: 1363, det: 1376, wd: 99 },
        other: { hp: 21663, mainStat: 1393, det: 1204, wd: 99 }
    },
    "4.11": {
        tank: { hp: 22646, mainStat: 1227, det: 1254, wd: 99 },
        other: { hp: 15029, mainStat: 1257, det: 1102, wd: 90 }
    },
    "4.05": {
        tank: { hp: 32635, mainStat: 1363, det: 1376, wd: 99 },
        other: { hp: 21663, mainStat: 1393, det: 1204, wd: 99 }
    }
};

// ============================================================================
// 2. システム参照用マップ
// ============================================================================

/**
 * レベルごとのデフォルト定義（パッチが見つからない場合に使用）
 * 各拡張の「最新パッチ相当」をデフォルトとして設定
 */
export const DEFAULT_STATS_BY_LEVEL: Record<number, TemplateStats> = {
    100: DT_PATCH_STATS["7.40"],
    90: EW_PATCH_STATS["6.40"],
    80: SHB_PATCH_STATS["5.40"],
    70: SB_PATCH_STATS["4.40"]
};

/**
 * 全パッチデータの統合リスト
 * パッチ文字列から一意にデータを取得するために使用
 */
export const ALL_PATCH_STATS: Record<string, TemplateStats> = {
    ...DT_PATCH_STATS,
    ...EW_PATCH_STATS,
    ...SHB_PATCH_STATS,
    ...SB_PATCH_STATS
};
