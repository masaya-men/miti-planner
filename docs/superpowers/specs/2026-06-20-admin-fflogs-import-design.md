# 管理画面 FFLogs タイムライン取り込み 設計書

- **日付**: 2026-06-20
- **対象**: 管理画面テンプレートエディターへの FFLogs 直接取り込み（置き換え／追記）の新設
- **スコープ**: ① 管理画面テンプレ編集に FFLogs 取り込みモーダルを新設 ② FFLogs 取得シーケンスと URL 解析を共通部品へ抽出（ユーザー側と共用） ③ テンプレ専用のフェーズ追記純粋関数を新設
- **関連既存 spec**: `2026-06-20-fflogs-import-modes-design.md`（ユーザー側の取り込みモード）、`2026-04-05-fflogs-import-v2.md`（取得・mapper の基盤）
- **元要望**: ユーザー要望（2026-06-20）「logs を途中から追加できるやつを、管理画面に**も**ほしい」
- **最優先制約**: **既存ユーザー側（軽減表編集）の FFLogs 取り込み挙動を 1 ミリも変えない**
- **監査**: 2026-06-20 多エージェント監査（Understand 6 領域 ＋ Verify 3 レンズ・9 エージェント）で抽出境界・不変条件・型整合・回帰ゲートを確定。本 spec はその結論を反映した決定版。

---

## 1. 背景・課題

### 現状の管理画面テンプレ作成手段（実コード）

管理画面のテンプレートエディター（コンテンツの公式ボス技タイムラインを編集）でタイムラインを入れる手段は 3 つ。

- **プランから昇格**: 共有 URL からプランを取得し `convertPlanToTemplate` → `editor.replaceAll`（全置換）。`src/components/admin/PlanToTemplateModal.tsx:133-137`、入口 `AdminTemplates.tsx:282-285,523-529`。
- **スプシ（TSV）取り込み**: 貼り付け → 列対応付け → `editor.replaceAll`（全置換）。`CsvImportModal.tsx`、入口 `AdminTemplates.tsx:286-289,530-534`。
- **FFLogs 翻訳**: FFLogs URL から技名を取得し既存イベントに GUID 突合で**翻訳マップを返すだけ**（タイムラインは取り込まない）。`FflogsTranslationModal.tsx:4-6`、入口 `AdminTemplates.tsx:290-292,535-540`。

→ **管理画面には「FFLogs ログから直接タイムラインを取り込む」手段が無い**。FFLogs からタイムラインを取り込めるのはユーザー側のみ（`Timeline.tsx:3910` の `<FFLogsImportModal>`、呼び出しはこの 1 箇所）。

### ユーザー側は既に「途中から追加」対応済

ユーザー側の取り込みは 2026-06-20 に 3 モード化済み（置き換え＋軽減削除／置き換え＋軽減保持／追記）。モード解決は純粋関数 `resolveImportEvents`（`src/utils/importModes.ts:16-32`）、フェーズ追記を含む適用は `useMitigationStore.importTimelineEvents`（`src/store/useMitigationStore.ts:924-977`）。

### 課題

管理者が FFLogs からテンプレを起こすとき、今は「ユーザー側で取り込み → 共有 URL 発行 → 管理画面で『プランから昇格』」という手数が必要。直接取り込みたい。さらにワイプログで前半を作った後、クリアログで後半フェーズを足す「途中から追加」を管理画面でもやりたい。

---

## 2. ゴール

管理画面テンプレ編集に、FFLogs URL 貼り付けでタイムラインを直接取り込む手段を新設する。**置き換え／追記の 2 モード**対応。**既存ユーザー側取り込みは挙動不変**。

---

## 3. 取り込みモード（2 種）

テンプレートには「軽減」が存在しない（テンプレ＝ボス技タイムライン＋フェーズ＋ラベルのみ）ため、ユーザー側の 3 モードのうち軽減に関わる区別は不要。2 モードに集約する。

| モード | イベント | フェーズ | ラベル | editor への反映 |
|---|---|---|---|---|
| **置き換え** ※既存ありの既定 | 取り込み分で全置換 | 取り込み分で全置換 | 取り込み分（実質空）で全置換 | `replaceAll(incomingEvents, incomingPhases)` |
| 追記 | 既存最終時刻より後だけ追加 | 既存最終時刻より後の新規だけ追加 | 既存ラベルを維持 | `replaceAll([...visibleEvents, ...added], mergedPhases, [...currentLabels])` |

