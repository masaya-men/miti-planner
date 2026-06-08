# 共同編集 段取り②-b-1 設計書：軽量 PlanData ライブ同期 (2026-06-08)

## 0. 位置づけ

- 順番B決定（[docs/.private/2026-06-08-collab-roadmap-order-B-decision.md](../../.private/2026-06-08-collab-roadmap-order-B-decision.md)）で「次は②-b（全 PlanData ライブ同期＝自己完結ドキュメントの土台）」と確定。
- ②-b は実装難易度に明確な段差があるため **2 段階に分割**（最終ゴール＝全 PlanData ライブ同期は不変、実装の置き場所を分けるだけ）:
  - **②-b-1（本設計）**: 他要素に波及しない軽量要素＝`timelineEvents` / `phases` / `labels` / `memos` / `aaSettings` / `currentLevel` / `schAetherflowPatterns`。
  - **②-b-2（後段・別ブレスト）**: 重い `partyMembers`（ジョブ変更が `timelineMitigations` に深く波及）。
- ②-a（`timelineMitigations` 同期）／③（Firestore 恒久保存）は **本番稼働中**。本設計は **これを壊さず additive に拡張**する。
- **UI 入口なしのまま main に dormant 投入**（②-a／⑤-2b と同型・ユーザー影響ゼロ）。

## 1. 前提（既存実装の確認結果）

