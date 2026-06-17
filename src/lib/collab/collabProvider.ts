import * as Y from 'yjs';
import YProvider from 'y-partyserver/provider';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import { appliedToYMap, readMitigations, indexOfMitigation, YJS_MITIGATIONS_KEY } from './yjsMitigations';
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY, PLAN_META_KEY,
  META_LEVEL, META_AA, META_SCH, PARTY_MEMBERS_KEY,
  applyUpsert, applyRemove, setMetaField, readArray, readPlanMeta, readContentId, readOwnerLabel,
  recordToYMap, buildArrByKey, applyBatch,
} from './yjsPlanData';
import { dedupeById } from './dedupeById';
import { fieldsNeedingReseed, RESEED_FIELDS } from './collabReseed';
import type { AppliedMitigation, TimelineEvent, Phase, Label, PlanMemo, PartyMember } from '../../types';
import type { CollabHandlers } from './collabTypes';
import { colorForClient, wirePresence, type AwarenessLike, type PresenceState } from './presence';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { createCursorMesh } from './cursorMesh';
import { createRealPeer } from './cursorPeer';
import { wireSignal } from './cursorSignal';
import { useRemoteCursorsStore } from '../../store/useRemoteCursorsStore';
import { useCursorSendStore } from '../../store/useCursorSendStore';
import { createPlanUndoManager, type PlanUndoManager } from './planUndoManager';

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
// ローカル完全スタック検証(⑤-3d)用に VITE_COLLAB_HOST で上書き可能。
// 本番は env 未設定 → ハードコード値にフォールバック(挙動無変更)。
const COLLAB_HOST =
  (import.meta.env.VITE_COLLAB_HOST as string | undefined) || 'lopo-collab.masaya-maeno0106.workers.dev';

/**
 * #3d: 確実な人数を取得する。サーバの /count は getConnections() 由来(ハイバネを越えて保持=Cloudflare 公式)。
 * 入退室(awareness の add/removed)時 + 接続時にだけ呼ぶ(カーソル更新では呼ばない)→ アイドル中は
 * DO を起こさず $0 を維持。失敗は null(呼び出し側は roster.length にフォールバック)。
 */
export async function fetchRoomCount(roomToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://${COLLAB_HOST}/parties/room/${encodeURIComponent(roomToken)}/count`);
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    return typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * ④-a: provider params。ログイン中なら現在の Firebase ID トークンを載せ、未ログインは空(viewer)。
 * 関数なので再接続のたびに最新トークンを取り直す(約1時間の期限を自然に解決)。
 * getToken を注入式にして純粋にテストする(firebase を静的 import せず、呼び出し側で動的に渡す)。
 */
export async function buildCollabParams(
  getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
  try {
    const token = await getToken();
    return token ? { token } : {};
  } catch {
    return {}; // 取得失敗 → viewer(編集権はサーバが拒否するだけ・閲覧は維持)
  }
}

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
 * client 側 空上書き防御: 「doc 側が空・手元(store)が非空」の構造フィールドだけを
 * 手元から id 単位 upsert で再シードする(列増殖しない)。部分的な空(例: 軽減だけ空・
 * イベントは残る)でも手元を潰さない＝サーバ _logic.ts emptyOverwriteSkips と対の多重防御。
 * 全構造フィールドが空(=seed 完全失敗)のときだけ labels/memos/meta も手元から復元する。
 * origin='local' で 1 transaction。observeDeep 経由で store と一致し、onSave で Firestore へ復元される。
 * 返り値 = 再シードしたフィールド数(0 = 防御不要だった)。
 */
function reseedEmptyDocFields(
  doc: Y.Doc,
  s: ReturnType<typeof useMitigationStore.getState>,
): number {
  const need = fieldsNeedingReseed(
    {
      timelineMitigations: readMitigations(doc).length,
      timelineEvents: readArray(doc, TIMELINE_EVENTS_KEY).length,
      phases: readArray(doc, PHASES_KEY).length,
      partyMembers: readArray(doc, PARTY_MEMBERS_KEY).length,
    },
    {
      timelineMitigations: s.timelineMitigations.length,
      timelineEvents: s.timelineEvents.length,
      phases: s.phases.length,
      partyMembers: s.partyMembers.length,
    },
  );
  if (need.size === 0) return 0;
  doc.transact(() => {
    if (need.has('timelineMitigations')) applyUpsert(doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY), s.timelineMitigations);
    if (need.has('timelineEvents')) applyUpsert(doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY), s.timelineEvents);
    if (need.has('phases')) applyUpsert(doc.getArray<Y.Map<unknown>>(PHASES_KEY), s.phases);
    if (need.has('partyMembers')) applyUpsert(doc.getArray<Y.Map<unknown>>(PARTY_MEMBERS_KEY), s.partyMembers);
    // 全構造フィールドが空 = seed 完全失敗。labels/memos/meta も手元から復元(従来の丸ごと再シード相当)。
    if (need.size === RESEED_FIELDS.length) {
      applyUpsert(doc.getArray<Y.Map<unknown>>(LABELS_KEY), s.labels);
      applyUpsert(doc.getArray<Y.Map<unknown>>(MEMOS_KEY), s.memos);
      if (s.currentLevel !== undefined) setMetaField(doc, META_LEVEL, s.currentLevel);
      if (s.aaSettings !== undefined) setMetaField(doc, META_AA, s.aaSettings);
      if (s.schAetherflowPatterns !== undefined) setMetaField(doc, META_SCH, s.schAetherflowPatterns);
    }
  }, 'local');
  return need.size;
}