- **既存タイムラインが空（`editor.visibleEvents.length === 0`）のときはモード選択を出さない**。どのモードでも結果が同じなため、従来どおり「取り込み」一発（ユーザー側 `FFLogsImportModal.tsx:322` の作法に揃える）。
- 既定は「置き換え」。テンプレ作成は新規起こしが主。
- 文言は淡々とした説明のみ。i18n キー経由（ja/en/ko/zh）。

### 「追記」の editor 反映方針（B 案＝確定）

useTemplateEditor の `replaceAll`（`useTemplateEditor.ts:290-315`）は **全 state リセット**（`modified`/`deleted`/`autoFilled` を `new Set()`、`original` 差し替え）である。追記専用の append アクションは**新設しない**（ユーザー合意 2026-06-20＝B 案）。

- 追記は `replaceAll([...editor.visibleEvents, ...addedEvents], mergedPhases, [...editor.state.currentLabels])` で実現する。
- これにより**データ（イベント値・フェーズ・既存ラベル・翻訳）は保持**され、失われるのは「編集中マーク（modified/autoFilled の色分け）」と「Undo 基準点」のみ。既存の CSV 取り込み／プラン昇格と同じ割り切り（どちらも `replaceAll` で全リセット）。
- `visibleEvents` は `state.current` から `deleted` を除外した配列（`useTemplateEditor.ts:77-80`）なので、削除済みイベントは追記で復活しない。

---

## 4. アーキテクチャ（A 案: 取得コア共通化・ストア非介入）

FFLogs の取得・変換は既に `api/fflogs` の関数群と `mapFFLogsToTimeline` に分離済み。`FFLogsImportModal` 本体が抱えているのは「UI ＋ 取得シーケンス ＋ ストアへの適用」のみ。共通化対象は **2 点**（URL 解析・取得シーケンス）に限定し、**ストア（`importTimelineEvents`）には一切手を入れない**。

> **監査による方針確定（旧 §4.3 を撤回）**: ストアのフェーズ追記ロジック（`useMitigationStore.ts:932-951`）は `get().phases` とストア `Phase` 型（`startTime`＋`endTime` ベース、`types/index.ts:123-128`）に密結合している。テンプレ側フェーズは `TemplateData['phases']`（`{id:number; startTimeSec:number; name?:LocalizedString}`、`endTime` 無し、`templateLoader.ts:19`）で**型が根本的に異なる**ため、ストア関数を共通化するとユーザー側に回帰リスクを生むだけで利得が無い。よって**ストアは非介入**とし、テンプレ側は独立した純粋関数を新設する。共有してよいのは副作用ゼロの `resolveImportEvents`（`importModes.ts:16-32`、ストア非依存を監査で確認）のみ。

### 4.1 URL 解析の抽出（`parseFflogsUrl`）

- 新規 `src/lib/fflogs/parseFflogsUrl.ts`: `parseFflogsUrl(url: string): { reportId: string; fightId: string | null } | null`。
- **ユーザー側の現行正規表現を正本として厳密再現**: reportId=`/reports\/([a-zA-Z0-9]+)/`、fightId=`/[#?]fight=([^&]+)/`（`FFLogsImportModal.tsx:89-90`）。
- **管理画面側 `FflogsTranslationModal` の厳しい正規表現（10–20 桁・数値 fight のみ、`:48-50`）に寄せない**（ユーザー側の受理 URL 集合を狭めると既存取り込みが壊れる）。
- 純粋関数（副作用なし）。`invalid_url` の i18n 表示・state リセットは呼び出し側に残す。空文字 trim 早期 return も呼び出し側の責務。
- ユーザー側 `handleUrlChange`（`:80-100`）をこの関数利用に差し替える（挙動不変）。

### 4.2 取得シーケンスの抽出（`fetchAndMapFflogs`）

- 新規 `src/lib/fflogs/fetchAndMapFflogs.ts`:
  ```ts
  export type FflogsFetchPhase = 'resolving' | 'fetching_players' | 'fetching' | 'mapping'
  export async function fetchAndMapFflogs(
    reportId: string,
    fightId: string | null,
    onProgress?: (phase: FflogsFetchPhase, ctx?: { name?: string }) => void,
  ): Promise<{ fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }>
  ```
