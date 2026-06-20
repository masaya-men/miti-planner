# 管理画面 FFLogs タイムライン取り込み 設計書

- **日付**: 2026-06-20
- **対象**: 管理画面テンプレートエディターへの FFLogs 直接取り込み（置き換え／追記）の新設
- **スコープ**: ① 管理画面テンプレ編集に FFLogs 取り込みモーダルを新設 ② FFLogs 取得シーケンスとイベント／フェーズ追記ロジックを共通部品へ抽出
- **関連既存 spec**: `2026-06-20-fflogs-import-modes-design.md`（ユーザー側の取り込みモード）、`2026-04-05-fflogs-import-v2.md`（取得・mapper の基盤）
- **元要望**: ユーザー要望（2026-06-20）「logs を途中から追加できるやつを、管理画面に**も**ほしい」

---

## 1. 背景・課題

### 現状の管理画面テンプレ作成手段（実コード）

管理画面のテンプレートエディター（コンテンツの公式ボス技タイムラインを編集）でタイムラインを入れる手段は 3 つ。

- **プランから昇格**: 共有 URL からプランデータを取得し `convertPlanToTemplate` で変換 → `editor.replaceAll`（全置換）。`src/components/admin/PlanToTemplateModal.tsx:133-137`、入口 `src/components/admin/AdminTemplates.tsx:282-285,523-529`。
- **スプシ（TSV）取り込み**: 貼り付け → 列対応付け → `convertCsvToEvents` → `editor.replaceAll`（全置換）。`src/components/admin/CsvImportModal.tsx`、入口 `AdminTemplates.tsx:286-289,530-534`。
- **FFLogs 翻訳**: FFLogs レポート URL から技名を取得し、既存タイムラインのイベントと GUID で突合して**翻訳マップを返すだけ**（タイムラインは取り込まない）。`src/components/admin/FflogsTranslationModal.tsx:4-6`、入口 `AdminTemplates.tsx:290-292,535-540`。

→ **管理画面には「FFLogs ログから直接タイムラインを取り込む」手段が無い**。FFLogs からタイムラインを取り込めるのはユーザー側のみ（`src/components/Timeline.tsx:3910` の `<FFLogsImportModal>`、呼び出しはこの 1 箇所）。

### ユーザー側は既に「途中から追加」対応済

ユーザー側の取り込みは 2026-06-20 に 3 モード化済み（置き換え＋軽減削除／置き換え＋軽減保持／追記）。モード解決は純粋関数 `resolveImportEvents`（`src/utils/importModes.ts:16-32`）、フェーズの追記を含む適用は `useMitigationStore.importTimelineEvents`（`src/store/useMitigationStore.ts:924-977`）。

### 課題

管理者が FFLogs からテンプレを起こすとき、今は「ユーザー側で取り込み → 共有 URL 発行 → 管理画面で『プランから昇格』」という手数が必要。直接取り込みたい。さらにワイプログで前半を作った後、クリアログで後半フェーズを足す「途中から追加」を管理画面でもやりたい。

---

## 2. ゴール

管理画面テンプレ編集に、FFLogs URL 貼り付けでタイムラインを直接取り込む手段を新設する。**置き換え／追記の 2 モード**対応。**既存ユーザー側取り込みは挙動不変**。

---

## 3. 取り込みモード（2 種）

テンプレートには「軽減（誰がいつ何の軽減を置くか）」が存在しない（テンプレ＝ボス技タイムライン＋フェーズ＋ラベルのみ）ため、ユーザー側の 3 モードのうち軽減に関わる区別は不要。2 モードに集約する。

| モード | イベント | フェーズ | 用途 |
|---|---|---|---|
| **置き換え** ※既存タイムラインがある時の既定 | 全置換 | 取り込み分で置換 | 別の戦闘を入れる／取り直す |
| 追記 | 既存の最終時刻より後だけ追加 | 既存最終時刻より後の新規フェーズだけ追加 | ワイプログ→クリアログで後半を足す |

- **既存タイムラインが空（`editor.visibleEvents.length === 0`）のときはモード選択を出さない**。どのモードでも結果が同じなため、従来どおり「取り込み」一発（ユーザー側 `FFLogsImportModal.tsx:322` の作法に揃える）。
- 既定は「置き換え」。テンプレ作成は新規起こしが主で、追記は明示選択時のみ。
- 文言は淡々とした説明のみ（既存 UI ルール準拠）。i18n キー経由（ja/en/ko/zh）。

