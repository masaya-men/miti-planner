import * as Y from 'yjs';
import YProvider from 'y-partyserver/provider';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import { appliedToYMap, readMitigations, indexOfMitigation, YJS_MITIGATIONS_KEY } from './yjsMitigations';
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY, PLAN_META_KEY,
  META_LEVEL, META_AA, META_SCH, PARTY_MEMBERS_KEY,
  applyUpsert, applyRemove, setMetaField, readArray, readPlanMeta, readContentId,
  recordToYMap, buildArrByKey, applyBatch,
} from './yjsPlanData';
import type { AppliedMitigation, TimelineEvent, Phase, Label, PlanMemo, PartyMember } from '../../types';
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
 * sync 完了時に部屋の現在状態を store に初期反映する(オーナー入室・ジョイナー購読の共通処理)。
 * readOnly のときは編集委譲(enterCollabMode)をしない＝ジョイナーの操作は Y に一切流れない(購読のみ)。
 * partyMembers は meta より前に反映(meta の currentLevel 再計算が同期済みメンバーを読むため)。
 * ⑤-3b: sync 後に planMeta の contentId(不変・seed のみ)を onContentId で渡す。
 */
export function applyRoomToStore(
  doc: Y.Doc,
  opts: { readOnly: boolean; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void },
): void {
  if (!opts.readOnly) {
    useMitigationStore.getState().enterCollabMode(opts.handlers);
  }
  const s = useMitigationStore.getState();
  s._applyMitigationsFromCollab(readMitigations(doc));
  s._applyEventsFromCollab(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY));
  s._applyPhasesFromCollab(readArray<Phase>(doc, PHASES_KEY));
  s._applyLabelsFromCollab(readArray<Label>(doc, LABELS_KEY));
  s._applyMemosFromCollab(readArray<PlanMemo>(doc, MEMOS_KEY));
  s._applyPartyMembersFromCollab(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY));
  s._applyMetaFromCollab(readPlanMeta(doc));
  opts.onContentId?.(readContentId(doc));
}

/**
 * roomToken を部屋として共同編集セッションを開始する(⑤-3a でルーム鍵を plan ID → roomToken に分離)。
 * サーバ routing /parties/room/<roomToken> に合わせ party:"room" を指定。
 * ⑤-3b: opts.readOnly でジョイナー購読モード(enterCollabMode を呼ばず観測のみ)。
 */