- 中身は `FFLogsImportModal.handleFetch:113-131` から **`setStatus` 行だけを除いて逐語移植**:
  1. `onProgress?('resolving')` → `resolveFight(reportId, fightId)` → `fight`
  2. `onProgress?('fetching_players')` → `fetchPlayerDetails(reportId, fight.id)` → `players`（第 2 引数は **`fight.id`（number）**、引数 `fightId`（string）ではない）
  3. `onProgress?('fetching', { name: fight.name })` → `Promise.all([fetchFightEvents(reportId,fight,false), fetchFightEvents(reportId,fight,true), fetchDeathEvents(reportId,fight), fetchCastEvents(reportId,fight,true), fetchCastEvents(reportId,fight,false)])` → `[eventsJp, eventsEn, deaths, castEn, castJp]`
  4. `onProgress?('mapping')` → `mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players)` → `mapped`
  5. `return { fight, events: eventsEn, mapped }`
- **不変条件（監査・高リスク）**: Promise.all の 5 要素の順序・各 `translate` フラグ・分解先 `[eventsJp,eventsEn,deaths,castEn,castJp]`・`mapFFLogsToTimeline` の引数順を**一字一句変えない**。en/jp や cast の translate を取り違えると技名が**無言で逆転**する（throw しないため気づけない）。
- **throw は透過**（内部に try/catch を持たない）。呼び出し側が try/catch して `err instanceof Error ? err.message : String(err)` で error 表示に落とす（現行 `:135` を各呼び出し元に残す）。
- 戻り値の 3 フィールドは全て**非 optional**（`events` を optional にすると preview 代入で型エラー）。`events` には **`eventsEn`** を入れる（ユーザー側 preview が `events` を必須フィールドで持つ・`:55,133`）。
- 型は `import type { FFLogsFight, FFLogsRawEvent } from '../../api/fflogs'` / `import type { MapperResult } from '../../utils/fflogsMapper'`（tsc -b 厳密・`erasableSyntaxOnly` 対応）。
- ユーザー側 `handleFetch` をこの関数利用に差し替える。**モーダル側に残すもの**: レート制限ゲート＋`recordImport`（ゲート→消費→`await` の順を 1 ブロックで維持・`:105-111`）、最初の `loading` 化を `await` 前に同期実行（連打ガード・`:111-112`）、`onProgress` を受けた `setStatus`＋`t()`、catch のエラー文字列化、`importMode`、`handleImport`、`tryAutoRegisterTemplate`、`handleClose`。

### 4.3 テンプレ用フェーズ追記（`resolveTemplatePhaseAppend`）

- 新規 `src/utils/templateImportPhases.ts`:
  ```ts
  export function resolveTemplatePhaseAppend(
    currentPhases: TemplateData['phases'],
    incomingPhases: TemplateData['phases'],
    mode: 'replace_all' | 'append',
    appendFromTime: number | null,
  ): TemplateData['phases']
  ```
- **引数・戻り値とも `TemplateData['phases']`（name 任意）に統一**。`MapperResult['phases']`（name 必須）を戻り値型にすると、`currentPhases`（name 任意）との結合で TS2322。`MapperResult['phases']` は name 必須→任意へ代入可なので入力には渡せる。
- 仕様: `replace_all` → `incomingPhases` をそのまま返す。`append` → `appendFromTime === null || p.startTimeSec > appendFromTime`（**null ガード必須**・同時刻除外）かつ `p.startTimeSec >= 0`（負値除外）でフィルタ → 0 件なら `currentPhases` をそのまま返す → 1 件以上なら `[...currentPhases, ...filtered]` を `startTimeSec` 昇順 sort。
- **`ensurePhaseEndTimes` は通さない**（テンプレ型に `endTime` が無く、描画前の `deriveLabelsFromEvents`→`ensurePhaseEndTimes` 経路で補完される・`useTemplateEditor.ts:57-61`）。
- イベント追記は既存 `resolveImportEvents` を流用（戻り値 `clearMitigations` は無視、`mode` は `'replace_all'|'append'` に限定、`appendFromTime` を上記フェーズ関数へ渡す）。

### 4.4 管理画面モーダル新設（`FflogsTimelineImportModal`）

