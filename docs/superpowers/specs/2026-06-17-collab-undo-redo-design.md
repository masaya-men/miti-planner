# 共同編集中の Undo/Redo (CRDT 化・②-c) 設計書

> 2026-06-17 / 機能アイデア由来=リアルタイム共同編集の積み残し ②-c
> 「共同編集中は Undo/Redo が効かない（オーナーも戻せない）」を CRDT 対応 Undo で解消する。

## 1. 問題と根本原因 (事実ベース・全て実コード確認済)

- 共同編集中、Undo/Redo ボタンは**常時グレーアウトし、ショートカットも no-op**。オーナー・参加者を問わない。
- 根本原因（推測なし・引用付き）:
  - 全ローカル編集は単一 `Y.Doc` に `doc.transact(..., 'local')` で書く（[collabProvider.ts:262-334](../../../src/lib/collab/collabProvider.ts#L262)）。
  - Yjs → store の反映は observeDeep 経由で、**`pushHistory` を呼ばない**＝ローカル履歴 `_history`/`_future` は共同編集中積まれない（[useMitigationStore.ts:556](../../../src/store/useMitigationStore.ts#L556)）。
  - そのため `undo`/`redo` は `_collabActive` で no-op を返すしかなかった（[useMitigationStore.ts:678](../../../src/store/useMitigationStore.ts#L678) / [:703](../../../src/store/useMitigationStore.ts#L703)）。コメントに「CRDT undo は②-c」と明記。
  - UI のボタン活性は `_history.length`/`_future.length` で判定（[Timeline.tsx:602-603](../../../src/components/Timeline.tsx#L602)）→ 共同編集中は空なので常に disabled。
- 当初設計でも ②-c は「**Undo/Redo の CRDT 化(Y.UndoManager)**」と定義済み（[stage2a design §非ゴール](2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md)）。本設計はその実装。

## 2. 依存・前提の網羅確認 (データ安全のための事実確認)

| 確認項目 | 結果 | 根拠 |
|---|---|---|
| `Y.UndoManager` の利用可否 | 利用可（export 済） | yjs 13.6.31・[UndoManager.d.ts](../../../node_modules/yjs/dist/src/utils/UndoManager.d.ts) |
| リモート変更を上書きしないか | **デフォルトで上書きしない** | `ignoreRemoteMapChanges` 既定 false（d.ts:23・「By default, never overwrite remote changes」） |
| 全ローカル編集の origin | **すべて `'local'`** | add/remove/updateTime/upsertItems/removeItems/setMeta/importBulk([collabProvider.ts](../../../src/lib/collab/collabProvider.ts)) + batch/applyBatch([yjsPlanData.ts:130](../../../src/lib/collab/yjsPlanData.ts#L130)) + reseed([collabProvider.ts:150](../../../src/lib/collab/collabProvider.ts#L150)) |
| リモート更新適用時の origin | **`provider`(オブジェクト)** ＝ `'local'` ではない | [y-partyserver provider/index.js:22-27](../../../node_modules/y-partyserver/dist/provider/index.js#L22)（`readSyncMessage(... , provider)`） |
| 保存経路 | サーバ(DO)が `Y.Doc` から Firestore へ。Undo も通常 transact = 同経路 = **既存防御を継承** | [collabProvider.ts:116](../../../src/lib/collab/collabProvider.ts#L116) コメント / サーバ `emptyOverwriteSkips` |
| `destroy()` の有無 | あり（後始末可能） | [UndoManager.js:398](../../../node_modules/yjs/src/utils/UndoManager.js#L398) |
| solo Undo の対象範囲 | 5種=mitigations/events/phases/labels/partyMembers（memos・meta は対象外） | [useMitigationStore.ts:497-503](../../../src/store/useMitigationStore.ts#L497) |

**結論**: `trackedOrigins: new Set(['local'])` の `Y.UndoManager` は、**自分の編集だけを Undo スタックに積み、他人の編集は構造上絶対に捕捉しない**。さらに既定でリモート変更を上書きしない。過去のデータ消失（空スナップショットの丸ごと上書き／再シード desync）とは**層が異なり**、Undo はその層を一切触らない。

## 3. 方針

- **per-user undo**（各自が自分の操作だけを戻す。Google Docs / Figma 標準）をユーザー承認済。
- `Y.UndoManager` を `collabProvider` 内で生成。scope = solo と同じ **5 つのトップレベル Y 型**（`YJS_MITIGATIONS_KEY` / `TIMELINE_EVENTS_KEY` / `PHASES_KEY` / `LABELS_KEY` / `PARTY_MEMBERS_KEY`）。**memos と planMeta は scope 外**（solo と挙動パリティ＝最小驚き）。
- `trackedOrigins: new Set(['local'])`、`captureTimeout: 0`（1 操作=1 Undo 単位＝solo と同等。連打でまとめ過ぎない）。
- store の `undo`/`redo` は共同編集中、ローカル履歴ではなく **handlers 経由で UndoManager に委譲**する。反映は従来どおり observeDeep → store。
- ボタン活性は共同編集中、UndoManager の `canUndo()/canRedo()` を反映する新フラグ `_collabCanUndo`/`_collabCanRedo` を購読する。

## 4. アーキテクチャ

```
[Timeline ボタン/ショートカット]
   → useMitigationStore.undo()
       ├ _collabReadonly → no-op (閲覧者・既存ガード維持)
       ├ _collabActive   → _collabHandlers.undo()  ← 新規委譲
       │                       → planUndoManager.undo()
       │                           → Y.UndoManager.undo() (origin='local' の変更だけ逆操作)
       │                               → observeDeep → _apply*FromCollab → store 反映 → 再描画
       └ それ以外         → 既存ローカル履歴 undo (無改変)

[Y.UndoManager の stack 変化イベント]
   → planUndoManager が canUndo/canRedo を算出
       → store._setCollabUndoRedo(canUndo, canRedo)
           → Timeline の canUndo/canRedo セレクタが再評価 → ボタン活性更新
```

## 5. データ安全策（厳守）

1. **既存の防御・保存・スナップショット経路には一切触れない（純粋な追加のみ）**。
2. **UndoManager 未生成時は従来どおり no-op フォールバック**（`_collabHandlers?.undo()` で optional・クラッシュさせない）。
3. **閲覧者ガード維持**: `undo`/`redo` 冒頭の `_collabReadonly` チェックは残す（多層防御）。
4. `disconnect` で UndoManager を `destroy()` し、`_collabCanUndo`/`_collabCanRedo` を false に戻す。
5. 2 タブ実機検証は**捨てプラン（テスト用の表）**で行い、本物のユーザーデータには触れない。

## 6. リスクと対策

| リスク | 度合い | 対策 |
|---|---|---|
| データ消失（過去事故型） | ほぼ無し | スナップショット層を触らない／既存防御を継承（§2 結論） |
| 自分の Undo が他人の編集を巻き戻す | 中→対策可 | `trackedOrigins:['local']` 限定 + 既定でリモート非上書き。**核心テストで担保**（§7 Task1） |
| Undo 範囲ズレ（カスケード） | 低 | 1 transaction = 1 Undo 単位。テストで担保 |
| 連打でまとめ過ぎ | 低(UX) | `captureTimeout: 0` |
| 後始末漏れ | 低 | disconnect で destroy + フラグ reset |

## 7. 非ゴール

- memos / currentLevel / aaSettings / schAetherflowPatterns の Undo（solo も非対応・別途検討）。
- 共有スタック（global undo）。
- Undo 履歴の永続化（セッション内のみ・再接続でクリアは正常）。
- 「誰が戻したか」の presence 表示。
