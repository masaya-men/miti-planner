import {
  resolveFight,
  fetchFightEvents,
  fetchDeathEvents,
  fetchCastEvents,
  fetchPlayerDetails,
} from '../../api/fflogs';
import type { FFLogsFight, FFLogsRawEvent } from '../../api/fflogs';
import { mapFFLogsToTimeline } from '../../utils/fflogsMapper';
import type { MapperResult } from '../../utils/fflogsMapper';

export type FflogsFetchPhase = 'resolving' | 'fetching_players' | 'fetching' | 'mapping';

/**
 * FFLogs レポートを取得してタイムラインへ変換する共通シーケンス。
 * FFLogsImportModal.handleFetch（旧 L113-131）の取得本体を setStatus を除いて逐語移植したもの。
 * - throw は透過（内部に try/catch を持たない）。呼び出し側が捕捉してエラー表示に落とす。
 * - 進捗は onProgress で通知（t()/setStatus は呼び出し側に残す）。
 * - Promise.all の 5 要素の順序・translate フラグ・分解先・map の引数順は絶対に変えない
 *   （en/jp や cast の translate を取り違えると技名が無言で逆転する）。
 */
export async function fetchAndMapFflogs(
  reportId: string,
  fightId: string | null,
  onProgress?: (phase: FflogsFetchPhase, ctx?: { name?: string }) => void,
): Promise<{ fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }> {
  onProgress?.('resolving');
  const fight = await resolveFight(reportId, fightId);

  onProgress?.('fetching_players');
  const players = await fetchPlayerDetails(reportId, fight.id);

  onProgress?.('fetching', { name: fight.name });
  const [eventsJp, eventsEn, deaths, castEn, castJp] = await Promise.all([
    fetchFightEvents(reportId, fight, false),
    fetchFightEvents(reportId, fight, true),
    fetchDeathEvents(reportId, fight),
    fetchCastEvents(reportId, fight, true),
    fetchCastEvents(reportId, fight, false),
  ]);

  onProgress?.('mapping');
  const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players);

  return { fight, events: eventsEn, mapped };
}
