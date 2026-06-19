# 共同編集中の進捗同期 (Plan 2) — 設計書

- **日付**: 2026-06-19
- **ステータス**: 設計確定（ユーザー承認済・実装前）
- **前提**: Plan 1（進捗HUD一式 + 共有プライバシー除外）は本番稼働済（main `d92d718`）
- **関連**: [2026-06-18-progress-tracking-hud-design.md](./2026-06-18-progress-tracking-hud-design.md) / [2026-06-19-progress-detail-panel-design.md](./2026-06-19-progress-detail-panel-design.md) / [2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md](./2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)

---

## 1. 背景と問題

進捗トラッキング（道をクリックして到達点を打点・履歴/メモ表示）は実装済みだが、**共同編集中はローカルにしか溜まらない**。

- 記録アクションは collab 中でも `set()` するだけで、Yjs へ委譲していない（[useMitigationStore.ts:1592](../../../src/store/useMitigationStore.ts#L1592) `recordReachedPoint` 他、コメント「Plan 1 では collab 委譲を使わず常にローカル set() のみ」）。
- 結果、**参加者の進捗がオーナー/他参加者に同期しない**。また部屋の seed/save 経路に進捗が載っていないため、部屋を出ると collab 中の打点が残らない（[buildSeedDocFull](../../../workers/collab/src/yjsPlanData.ts#L64) と [_saveHandler.ts](../../../api/collab/_saveHandler.ts) のどちらにも `progress` が無い）。

## 2. ゴールと非ゴール

### ゴール
- 共同編集中、**全員の打点が全員に同期する**。
- 部屋を出ても打点が**残る**（Firestore に永続化）。
- **表（軽減配置・イベント・フェーズ・パーティ）のデータは進捗操作で絶対に壊れない**（最重要・後述 §5）。

### 非ゴール（今回やらない）
- **記録者の識別/色分け**：打点は匿名のチーム共通点とする（A案確定）。「誰が記録したか」は持たない。進捗は「グラフが面白くなるだけの飾り」であり、正確さは要求しない。
- **スマホからの記録UI**：別タスクに分離（ユーザー合意）。本設計は同期＋データ安全に集中する。
- **競合解決ロジック**：union（全部足す）なので「誰の進捗を正にするか」は発生しない。

## 3. 基本方針 — 「進捗の点を memos と同じレーンに載せる」

進捗の打点は「毎クリック1点・統合しない・順序=クリック順」の**追記専用**モデル（[progressLogic.ts:13](../../../src/lib/progressLogic.ts#L13) `appendProgressPoint`）。これは memos とほぼ同じ性質。よって既存の汎用コレクション同期（[collabTypes.ts:8](../../../src/lib/collab/collabTypes.ts#L8) `upsertItems`/`removeItems`、seed=[buildSeedDocFull](../../../workers/collab/src/yjsPlanData.ts#L64)、save=[_saveHandler.ts](../../../api/collab/_saveHandler.ts)）に **`progressPoints` を1つ追加するだけ**で実現する。

新しい同期機構はゼロから作らない。実績ある memos の経路をそのまま流用する＝「簡単な作り」かつ「監査済みの安全な道」。

## 4. データモデルの変更

### 4.1 打点に固定 ID を付与
現状の打点 `ProgressPoint` は `{ ts, reachedPos, note? }` で、**配列の index で識別**している（[useMitigationStore.ts:1598](../../../src/store/useMitigationStore.ts#L1598) `removeProgressPoint(index)` / `setProgressPointNote(index)` / `insertProgressPoint(index)`）。

→ `ProgressPoint` に **`id: string`（`pt_${crypto.randomUUID()}`）** を追加。理由：複数人同時記録で index がズレ「別人の点を消す/上書きする」事故を防ぐ。union するなら id 識別は必須の土台。

**後方互換**：既存データ（id なしの点）は読み込み時に id を補完する（[normalizeProgress](../../../src/lib/progressLogic.ts#L39) で `id` 欠落時に採番）。これにより旧形式の plan.data / 共有スナップショットも安全に移行する。

### 4.2 ストアアクションを id ベースへ
- `removeProgressPoint(index)` → `removeProgressPoint(id)`（または id を受ける新関数）。
- `setProgressPointNote(index, note)` → id ベース。
- `clearAllProgressPoints()` は据え置き（全件対象）。
- collab 中はローカル `set()` ではなく **handlers へ委譲**：
  - 記録：`upsertItems('progressPoints', [新しい点])`
  - 個別削除：`removeItems('progressPoints', [id])`
  - 全消去：`removeItems('progressPoints', 全 id)`
- 非 collab 時は従来どおりローカル `set()`（memos と同じ二分岐パターン。[useMitigationStore.ts:1549](../../../src/store/useMitigationStore.ts#L1549) addMemo を踏襲）。

UI（ProgressDetailPanel 等）が index を前提にしている箇所は id 受け渡しへ追従する。

### 4.3 スカラー項目は planMeta（LWW）
`cleared` / `activeDays` / `activeHours` はチーム共通の1個もの。`currentLevel` と全く同じく planMeta（Y.Map・最後に書いた人が勝つ）に載せる。正確さ不要なので LWW で十分。
- 新 planMeta キー：`progressCleared` / `progressActiveDays` / `progressActiveHours`。
- seed（[buildSeedDocFull](../../../workers/collab/src/yjsPlanData.ts#L74) 付近）と save（[_saveHandler.ts:66-68](../../../api/collab/_saveHandler.ts#L66) currentLevel 等の隣）に同型で追加。

### 4.4 Yjs / seed / save への登録
- クライアント Y.Doc キー：`PROGRESS_POINTS_KEY = "progressPoints"` を [yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts) に追加し、`PlanArrayKey` と `buildArrByKey` に含める。
- worker 側 [yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts) の `PlanDataSeed` / `buildSeedDocFull` / `readPlanDataFull`（save 射影）に `progressPoints` を追加。**クライアントと worker のキー名/構造を必ず揃える**（往復が崩れると seed/save が壊れる）。
- 受付係 [_logic.ts](../../../api/collab/_logic.ts) `decideLoadFull` / `PlanDocSnapshotFull` と [_saveHandler.ts](../../../api/collab/_saveHandler.ts) に `progressPoints`（と planMeta スカラー3種）を追加。

## 5. データロスト対策（最重要・第一要件）

ユーザーの絶対条件：**「進捗を全削除しても表が消えない」「全削除→新規表→すぐ共同編集の表に戻る、で壊れない」**。過去のデータ破壊バグ（保存先プランのズレ・空配列が非空を上書き）と同じ急所。

### A) 表は構造的に巻き込まれない
進捗の全操作は `progressPoints` レーンと progress スカラーしか書かない。save は項目ごとに独立した field-path 更新（[_saveHandler.ts:61-69](../../../api/collab/_saveHandler.ts#L61) `update['data.xxx']`）なので、`data.progressPoints` を足しても他の `data.*` には届かない。
→ **進捗の空っぽは進捗の欄にしか効かず、表の欄には到達しない。** 「進捗全削除で表が消える」は構造上発生不能。

### B) プラン切替で壊れない（既存対策を継承）
**鉄則：進捗は表と同じ“保存先ロック済み”の経路（`_loadedPlanId` 固定保存・collab 作成時の先行 disconnect）に必ず相乗りさせる。進捗だけ別の保存ルートを作らない。**
→ 新規表の空っぽな進捗が共同編集の表の進捗を上書きする経路がそもそも生まれず、表に効いている既存の安全策（455cc20 / collabCreateGuard）を進捗もそのまま継承する。

### C) 空上書きガードは「守らない＝memos と同型」（確定）
`progressPoints` は memos と同じく**空上書きガードの対象外**（[emptyOverwriteSkips](../../../api/collab/_logic.ts#L88) の GUARDED_ARRAY_FIELDS / [collabReseed.ts](../../../src/lib/collab/collabReseed.ts) の RESEED_FIELDS に**含めない**）。
- 理由：打点は「ただの飾り」で正確さ不要。まれな通信ズレで数個消えても実害なし。守る方にすると「collab 中の全消去がやり直しても復活する」過剰な副作用が出る。
- **重要**：これは§5-A/B の表の保護とは独立。表は引き続きガード対象であり、進捗を非ガードにしても表の安全性には一切影響しない（field-path が独立しているため）。

### D) 実装前の敵対監査（必須）
§5-A/B の経路（保存先ロック・collab 入退室・reseed・素早いプラン切替）に進捗を相乗りさせる差分は、**実装に入る前に多エージェント敵対監査で全経路を洗い出してからまとめて直す**（memory `feedback_dataloss_exhaustive_audit` のルール）。「簡単な作り」でもこの部分だけは慎重に進める。

## 6. 同期の意味論（union の挙動）

- **記録**：各自の点が `upsertItems` で足し合わさる（union）。競合なし。グラフは「全員の到達点が時系列で散らばる」。
- **個別削除/全消去**：共有の点を消す＝相手の画面からも消える（匿名なので区別なし）。意図的操作なので許容。
- **純粋閲覧者**：従来どおりブロック（[useMitigationStore.ts:1593](../../../src/store/useMitigationStore.ts#L1593) `_collabReadonly && !_collabActive` ガードは維持）。
- **percent 計算**（[computeProgressPercent](../../../src/lib/progressLogic.ts#L23) = 最高到達点ベース）は union された全点の max を取るだけで自然に機能する。変更不要。

## 7. テスト方針

- **純粋ロジック**：`normalizeProgress` の id 補完（旧形式→id 付与）、id ベース remove/note の単体テスト追加。
- **store collab 委譲**：collab active 時に記録/削除/全消去が `upsertItems`/`removeItems('progressPoints', …)` へ委譲されること（[useMitigationStore.collab.test.ts](../../../src/store/__tests__/useMitigationStore.collab.test.ts) に追加）。非 collab 時はローカル set のまま。
- **readonly**：純粋閲覧者がブロックされること（既存 readonly テスト踏襲）。
- **seed/save 往復**：worker [yjsPlanData.test.ts](../../../workers/collab/src/yjsPlanData.test.ts) に `progressPoints` 往復、`_logic` の `decideLoadFull` に progressPoints 反映を追加。
- **データロスト経路**（§5-D の監査結果に基づく）：全削除→プラン切替→collab 復帰で表データ非破壊・進捗欄のみ変化、を統合/実機で確認。
- **2タブ実機**：両タブ最新版にリロードして検証（memory `reference_collab_two_client_version_skew`）。

## 8. 段取り（writing-plans で詳細化）

1. データモデル：`ProgressPoint.id` 追加 + `normalizeProgress` の id 補完 + 純粋ロジック（id ベース remove/note）。
2. ストア：collab 委譲分岐（記録/削除/全消去）+ スカラーの planMeta 委譲。UI の index→id 追従。
3. 同期配管：client/worker `yjsPlanData` キー追加、`PlanArrayKey`/`buildArrByKey`、seed、save、`decideLoadFull`、`PlanDocSnapshotFull`。
4. §5-D 敵対監査 → データロスト経路の最終確認。
5. 2タブ実機検証 → デプロイ。

## 9. 確定事項まとめ

- 打点は**匿名 union**（A案）。記録者識別なし。
- **memos と同じレーン**に載せる（新機構を作らない）。
- 打点に**固定 id** を付与（index 識別を廃止）。
- スカラーは **planMeta LWW**。
- 空上書きガードは **progressPoints を対象外**（memos 同型・確定）。表は従来どおりガード継続。
- **スマホ記録は別タスク**。
- 実装前に**データロスト経路の多エージェント監査**を必須とする。
