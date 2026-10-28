/**
 * 共同編集: 部屋の現在状態を store に初期反映する(sync 完了時)+ 空上書き防御の再シード。
 */

import * as Y from 'yjs';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { readMitigations, YJS_MITIGATIONS_KEY } from './yjsMitigations';
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY,
  META_LEVEL, META_AA, META_SCH, PARTY_MEMBERS_KEY, PROGRESS_POINTS_KEY,
  META_PROGRESS_CLEARED, META_PROGRESS_DAYS, META_PROGRESS_HOURS,
  applyUpsert, setMetaField, readArray, readPlanMeta, readContentId, readOwnerLabel,
} from './yjsPlanData';
import { dedupeById } from './dedupeById';
import { fieldsNeedingReseed, RESEED_FIELDS, canTrustLocalDataForRoom } from './collabReseed';
import type { TimelineEvent, Phase, Label, PlanMemo, PartyMember, ProgressPoint } from '../../types';
import type { CollabHandlers } from './collabTypes';

/**
 * client 側 空上書き防御: 「doc 側が空・手元(store)が非空」の構造フィールドだけを
 * 手元から id 単位 upsert で再シードする(列増殖しない)。部分的な空(例: 軽減だけ空・
 * イベントは残る)でも手元を潰さない＝サーバ _logic.ts emptyOverwriteSkips と対の多重防御。
 * 全構造フィールドが空(=seed 完全失敗)のときだけ labels/memos/進捗/meta も手元から復元する。
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
      // 進捗(2026-10-27 抜けを補う): 打点と 3 スカラー
      applyUpsert(doc.getArray<Y.Map<unknown>>(PROGRESS_POINTS_KEY), s.progress?.points ?? []);
      if (s.progress?.cleared !== undefined) setMetaField(doc, META_PROGRESS_CLEARED, s.progress.cleared);
      if (s.progress?.activeDays !== undefined) setMetaField(doc, META_PROGRESS_DAYS, s.progress.activeDays);
      if (s.progress?.activeHours !== undefined) setMetaField(doc, META_PROGRESS_HOURS, s.progress.activeHours);
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
  opts: { readOnly: boolean; roomToken: string; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void; onOwnerLabel?: (label: string | undefined) => void },
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
    // 2026-08-07データ安全監査: 上記は「手元データ=このプランのもの」という前提を無条件に
    // 信頼していたため、無関係なプランのデータが他人の部屋へ混入する経路があった。接続直前に
    // 持ち主を確認し、一致するときだけ再シードする(不一致でも enterCollabMode 自体は続行し、
    // 直後の apply-all で部屋の真のデータが手元に反映されるので共同編集は問題なく始まる)。
    const trusted = canTrustLocalDataForRoom({
      loadedPlanId: store._loadedPlanId,
      roomToken: opts.roomToken,
      plans: usePlanStore.getState().plans,
    });
    if (trusted) {
      reseedEmptyDocFields(doc, store);
    } else {
      // 通常の参加者接続(他人の部屋へゲスト参加)では毎回不一致になるのが正常なため、
      // 本番コンソールを汚さないよう dev のみ警告する(2026-08-07監査 最終レビュー指摘)。
      if (import.meta.env.DEV) {
        console.warn('[LoPo][collab] 手元データの持ち主が接続先の部屋と一致しないため、空上書き防御をスキップしました', {
          loadedPlanId: store._loadedPlanId, roomToken: opts.roomToken,
        });
      }
    }
  }
  const s = useMitigationStore.getState();
  s._applyMitigationsFromCollab(readMitigations(doc));
  s._applyEventsFromCollab(dedupeById(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY)));
  s._applyPhasesFromCollab(dedupeById(readArray<Phase>(doc, PHASES_KEY)));
  s._applyLabelsFromCollab(dedupeById(readArray<Label>(doc, LABELS_KEY)));
  s._applyMemosFromCollab(dedupeById(readArray<PlanMemo>(doc, MEMOS_KEY)));
  s._applyProgressPointsFromCollab(dedupeById(readArray<ProgressPoint>(doc, PROGRESS_POINTS_KEY)));
  s._applyPartyMembersFromCollab(dedupeById(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY)));
  s._applyMetaFromCollab(readPlanMeta(doc));
  opts.onContentId?.(readContentId(doc));
  opts.onOwnerLabel?.(readOwnerLabel(doc));
}
