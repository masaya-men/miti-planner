# セッション引き継ぎ書（2026-04-01 第65セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **clip-path: path()はブラウザ互換性が低い → SVG evenodd方式を使う**
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
- **PartyAutoFillでDOMセレクタに依存すると空振りする** — スロットの判定方法を見直す必要あり

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand 5 + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第65セッション）で完了したこと

### チュートリアル刷新の実装（`feature/tutorial-overhaul` ブランチ・18コミット）

**旧28ステップ1本通しチュートリアルを完全に削除し、データ駆動型の新システムに置き換えた。**

#### 新規作成ファイル
| ファイル | 責務 |
|---|---|
| `src/data/tutorialDefinitions.ts` | 3チュートリアルのステップ定義（メイン13/攻撃追加4/共有2） |
| `src/store/useTutorialStore.ts` | 新ストア（旧753行→約200行） |
| `src/components/tutorial/TutorialPill.tsx` | 緑ピル（down/right矢印対応） |
| `src/components/tutorial/TutorialCard.tsx` | カード（STEP数表示、緑アクセントバー） |
| `src/components/tutorial/TutorialBlocker.tsx` | SVG evenoddクリックブロック |
| `src/components/tutorial/TutorialMenu.tsx` | ドロップダウン（Portal化） |
| `src/components/tutorial/TutorialOverlay.tsx` | オーケストレーター |
| `src/components/tutorial/animations/PartyAutoFill.tsx` | 自動埋めアニメ **（未動作・要修正）** |
| `src/components/tutorial/animations/PaletteHint.tsx` | パレットヒント（CHECK→3秒→自動進行） |
| `src/components/tutorial/animations/PillFly.tsx` | ピル飛行 **（要ブラッシュアップ）** |
| `src/components/tutorial/animations/CompletionCard.tsx` | 完了画面 |

#### 変更したファイル
- `src/App.tsx` — TutorialOverlayのimport先変更
- `src/components/ConsolidatedHeader.tsx` — TutorialMenuに差し替え
- `src/components/MitiPlannerPage.tsx` — 起動ロジック簡素化
- `src/components/PartySettingsModal.tsx` — data-tutorial属性追加、completeEvent追加、ゴミ箱ツールチップ削除
- `src/components/EventModal.tsx` — completeEvent名更新、旧ステップID削除
- `src/components/MitigationSelector.tsx` — 旧completeEvent/ステップID削除
- `src/components/Sidebar.tsx` — isTutorialContentSelect判定、completeEvent名更新
- `src/components/NewPlanModal.tsx` — completeEvent名更新
- `src/components/Timeline.tsx` — completeEvent追加、チュートリアル中jobIdバイパス
- `src/components/TimelineRow.tsx` — miti-cell-mt-4 data-tutorial追加
- `src/components/ShareButtons.tsx` — share-copy-btn data-tutorial追加
- `src/store/useMitigationStore.ts` — completeEvent名更新
- `src/locales/ja.json` / `en.json` — 新チュートリアルi18nキー
- `src/index.css` — 旧チュートリアルCSS削除

#### 削除したファイル
- `src/components/TutorialOverlay.tsx`（旧809行）
- `src/store/useTutorialStore.old.ts`

---

## 次セッションの最優先タスク

### 1. 自動埋めアニメーション修正（PartyAutoFill.tsx）— 最優先
**問題**: アニメーションがまったく表示されない。ジョブも配置されない。
**原因**: PartyAutoFill.tsxがDOM要素（`party-slot-{i}` のスロット、`[data-job-id]` のパレットボタン）から座標を取得しようとするが、空きスロットの判定が正しく動作していない。
**ユーザーの希望するアニメーション**:
- タイミングがバラバラにふわぁっとアイコンの分身が出現
- 投げたブーメランが弧を描くように飛行
- 枠にカチャッとはまる感じでスロットに着地
- 実際にジョブを配置する（click()シミュレートまたはstoreのsetDraftMembersを直接呼ぶ）

**デバッグの方向性**:
- `npm run dev` で実際にチュートリアルを進めてStep 9（auto-fill）まで到達し、ブラウザのコンソールでDOM状態を確認
- `document.getElementById('party-slot-0')` でスロットが取得できるか
- スロット内のジョブ有無判定を改善（`img[src*="job"]`ではなく、draftMembersの状態を直接チェックするべきかも）
- 最終手段: PartySettingsModalにref/callbackを渡してReact側からドラフト状態を受け取る

### 2. ピル飛行演出ブラッシュアップ（PillFly.tsx）
**問題**: CHECK→ジャンプ→着地の動きがイマイチ
**ユーザーの希望**:
- 致死ダメージを示した後、もっと大げさに上に跳ねる
- クリックさせたいセルの上でバウンドして落ち着く
- メッセージカードも飛行先に合わせて右に移動する

### 3. feature/tutorial-overhaul ブランチのマージ
上記2件の修正完了後にmainにマージ→デプロイ

---

## チュートリアルの全ステップフロー（現在の定義）

```
main-1-content:     コンテンツ選択（サイドバー）
main-2-party-open:  パーティ編成ボタン
main-3-select-h1:   H1スロットクリック
main-4-pick-blm:    黒魔道士クリック（間違い配置デモ）
main-5-delete-job:  H1削除ボタン
main-6-pick-war:    戦士クリック！
main-7-pick-whm:    白魔導士クリック！
main-8-palette-hint: CHECK演出（戦士・白魔スロット上にピル表示、3秒メッセージ）
main-9-auto-fill:   自動埋めアニメーション ← 🔴 未動作
main-10-party-close: パーティ編成閉じる（右矢印ピル）
main-11-check-damage: 致死ダメージCHECK → ピル飛行 ← 🔴 要ブラッシュアップ
main-12-select-miti: リプライザル選択
main-13-complete:   完了画面
```

---

## 重要な技術的注意

- **ブランチ**: `feature/tutorial-overhaul`（mainにはまだマージしていない）
- **TutorialBlocker**: CSS clip-pathではなくSVG evenodd方式。`fill="transparent"` + `pointerEvents: 'auto'` でくり抜き外をブロック
- **TutorialMenu**: `createPortal` でbody直下にレンダリング（ヘッダーのoverflow-hidden回避）
- **Vercel関数**: 現在7/12
- **ENFORCE_APP_CHECK=true が本番で有効**
- **管理者UID**: `（旧管理者UID）`