/**
 * sync 完了時に部屋の現在状態を store に初期反映する(オーナー入室・ジョイナー購読の共通処理)。
 * readOnly のときは編集委譲(enterCollabMode)をしない＝ジョイナーの操作は Y に一切流れない(購読のみ)。
 * partyMembers は meta より前に反映(meta の currentLevel 再計算が同期済みメンバーを読むため)。
 * ⑤-3b: sync 後に planMeta の contentId(不変・seed のみ)を onContentId で渡す。
 */
export function applyRoomToStore(
  doc: Y.Doc,
  opts: { readOnly: boolean; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void; onOwnerLabel?: (label: string | undefined) => void },
): void {
  if (!opts.readOnly) {
    const store = useMitigationStore.getState();
    store.enterCollabMode(opts.handlers);
    // データ安全(絶対に破壊しない): 部屋が空(seed 失敗 / 保存間引き中の再接続 / ハイバネ復帰で
    // 揃わない 等)なのに手元に中身がある「構造フィールド」は、空スナップショットで潰さず手元を
    // 正として再シードする。**部分的な空(例: 軽減だけ空・イベントは残る)も対象**(これが今回の
    // データ破壊の真因で、旧実装は「丸ごと空」しか守れていなかった)。applyUpsert = id 一致は部分
    // 更新・新規のみ push = 列増殖しない。再シード後は doc が手元と一致するので、下の apply-all を
    // 空が潰すことはない(早期 return 不要)。サーバ側 emptyOverwriteSkips と対の多重防御。
    reseedEmptyDocFields(doc, store);
  }
  const s = useMitigationStore.getState();
  s._applyMitigationsFromCollab(readMitigations(doc));
  s._applyEventsFromCollab(dedupeById(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY)));
  s._applyPhasesFromCollab(dedupeById(readArray<Phase>(doc, PHASES_KEY)));
  s._applyLabelsFromCollab(dedupeById(readArray<Label>(doc, LABELS_KEY)));
  s._applyMemosFromCollab(dedupeById(readArray<PlanMemo>(doc, MEMOS_KEY)));
  s._applyPartyMembersFromCollab(dedupeById(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY)));
  s._applyMetaFromCollab(readPlanMeta(doc));
  opts.onContentId?.(readContentId(doc));
  opts.onOwnerLabel?.(readOwnerLabel(doc));
}

/**
 * roomToken を部屋として共同編集セッションを開始する(⑤-3a でルーム鍵を plan ID → roomToken に分離)。
 * サーバ routing /parties/room/<roomToken> に合わせ party:"room" を指定。
 * ⑤-3b: opts.readOnly でジョイナー購読モード(enterCollabMode を呼ばず観測のみ)。
 */
/** worker が失効(revoke)で接続を閉じるときのクローズコード(server.ts と同値・4000-4999 アプリ専用域)。 */
export const REVOKED_CLOSE_CODE = 4001;