- PlanData の全フィールドは単一の `useMitigationStore`（[src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)）に存在。
- ②-a の同期パターン（[src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts)）:
  - 共同編集中、各 store 操作は `_collabActive` を見て **ハンドラに委譲して early-return**（`pushHistory` も local `set` もスキップ）。
  - ハンドラが Y 操作（cascade はここで再現）→ `observeDeep` → `_applyMitigationsFromCollab` で store 反映。**Y.Doc が唯一の正**。
  - UI 一時状態（プロンプト等）だけローカル `set`（[useMitigationStore.ts:849-861](../../../src/store/useMitigationStore.ts#L849-L861)）。
  - 共同編集の反映は **undo 履歴に積まない**（CRDT undo は②-c。[useMitigationStore.ts:333](../../../src/store/useMitigationStore.ts#L333)）。
- ③ 永続化:
  - worker `Room.onLoad`（[workers/collab/src/server.ts:41](../../../workers/collab/src/server.ts#L41)）が受付係 `/api/collab/load` から seed を取得し `buildSeedDoc` で Y.Doc 構築。`onSave`/`onClose` で `readMitigations` → `/api/collab/save` に書き戻し。
  - Vercel 側 `decideLoad`/`decideSave`（[api/collab/_logic.ts](../../../api/collab/_logic.ts)）は **`data.timelineMitigations` だけ**を扱う。save は `tx.update(ref, {'data.timelineMitigations': ..., version, updatedAt})`（[api/collab/_saveHandler.ts:42-46](../../../api/collab/_saveHandler.ts#L42-L46)）。
- phases/labels には **クリッピング連鎖**がある（add で含有フェーズを `startTime-1` で打ち切り、resize で隣接フェーズの端を調整）。[useMitigationStore.ts:645-745](../../../src/store/useMitigationStore.ts#L645-L745)。②-a のセラフィム重複削除と同じく **ハンドラ内で再現すべき**ロジック。

## 2. アーキ方針：②-a の「委譲方式」を additive 拡張

**採用＝委譲方式（②-a と同一モデル）**。各 b-1 操作は共同編集中、対応するハンドラに委譲し early-return（`pushHistory`/local `set` スキップ）。ハンドラが Y 操作（クリッピング連鎖を再現）→ `observeDeep` → store 反映。

**不採用＝反映方式（store 計算→Y 差分転写）**: 連鎖の再実装は減るが、双方向ループ防止ガード・undo 別扱いが要り、②-a と 2 つのメンタルモデルが混在する。b-1 の連鎖は中規模で委譲方式で十分きれいに再現できるため、1 モデルで通す。

重い `partyMembers`（②-b-2）はカスケードが桁違いに大きいため、b-2 のブレストで「store 計算→転写」方式を改めて検討する（§8）。

## 3. Y.Doc 構造（②-a に additive で並べる）

既存 `timelineMitigations`（②-a の `Y.Array<Y.Map>`）に加える:

| キー | Y 型 | 中身 | マージ単位 |
|---|---|---|---|
| `timelineEvents` | `Y.Array<Y.Map>` | ボス行動 | id 単位 |
| `phases` | `Y.Array<Y.Map>` | フェーズ | id 単位 |
| `labels` | `Y.Array<Y.Map>` | ラベル | id 単位 |
| `memos` | `Y.Array<Y.Map>` | メモ | id 単位 |
| `planMeta` | `Y.Map` | `currentLevel`(number) / `aaSettings`(object) / `schAetherflowPatterns`(object) | フィールド単位 |

- 配列系の各 `Y.Map` は対象型の全フィールドを保持。`LocalizedString`（`name`）など入れ子オブジェクトは **Yjs のプレーン値として丸ごと格納・置換**（文字単位の共同編集はしない＝YAGNI）。任意フィールドは値があるときだけ `set`（②-a `appliedToYMap` と同方針。[src/lib/collab/yjsMitigations.ts:8-19](../../../src/lib/collab/yjsMitigations.ts#L8-L19)）。
- `planMeta` のスカラー類は `Y.Map` のフィールド後勝ち。`schAetherflowPatterns`（`Record<string,1|2>`）は `planMeta` 内のネスト `Y.Map<number>`（memberId → pattern）。

### マージ意味（衝突時の挙動）

- **配列系**: 別項目を同時編集 → 両方残る。同一項目の同一フィールド同時編集 → 後勝ち（軽減表では稀）。
- **planMeta**: フィールド単位後勝ち。
- `currentLevel` 変更は各メンバーの `computedValues` 再計算を伴うが、`computedValues` は**派生データ**なので各クライアントがローカル再計算（同期しない）。b-1 では `partyMembers` 未同期のため各自ローカル再計算で問題なし。b-2 で `partyMembers` 同期後も `currentLevel`＋`partyMembers` が揃って同期されるため整合する。

## 4. クライアント側ブリッジ（[src/lib/collab/](../../../src/lib/collab/)）

②-a の構成を踏襲して additive 追加:

- **Y 変換モジュール**（②-a `yjsMitigations.ts` と同パターン）: 各要素型 ⇄ `Y.Map` の往復関数 + `Y.Doc` 全体 read。
  - 配列系で重複が出やすいため **id キー配列の汎用ヘルパ**（`appliedToYMap` 相当の per-type 変換 + `indexOfById` + `addItem/removeItem/updateItemFields`）を用意し、各要素はそれを使う。
- **`CollabHandlers` 拡張**（[src/lib/collab/collabTypes.ts](../../../src/lib/collab/collabTypes.ts)）: events/phases/labels/memos の add/remove/update、planMeta の setLevel/setAaSettings/setSchPattern を追加。store は型のみ参照（yjs 非 import の遅延ロード境界を維持）。
- **`startCollabSession`**（[collabProvider.ts:64](../../../src/lib/collab/collabProvider.ts#L64)）: 新キーの `Y.Array`/`Y.Map` を取得し、各々に `observeDeep` を張る。`applyToStore` を全要素対応に拡張（Y → store 一括反映）。`disconnect` で全 observe を解除。
- **ハンドラ実装**: phases/labels の add/resize は store ソロ版（[useMitigationStore.ts:645-745](../../../src/store/useMitigationStore.ts#L645-L745)）と**同一ロジックを Y 操作で再現**（含有打ち切り・隣接端調整を同一 `doc.transact` 内で）。その他は素の add/remove/field-set。
- **バルク操作 `importTimelineEvents`（FFLogs 取込）**: events + phases + labels を一括置換する（[useMitigationStore.ts:603-630](../../../src/store/useMitigationStore.ts#L603-L630)）。collab では専用バルクハンドラで **3 つの `Y.Array` を同一 `doc.transact` 内でクリア→再投入**（全置換＝後勝ち。取込は破壊的操作なので id 単位マージ不要）。

## 5. store 側委譲（[src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)）

②-a `addMitigation`（[L845-861](../../../src/store/useMitigationStore.ts#L845-L861)）と同型で、対象 mutation の先頭に分岐を追加:

```
if (get()._collabActive && get()._collabHandlers) {
  // （UI 一時状態があればローカル set）
  get()._collabHandlers!.<op>(...);
  return;            // pushHistory / local set はスキップ
}
// 以下、既存ソロ実装そのまま
```

対象 mutation（b-1・実関数名は確認済）:
- events: `addEvent` / `updateEvent` / `removeEvent` / `importTimelineEvents`（バルク＝§4 参照・events+phases+labels 一括）
- phases: `addPhase` / `updatePhase` / `removePhase` / `updatePhaseEndTime` / `updatePhaseStartTime`
- labels: `addLabel` / `updateLabel` / `removeLabel` / `updateLabelEndTime` / `updateLabelStartTime`
- memos: `addMemo` / `updateMemo` / `deleteMemo` / `deleteAllMemos`
- planMeta: `setCurrentLevel`（の level 部分）/ `setAaSettings` / `setSchAetherflowPattern`

> バルク／リセット系の監査（実装 plan で必須）: `importTimelineEvents` 以外にも store 全体を差し替える経路（`loadSnapshot`・レベル別 reset [useMitigationStore.ts:1268-1277](../../../src/store/useMitigationStore.ts#L1268-L1277)・undo/redo）がある。共同編集中はこれらが Y を経由せず store だけ書き換えると **無言で desync** する。plan で全経路を洗い、collab 中は委譲するか発火しないことを保証する（undo/redo の CRDT 化は②-c なので b-1 では collab 中の undo を無効化 or 据え置き＝②-a と同じ扱い）。

Y → store 反映関数（`_applyMitigationsFromCollab` 相当を要素ごとに）: pushHistory を呼ばず set。`currentLevel` 反映時は `computedValues` をローカル再計算。

> 注意（実装フェーズで再点検）: `setCurrentLevel` はソロ版で `partyMembers` の再計算も同時に行う（[useMitigationStore.ts:515-516](../../../src/store/useMitigationStore.ts#L515-L516)）。b-1 では `partyMembers` 未同期なので、collab 分岐では **level を Y に送る＋ローカルの `partyMembers.computedValues` 再計算**のみ行い、`partyMembers` 配列自体は同期しない。

## 6. 永続化（③）の additive 拡張

「mitigations だけ」を「全 b-1 要素」に広げる。**mitigations 経路は無改変、フィールドを増やすだけ**。

- **worker**（[workers/collab/src/](../../../workers/collab/src/)）:
  - Y 変換（`yjsMitigations.ts` のミラー）を全 b-1 要素対応に拡張（新モジュール or 既存拡張）。`buildSeedDoc` が全要素を seed、`readPlanData` が全要素を読む。
  - `collabPersistence.ts` `SeedResult` に新フィールド追加。`fetchSeed`/`postPlanData` が全要素を授受。
  - `server.ts` `onLoad`/`flushSave` を全要素対応に。**`#saveEnabled` 破壊保存ガード・墓標ガード・debounce は現行どおり**。`/count`・`MAX_PARTICIPANTS_KEY`（⑤-2b）は無関係＝無改変。
- **Vercel**（[api/collab/](../../../api/collab/)）:
  - `_logic.ts` `PlanDocSnapshot` を全 b-1 `data.*` 対応に拡張。`decideLoad` が全要素 seed を返す。`decideSave` は version 計算据え置き。
  - `_saveHandler.ts` の `tx.update` を全 b-1 `data.*` フィールドに拡張（`data.timelineEvents` / `data.phases` / `data.labels` / `data.memos` / `data.aaSettings` / `data.currentLevel` / `data.schAetherflowPatterns`）。**`data.timelineMitigations`・version・updatedAt・墓標ガードは現行どおり**。
  - `_loadHandler.ts` は roomToken→planId 解決（⑤-1）・緊急停止・墓標ガードを無改変で通し、返す JSON に新フィールドを追加。
- **後方互換**: 既存プランで `labels`/`memos` 等が undefined のケースを seed/save 両側でデフォルト（`[]`/既定オブジェクト）にフォールバック。

## 7. 同期しないもの（ローカル維持）

- `myMemberId`（個人の表示設定＝自ジョブハイライト用。[CheatSheetView.tsx:226](../../../src/components/CheatSheetView.tsx#L226) / [TimelineRow.tsx:106](../../../src/components/TimelineRow.tsx#L106)）。seed 時の初期値のみ Firestore から読むが、**共同編集中は各クライアントのローカル値**（同期すると全員で 1 値共有になり他者のハイライトを壊す）。
- UI トグル（`myJobHighlight` / `hideEmptyRows` / `showRowBorders` 等）。
- `partyMembers`（②-b-2）/ `partyMembers.computedValues`（派生）。
- undo 履歴（②-a と同じく共同編集の反映は積まない。CRDT undo は②-c）。
- `contentId`（不変。seed のみ・同期不要）。

## 8. ②-b-2 への接続（最終ゴール担保）

- b-1 完了時点で `partyMembers` 以外は全要素ライブ同期。b-2 で `partyMembers`（ジョブ変更カスケード）を追加すれば「全員が同じ 1 枚を全要素ライブ編集」が完成。
- b-2 の難所＝ジョブ変更が `timelineMitigations` に波及（フィルタ／別ジョブ移行／学者・占星の自動挿入。[useMitigationStore.ts:1063-1105](../../../src/store/useMitigationStore.ts#L1063-L1105)）。`timelineMitigations` は②-a が所有するため、b-2 はこの継ぎ目（store 計算結果の mitigation 差分を②-a ハンドラ経由で流すか／b-2 側で mitigations も転写するか）を改めて設計する。**本設計（b-1）は mitigations に一切触れない**ため b-2 を阻害しない。

## 9. テスト方針（TDD・緑維持）

- **純ロジック**: 各要素の Y ⇄ 型往復、phases/labels クリッピング連鎖の Y 再現（ソロ版と同結果）。
- **worker 永続化**: `fetchMock` で seed/save の全要素授受（②-a `collabPersistence.test.ts` と同型）。破壊保存ガード・墓標ガードの回帰。
- **Vercel ハンドラ**: load/save が全 `data.*` を授受・mitigations/version/墓標を回帰。
- **非破壊回帰**: root 既存テスト全緑、②-a／③ の mitigations 同期・worker 24 テストが緑のまま。

## 10. dormant / デプロイ方針

- UI 入口なしのまま main に dormant（②-a／⑤-2b と同型）。`collabProvider` を import する UI が増えなければ本番 bundle 非混入。
- worker/Vercel 変更は稼働中ルームが本番に無いため安全（onLoad/onSave は誰も接続しなければ発火しない）。デプロイ（worker `wrangler deploy` / Vercel push）のタイミングと順序は実装 plan で扱う。
- **⑤-3a の UI ブランチ（`feat/collab-stage5-3a-owner-entry`）は held のまま別管理**。b-1 は main から新ブランチで開始。

## 11. スコープ外（YAGNI）

- `partyMembers` 同期（②-b-2）。
- メモ本文・イベント名の文字単位共同編集（`Y.Text`）。
- presence／カーソル（④）。
- CRDT undo（②-c）。
- 実データ往復の本番 E2E は⑤入口後にユーザー 2 ブラウザで（既定方針）。
