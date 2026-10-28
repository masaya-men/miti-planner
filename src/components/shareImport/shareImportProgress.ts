import type { ProgressEvent } from '../../lib/shareImportTypes';

/** 1 アイテムの進捗を 0-1 で返す (Phase B-1.5 polish 第 2 弾 #4 Revision)。
 *  ステージ重み: check 33% / local 66% / server 100%、 in_progress は手前 10/50/80%。
 *  中央オーバーレイの linear bar 充填率算出に使う。 */
export function getImportItemFraction(events: ProgressEvent[]): number {
    if (events.length === 0) return 0;
    const server = events.find(e => e.stage === 'server');
    if (server) return server.status === 'in_progress' ? 0.8 : 1.0;
    const local = events.find(e => e.stage === 'local');
    if (local) return local.status === 'in_progress' ? 0.5 : 0.66;
    const check = events.find(e => e.stage === 'check');
    if (check) return check.status === 'in_progress' ? 0.1 : 0.33;
    return 0;
}

/** アイテムが「処理終了 (success/failed/cancelled/skipped どれか)」か。 */
export function isImportItemTerminal(events: ProgressEvent[]): boolean {
    if (events.length === 0) return false;
    return !events.some(e => e.status === 'in_progress');
}

/** ProgressEvent[] → sweep status の解決ロジック (取り込み 3 stage を 1 本の sweep に集約)。
 *  - server stage success/skipped → success (取り込み完了)
 *  - 任意 stage failed → failed (赤 sweep 100% 維持)
 *  - それ以外で events 1 件以上 → active (sweep 走行)
 *  - events なし → idle */
export function resolveItemSweepStatus(
    events: ProgressEvent[],
): 'idle' | 'active' | 'success' | 'failed' {
    if (events.length === 0) return 'idle';
    const failed = events.find(e => e.status === 'failed');
    if (failed) return 'failed';
    const serverDone = events.find(
        e => e.stage === 'server' && (e.status === 'success' || e.status === 'skipped'),
    );
    if (serverDone) return 'success';
    return 'active';
}
