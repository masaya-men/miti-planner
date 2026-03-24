# セッション引き継ぎ書（2026-03-24 第3セッション）

## ★ セッション開始時の必須作業
**毎回のセッション開始時に、`docs/` フォルダ内の全計画書・設計書を必ず読むこと。**
CLAUDE.md の「セッション開始時の必須作業」セクションに一覧がある。
特に `docs/TODO.md` は最新の進捗・方針が集約されているため、最初に必ず確認する。

---

## 今回のセッションで完了したこと

### チュートリアル全面改修
- **専用プラン作成**: コンテンツ選択 → `[コンテンツ名]_チュートリアル` で自動作成、名前入力ダイアログはスキップ
- **ダメージ動的計算**: 固定値方式を廃止 → 選んだコンテンツのステータスHP × 倍率で致死量を動的計算（`createTutorialEvents(otherHp, tankHp)`）
- **カード配置ルール**: ステップごとに right/left 指定、`isModalTarget` はモーダル外に配置（`data-tutorial-modal` で検出）+ 縦軸のみ追従
- **ステップ遷移の中央ジャンプ防止**: `_lastTooltipPos` で前回位置を記憶、targetRectsが空のときは前回位置を維持
- **戻るボタン全ステップundo**: パーティリセット（`updatePartyBulk`）、軽減削除、モーダル開閉（カスタムイベント `tutorial:close-all-modals` / `tutorial:open-party-modal` / `tutorial:close-new-plan-modal`）
- **新規作成ステップ2段階**: ボタンクリック（`sidebar:new-plan-clicked`） → モーダルの×ボタンを押させる（`tutorial:new-plan-modal-closed`）
- **チュートリアル終了時プラン自動削除**: `completeTutorial` / `skipTutorial` で `_チュートリアル` / `_Tutorial` で終わるプランを検索・削除
- **テーマ・言語切替**: `data-tutorial-always` 属性でチュートリアル中も常に操作可能
- **×ボタン位置修正**: `UiTooltip` ラッパー除去（absoluteが崩れる原因だった）
- **ステップインジケーター**: ドット列 → `5 / 25` 数字表示
- **16/24の青ハイライト**: `bg-sky-500/20` → `bg-white/10`（白グロー統一）
- **23/24の暗いオーバーレイ除去**: `isTimelineStep: true` で暗くせずクリックブロックのみ
- **文言全面整理**: 日英統一、温度感統一（成功は「素晴らしい！」/"Great!"）、未使用キー削除、「タップ」→操作表現統一、「マス」→「セル」

### 数値入力の全角対応
- EventModal内の全数値入力欄で `type="text"` + `toHalfWidthNumber()` で全角→半角自動変換
- 日本語IMEモードのまま数字を打ってもストレスなく入力可能

### PartySettingsModal修正
- `data-tutorial-modal` をフルスクリーンラッパー（`fixed inset-0`）から実際のパネル（`md:w-[450px]`）に移動

---

## 次回セッションでやるべきこと（優先順）

### 1. スマホ対応（最優先）
ユーザーが次にやりたいと明言したテーマ。現在の状態を調査し、何が必要か洗い出すところから始める。

### 2. チュートリアル残タスク
- 追加ステップ候補: オートプラン体験・プラン名編集・共有体験
- 戻るボタンの通し動作確認（特にパーティ系ステップの巻き戻し）

### 3. その他（TODO.md参照）
- バグ修正（FFLogs系・オートプラン）
- Firebase連携（クラウド保存）
- トップページ改修

---

## 重要な技術的判断

1. **ダメージ動的計算**: `tutorialTemplate.ts` は倍率のみエクスポート（`TUTORIAL_AOE_RATIO = 1.08`, `TUTORIAL_TB_RATIO = 1.95`）。`createTutorialEvents(otherHp, tankHp)` で実際のHPから計算
2. **カード配置の `_lastTooltipPos`**: モジュールスコープの変数でステップ遷移時の中央ジャンプを防止
3. **モーダル制御のカスタムイベント**: ストアから直接React stateを変更できないため、`window.dispatchEvent` + `addEventListener` パターンでTimeline.tsx / Sidebar.tsxのモーダル開閉を制御
4. **`data-tutorial-modal`**: PartySettingsModal（パネル本体）、MitigationSelector、EventModal、NewPlanModalに設定済み。フルスクリーンのbackdropではなくモーダル本体に付けること
5. **全角→半角変換**: `toHalfWidthNumber()` — `０-９` → `0-9` 変換 + 数字と小数点以外を除去。`type="text"` + `inputMode="numeric"` の組み合わせ

---

## ファイル変更一覧（主要）

| ファイル | 変更内容 |
|---------|---------|
| `src/store/useTutorialStore.ts` | ステップ定義のtooltipPosition更新、prevStep全面書き直し、新規作成2段階ステップ、終了時プラン削除 |
| `src/components/TutorialOverlay.tsx` | calcTooltipPos全面書き直し（right/left/keep/modal対応）、×ボタン修正、ステップインジケーター |
| `src/components/Sidebar.tsx` | チュートリアル時のプラン作成（動的ダメージ計算）、NewPlanModal閉じるイベントリスナー |
| `src/data/tutorialTemplate.ts` | 固定イベント → 倍率+関数方式に変更 |
| `src/components/EventModal.tsx` | 全角→半角変換、data-tutorial-modal追加 |
| `src/components/Timeline.tsx` | チュートリアルモーダル制御イベントリスナー |
| `src/components/PartySettingsModal.tsx` | data-tutorial-modalをパネル本体に移動 |
| `src/components/NewPlanModal.tsx` | data-tutorial-modal追加、閉じるボタンにdata-tutorial属性 |
| `src/components/TimelineRow.tsx` | 青ハイライト→白グロー統一 |
| `src/components/ConsolidatedHeader.tsx` | テーマボタンにdata-tutorial-always |
| `src/components/LanguageSwitcher.tsx` | data-tutorial-always追加 |
| `src/components/Layout.tsx` | テーマボタンにdata-tutorial-always |
| `src/locales/ja.json` / `en.json` | チュートリアル文言全面整理、未使用キー削除 |
| `docs/TODO.md` | チュートリアル完了記録、スマホ対応を次回テーマに |