- 新規 `src/components/admin/FflogsTimelineImportModal.tsx`。`PlanToTemplateModal` / `CsvImportModal` と同じ作法（URL 入力 → プレビュー → 確定）。
- Props: `{ isOpen: boolean; onClose: () => void; hasEvents: boolean; onImport: (events: TimelineEvent[], phases: TemplateData['phases'], mode: 'replace_all' | 'append') => void }`。
- 内部で `parseFflogsUrl`＋`fetchAndMapFflogs` を呼びプレビュー（ボス名・戦闘長・イベント数）。`hasEvents` が true のときだけ置き換え／追記のラジオを表示。
- 確定で `onImport(mapped.events, mapped.phases, mode)` を呼ぶ。**`mapped.labels` は渡さない**（`Label[]` と `TemplateLabel[]` は型非互換・`as any` 禁止。FFLogs イベントは `mechanicGroup` を持たず `labels` は実質常に空）。
- 管理画面なのでレート制限・ログインガード・auto-register は持たない。

### 4.5 配線（`AdminTemplates` / `TemplateEditorToolbar`）

- `AdminTemplates`: 新フラグ `showFflogsImportModal`、新ハンドラ `handleFflogsTimelineImport(events, phases, mode)`。
  - `replace_all` → `editor.replaceAll(events, phases)` ＋ `setDataSource('fflogs_timeline_import')`。
  - `append` → `resolveImportEvents(editor.visibleEvents, events, 'append')` でイベント解決 → `resolveTemplatePhaseAppend(editor.state.currentPhases, phases, 'append', resolution.appendFromTime)` → `editor.replaceAll(resolution.events, mergedPhases, [...editor.state.currentLabels])` ＋ `setDataSource`。
- `TemplateEditorToolbar`: prop `onOpenFflogsTimelineImport` を追加し、FFLogs 翻訳ボタン（purple）近くに新ボタン。**新規取り込み（置換）は空テンプレにも使うので `disabled={!hasEvents}` は付けない**。色は DESIGN ルール（白黒＋機能色＝青系）に沿う。

---

## 5. データフロー

```
管理者が URL 貼付
  → parseFflogsUrl(url) → { reportId, fightId } | null（null は invalid_url 表示）
  → fetchAndMapFflogs(reportId, fightId, onProgress)
       → resolveFight → fetchPlayerDetails(fight.id) → Promise.all(5) → mapFFLogsToTimeline
       → { fight, events:eventsEn, mapped }
  → プレビュー表示（hasEvents なら 置き換え/追記 ラジオ）
  → 「取り込み」→ onImport(mapped.events, mapped.phases, mode)
       → replace_all: editor.replaceAll(events, phases)
       → append: resolveImportEvents + resolveTemplatePhaseAppend → editor.replaceAll(merged, mergedPhases, currentLabels)
  → 保存は既存「保存」ボタンで /api/admin templates POST へ（取り込みは editor メモリ反映まで）
```

---

## 6. ラベル・翻訳・英語ログ

- **`mapped.labels` は editor に渡さない**（型非互換・実質空）。取り込み後のラベルは admin が既存のラベル CRUD（`useTemplateEditor` の addLabel 等）で付与する想定。追記時は既存 `currentLabels` を維持。
- 取り込む技名は**日本語ログ前提**。`mapped.stats.isEnglishOnly`（`fflogsMapper.ts:88`）が真ならプレビューに注記。英語ログでも取り込み可。取り込み後に既存の「FFLogs 翻訳」ボタンで en/zh/ko を付与する現行ワークフローに繋げる。

---

## 7. 管理画面なので省くもの（ユーザー側にあるがテンプレに不要）

- レート制限（15 回/時）／ログイン必須ガード／テンプレ候補の自動登録（`tryAutoRegisterTemplate`）／軽減保持モード（`replace_keep`）。

---

## 8. 既存への影響と回帰（最優先）

- **ストア `importTimelineEvents`（`useMitigationStore.ts:924-977`）には物理的に touch しない。**
- ユーザー側 `FFLogsImportModal` で変わるのは「URL 解析を `parseFflogsUrl` 呼び出しに」「取得シーケンスを `fetchAndMapFflogs` 呼び出しに」差し替える 2 点のみ。状態遷移・レート制限・進捗表示・エラー処理・preview ペイロード・受理 URL 集合は**完全に現状維持**。
- **回帰ゲート（無改変で緑のまま＝完了条件）**: `importModes.test.ts`、`useMitigationStore.importModes.test.ts`、`useMitigationStore.collab.test.ts`。
- 共有モジュール（取得シーケンス）に手を入れるため、ユーザー側取り込みを **collab ON 含め実機回帰**（[[feedback_structural_refactor_runtime_audit]]）。検証ケース: 撃破ログ／全滅のみログ（fightId=null）／fightId 指定／英語のみログ／filtered 空。

