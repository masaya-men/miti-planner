# セッション引き継ぎ書（2026-03-31 第62セッション）

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
- **Zustandストア内でハードコーディングした日本語メッセージ**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **glass-tier3の`!important`を無視してTailwindクラスで上書きしようとする**
- **authDomainをlopoly.appに直接変更する（Firebase Hostingのハンドラーが必要）→ auth.lopoly.appを使う**
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
- **`require()`をAPI関数内で使わない** — ESモジュールバンドルで`require is not defined`になる
- **編集のたびにFirestoreに同期しない** — イベント駆動+定期バックアップが正しい設計
- **useShallowでConsolidatedHeaderのmyJobHighlightをまとめると再レンダリングが阻害される** — 個別セレクタを使う
- **Ctrl+Shift+Zのe.keyは大文字'Z'** — toLowerCase()を使う

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand 5 + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **公式X**: https://x.com/lopoly_app
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第62セッション）で完了したこと

### βテストフィードバック対応 第1弾（全て本番デプロイ済み）

**1. サイドバー・ヘッダーのホバー展開挙動削除**
- `isNear` 近接センサー・幅変化を削除。アイコンの振動+スケールアニメーションは `isHovered` で維持
- 変更: `Sidebar.tsx`, `ConsolidatedHeader.tsx`

**2. 「表を展開する」（旧コンパクト表示）名称変更＋デフォルト化**
- i18n: `compact_view` → JA「表を展開する」/ EN「Expand Table」
- デフォルト: `hideEmptyRows: true`（コンパクトがデフォルト）
- スタイル反転: `!hideEmptyRows` でハイライト
- 変更: `Timeline.tsx`, `useMitigationStore.ts`, `ja.json`, `en.json`

**3. ジョブアイコン行の右端角丸除去＋罫線追加**
- `rounded-tr-2xl border-r-0` → `border-r border-app-border`
- 変更: `Timeline.tsx`

**4. コピースタンプのメッセージ改善**
- i18nテンプレート化: `copying` キーに `{{name}}` パラメータ追加
- ハードコード `'イベント'` → `t('timeline.event')` に
- 英語の語順修正（`"Attack Copying"` → `"Copying: Attack"`）
- 変更: `Timeline.tsx`, `ja.json`, `en.json`

**5. 軽減配置時のリキャスト被り表現改善**
- 警告メッセージ: JA「○s後に配置済。ずらすか除去してください。」/ EN「Placed Xs later. Remove or adjust it.」
- `cd_overlap` キーをi18nに登録
- **被り先パルスアニメーション**: 配置時に被り先の軽減が `ring-2 ring-amber-400` + パルスで点滅。操作or削除で解除
- 新規: `conflictingMitigationId` をZustandストアに追加、`resourceTracker.ts` から `conflictInstanceId` を返却
- 無効配置トースト: 画面下部中央の統一スタイルに変更。メッセージ「ここには配置できません」
- 変更: `Timeline.tsx`, `MitigationSelector.tsx`, `useMitigationStore.ts`, `resourceTracker.ts`, `index.css`, `ja.json`, `en.json`

**6. オートプラン確認ダイアログの注意書き追加**
- 「8人フルパーティ以外では正しく動作しない場合があります。AIは使用しておらず、独自アルゴリズムによる実験的な機能です。」
- `ConfirmDialog.tsx` に `whitespace-pre-line` 追加で改行対応
- 変更: `ConfirmDialog.tsx`, `ja.json`, `en.json`

**7. 最小フォントサイズ見直し＋サイドバーUI改善**
- `text-[7px]` → `text-[8px]`（Timeline.tsxヘッダーモバイル）
- 主要な `text-[8px]` → `text-[10px]`（Sidebar.tsxコンテンツ名、Timeline.tsx STARTラベル）
- サイドバー層名バッジ: 1行・2行を同一箱（`w-7 h-8`）に統一
- 「最近のアクティビティ」下に `border-b border-glass-border` 罫線追加
- 変更: `Sidebar.tsx`, `Timeline.tsx`

---

## βテストフィードバック 残タスク

### 未着手（方針相談が必要）
1. **コントロールバーのアイコン配置見直し** — AA・コンパクトの右のアイコンが何か分からない。チートシートをなくすか別のものに変更し、罫線ONOFFとくっつける等を検討中
2. **ヘビー級まとめ共有** — シリーズクリックで中のプラン全選択。共有限度でチェック外し。デザイン要検討

### 未着手（設計から必要な大タスク）
3. **チュートリアル全面刷新** — 短い個別チュートリアルに分割。指アイコン方式に統一。戻るボタン廃止
4. **チュートリアル構成の見直し** — 攻撃追加ステップの要否、ユーザーストーリー再設計

### 継続検討（方針未確定）
- FFLogsアイコン案、チートシートMTST分け、フェーズなしコンテンツ、テンプレート日本語攻撃名、みんなの軽減表、軽減選択モーダル画面サイズ

---

## 次セッションの優先タスク

### 1. βテストフィードバック対応の続き
- コントロールバーのアイコン配置見直し（方針相談→実装）
- ヘビー級まとめ共有（設計→実装）

### 2. チュートリアル刷新（大タスク）
- 設計から入る必要あり。brainstorming → writing-plans → 実装の流れ

### 3. feature/pretext-lpブランチの整理
- 不採用が確定しているのでブランチ削除を検討

---

## 重要な技術的注意（前セッションから引き続き）

- **Vercel関数**: 現在7/12。新規APIは既存ルーターに統合する方式
- **API URLパターン**: `/api/admin?resource=xxx`, `/api/auth?provider=xxx`, `/api/template?action=xxx`, `/api/share?type=page`
- **管理者curlコマンド**: `curl -X POST "https://lopoly.app/api/admin?resource=role" ...`
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIでverifyAppCheckを維持
- **OAuthコールバックURL**: Discord=`/api/auth?provider=discord`, Twitter=`/api/auth?provider=twitter`
- **Cookieパス**: 統合後は `/api/auth`
- **LoPo管理マニュアル**: `C:\Users\masay\Desktop\LoPo管理マニュアル\` — 全シークレット含む（git外）

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Upstash Redis: `lopo-rate-limit` (us-east-1, 無料プラン)
