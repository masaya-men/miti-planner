# 共同編集 段取り②-b-2 設計書：partyMembers ライブ同期 + ジョブ変更カスケード (2026-06-09)

## 0. 位置づけ

- 順番B（[docs/.private/2026-06-08-collab-roadmap-order-B-decision.md](../../.private/2026-06-08-collab-roadmap-order-B-decision.md)）の **②-b の後半**。前半 ②-b-1（軽量 PlanData 同期）は main dormant 完了（[specs/2026-06-08-...stage2b1...](./2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)）。
- 本段階で **`partyMembers`（パーティ編成）をライブ同期**し、これで「全員が同じ 1 枚を全要素ライブ編集」が完成する。
- **スコープ（ユーザー確定＝案A・2026-06-09）**: `partyMembers` 同期 + **ジョブ変更カスケード**（mitigations 波及）+ **②-a が未委譲のまま残した bulk mitigation 操作 3 種**（`applyAutoPlan` / `clearAllMitigations` / `clearMitigationsByMember`）。
- ②-a（mitigations 同期）/ ③（Firestore 保存）/ ②-b-1 を **壊さず additive に拡張**。**UI 入口なしのまま main dormant**（push/worker deploy はユーザー承認まで保留）。

## 1. 前提（既存実装の確認結果）