export function startCollabSession(
  roomToken: string,
  opts: {
    readOnly?: boolean;
    onContentId?: (id: string | undefined) => void;
    onOwnerLabel?: (label: string | undefined) => void;
    /** オーナーがリンクを失効 → worker が接続を閉じたとき呼ぶ(再接続は止める)。UI 側で「終了」表示に使う。 */
    onRevoked?: () => void;
  } = {},
): CollabSession {
  const doc = new Y.Doc();
  const provider = new YProvider(COLLAB_HOST, roomToken, doc, {
    party: 'room',
    connect: true,
    // ④-a: 接続時に Firebase ID トークンをクエリ送付(viewer は空)。firebase は動的 import で
    // collabProvider の静的グラフを汚さない(遅延境界・テスト容易性を保つ)。
    params: () =>
      buildCollabParams(async () => {
        const { auth } = await import('../firebase');
        const user = auth.currentUser;
        return user ? await user.getIdToken() : null;
      }),
  });

  // 失効クローズ(4001)を受けたら再接続を止める(reconnect ハンマー回避)+ UI へ通知。
  // 通常の切断(ネット瞬断=1006 等)は無視して自動再接続に任せる(失効だけを特別扱い)。
  const onConnClose = (event: { code?: number } | undefined) => {
    if (event?.code === REVOKED_CLOSE_CODE) {
      provider.shouldConnect = false;
      opts.onRevoked?.();
    }
  };
  provider.on('connection-close', onConnClose as (e: unknown) => void);
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

  // ②-c: CRDT undo/redo。scope は solo 履歴と同じ 5 トップレベル型(memos/meta は対象外)。
  // trackedOrigins=['local'] で自分の編集だけを積む(planUndoManager 内で設定)。
  // readOnly(閲覧者)でも生成して可(ローカル編集をしないのでスタックは常に空)。
  const planUndo: PlanUndoManager = createPlanUndoManager(
    [yarr, yEvents, yPhases, yLabels, yPartyMembers],
    (canUndo, canRedo) => useMitigationStore.getState()._setCollabUndoRedo(canUndo, canRedo),
  );

  // Yjs → store。自分の操作も相手の操作も同じ observeDeep 経路で store に入る(単一の真実 = Y.Doc)。
  // Y.Map 内フィールド変更(time の set 等)も拾うため observe ではなく observeDeep。
  const applyToStore = () =>
    useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  yarr.observeDeep(applyToStore);

  // ②-b-1: 各要素の Yjs → store 反映(pushHistory は積まない＝②-a と同じ)。
  const store = () => useMitigationStore.getState();
  const applyEvents = () => store()._applyEventsFromCollab(dedupeById(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY)));
  const applyPhases = () => store()._applyPhasesFromCollab(dedupeById(readArray<Phase>(doc, PHASES_KEY)));
  const applyLabels = () => store()._applyLabelsFromCollab(dedupeById(readArray<Label>(doc, LABELS_KEY)));
  const applyMemos = () => store()._applyMemosFromCollab(dedupeById(readArray<PlanMemo>(doc, MEMOS_KEY)));
  const applyMeta = () => store()._applyMetaFromCollab(readPlanMeta(doc));
  const applyPartyMembers = () => store()._applyPartyMembersFromCollab(dedupeById(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY)));
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
    // ②-c: CRDT undo/redo。Y.UndoManager が origin='local' の変更だけを逆操作する。
    undo: () => planUndo.undo(),
    redo: () => planUndo.redo(),
  };

  // 初期同期完了後に入室処理。
  // 段取り③: seed はサーバー(DO の onLoad が Firestore から)が担うため、クライアントは
  // 「部屋の状態を store に反映」するだけ(自分のローカル軽減で seed しない)。これにより
  // 「部屋の状態 = Firestore の保存済み内容」が唯一の真実になり、オーナー不在でも矛盾しない。
  const readOnly = opts.readOnly ?? false;

  // ④-b-1: roster(誰がいる・色・編集/閲覧)を WS awareness で全員に配信。
  // isEditor は表示用バッジ(真実の権限は④-a のサーバゲート)= 編集接続(!readOnly)か。
  const localPresence: PresenceState = {
    color: colorForClient(provider.awareness.clientID),
    jobId: null,         // ④-b-2 で自己選択 UI(store の jobId で駆動)
    isEditor: !readOnly,
    cursorEnabled: false, // ④-b-2: 既定 OFF オプトイン(IP 露出は本人が ON にした時のみ)
  };
  const presenceHandle = wirePresence(
    provider.awareness as unknown as AwarenessLike,
    localPresence,
    (roster) => useCollabPresenceStore.getState().setRoster(roster),
  );

  // #3d: 確実な人数は roster(awareness=ハイバネで揮発)でなくサーバの接続リスト由来。
  //   入退室(awareness の add/removed)時にだけ /count を取り直す(カーソル更新では取らない)。
  const healTimers: ReturnType<typeof setTimeout>[] = []; // ①収束用の遅延再チェック(disconnect で破棄)
  const refreshCount = () => {
    void fetchRoomCount(roomToken).then((n) => {
      if (n === null) return;
      useCollabPresenceStore.getState().setConnectionCount(n);
      // ①自己修復: 確実な人数 > 名前付き roster なら presence が揮発している(ハイバネ復帰の非対称欠落)。
      //   requestResync() で「みんな再送して」を出す=自分の presence も全員へ再送され、受信側も応答で
      //   再送 → 双方向に穴が埋まり、何もしないで待っていても収束する(入退室時だけ=$0 設計を壊さない)。
      if (n > useCollabPresenceStore.getState().roster.length) presenceHandle.requestResync();
    });
  };
  const onAwarenessMembership = (changes: { added: number[]; removed: number[] }) => {
    if (changes.added.length > 0 || changes.removed.length > 0) refreshCount();
  };
  provider.awareness.on('change', onAwarenessMembership);

  // ④-b-2: live カーソル(P2P)。mesh + signaling(awareness 相乗り)。
  // WebRTC は遅延チャンク内なので main bundle 非混入。
  // signal の callback は mesh を、mesh の sendSignal は signal を参照する循環だが、
  // どちらも構築時には発火しない(awareness 変化 / signal 受信時のみ)ため初期化順は安全。
  const awarenessLike = provider.awareness as unknown as AwarenessLike;
  const signal = wireSignal(awarenessLike, (msg) => void mesh.handleSignal(msg));
  const mesh = createCursorMesh({
    localClientId: provider.awareness.clientID,
    makePeer: createRealPeer,
    sendSignal: (m) => signal.send(m),
    onPacket: (p) => useRemoteCursorsStore.getState().apply(p),
    // P2P 不成立(厳しい NAT 等)は静かにフォールバック表示(エラー扱いしない)。
    onFallback: () => useCollabPresenceStore.getState().setCursorFallback(true),
  });

  // ④-b-2: store の cursorEnabled/jobId 変化を awareness presence に反映し、mesh を reconcile。
  // これで「ON にした人だけが mesh に入る」(= IP を共有する)が成立。update は差分時のみ(無限ループ防止)。
  let lastEnabled = false;
  let lastJobId: string | null = null;
  const syncLocalPresence = () => {
    const st = useCollabPresenceStore.getState();
    if (st.cursorEnabled !== lastEnabled || st.jobId !== lastJobId) {
      lastEnabled = st.cursorEnabled;
      lastJobId = st.jobId;
      presenceHandle.update({ cursorEnabled: st.cursorEnabled, jobId: st.jobId });
    }
    void mesh.reconcile(st.roster, st.cursorEnabled);
  };
  const unsubReconcile = useCollabPresenceStore.subscribe(syncLocalPresence);

  // ④-b-2: Timeline からの送信を mesh.broadcast にブリッジ(Timeline は yjs 非依存のまま)。
  useCursorSendStore.getState().setBroadcaster((p) => mesh.broadcast(p), provider.awareness.clientID);

  let entered = false;
  const onSynced = (isSynced: boolean) => {
    if (!isSynced || entered) return;
    entered = true;
    // ②-b-1/②-b-2 の全要素初期反映 + ⑤-3b の readOnly 分岐 + contentId seed 取得を 1 箇所に集約。
    applyRoomToStore(doc, { readOnly, handlers, onContentId: opts.onContentId, onOwnerLabel: opts.onOwnerLabel });
    refreshCount(); // #3d: 接続確立時に確実な人数を 1 回取得。
    // ①: 初回 /count は他者の接続/presence 伝播より早いことがある。少し置いて 2 回だけ再チェックし、
    //    まだ欠落していれば resync を出す(membership 変化が来ない静止状態でも収束させる保険)。
    healTimers.push(setTimeout(refreshCount, 2000));
    healTimers.push(setTimeout(refreshCount, 5000));
  };
  provider.on('sync', onSynced);

  const disconnect = () => {
    provider.off('sync', onSynced);
    provider.off('connection-close', onConnClose as (e: unknown) => void); // 失効リスナー解除
    provider.awareness.off('change', onAwarenessMembership); // #3d
    healTimers.forEach(clearTimeout); // ① 遅延再チェックを破棄
    yarr.unobserveDeep(applyToStore);
    yEvents.unobserveDeep(applyEvents);
    yPhases.unobserveDeep(applyPhases);
    yLabels.unobserveDeep(applyLabels);
    yMemos.unobserveDeep(applyMemos);
    yMeta.unobserveDeep(applyMeta);
    yPartyMembers.unobserveDeep(applyPartyMembers);
    // readOnly(ジョイナー購読)は enterCollabMode していないので exit も不要(購読解除＝unobserve で十分)。
    if (!readOnly) useMitigationStore.getState().exitCollabMode();
    presenceHandle.stop();
    unsubReconcile();
    signal.stop();
    signal.clear();        // awareness の signal フィールドを空に(SDP=IP を残さない)
    mesh.destroy();
    useCursorSendStore.getState().setBroadcaster(null, null);
    useRemoteCursorsStore.getState().clear();
    useCollabPresenceStore.getState().clear();
    planUndo.destroy(); // ②-c: UndoManager のリスナー解除 + doc afterTransaction ハンドラ除去
    useMitigationStore.getState()._setCollabUndoRedo(false, false); // ボタン活性リセット
    provider.destroy();
    doc.destroy();
  };

  return { provider, doc, disconnect };
}
