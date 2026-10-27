import type { PartyMember, PlayerStats } from '../../types';
import { calculateMemberValues } from '../../utils/calculator';
import { getLevelModifiersFromStore, getDefaultStatsByLevelFromStore, getPatchStatsFromStore } from '../../hooks/useSkillsData';
import { DEFAULT_NEW_MODE } from '../../utils/mitigationResolver';

// レベルに応じたサブステベース値を取得（遅延評価）
const getSubBase = (level: number = 100) => {
    const mods = getLevelModifiersFromStore();
    return mods[level]?.sub ?? 420;
};

const fillDefaultStats = (partial: any, level: number = 100): PlayerStats => ({
    ...partial,
    crt: getSubBase(level),
    ten: getSubBase(level),
    ss: getSubBase(level),
});

// ストアからデフォルトステータスを遅延取得する関数
export function getDefaultTankStats(level: number = 100): PlayerStats {
    const defaults = getDefaultStatsByLevelFromStore();
    return fillDefaultStats(defaults[level]?.tank ?? defaults[100]?.tank ?? { hp: 296194, mainStat: 6217, det: 2410, wd: 154 }, level);
}

export function getDefaultHealerStats(level: number = 100): PlayerStats {
    const defaults = getDefaultStatsByLevelFromStore();
    return fillDefaultStats(defaults[level]?.other ?? defaults[100]?.other ?? { hp: 186846, mainStat: 6317, det: 2987, wd: 154 }, level);
}

// 後方互換性（モジュールレベル定数として静的フォールバック値で初期化）
export const DEFAULT_TANK_STATS: PlayerStats = getDefaultTankStats();
export const DEFAULT_HEALER_STATS: PlayerStats = getDefaultHealerStats();

// Initial Party Slots
export const INITIAL_PARTY: PartyMember[] = [
    { id: 'MT', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'ST', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H1', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H2', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D1', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D2', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D3', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D4', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
];

// ────────────────────────────────────────────────────────────────────
// ②-b-2: partyMembers 変更 mutation のソロ計算を純関数に抽出(collab/ソロ両経路で共有=DRY)。
// collab 分岐は同じ関数で結果を計算し、差分をハンドラ経由で Y に反映する(二重実装回避)。
// ────────────────────────────────────────────────────────────────────

/** applyDefaultStats のソロ計算。level/patch から全メンバーの stats を既定値で更新する。 */
export function computeDefaultStatsMembers(
    members: PartyMember[],
    level: number,
    patch?: string,
): PartyMember[] {
    const patchData = patch ? getPatchStatsFromStore()[patch] : null;
    const template = patchData || getDefaultStatsByLevelFromStore()[level] || getDefaultStatsByLevelFromStore()[100];
    const subBase = getLevelModifiersFromStore()[level]?.sub || 420;
    const fillStats = (partial: any): PlayerStats => ({ ...partial, crt: subBase, ten: subBase, ss: subBase });
    const newDefaults = { tank: fillStats(template.tank), other: fillStats(template.other) };
    return members.map((m) => {
        const stats = m.role === 'tank' ? newDefaults.tank : newDefaults.other;
        return { ...m, stats: { ...stats }, computedValues: calculateMemberValues({ ...m, stats }, level) };
    });
}
