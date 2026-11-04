/**
 * 運営通知 (system_notifications) の取得と共有。
 *
 * - 公開窓口 (`GET /api/template?action=public-notifications`) の取得をアプリ内 1 か所に集約する。
 *   通知を出す部品が何個マウントされても、取得は 1 本・visibilitychange リスナーは 1 個。
 * - 最後に「成功した」取得から 5 分未満なら、マウント時も前面復帰時も取りに行かない
 *   (初回=成功記録なしは必ず取る。失敗時は時刻を進めない=次の前面復帰ですぐ取り直す)。
 * - 管理者が通知を投稿・編集した直後は `refreshSystemNotifications({ force: true })` で
 *   5 分ルールを飛ばし、その 1 回だけ URL に時刻の印 (&t=) を付けて Cloudflare・ブラウザのキャッシュを避けて取り直す。
 * - 素の fetch で App Check を付与しない (Admin SDK 経由の公開読み窓口・App Check 不要)。
 */
import type { SystemNotification } from '../types/systemNotification';

export const NOTIFICATIONS_MIN_REFETCH_MS = 5 * 60_000;
/** サーバーの Cache-Control の max-age と同じ長さ。強制で取り直した後この間は、普通の取得も時刻の印を付ける(ブラウザが覚えている投稿前の古い応答に戻らないため) */
export const NOTIFICATIONS_BROWSER_CACHE_MS = 60 * 60_000;

const ENDPOINT = '/api/template?action=public-notifications';
const EMPTY: SystemNotification[] = [];

let snapshot: SystemNotification[] = EMPTY;
let lastSuccessAt: number | null = null;
/** 最後に強制で取り直した時刻(このタブだけ・管理者の画面) */
let forcedAt: number | null = null;
let inflight: Promise<void> | null = null;
/** 取得の世代。新しい取得を始めたら進め、古い取得の結果は捨てる。 */
let generation = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function onVisible() {
  if (document.visibilityState === 'visible') void refreshSystemNotifications();
}

async function fetchOnce(gen: number, force: boolean): Promise<void> {
  try {
    const bypass = force || (forcedAt !== null && Date.now() - forcedAt < NOTIFICATIONS_BROWSER_CACHE_MS);
    const res = await fetch(bypass ? `${ENDPOINT}&t=${Date.now()}` : ENDPOINT);
    if (!res.ok) return;
    const data = (await res.json()) as { items?: SystemNotification[] };
    if (gen !== generation) return;
    snapshot = Array.isArray(data.items) ? data.items : [];
    lastSuccessAt = Date.now();
    emit();
  } catch {
    // ネットワーク失敗時は既存 items を維持 (握りつぶし)。時刻は進めない。
  }
}

/** 同じ配列参照を返す (useSyncExternalStore 用)。 */
export function getSystemNotificationsSnapshot(): SystemNotification[] {
  return snapshot;
}

/**
 * 取得する。実行中の取得があればそれを共有し、前回成功から 5 分未満なら何もしない。
 * force=true は両方を飛ばし、URL に時刻の印を付けて新しく取る (管理者の投稿・編集直後用)。
 */
export function refreshSystemNotifications(opts?: { force?: boolean }): Promise<void> {
  const force = opts?.force === true;
  if (!force) {
    if (inflight) return inflight;
    if (lastSuccessAt !== null && Date.now() - lastSuccessAt < NOTIFICATIONS_MIN_REFETCH_MS) {
      return Promise.resolve();
    }
  }
  if (force) forcedAt = Date.now();
  generation += 1;
  const gen = generation;
  const p = fetchOnce(gen, force).finally(() => {
    if (inflight === p) inflight = null;
  });
  inflight = p;
  return p;
}

/** 最初の購読で visibilitychange 登録+取得、最後の解除でリスナー削除。 */
export function subscribeSystemNotifications(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisible);
  }
  void refreshSystemNotifications();
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

export function __resetSystemNotificationsFeedForTest(): void {
  if (listeners.size > 0) document.removeEventListener('visibilitychange', onVisible);
  listeners.clear();
  snapshot = EMPTY;
  lastSuccessAt = null;
  forcedAt = null;
  inflight = null;
  generation += 1;
}
