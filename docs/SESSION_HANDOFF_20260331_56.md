# セッション引き継ぎ書（2026-03-31 第56セッション）

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

## 今回のセッション（第56セッション）で完了したこと

### 1. パフォーマンス最適化（React.memo + useShallow + useCallback + Layout分割）
- **React.memo**: MitigationItem, ContentTreeItem, SaveIndicator
- **useShallow**: Timeline, Sidebar, CheatSheetView, Layout（ConsolidatedHeaderは個別セレクタに戻し）
- **useCallback**: Timeline内6ハンドラ（handlePhaseAdd, handleAddClick, handleEventClick, handleCellClick, handleDamageClick, handleMobileDamageClick）
- **Layout.tsx分割**: MobileHeader.tsx（~150行）, MobilePartySettings.tsx（~330行）を別ファイルに切り出し → Layout.tsx: 980行→500行に縮小
- **canUndo/canRedo**: リアクティブセレクタで Undo/Redo ボタンの disabled 状態を正しく管理

### 2. テスト中に発見した問題の修正（11件）
- イベントポップオーバー: glass-tier3追加、削除ボタン赤文字+角丸、Escape対応
- Redo修正: Ctrl+Shift+Zの大文字問題（toLowerCase）
- MyJobボタン: 全箇所で黄色に統一（PartySettingsModal, MobilePartySettings, ConsolidatedHeader, MobileBottomNav）
- JobMigrationModal: ライトモード視認性改善、createPortal化（ヘッダー埋まり修正）
- オートプランi18n翻訳キー追加（en.json/ja.json）
- ConfirmDialogのi18nハードコーディング修正

---

## 第56セッションで変更したファイル一覧

### パフォーマンス最適化
- `src/components/Timeline.tsx` — React.memo(MitigationItem) + useShallow + useCallback + canUndo/canRedo
- `src/components/TimelineRow.tsx` — 変更なし（既にmemo使用）
- `src/components/Sidebar.tsx` — React.memo(ContentTreeItem) + useShallow
- `src/components/ConsolidatedHeader.tsx` — React.memo(SaveIndicator) + 個別セレクタ
- `src/components/CheatSheetView.tsx` — useShallow追加
- `src/components/Layout.tsx` — useShallow + MobileHeader/MobilePartySettings切り出し
- `src/components/MobileHeader.tsx` — **新規**（Layout.tsxから切り出し）
- `src/components/MobilePartySettings.tsx` — **新規**（Layout.tsxから切り出し）

### バグ修正・UI改善
- `src/components/Timeline.tsx` — イベントポップオーバー改善、Redo修正、ESC対応、i18n修正
- `src/components/ConsolidatedHeader.tsx` — MyJobボタン黄色
- `src/components/MobileBottomNav.tsx` — MyJobインジケーター黄色
- `src/components/PartySettingsModal.tsx` — MyJob星ボタン黄色
- `src/components/MobilePartySettings.tsx` — MyJobバッジ・モード切替黄色
- `src/components/JobMigrationModal.tsx` — ライトモード修正 + createPortal
- `src/locales/en.json` — auto_plan翻訳キー追加
- `src/locales/ja.json` — auto_plan翻訳キー追加

### ドキュメント
- `docs/TODO.md` — パフォーマンス最適化完了マーク
- `docs/superpowers/specs/2026-03-30-performance-optimization-design.md` — 設計書
- `docs/superpowers/plans/2026-03-30-performance-optimization.md` — 実装計画書

---

## 最優先タスク（第57セッション）

### βテスト前の残りタスク（TODO.md 優先順位2-3）
1. **i18nハードコーディング精査** — リスク調査から着手。特にPartyStatusPopover.tsxの21個のスキル名が最重要
2. **非ログインユーザーへのログイン促進UI** — NewPlanModalに非ログイン時のみ注意書き追加 + 共有モーダルにも追記

### その他の候補
- Admin系ファイル（AdminContentForm, AdminSkills, AdminServers）のi18nハードコーディングは管理者専用のため低優先
- MitiPlannerPage.tsxのdocument.titleのi18n化

---

## アクセントカラーの方針（確定 第42・56セッション）
- 警告系 → 黄色
- 削除・危険系 → 赤
- OK・先に進む系 → 青
- **MyJob関連 → 黄色**（第56セッション確定）

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

## バックアップについて
- `C:\Users\masay\Desktop\FF14Sim - コピー` にfilter-branch前の完全バックアップが存在
- プロジェクトが正常に動作し続けることを確認したら削除してよい
