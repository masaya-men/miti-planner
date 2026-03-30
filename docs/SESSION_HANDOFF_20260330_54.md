# セッション引き継ぎ書（2026-03-30 第54セッション）

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

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **公式X**: https://x.com/lopoly_app
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第54セッション）で完了したこと

### 1. Escapeキーで全モーダル・メニューを閉じる機能
- **useEscapeCloseフック** (`src/hooks/useEscapeClose.ts`) を新規作成
  - グローバルスタック機構: モーダルが重なった場合、最前面だけがEscapeに反応
  - チュートリアル中はEscapeを無視
  - `callbackRef`パターンでonClose変更時の再登録を防止
  - `stopImmediatePropagation`で同一Escapeイベントの多重処理を防止
- **適用した全UI要素（14+4=18箇所）:**
  - モーダル10個: ConfirmDialog / EventModal / FFLogsImportModal / CsvImportModal / LoginModal / NewPlanModal / JobMigrationModal / PhaseModal / ShareModal / PartySettingsModal
  - ポップオーバー3個: AASettingsPopover / ClearMitigationsPopover / PartyStatusPopover
  - SaveDialog（既存のinput内Escape + フック併用）
  - Sidebar⋮メニュー（直接useEffect、フック不使用 — menuPlanIdベースのため）

### 2. PartyStatusPopover contentLanguage依存バグ修正
- `useMemo`の依存配列に`contentLanguage`を追加
- 言語切替時にスキルプレビュー（シールド・ヒール量）が再計算されるようになった

### 3. パーティメンバーID定数の共通化
- `src/constants/party.ts` を新規作成: `PARTY_MEMBER_IDS` + `PARTY_MEMBER_ORDER`
- Layout.tsx（2箇所）, Timeline.tsx（2箇所）, useTutorialStore.ts（1箇所）の重複定義を置換

---

## 第54セッションで追加・変更したファイル一覧

### 新規作成
- `src/hooks/useEscapeClose.ts` — Escape共通フック
- `src/constants/party.ts` — パーティメンバーID定数
- `docs/superpowers/plans/2026-03-30-pre-optimization-cleanup.md` — 実装計画書

### 修正（useEscapeClose適用）
- `src/components/ConfirmDialog.tsx`
- `src/components/EventModal.tsx`
- `src/components/FFLogsImportModal.tsx`
- `src/components/CsvImportModal.tsx`
- `src/components/LoginModal.tsx`
- `src/components/NewPlanModal.tsx`
- `src/components/JobMigrationModal.tsx`
- `src/components/PhaseModal.tsx`
- `src/components/ShareModal.tsx`
- `src/components/PartySettingsModal.tsx`
- `src/components/AASettingsPopover.tsx`
- `src/components/ClearMitigationsPopover.tsx`
- `src/components/PartyStatusPopover.tsx` — Escape追加 + contentLanguage依存修正
- `src/components/SaveDialog.tsx`
- `src/components/Sidebar.tsx` — ⋮メニューEscape対応

### 修正（定数共通化）
- `src/components/Layout.tsx`
- `src/components/Timeline.tsx`
- `src/store/useTutorialStore.ts`

---

## ユーザーによるテスト中（第55セッション開始前に結果を確認）

ユーザーがEscapeキー対応の動作確認を行っている。次セッション開始時にテスト結果を聞くこと。

### テスト項目
1. 各モーダル/ポップオーバーでEscキーが効くか（14+4箇所）
2. スタック動作: パーティ設定→ジョブ変更確認→Esc→最前面だけ閉じるか
3. チュートリアル中にEscが無視されるか
4. 言語切替でPartyStatusPopoverのスキルプレビューが更新されるか
5. 既存機能（プラン作成・編集・保存・サイドバー操作）が壊れていないか

---

## 最優先タスク（第55セッション）

### 1. テスト結果の確認とバグ修正
- ユーザーのテスト結果に基づいて修正が必要な箇所を対応

### 2. アプリ動作パフォーマンスの最適化
- React.memo追加（全ての視覚的変更が完了したため着手可能）
- サイドメニュー・ヘッダーの開閉パフォーマンス最適化
- 対象候補: Timeline.tsx, Sidebar.tsx, ConsolidatedHeader.tsx

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
- `[Violation]` — Chromeのパフォーマンス警告。パフォーマンス最適化タスクで対応

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
- セキュリティ残課題の一部（shared_plansクリーンアップ等）がこの制限で対応不可

## 重要な技術的注意
- **useEscapeCloseフック**: `src/hooks/useEscapeClose.ts` — グローバルスタックで最前面モーダルのみEscapeに反応。新規モーダル追加時は必ずこのフックを使うこと
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

## バックアップについて
- `C:\Users\masay\Desktop\FF14Sim - コピー` にfilter-branch前の完全バックアップが存在
- プロジェクトが正常に動作し続けることを確認したら削除してよい
