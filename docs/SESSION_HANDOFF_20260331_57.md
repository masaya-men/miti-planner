# セッション引き継ぎ書（2026-03-31 第57セッション）

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
- **修正件数を圧縮して報告する** — 監査で見つけた問題の件数と修正済み件数は常に正確に突き合わせること
- **Vercel環境変数を`echo`でパイプしない** — 末尾改行が混入する。`printf`または`--value`フラグを使う
- **`require()`をAPI関数内で使う** — VercelのESモジュールバンドルで`require is not defined`になる。必ず`import`を使う
- **CSP変更後にデプロイしただけでAPIファイルが反映されたと思い込む** — `vercel --prod --force`で全ファイル強制アップロードが必要な場合がある
- **編集のたびにFirestoreに同期しない** — 試行錯誤中の無駄な同期を避ける。イベント駆動（タブ離脱/プラン切替等）+定期バックアップが正しい設計
- **createPortalのイベントバブリング** — ReactのPortalはDOMツリーではなくReactツリーでイベントが伝播する。Portal内で`stopPropagation`が必要
- **Tooltipのwrapperが`w-fit justify-center`** — Tooltip内にflex-1要素を入れる場合は`wrapperClassName="flex-1 min-w-0 !w-auto !justify-start"`で上書き必須
- **useShallowでConsolidatedHeaderのmyJobHighlightをまとめると再レンダリングが阻害される** — 個別セレクタを使うこと（第56セッション発見）
- **React.memoの閉じ位置を間違える** — 内部サブコンポーネント（ContentTreeItem等）をmemo化する際、次のコンポーネント定義まで巻き込まないよう注意
- **Ctrl+Shift+Zのe.keyは大文字'Z'** — キーボードショートカットの比較はtoLowerCase()を使う

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

## 今回のセッション（第57セッション）で完了したこと

### 1. i18nハードコーディング精査（全8箇所修正）
- **PartyStatusPopover.tsx**: スキル名21個のハードコードをSKILL_DATAから動的取得に変更。`nameEn`プロパティを活用
- **MitiPlannerPage.tsx**: `document.title = "LoPo | 軽減プランナー"` → `t('app.page_title_planner')`
- **LandingPage.tsx**: `document.title = 'LoPo — FFXIV Tool Portal'` → `t('app.page_title_landing')`（`useTranslation`インポート追加）
- **CsvImportModal.tsx**: タイトル・説明文・エラーメッセージ・ボタン全てi18nキー化（`csv_import.*`セクション新設）
- **ErrorBoundary.tsx**: クラスコンポーネントなので`i18next.t()`直接使用（`error_boundary.*`セクション新設）
- **ConsolidatedHeader.tsx**: `{ defaultValue: '保存中...' }` / `{ defaultValue: '保存済み ✓' }` の日本語フォールバック削除（キーは既にen/ja.jsonに存在）
- **ShareButtons.tsx**: `{ defaultValue: '共有' }` 削除
- **SharePage.tsx**: `{ defaultValue: 'すべてコピー' }` 削除
- **CheatSheetView.tsx / TimelineRow.tsx**: `alt="Magical"` → `alt={t('modal.magical')}` 等、ダメージ種別alt属性3箇所×3ファイル

### 2. 非ログインユーザーへのログイン促進UI（★実機確認未完了）
- **NewPlanModal.tsx**: `useAuthStore`と`LoginModal`を追加。フッター部分に`!user`条件で案内テキスト表示。`<login>`タグパース方式で「ログイン」部分をクリック可能なボタンに
- **ShareModal.tsx**: チームロゴセクションの前に`!user`条件で案内テキスト表示。同じ`<login>`タグパース方式
- **i18nキー**: `new_plan.guest_hint`、`app.share_guest_hint` を en.json / ja.json に追加
- **★問題**: ユーザーがシークレットウィンドウで確認したところ、テキストが表示されなかった。ビルドは成功。TypeScriptエラーなし。原因未特定

---

## 第57セッションで変更したファイル一覧

