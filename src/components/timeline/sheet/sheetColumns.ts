// スプシモードの列定義(純粋関数)。1 ジョブ = 軽減技ごとの縦列。
import type { Mitigation, PartyMember } from '../../../types';
import { getMitigationPriority } from '../../../data/mockData';
import { SERAPHISM_TRANSFORMS } from '../../../utils/scholarShieldRules';

/** 1 列の幅 (px) */
export const SHEET_COL_W = 28;
/** 置いたアイコンの 1 辺 (px) */
export const SHEET_ICON_PX = 18;
/** 帯(効果時間)の幅 (px) */
export const SHEET_BAND_W = 6;

export interface SheetColumn {
    mitigationId: string;
    def: Mitigation;
}

/** ジョブの列を作る。MitigationSelector と同じレベル・hidden 絞り込み(requires では絞らない)。 */
export function buildSheetColumns(
    jobId: string | null,
    defs: readonly Mitigation[],
    currentLevel: number,
): SheetColumn[] {
    if (!jobId) return [];
    return defs
        .filter(m => m.jobId === jobId)
        .filter(m => {
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;
            if (m.hidden) return false;
            return true;
        })
        .sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
        .map(def => ({ mitigationId: def.id, def }));
}

/** 置いた技をどの列に描くか。見つからなければ -1。 */
export function sheetColumnIndex(
    columns: readonly SheetColumn[],
    mitigationId: string,
    defs: readonly Mitigation[],
): number {
    // (1) 同じ id
    const direct = columns.findIndex(c => c.mitigationId === mitigationId);
    if (direct >= 0) return direct;
    // (2) セラフィズム差し替え(manifestation → adloquium 等)の逆引き
    const base = Object.keys(SERAPHISM_TRANSFORMS).find(k => SERAPHISM_TRANSFORMS[k] === mitigationId);
    if (base) {
        const i = columns.findIndex(c => c.mitigationId === base);
        if (i >= 0) return i;
    }
    // (3) 同じ jobId + 同じ icon(版違い。getSharedCooldownIds と同じ規則)
    const def = defs.find(d => d.id === mitigationId);
    if (def) {
        return columns.findIndex(c => c.def.jobId === def.jobId && c.def.icon === def.icon);
    }
    return -1;
}

/** クリック位置 → 列番号(セル左端基準) */
export function sheetColumnAt(clientX: number, cellLeft: number, colW = SHEET_COL_W): number {
    return Math.floor((clientX - cellLeft) / colW);
}

/** メンバー id → 列 */
export function buildSheetColumnMap(
    members: readonly PartyMember[],
    defs: readonly Mitigation[],
    currentLevel: number,
): ReadonlyMap<string, SheetColumn[]> {
    const map = new Map<string, SheetColumn[]>();
    for (const m of members) map.set(m.id, buildSheetColumns(m.jobId, defs, currentLevel));
    return map;
}