export function startCollabSession(
  roomToken: string,
  opts: { readOnly?: boolean; onContentId?: (id: string | undefined) => void } = {},
): CollabSession {
  const doc = new Y.Doc();
  const provider = new YProvider(COLLAB_HOST, roomToken, doc, { party: 'room', connect: true });
  const yarr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);

  // ②-b-1: 残りの PlanData 要素の Y 型(②-a の timelineMitigations と並ぶトップレベルキー)。
  const yEvents = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
  const yPhases = doc.getArray<Y.Map<unknown>>(PHASES_KEY);
  const yLabels = doc.getArray<Y.Map<unknown>>(LABELS_KEY);
  const yMemos = doc.getArray<Y.Map<unknown>>(MEMOS_KEY);
  const yPartyMembers = doc.getArray<Y.Map<unknown>>(PARTY_MEMBERS_KEY);
  const yMeta = doc.getMap(PLAN_META_KEY);
  // ②-b-2: 全 PlanArrayKey(partyMembers/timelineMitigations 含む)の対応表を共有ヘルパで生成。
  const arrByKey = buildArrByKey(doc);

  // Yjs → store。自分の操作も相手の操作も同じ observeDeep 経路で store に入る(単一の真実 = Y.Doc)。
  // Y.Map 内フィールド変更(time の set 等)も拾うため observe ではなく observeDeep。
  const applyToStore = () =>
    useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  yarr.observeDeep(applyToStore);

  // ②-b-1: 各要素の Yjs → store 反映(pushHistory は積まない＝②-a と同じ)。
  const store = () => useMitigationStore.getState();
  const applyEvents = () => store()._applyEventsFromCollab(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY));
  const applyPhases = () => store()._applyPhasesFromCollab(readArray<Phase>(doc, PHASES_KEY));
  const applyLabels = () => store()._applyLabelsFromCollab(readArray<Label>(doc, LABELS_KEY));
  const applyMemos = () => store()._applyMemosFromCollab(readArray<PlanMemo>(doc, MEMOS_KEY));
  const applyMeta = () => store()._applyMetaFromCollab(readPlanMeta(doc));
  const applyPartyMembers = () => store()._applyPartyMembersFromCollab(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY));
  yEvents.observeDeep(applyEvents);
  yPhases.observeDeep(applyPhases);
  yLabels.observeDeep(applyLabels);
  yMemos.observeDeep(applyMemos);
  yMeta.observeDeep(applyMeta);
  yPartyMembers.observeDeep(applyPartyMembers);

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
    // ②-b-1 汎用: store が計算した delta(新規/変更項目)を id 単位で Y に反映。
    upsertItems: (key, items) => {
      doc.transact(() => applyUpsert(arrByKey[key], items), 'local');
    },
    removeItems: (key, ids) => {
      doc.transact(() => applyRemove(arrByKey[key], ids), 'local');
    },
    setMeta: (field, value) => {
      const k = field === 'currentLevel' ? META_LEVEL : field === 'aaSettings' ? META_AA : META_SCH;
      doc.transact(() => setMetaField(doc, k, value), 'local');
    },
    // FFLogs 取込: events/phases/labels を全置換 + mitigations を全クリア(別の戦闘へ切替)。1 transaction。
    importBulk: (events, phases, labels) => {
      doc.transact(() => {
        yEvents.delete(0, yEvents.length);
        events.forEach((e) => yEvents.push([recordToYMap(e)]));
        if (phases) { yPhases.delete(0, yPhases.length); phases.forEach((p) => yPhases.push([recordToYMap(p)])); }
        if (labels) { yLabels.delete(0, yLabels.length); labels.forEach((l) => yLabels.push([recordToYMap(l)])); }
        yarr.delete(0, yarr.length); // ②-a 領域だが破壊的全置換で衝突しない(設計書 §8)
      }, 'local');
    },
    // ②-b-2: 複数キーを 1 transaction で原子的に反映(ジョブ変更カスケード等)。
    batch: (ops) => applyBatch(doc, arrByKey, ops),
  };

  // 初期同期完了後に入室処理。
  // 段取り③: seed はサーバー(DO の onLoad が Firestore から)が担うため、クライアントは
  // 「部屋の状態を store に反映」するだけ(自分のローカル軽減で seed しない)。これにより
  // 「部屋の状態 = Firestore の保存済み内容」が唯一の真実になり、オーナー不在でも矛盾しない。
  const readOnly = opts.readOnly ?? false;
  let entered = false;
  const onSynced = (isSynced: boolean) => {
    if (!isSynced || entered) return;
    entered = true;
    // ②-b-1/②-b-2 の全要素初期反映 + ⑤-3b の readOnly 分岐 + contentId seed 取得を 1 箇所に集約。
    applyRoomToStore(doc, { readOnly, handlers, onContentId: opts.onContentId });
  };
  provider.on('sync', onSynced);

  const disconnect = () => {
    provider.off('sync', onSynced);
    yarr.unobserveDeep(applyToStore);
    yEvents.unobserveDeep(applyEvents);
    yPhases.unobserveDeep(applyPhases);
    yLabels.unobserveDeep(applyLabels);
    yMemos.unobserveDeep(applyMemos);
    yMeta.unobserveDeep(applyMeta);
    yPartyMembers.unobserveDeep(applyPartyMembers);
    // readOnly(ジョイナー購読)は enterCollabMode していないので exit も不要(購読解除＝unobserve で十分)。
    if (!readOnly) useMitigationStore.getState().exitCollabMode();
    provider.destroy();
    doc.destroy();
  };

  return { provider, doc, disconnect };
}