### i18nハードコーディング修正
- `src/components/PartyStatusPopover.tsx` — スキル名をSKILL_DATA動的取得に変更
- `src/components/MitiPlannerPage.tsx` — document.title i18n化
- `src/components/landing/LandingPage.tsx` — document.title i18n化 + useTranslation追加
- `src/components/CsvImportModal.tsx` — UIテキスト全件i18n化
- `src/components/ErrorBoundary.tsx` — i18next.t()でエラーメッセージi18n化
- `src/components/ConsolidatedHeader.tsx` — defaultValue日本語削除
- `src/components/ShareButtons.tsx` — defaultValue日本語削除
- `src/components/SharePage.tsx` — defaultValue日本語削除
- `src/components/CheatSheetView.tsx` — alt属性i18n化
- `src/components/TimelineRow.tsx` — alt属性i18n化（2箇所）

### ログイン促進UI（★要確認）
- `src/components/NewPlanModal.tsx` — useAuthStore + LoginModal追加、ゲストヒントテキスト追加
- `src/components/ShareModal.tsx` — LoginModal追加、ゲストヒントテキスト追加

### i18nファイル
- `src/locales/en.json` — `app.page_title_planner/landing`、`app.share_guest_hint`、`csv_import.*`、`error_boundary.*`、`new_plan.guest_hint/guest_hint_short` 追加
- `src/locales/ja.json` — 同上の日本語翻訳追加

### ドキュメント
- `docs/TODO.md` — 完了マーク + バグ追記
- `docs/TODO_COMPLETED.md` — 完了タスク移動

---

## ★ 最優先タスク（第58セッション）

### 1. ログイン促進UI実機確認（修正必須）
- 非ログイン状態で `/miti` にアクセス → サイドバー「新規作成」クリック → NewPlanModalのフッター部分にゲストヒントが表示されるか確認
- ShareModalも同様に確認
- **表示されない場合の調査ポイント**:
  - `useAuthStore`の`user`がFirebase Auth初期化中は`null`だが初期化完了後も`null`か
  - `!user`条件が正しく評価されているか（React DevToolsで確認）
  - `t('new_plan.guest_hint')`の`.split(/<\/?login>/)`が正しく動作しているか
  - `createPortal`で`<>`フラグメントを使った構造に問題がないか

### 2. βテスト残りタスク
- 優先順位1-3は完了（パフォーマンス、i18n、ログイン促進UI）
- 優先順位4: ヒールスキル追加は管理者画面テストと兼ねて後回し
- 優先順位5: FFLogsバグ2件も後回し

---

## セキュリティ残課題の進捗

### 第45セッション監査（7件）の対応状況

| # | 課題 | 状態 |
|---|------|------|
| 1 | ENFORCE_APP_CHECK未設定 | ✅ 第47セッションで完了 |
| 2 | .env.vercel-checkがgitに永続化 | ✅ 第48セッションで完了 |
| 3 | レート制限がインメモリ | ✅ 第49セッションで完了 |
| 4 | shared_plansクリーンアップ | ❌ 未対応（Vercel 12関数上限の解消が先） |
| 5 | localStorage認証トークンリスク | ❌ 未対応（Firebase Auth標準動作、CSP多層防御で対応済み） |
| 6 | Google Fonts SRI | ❌ 未対応（CSP style-srcで代替防御済み） |
| 7 | Firestoreパスフォーマット検証 | ❌ 未対応（admin専用のため影響限定的） |
| 8 | クライアント側バッチ削除中断 | ❌ 未対応（Vercel環境ではCloud Functions不可） |

---

## 公開までの進捗

```
全体: █████████████████████████░ 約97%完了
```

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook（管理者向け → MainDiscord）: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Discord Bot Token: lopo-botリポジトリの.env + Wispbyteの.env
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Firebase プラン: Blaze（従量課金、予算アラート500円）
- Wispbyteアカウント: lopoly.contact@gmail.com
- **Upstash Redis**: `lopo-rate-limit` (us-east-1, 無料プラン, カード未登録)

