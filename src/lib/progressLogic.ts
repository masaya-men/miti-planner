import type { ProgressPoint, PlanProgress, LocalizedString } from '../types';

/** 打点 id を採番（pt_<uuid>）。crypto.randomUUID は全対象ブラウザで利用可。 */
export function makeProgressPointId(): string {
    return `pt_${crypto.randomUUID()}`;
}

/** Date → 'YYYY-MM-DD' (JST = UTC+9)。点のツールチップ等の日付ラベル算出に使う */
export function makeDayKey(date: Date): string {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** 打点を末尾に追加（毎クリック 1 点・同日でも溜まる・統合しない・順序=クリック順） */
export function appendProgressPoint(list: ProgressPoint[] | undefined, point: ProgressPoint): ProgressPoint[] {
    return [...(list ?? []), point];
}

/** 指定インデックスの点を削除（誤記録修正） */
export function removeProgressPoint(list: ProgressPoint[] | undefined, index: number): ProgressPoint[] {
    return (list ?? []).filter((_, i) => i !== index);
}

/** id 一致の点を削除（共同編集の個別削除に使う・非破壊）。 */
export function removeProgressPointById(list: ProgressPoint[] | undefined, id: string): ProgressPoint[] {
    return (list ?? []).filter((p) => p.id !== id);
}

/** id 一致の点の note を設定（空白のみなら note を削除）。非破壊。 */
export function setProgressPointNoteById(
    list: ProgressPoint[] | undefined, id: string, note: string
): ProgressPoint[] {
    const trimmed = note.trim();
    return (list ?? []).map((p) => {
        if (p.id !== id) return p;
        if (!trimmed) { const { note: _omit, ...rest } = p; return rest; }
        return { ...p, note: trimmed };
    });
}

/** 最高到達点 / 全長 * 100（cleared は 100）。0〜100 に丸めクランプ */
export function computeProgressPercent(progress: PlanProgress | undefined, timelineTotalSec: number): number {
    if (!progress) return 0;
    if (progress.cleared) return 100;
    const points = progress.points ?? [];
    if (timelineTotalSec <= 0 || points.length === 0) return 0;
    const best = Math.max(...points.map(p => p.reachedPos));
    return Math.max(0, Math.min(100, Math.round((best / timelineTotalSec) * 100)));
}

/**
 * 永続化/スナップショットから読んだ progress を新形式に正規化する。
 * - undefined/不正 → 空
 * - 新形式(points あり) → そのまま
 * - 旧形式(dailyBest のみ・本ブランチ初期のテストデータ) → points へ変換（順序維持・救済）
 * これにより progress.points は常に配列になり、読み出し/追記が安全になる。
 */
export function normalizeProgress(p: unknown): PlanProgress {
    const obj = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
    const cleared = !!obj.cleared;
    const activeDays = typeof obj.activeDays === 'number' ? obj.activeDays : undefined;
    const activeHours = typeof obj.activeHours === 'number' ? obj.activeHours : undefined;
    const withId = (pt: Record<string, unknown>): ProgressPoint => ({
        id: typeof pt.id === 'string' && pt.id ? pt.id : makeProgressPointId(),
        ts: Number(pt.ts) || 0,
        reachedPos: Number(pt.reachedPos) || 0,
        ...(typeof pt.note === 'string' && pt.note ? { note: pt.note } : {}),
    });
    if (Array.isArray(obj.points)) {
        return { points: (obj.points as Record<string, unknown>[]).map(withId), cleared, activeDays, activeHours };
    }
    const legacy = Array.isArray(obj.dailyBest) ? obj.dailyBest as Array<{ reachedPos?: number }> : [];
    const points: ProgressPoint[] = legacy.map((d, i) => ({ id: makeProgressPointId(), ts: i + 1, reachedPos: Number(d?.reachedPos) || 0 }));
    return { points, cleared, activeDays, activeHours };
}

export function isEmptyProgress(progress: PlanProgress | undefined): boolean {
    if (!progress) return true;
    return (
        (progress.points ?? []).length === 0 &&
        !progress.cleared &&
        progress.activeDays === undefined &&
        progress.activeHours === undefined
    );
}

/**
 * 記録する reachedPos が「チームのこれまでの最高到達点」を更新するか判定する。
 * 記録前の progress を渡すこと。最高を超えたら 'update'、そうでなければ 'nice'。
 * （0 は更新扱いにしない＝points 空 + reachedPos 0 は 'nice'）
 */
export function classifyRecord(progress: PlanProgress, reachedPos: number): 'update' | 'nice' {
    const points = progress.points ?? [];
    const prevMax = points.length ? Math.max(...points.map(p => p.reachedPos)) : 0;
    return reachedPos > prevMax ? 'update' : 'nice';
}

/** 光の道: 各フェーズを開始時間に比例した leftPct(4〜96) に配置。total<=0 は空。 */
export function phaseRoadPositions(
    phases: { id: string; name: LocalizedString; startTime: number }[],
    totalSec: number
): { id: string; name: LocalizedString; leftPct: number; time: number }[] {
    if (totalSec <= 0) return [];
    return phases.map((p) => ({
        id: p.id,
        name: p.name,
        time: p.startTime,
        leftPct: Math.min(96, Math.max(4, (p.startTime / totalSec) * 100)),
    }));
}

/** 道のクリック割合(0〜1) → タイムライン時間(秒・0〜total にクランプ・四捨五入)。 */
export function roadTimeFromClick(fraction: number, totalSec: number): number {
    return Math.max(0, Math.min(totalSec, Math.round(fraction * totalSec)));
}

/** 活動日数/時間の値を 0 以上の整数にクランプ。 */
export function clampActivity(n: number): number {
    return Math.max(0, Math.round(n));
}

/** 指定 index に点を挿入（削除のUndo復元用・非破壊・範囲外はクランプ） */
export function insertProgressPoint(
    list: ProgressPoint[] | undefined, index: number, point: ProgressPoint
): ProgressPoint[] {
    const base = list ?? [];
    const i = Math.max(0, Math.min(index, base.length));
    return [...base.slice(0, i), point, ...base.slice(i)];
}

/** reachedPos を含むフェーズ（startTime<=sec で最大の startTime）を返す。無ければ null。未ソート安全。 */
export function phaseAtTime(
    phases: { name: LocalizedString; startTime: number }[], sec: number
): { name: LocalizedString } | null {
    let best: { name: LocalizedString } | null = null;
    let bestStart = -1;
    for (const p of phases) {
        if (p.startTime <= sec && p.startTime >= bestStart) { best = { name: p.name }; bestStart = p.startTime; }
    }
    return best;
}

/** 1点の到達割合 (reachedPos/totalSec*100) を 0〜100 に丸めクランプ */
export function pointPercent(reachedPos: number, totalSec: number): number {
    if (totalSec <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((reachedPos / totalSec) * 100)));
}

/** 秒 → "m:ss"（フェーズ未定義時の到達点ラベル用） */
export function formatClock(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** epoch ms → JST "H:MM"（記録時刻表示） */
export function formatTimeOfDay(ts: number): string {
    const jst = new Date(ts + 9 * 60 * 60 * 1000);
    return `${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

/** epoch ms → JST "M/D" */
export function formatMonthDay(ts: number): string {
    const jst = new Date(ts + 9 * 60 * 60 * 1000);
    return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

/** ts が今日/昨日/それ以前か（JST 基準・makeDayKey で日付比較） */
export function dayBucket(ts: number, nowTs: number): 'today' | 'yesterday' | 'older' {
    const day = makeDayKey(new Date(ts));
    if (day === makeDayKey(new Date(nowTs))) return 'today';
    if (day === makeDayKey(new Date(nowTs - 24 * 60 * 60 * 1000))) return 'yesterday';
    return 'older';
}