---

## 9. 触るファイル（確定）

- **新規** `src/lib/fflogs/parseFflogsUrl.ts` — URL 解析純粋関数。
- **新規** `src/lib/fflogs/fetchAndMapFflogs.ts` — 取得シーケンス共通関数（onProgress・throw 透過）。
- **新規** `src/utils/templateImportPhases.ts` — テンプレ用フェーズ追記純粋関数。
- **新規** `src/components/admin/FflogsTimelineImportModal.tsx` — 管理画面の取り込みモーダル。
- `src/components/FFLogsImportModal.tsx` — `handleUrlChange`／`handleFetch` を共通関数呼び出しへ差し替え（挙動不変）。
- `src/components/admin/AdminTemplates.tsx` — モーダル配線＋ `handleFflogsTimelineImport`。
- `src/components/admin/TemplateEditorToolbar.tsx` — 「FFLogs 取り込み」ボタン追加。
- i18n（ja/en/ko/zh）— 新 prefix `admin.tpl_fflogs_import_*`（既存 `admin.tpl_fflogs_*` は翻訳専用で意味衝突するため流用しない）。`admin.cancel` は流用。
- **触らない** `src/store/useMitigationStore.ts`、`src/utils/importModes.ts`（`resolveImportEvents` は読み取り利用のみ・改変なし）。

---

## 10. テスト方針

- **`parseFflogsUrl` 単体**（`src/lib/fflogs/__tests__/parseFflogsUrl.test.ts`・表駆動）: URL+数値 fight／fight 無し→null fightId／クエリ付き（`?fight=N&type=damage`）→fightId のみ／reports セグメント無し→null／非数値 fight（`fight=last`）をユーザー側現 regex どおり許容。**ユーザー側 `FFLogsImportModal.tsx:89-90` の出力と完全一致**を固定。
- **`fetchAndMapFflogs` 単体**（`src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts`）: `vi.mock('../../api/fflogs')` で各 API をスタブ。`resolveFight→fetchPlayerDetails(fight.id)→fetchFightEvents(false/true)→Deaths→Casts(true/false)` の引数・回数、`mapFFLogsToTimeline` へ `(eventsEn,eventsJp,fight,deaths,castEn,castJp,players)` の順で渡すこと、`onProgress` が `resolving→fetching_players→fetching(name付)→mapping` の順で発火、throw 透過を検証。**黄金マスター**: 固定入力での `mapped` をリファクタ前後で一致 assert。
- **`resolveTemplatePhaseAppend` 単体**（`src/utils/__tests__/templateImportPhases.test.ts`）: replace_all=全置換／append=cutoff 超のみ追加／append 新規 0 件→既存不変／同時刻（`startTimeSec===cutoff`）除外／`startTimeSec<0` 除外／`appendFromTime===null`（空テンプレ）→全件。
- **回帰（無改変）**: `importModes.test.ts` / `useMitigationStore.importModes.test.ts` / `useMitigationStore.collab.test.ts` を変更せず緑。
- **管理画面ハンドラ**（任意・`useTemplateEditor` ベース）: 置き換え→`replaceAll` 後 `hasChanges=false`・labels 空／追記→既存維持＋結合・currentLabels 保持。
- vitest は `pool='vmThreads'` 必須（`vitest.config.ts:33`・削除厳禁）。実行 `npm run test`。push 前に `npm run build`（tsc -b 厳密）必須（[[feedback_vercel_tsc_strict]]）。
- collab ON は 2 タブ実機（自動テスト外）。

---

## 11. スコープ外（明示）

- **① スプシ軽減表のタイムライン読み込み**（軽減割り当て込み）= 別タスク（別 spec）。
- **再アンカー**（技に合わせ軽減もずらす）= ユーザー側 Phase 1.5・テンプレ無関係。
- **管理画面取り込みのレート制限・濫用対策** = 管理者専用のため当面不要。
- **`/api/admin` templates POST のサーバ側バリデーション監査**（ラベル空・mechanicGroup 無しイベントの永続化整合）= 実装時に別途確認（本 spec はクライアント側設計）。
- **追記専用 append アクションの新設** = B 案採用により**不採用**（`replaceAll` 全リセットで割り切る）。