## 既知のコンソールエラー（未対応・既存）
- `<path> attribute d: Expected number` — LoPoButton.tsxのSVGパスに%やcalcが入っている（4件、表示には影響なし）
- `THREE.Clock非推奨警告` — LandingScene.tsx:155, ParticleBackground.tsx:133（THREE.Timerに移行が必要）
- `[Violation]` — Chromeのパフォーマンス警告。パフォーマンス最適化で改善済みだが完全には消えない

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式

## 重要な技術的注意
- **useEscapeCloseフック**: `src/hooks/useEscapeClose.ts` — グローバルスタックで最前面モーダルのみEscapeに反応。新規モーダル追加時は必ずこのフックを使うこと
- **MitigationSelectorのEscape**: 段階的閉じ（対象選択→スキル一覧→閉じる）。callbackRef経由でselectedSingleTargetMit状態に追従
- **PARTY_MEMBER_IDS / PARTY_MEMBER_ORDER**: `src/constants/party.ts` — パーティメンバーIDの配列・ソートマップ。新規に`['MT','ST',...]`を書かず、ここからimportすること
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIがApp Checkトークン必須。新規API追加時は必ず`verifyAppCheck`を呼ぶこと
- **共有API GETはApp Check不要** — OGP画像生成の内部fetch用にスキップ設定済み
- **OAuthはPOST（開始）+GET（コールバック）の2ステップ** — POSTにApp Check、GETはstate/PKCEで保護
- **apiFetchがIDトークン+App Checkトークンを自動付与** — 手動でヘッダーを付ける必要なし
- **backdrop-filter直書き禁止** → `--tw-backdrop-blur` 変数パターンを使う（TECH_NOTES.md参照）
- **authDomain**: `auth.lopoly.app`（Firebase Hosting経由。直接lopoly.appにしてはいけない）
- **×ボタンのスタイル**: 全モーダルで反転ホバー統一済み（`hover:bg-app-text hover:text-app-bg`）
- **エラーレスポンスにdetailsを含めない** — 全APIで統一済み
- **CORSは`lopo-miti(-xxx).vercel.app`のみ許可** — `*.vercel.app`全許可は禁止
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
- **API内で`require()`を使わない** — ESモジュールバンドルで`require is not defined`になる。必ず`import`を使う
- **Upstash Redis**: 無料枠1日10,000コマンド。DAU成長時は有料プラン($0.2/10万コマンド)に切替
- **Firestore同期の3分クールダウン** — syncToFirestoreは_lastSyncAtから3分以内は実行しない。forceSyncAllはバイパス
- **ダークモードのglass-tier3 blur**: 12px（第52セッションで2px→12pxに変更）。サイドバー・ヘッダーは`.glass-frame`で2px維持
- **⋮メニューはcreatePortalでbody描画** — overflow-y-autoのクリップ回避。z-[99999]。イベントバブリング注意（stopPropagation必須）
- **Tooltipラッパーのw-fitに注意** — flex-1要素をTooltipで包む場合はwrapperClassNameで上書き必須
- **近接センサー**: `-left-1 w-[60px]`に縮小済み（第53セッション）。これ以上の変更は不要
- **ConsolidatedHeaderのmyJobHighlight**: useShallowではなく個別セレクタで取得すること（useShallowだと再レンダリングが阻害される）
- **JobMigrationModal**: createPortalでbody直下に描画（framer-motionのtransformでfixed配置が崩れるため）
- **Undo/Redoのdisabled判定**: canUndo/canRedoリアクティブセレクタを使う（getState()._history.lengthはレンダリング時に最新値を取れない場合がある）
- **キーボードショートカット**: e.key.toLowerCase()で比較すること（Shift併用時にe.keyが大文字になる）
- **i18nの`<login>`タグパース**: `t('key').split(/<\/?login>/)` で3分割し、index=1をボタンに。NewPlanModal・ShareModalで使用

## バックアップについて
- `C:\Users\masay\Desktop\FF14Sim - コピー` にfilter-branch前の完全バックアップが存在
- プロジェクトが正常に動作し続けることを確認したら削除してよい
