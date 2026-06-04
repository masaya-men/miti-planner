import * as Y from 'yjs';
import YProvider from 'y-partyserver/provider';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import { appliedToYMap, readMitigations, indexOfMitigation, YJS_MITIGATIONS_KEY } from './yjsMitigations';
import type { AppliedMitigation } from '../../types';
import type { CollabHandlers } from './collabTypes';

/**
 * 共同編集の遅延チャンク。yjs / y-partyserver を実行時 import するのはこのファイルと
 * yjsMitigations.ts のみ。CollabToggle が「一緒に編集」クリック時に動的 import するので、
 * Yjs 系はソロ利用者の初期 bundle に乗らない(設計書 §遅延ロード)。
 *
 * 段取り②-a: timelineMitigations(軽減配置)だけを Y.Array<Y.Map> で同期。
 * - サーバ: 段取り①+②でデプロイ済の YServer(lopo-collab)。party="room" でルーティング一致。
 * - cascade(セラフィム重複削除・requires 依存削除)は store のソロ版と同ロジックを Y 操作で再現。
 *   盾連鎖(linkedMitigationId/duration)は store 側 _applyMitigationsFromCollab で派生再計算。
 */

// 本番 collab Worker(段取り①でデプロイ済)。dev でもここに直接 WebSocket する(/api/* と同様)。
const COLLAB_HOST = 'lopo-collab.masaya-maeno0106.workers.dev';

const SERAPH_DURATION = 22;

export interface CollabSession {
  provider: YProvider;
  doc: Y.Doc;
  disconnect: () => void;
}

/** id の配列を順に Y.Array から削除する(毎回 index を取り直すため index ずれに安全)。 */
function removeByIds(arr: Y.Array<Y.Map<unknown>>, ids: string[]): void {
  for (const id of ids) {
    const j = indexOfMitigation(arr, id);
    if (j >= 0) arr.delete(j, 1);
  }
}

/** セラフィム配置/移動時に重複削除すべき同一学者の転化(dissipation)の id を集める。 */
function dissipationIdsOverlapping(
  arr: Y.Array<Y.Map<unknown>>,
  ownerId: unknown,
  seraphStart: number,
  excludeId: string | null,
): string[] {
  const seraphEnd = seraphStart + SERAPH_DURATION;
  const ids: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const ym = arr.get(i);
    if (ym.get('id') === excludeId) continue;
    if (ym.get('mitigationId') === 'dissipation' && ym.get('ownerId') === ownerId) {
      const ds = ym.get('time') as number;
      const de = ds + (ym.get('duration') as number);
      if (!(de <= seraphStart || ds >= seraphEnd)) ids.push(ym.get('id') as string);
    }
  }
  return ids;
}

/**
 * plan ID を部屋として共同編集セッションを開始する。
 * サーバ routing /parties/room/<id> に合わせ party:"room" を指定。
 */
export function startCollabSession(planId: string): CollabSession {
  const doc = new Y.Doc();
  const provider = new YProvider(COLLAB_HOST, planId, doc, { party: 'room', connect: true });
  const yarr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);

  // Yjs → store。自分の操作も相手の操作も同じ observeDeep 経路で store に入る(単一の真実 = Y.Doc)。
  // Y.Map 内フィールド変更(time の set 等)も拾うため observe ではなく observeDeep。
  const applyToStore = () =>
    useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  yarr.observeDeep(applyToStore);

  // store → Yjs(共同編集中の add/remove/updateTime はここへ委譲される)。
  const handlers: CollabHandlers = {
    add: (m: AppliedMitigation) => {
      doc.transact(() => {
        if (m.mitigationId === 'summon_seraph') {
          removeByIds(yarr, dissipationIdsOverlapping(yarr, m.ownerId, m.time, null));
        }
        yarr.push([appliedToYMap(m)]);
      }, 'local');
    },
    remove: (id: string) => {
      doc.transact(() => {
        const idx = indexOfMitigation(yarr, id);
        if (idx < 0) return;
        const removed = yarr.get(idx);
        const removedMitId = removed.get('mitigationId') as string;
        const removedOwner = removed.get('ownerId');
        const removedStart = removed.get('time') as number;
        const removedEnd = removedStart + (removed.get('duration') as number);
        // requires 依存: 削除軽減に依存し、有効時間に重なる軽減も削除(store ソロ版と同ロジック)。
        const dependentMitIds = getMitigationsFromStore()
          .filter((d) => d.requires === removedMitId)
          .map((d) => d.id);
        const dependentIds: string[] = [];
        for (let i = 0; i < yarr.length; i++) {
          const ym = yarr.get(i);
          if (ym.get('id') === id) continue;
          const t = ym.get('time') as number;
          if (
            dependentMitIds.includes(ym.get('mitigationId') as string) &&
            ym.get('ownerId') === removedOwner &&
            t >= removedStart && t < removedEnd
          ) {
            dependentIds.push(ym.get('id') as string);
          }
        }
        removeByIds(yarr, [...dependentIds, id]);
      }, 'local');
    },
    updateTime: (id: string, newTime: number) => {
      doc.transact(() => {
        const idx = indexOfMitigation(yarr, id);
        if (idx < 0) return;
        const ym = yarr.get(idx);
        ym.set('time', newTime);
        if (ym.get('mitigationId') === 'summon_seraph') {
          removeByIds(yarr, dissipationIdsOverlapping(yarr, ym.get('ownerId'), newTime, id));
        }
      }, 'local');
    },
  };

  // 初期同期完了後に入室処理(seed の最初の参加者判定を sync 後に確定させる)。
  let entered = false;
  const onSynced = (isSynced: boolean) => {
    if (!isSynced || entered) return;
    entered = true;
    // 最初の参加者(部屋が空)なら現在のローカル軽減を seed。2人目以降は部屋の状態が正。
    if (yarr.length === 0) {
      const current = useMitigationStore.getState().timelineMitigations;
      doc.transact(() => {
        current.forEach((m) => yarr.push([appliedToYMap(m)]));
      }, 'seed');
    }
    useMitigationStore.getState().enterCollabMode(handlers);
    useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  };
  provider.on('sync', onSynced);

  const disconnect = () => {
    provider.off('sync', onSynced);
    yarr.unobserveDeep(applyToStore);
    useMitigationStore.getState().exitCollabMode();
    provider.destroy();
    doc.destroy();
  };

  return { provider, doc, disconnect };
}