- `partyMembers` を変更する store mutation（[src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)）:
  - `updateMemberStats`（[L1378](../../../src/store/useMitigationStore.ts#L1378)）: 1 メンバーの stats + computedValues。**mitigations 波及なし**。
  - `applyDefaultStats`（[L562](../../../src/store/useMitigationStore.ts#L562)）: 全メンバーの stats を level/patch 既定値で一括更新。**波及なし**。
  - `setMemberJob`（[L1181](../../../src/store/useMitigationStore.ts#L1181)）: ジョブ変更 + **そのメンバーの mitigations をフィルタ/別ジョブ移行/学者・占星の自動挿入**（同関数内のカスケード）。
  - `changeMemberJobWithMitigations`（[L1254](../../../src/store/useMitigationStore.ts#L1254)）: ジョブ変更 + **そのメンバーの mitigations を引数配列で上書き** + 学者・占星自動挿入。
  - `updatePartyBulk`（[L1299](../../../src/store/useMitigationStore.ts#L1299)）: 複数メンバーのジョブ/mitigations を一括（履歴 1 回）。
  - `initializeParty` / `resetForTutorial`（[L1497](../../../src/store/useMitigationStore.ts#L1497)）/ `restoreFromSnapshot`: パーティ全置換系（collab では到達しない＝ガード対象）。
- `computedValues`（[L1384 等](../../../src/store/useMitigationStore.ts#L1384)）は **派生データ**（`calculateMemberValues(member, currentLevel)`）。
- bulk mitigation 操作（②-a 未委譲・collab 中に store 直書きで desync する）:
  - `clearMitigationsByMember`（[L498](../../../src/store/useMitigationStore.ts#L498)）: `timelineMitigations` から該当メンバー分を除去。
  - `clearAllMitigations`（[L506](../../../src/store/useMitigationStore.ts#L506)）: `timelineMitigations` を空に。
  - `applyAutoPlan`（[L512](../../../src/store/useMitigationStore.ts#L512)）: **全 mitigations を計算済み配列で置換**（party の各ジョブから学者/占星を自動補完）+ `timelineEvents` の `warning` フラグ更新。
- ②-a の mitigations 同期は `collabProvider.ts` の `add`/`remove`/`updateTime`（seraph/requires cascade 込み）が所有。mitigations Y.Array キー = `timelineMitigations`（[yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts)）。
- ②-b-1 で汎用ハンドラ `upsertItems`/`removeItems`（`PlanArrayKey` = events/phases/labels/memos）/ `setMeta` / `importBulk` を実装済（[collabTypes.ts](../../../src/lib/collab/collabTypes.ts) / [collabProvider.ts](../../../src/lib/collab/collabProvider.ts) / [yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts)）。

## 2. アーキ方針：b-1 の「store 計算 → delta 委譲」を踏襲

ジョブ変更カスケード（フィルタ/移行/自動挿入）は **store のソロ版ロジックで結果を計算**し、その差分（変わったメンバー + 変わった mitigations）だけをハンドラ経由で Y に反映する。**カスケードを Y-land に再実装しない**（b-1 と同じ・二重実装回避）。mitigations は ②-a 所有だが、b-2 はカスケードの「計算済み結果」を **dumb な差分**として書く（②-a の seraph/requires cascade を再適用しない＝結果は既に確定済み）。両書き込み経路は同じ Y.Array に共存する。

## 3. partyMembers の Y 表現

- 新キー `partyMembers`（`Y.Array<Y.Map>`・id 単位マージ）。②-b-1 の汎用配列ヘルパ（`applyUpsert`/`applyRemove`/`readArray`）を `PlanArrayKey` に `'partyMembers'` を追加して再利用。
- 各 `Y.Map` は **PartyMember の全フィールド**（id, jobId, role, stats(object), mode?, computedValues(object)）を保持。`stats`/`computedValues` は入れ子オブジェクトとしてプレーン値格納（b-1 と同方針）。
- **`computedValues` は派生**だが、**保存（Firestore）形状維持のため Y にも持たせる**。受信側 apply では **ローカル再計算で上書き**（同期値が古くても各クライアントが `currentLevel` から正す）。→ Y の computedValues は「保存用キャッシュ」、表示用は常にローカル再計算。

## 4. 委譲（store → Y）

### 4.1 単純な partyMembers 変更（mitigations 波及なし）
- `updateMemberStats` → `upsertItems('partyMembers', [updatedMember])`
- `applyDefaultStats` → `upsertItems('partyMembers', allUpdatedMembers)`

### 4.2 ジョブ変更カスケード（partyMembers + mitigations を 1 transaction で）
原子性（途中状態で相手画面が壊れない）のため **新ハンドラ `batch(ops)`** を追加。`ops` = `{ kind:'upsert'|'remove'|'replace', key, items?, ids? }[]` を **1 つの `doc.transact` で実行**。
- `setMemberJob` → store がソロ版同ロジックで「新メンバー」と「そのメンバーの新 mitigations 一式」を計算 → `batch([upsert partyMembers [member], remove timelineMitigations [oldMemberMitIds], upsert timelineMitigations [newMemberMits]])`。
- `changeMemberJobWithMitigations` → 同様（mitigations は引数 + 学者/占星補完を計算して upsert）。
- `updatePartyBulk` → 全メンバー分の上記 batch を 1 transaction で。

### 4.3 bulk mitigation 操作
- `clearMitigationsByMember` → `removeItems('timelineMitigations', memberMitIds)`
- `clearAllMitigations` → `batch([replace timelineMitigations []])`（= clear）
- `applyAutoPlan` → store が最終 mitigations（学者/占星補完込み）と warning 更新後 events を計算 → `batch([replace timelineMitigations finalMits, upsert timelineEvents changedEvents])`

> `PlanArrayKey` に `'timelineMitigations'` を追加し、汎用 upsert/remove/replace を mitigations Y.Array にも使えるようにする。②-a の add/remove/updateTime（cascade 込み・単発操作）は無改変で共存。

## 5. 反映（Y → store）

- `_applyPartyMembersFromCollab(members)` を追加: `set({ partyMembers: members.map(m => ({ ...m, computedValues: calculateMemberValues(m, get().currentLevel) })) })`（**computedValues を必ずローカル再計算**）。
- ②-b-1 の `_applyMetaFromCollab`（currentLevel 受信時に computedValues 再計算）は、**partyMembers が Y 同期になったため「Y 反映済みの partyMembers」を読んで再計算する**形へ整合（挙動は実質同じ＝state.partyMembers を読む）。
- mitigations の Y 変更は ②-a の既存 observeDeep → `_applyMitigationsFromCollab` がそのまま反映（b-2 の batch が書いた mitigations も同経路で store に入る）。

## 6. 永続化（③）の additive 拡張

- worker（[workers/collab/src/yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts)）の `buildSeedDocFull`/`readPlanDataFull` の対象に **`partyMembers`** を追加（既存の汎用 push/read に 1 キー足すだけ）。
- `collabPersistence.ts` `PlanDataSeed` に `partyMembers?` 追加。
- Vercel（[api/collab/_logic.ts](../../../api/collab/_logic.ts) `decideLoadFull` / [_saveHandler.ts](../../../api/collab/_saveHandler.ts)）の seed/save 対象に `data.partyMembers` を追加。**mitigations/version/墓標ガード/他要素は無改変**。

## 7. 同期しないもの（b-1 継承）

- `myMemberId`（個人の表示設定）→ 非同期・ローカル維持。`setMyMemberId` は collab でも store ローカル set（委譲しない）。
- UI トグル類（myJobHighlight 等）。
- `computedValues` は Y に保存用キャッシュとして載るが **表示はローカル再計算が正**。

## 8. 監査ガード（collab 中の全置換経路を塞ぐ）

b-1 で undo/redo/loadSnapshot/resetForTutorial を no-op ガード済。b-2 で追加確認:
- `initializeParty` / `restoreFromSnapshot`: collab 中 no-op（部屋の seed が正）。
- 他に partyMembers/mitigations を store 直書きする未委譲経路が無いか plan で全 mutation を洗う（`applyDefaultStats` は §4.1 で委譲するので対象外）。

## 9. テスト方針（TDD・緑維持）

- **純ロジック**: partyMembers の Y 往復、ジョブ変更 delta 計算（ソロ版と同結果）、batch の 1 transaction 実行。
- **store 委譲**: 各 mutation が正しいハンドラ（upsertItems/batch/removeItems）に正しい delta で委譲し store 直変更しないこと（②-b-1 の `useMitigationStore.collab.test.ts` を踏襲）。
- **worker/Vercel 永続化**: partyMembers の seed/save 授受。
- **非破壊回帰**: root 既存 + ②-a/③/②-b-1 が緑のまま。build（tsc 厳密）緑。

## 10. dormant / デプロイ方針

- UI 入口なしで main dormant（②-b-1 と同型）。push/worker `wrangler deploy` はユーザー承認まで保留。
- 実データ往復の本番 E2E は ⑤ 実入口後にユーザー 2 ブラウザで（既定方針）。

## 11. スコープ外（YAGNI）

- presence / カーソル（④）。
- CRDT undo（②-c）。
- mitigations の文字単位共同編集等。
- ⑤-3b/3c（ジョイナー閲覧・ログイン編集 UI）= 順番B の後続。

## 12. これで完成する状態

②-b-2 完了時点で **PlanData の全要素（mitigations / events / phases / labels / memos / 設定 / partyMembers）がライブ同期**。エンジンとしての「全員が同じ 1 枚を全要素ライブ編集」が揃う。残るはユーザー向け UI（⑤-3b/3c）と presence（④）。