---

## 4. アーキテクチャ（A 案: 取得コア共通化）

FFLogs の取得・変換は既に `api/fflogs` の関数群と `mapFFLogsToTimeline`（`src/utils/fflogsMapper.ts`）に分離済み。`FFLogsImportModal` 本体が抱えているのは「UI ＋ 取得シーケンス ＋ ストアへの適用」のみ。共通化対象は次の 3 点。

### 4.1 取得シーケンスの抽出

現状 `FFLogsImportModal.handleFetch`（`src/components/FFLogsImportModal.tsx:102-138`）に埋め込まれている取得シーケンス（URL 解析 → `resolveFight` → `fetchPlayerDetails` → `Promise.all([fetchFightEvents JP/EN, fetchDeathEvents, fetchCastEvents EN/JP])` → `mapFFLogsToTimeline`）を、引数 `(reportId, fightId)` を取り `{ fight, mapped: MapperResult }` を返す純粋関数（例: `src/lib/fflogs/fetchAndMapFflogs.ts`）へ切り出す。

- URL→`{ reportId, fightId }` 解析（`FFLogsImportModal.tsx:89-90` の正規表現）も同モジュールにヘルパーとして集約。
- **ユーザー側 `FFLogsImportModal` もこの共通関数を呼ぶよう差し替える**（取得結果・順序・エラー文言は不変）。
- レート制限（`IMPORT_RATE_LIMIT`、`FFLogsImportModal.tsx:18-45`）はユーザー側固有の関心として**モーダル側に残す**（共通関数には含めない）。

### 4.2 イベント追記解決

既存 `resolveImportEvents`（`src/utils/importModes.ts:16-32`）をそのまま流用。テンプレ側は軽減を持たないため戻り値 `clearMitigations` は無視する。テンプレ用にはモードを `'replace_all' | 'append'` の 2 値に限定して渡す（`replace_keep` は使わない）。

### 4.3 フェーズ追記解決

現状 `useMitigationStore.importTimelineEvents:932-951` にフェーズの追記ロジック（`resolved.appendFromTime` を cutoff として「cutoff より後の新規フェーズだけ取り込む」「append かつ新規フェーズなしなら既存フェーズを触らない」「`ensurePhaseEndTimes` で終端補正」）が埋め込まれている。これを純粋関数（例: `resolveImportPhases(currentPhases, incomingPhases, mode, appendFromTime, maxEventTime)`）へ切り出し、ストアとテンプレの双方が使う。

- **型差異の吸収**: `mapFFLogsToTimeline` が返すフェーズは `startTimeSec` ベース、テンプレ側 `editor.replaceAll` が期待するのは `TemplateData['phases']` 形。ストア側は `startTime` 形（`useMitigationStore.ts:938`）。**共通フェーズ解決はどの型を正本にし、各呼び出し元でどう変換するかを実装計画で確定する**（mapper 出力型・テンプレ phases 型・ストア phases 型の 3 者を突き合わせてから切り出す）。
- ストア側を共通関数に置き換える際、`ensurePhaseEndTimes` の適用順・collab 経路（`importBulk`、`useMitigationStore.ts:955-958`）の引数が変わらないことを担保する。

### 4.4 管理画面モーダル新設

`src/components/admin/FflogsTimelineImportModal.tsx`（仮称）を新設。`PlanToTemplateModal` / `CsvImportModal` と同じ作法（URL 入力 → プレビュー → 確定）。

- Props: `{ isOpen, onClose, hasEvents, onImport(events, phases, mode) }`（既存モーダルに倣う）。
- 内部で 4.1 の共通関数を呼んでプレビュー（ボス名・戦闘長・イベント数）を表示。
- `hasEvents` が true のときだけ置き換え／追記のラジオを表示。
- 「取り込み」で `onImport` を呼ぶ。`AdminTemplates` 側ハンドラが 4.2/4.3 を使って `editor` に反映。

---

## 5. データフロー

```
管理者が URL 貼付
  → 共通関数 fetchAndMapFflogs(reportId, fightId)
       → api/fflogs 群で取得 → mapFFLogsToTimeline → { fight, mapped }
  → プレビュー表示（既存イベントがあれば置き換え/追記ラジオ）
  → 「取り込み」
       → resolveImportEvents(現イベント, mapped.events, mode)
       → resolveImportPhases(現フェーズ, mapped.phases, mode, ...)
       → editor へ反映（置き換え=replaceAll 相当 / 追記=結合）
  → 保存は既存の「保存」ボタンで Firestore へ（取り込みは editor メモリ反映まで）
```

