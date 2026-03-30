# セッション引き継ぎ書（2026-03-30 第47セッション）

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

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第47セッション）で完了したこと

### 1. ENFORCE_APP_CHECK=true の設定・検証・修正

**Vercel環境変数にENFORCE_APP_CHECK=trueを設定し、全APIでApp Check強制化を実現。**

- 初回設定時に`echo "true"`で改行が混入し、`"true\n" !== "true"`で強制化が無効だった
- `printf "true"`で再設定し、ランタイムログで`enforced=true`を確認
- 全11エンドポイントでApp Checkトークンなしの403拒否を検証済み

### 2. OAuth開始フローのApp Check保護強化

**従来**: `window.location.href = '/api/auth/discord'`（ブラウザナビゲーション → App Checkヘッダー付与不可）

**改善後**: `apiFetch('/api/auth/discord', { method: 'POST' })` → JSON応答でリダイレクトURL受取 → `window.location.href`でリダイレクト

これにより:
- **ステップ1（OAuth開始）**: App Check + state + cookie で保護（ボットによるフロー乱用を防止）
- **ステップ2（コールバック）**: state/PKCE + HttpOnly cookie で保護（外部リダイレクトのためApp Checkスキップは正しい設計）

### 3. FFLogsテンプレート自動登録のApp Check対応

`FFLogsImportModal.tsx`の直接`fetch`を`apiFetch`に置き換え。手動Authorization削除（`apiFetch`が自動付与）。

### 4. share-page/og の ESM import修正

`ogpHelpers`のimportに`.js`拡張子を追加。過去のコミット`d8982dc`で他APIは修正済みだったが、この2ファイルだけスキップされていた修正漏れ。OGPメタタグ（SNS共有カード）が正常に生成されるようになった。

### 5. 検証中に作成された偽共有プランの削除

App Check未適用時のcurlテストで偽作成された`shared_plans/J_UK3qpY`をFirebase Admin SDKで削除済み。

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `api/auth/discord/index.ts` | POST=ステップ1（App Check保護）+ JSON返却、GET=ステップ2（コールバック） + CORS追加 |
| `api/auth/twitter/index.ts` | 同上 |
| `src/store/useAuthStore.ts` | `window.location.href`を`apiFetch` POST → URL受取 → リダイレクトに変更 + apiFetchインポート追加 |
| `src/components/FFLogsImportModal.tsx` | 直接`fetch`を`apiFetch`に置き換え + 手動Authorization・token削除 + apiFetchインポート追加 |
| `api/share-page/index.ts` | ogpHelpers importに`.js`拡張子追加 |
| `api/og/index.ts` | 同上 |
| `docs/TODO.md` | ENFORCE_APP_CHECK完了マーク |

---

## セキュリティ残課題の進捗

### 第45セッション監査（7件）の対応状況

| # | 課題 | 状態 |
|---|------|------|
| 1 | ENFORCE_APP_CHECK未設定 | ✅ **第47セッションで完了** — 全環境設定 + 全11エンドポイント検証 + OAuth POST化 |
| 2 | レート制限がインメモリ | ❌ **未対応（最重要）** — Upstash Redis等の外部ストアが必要 |
| 3 | shared_plansクリーンアップ | ❌ 未対応（Vercel 12関数上限の解消が先） |
| 4 | localStorage認証トークンリスク | ❌ 未対応（Firebase Auth標準動作、CSP多層防御で対応済み） |
| 5 | Google Fonts SRI | ❌ 未対応（CSP style-srcで代替防御済み） |
| 6 | Firestoreパスフォーマット検証 | ❌ 未対応（admin専用のため影響限定的） |
| 7 | クライアント側バッチ削除中断 | ❌ 未対応（Vercel環境ではCloud Functions不可） |

### 第46セッション検証レポート（8件）の対応状況

| # | 問題 | 状態 |
|---|------|------|
| 1 | copyカウント不動 | ✅ 第46セッションで修正済み |
| 2 | App Check + OAuth干渉 | ✅ **第47セッションで強化** — POST方式に改善 |
| 3 | CSP reCAPTCHA不足 | ✅ 第46セッションで修正済み |
| 4 | share-page lopo-eta | ✅ 第46セッションで修正済み |
| 5 | templates CORS | ✅ 第46セッションで修正済み |
| 6 | fflogs.ts開発環境 | ❌ 未対応（開発環境のみ） |
| 7 | share API Storage正規表現 | ❌ 未対応（極めて低リスク） |
| 8 | userPlanCounts delete | ❌ 未対応（孤児ドキュメントが残るのみ） |

### 第47セッションで新たに発見

| 問題 | 状態 |
|------|------|
| `.env.vercel-check`がgitに永続化（全シークレット含む） | ❌ **要対応** — コミット`3b242c3`で混入。シークレットローテーションを検討すべき |

---

## 最優先タスク（第48セッション）

### 1. .env.vercel-checkのシークレット漏洩対応（最重要）
- `.env.vercel-check`がgitに全シークレットごとコミットされている（コミット`3b242c3`）
- リポジトリがprivateなら影響は限定的だが、シークレットローテーションを検討すべき
- `.gitignore`に追加してgitから除外する

### 2. レート制限のインメモリ問題（セキュリティ最重要）
- Upstash Redis等の外部ストアによるレート制限の実装
- TODO.mdに詳細記載

### 3. プライバシーポリシー更新（パターンC）

### 4. Firestore同期修正3件（持ち越し）
- 3分クールダウン未実装（usePlanStore.ts）
- 起動時Firestore読み込みの非ブロッキング化（useAuthStore.ts）
- forceSyncAllにタイムアウト追加

---

## 公開までの進捗

```
全体: █████████████████████████░ 約96%完了
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

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内（Sidebar.tsx:268-340）
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — LandingScene.tsx:155, ParticleBackground.tsx:133（THREE.Timerに移行が必要）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
- セキュリティ残課題の一部（shared_plansクリーンアップ等）がこの制限で対応不可
- **対応必須**（TODO.mdに記載済み: パスベースルーティング統合 or 有料プラン）

## 重要な技術的注意
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIがApp Checkトークン必須。新規API追加時は必ず`verifyAppCheck`を呼ぶこと
- **OAuthはPOST（開始）+GET（コールバック）の2ステップ** — POSTにApp Check、GETはstate/PKCEで保護
- **apiFetchがIDトークン+App Checkトークンを自動付与** — 手動でヘッダーを付ける必要なし
- **backdrop-filter直書き禁止** → `--tw-backdrop-blur` 変数パターンを使う（TECH_NOTES.md参照）
- **authDomain**: `auth.lopoly.app`（Firebase Hosting経由。直接lopoly.appにしてはいけない）
- **×ボタンのスタイル**: 全モーダルで反転ホバー統一済み（`hover:bg-app-text hover:text-app-bg`）
- **エラーレスポンスにdetailsを含めない** — 全APIで統一済み
- **CORSは`lopo-miti(-xxx).vercel.app`のみ許可** — `*.vercel.app`全許可は禁止
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