---

## 6. 翻訳・英語ログ

- 取り込む技名は**日本語ログ前提**。`mapped.stats.isEnglishOnly`（ユーザー側 `FFLogsImportModal.tsx:356`）が真のときはプレビューに注記を出す。
- 英語ログでも取り込みは可能。取り込み後に既存の「FFLogs 翻訳」ボタン（`FflogsTranslationModal`）で en/zh/ko を付与する現行ワークフローに繋げる。

---

## 7. 管理画面なので省くもの（ユーザー側にあるがテンプレに不要）

- **レート制限（15 回/時）** → 省く（管理者は信頼）。
- **ログイン必須ガード**（`FFLogsImportModal.tsx:238-290`）→ 省く（管理画面が既にアクセス制御済み）。
- **テンプレ候補の自動登録**（`tryAutoRegisterTemplate`、`FFLogsImportModal.tsx:141-175`）→ 省く（管理画面で直接テンプレを編集しているので二重になる）。
- **軽減保持モード（`replace_keep`）** → 無し（テンプレに軽減が無い）。

---

## 8. 既存への影響と回帰

- ユーザー側 `FFLogsImportModal` は**見た目・操作・取り込み挙動を一切変えない**。中の取得処理を 4.1 共通関数の呼び出しに差し替えるのみ。
- `useMitigationStore.importTimelineEvents` のフェーズ解決を 4.3 共通関数に置き換える際、ユーザー側の置き換え／軽減保持／追記の 3 モードが完全に同じ結果になることを単体テストで担保。
- 共有 DOM/座標基準は変えないが、ストアの取り込み経路に手を入れるため、**ユーザー側取り込み（3 モード）＋ collab ON 時の取り込み**を実機回帰確認（[[feedback_structural_refactor_runtime_audit]]）。

---

## 9. 触るファイル（見込み）

- **新規** `src/lib/fflogs/fetchAndMapFflogs.ts` — 取得シーケンス＋URL 解析の共通関数。
- **新規** `src/components/admin/FflogsTimelineImportModal.tsx` — 管理画面の取り込みモーダル。
- `src/utils/importModes.ts` — フェーズ追記解決 `resolveImportPhases` を追加（イベント側 `resolveImportEvents` と対にする）。
- `src/store/useMitigationStore.ts` — `importTimelineEvents` のフェーズ解決を共通関数へ置換（挙動不変）。
- `src/components/FFLogsImportModal.tsx` — `handleFetch` を共通関数呼び出しへ差し替え。
- `src/components/admin/AdminTemplates.tsx` — モーダル配線＋ `handleFflogsTimelineImport`（editor 反映）。
- `src/components/admin/TemplateEditorToolbar.tsx` — 「FFLogs 取り込み」ボタン追加。
- i18n リソース（ja/en/ko/zh）— モーダル文言・モードラベル・英語ログ注記キー。
- テスト — `resolveImportPhases` 単体、ユーザー側 import 回帰、管理画面モーダル表示条件。

---

## 10. テスト方針

- **回帰（最重要）**: 共通化後もユーザー側 `importTimelineEvents` の 3 モードが従来どおり（`replace_keep` で軽減保持、`replace_all` で軽減削除、`append` で後ろだけ追加・フェーズ追記）であることを store 単体テストで固定。
- `resolveImportPhases`: append で cutoff 以降の新規フェーズのみ追加・新規なしなら既存不変・置き換えで全置換、を単体テスト。
- 管理画面取り込み: 置き換えで全置換／追記で既存最終時刻より後のイベント・フェーズのみ追加・同時刻除外・既存イベント/フェーズ/ラベル不変。
- 空タイムライン時はモード非表示で全件取り込み。
- i18n: 4 言語キーの存在と en 表示崩れなし。
- collab ON: 2 タブ実機でユーザー側取り込みが回帰しないこと（自動テスト外の手動検証）。

---

## 11. スコープ外（明示）

- **① スプシ軽減表のタイムライン読み込み**（軽減割り当て込み）= 別タスク（別 spec）。本 spec は FFLogs 取り込みのみ。
- **再アンカー（技に合わせて軽減もずらす）** = ユーザー側 Phase 1.5 の課題でテンプレには無関係。
- **管理画面 FFLogs 取り込みのレート制限・濫用対策** = 管理者専用のため当面不要。将来 admin 権限を広げる場合に再検討。
