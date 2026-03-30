# セッション引き継ぎ書（2026-03-30 第48セッション）

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

## 今回のセッション（第48セッション）で完了したこと

### 1. git履歴からシークレットファイル除去

**問題**: コミット`3b242c3`で`.env.vercel-check`（Discord/FFLogs/Firebase/Twitter等の全シークレット含む）がgit履歴に残っていた。

**対応**:
- リポジトリがPRIVATEであること、共同作業者が本人のみであること、フォークがないことを確認
- デスクトップにプロジェクト全体のバックアップを作成
- `git filter-branch`で全466コミットの履歴から`.env.vercel-check`を完全除去
- 古い参照（refs/original/）を削除、`git gc --prune=now --aggressive`で不要データ消去
- `git push --force --all`でGitHubに反映
- 全履歴にファイルが残っていないことを検証（`git rev-list --all`で0件確認）

### 2. .gitignore強化

- `.env*`パターンを追加（`.env.local.example`のみ例外許可）
- 今後`.env`で始まるファイルがgitに入る事故を防止

### 3. プロジェクト破損なし検証

- ビルド成功（`npm run build`）
- TypeScript型チェックエラーなし（`tsc --noEmit`）
- テスト全32件パス
- `src/`, `api/`, `docs/`, `public/`, 設定ファイル全てがバックアップと完全一致

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `.gitignore` | `.env*`パターン追加（再発防止） |
| `docs/TODO.md` | `.env.vercel-check`課題を完了マーク |

※ `git filter-branch`により全コミットのハッシュが変更されている（内容は同一）

---

## セキュリティ残課題の進捗

### 第45セッション監査（7件）の対応状況

| # | 課題 | 状態 |
|---|------|------|
| 1 | ENFORCE_APP_CHECK未設定 | ✅ 第47セッションで完了 |
| 2 | .env.vercel-checkがgitに永続化 | ✅ **第48セッションで完了** — 全履歴から除去 + .gitignore強化 |
| 3 | レート制限がインメモリ | ❌ **未対応（最重要）** — Upstash Redis等の外部ストアが必要 |
| 4 | shared_plansクリーンアップ | ❌ 未対応（Vercel 12関数上限の解消が先） |
| 5 | localStorage認証トークンリスク | ❌ 未対応（Firebase Auth標準動作、CSP多層防御で対応済み） |
| 6 | Google Fonts SRI | ❌ 未対応（CSP style-srcで代替防御済み） |
| 7 | Firestoreパスフォーマット検証 | ❌ 未対応（admin専用のため影響限定的） |
| 8 | クライアント側バッチ削除中断 | ❌ 未対応（Vercel環境ではCloud Functions不可） |

### 第46セッション検証レポート（8件）の対応状況

| # | 問題 | 状態 |
|---|------|------|
| 1 | copyカウント不動 | ✅ 第46セッションで修正済み |
| 2 | App Check + OAuth干渉 | ✅ 第47セッションで強化 |
| 3 | CSP reCAPTCHA不足 | ✅ 第46セッションで修正済み |
| 4 | share-page lopo-eta | ✅ 第46セッションで修正済み |
| 5 | templates CORS | ✅ 第46セッションで修正済み |
| 6 | fflogs.ts開発環境 | ❌ 未対応（開発環境のみ） |
| 7 | share API Storage正規表現 | ❌ 未対応（極めて低リスク） |
| 8 | userPlanCounts delete | ❌ 未対応（孤児ドキュメントが残るのみ） |

---

## 最優先タスク（第49セッション）

### 1. レート制限のインメモリ問題（セキュリティ最重要）
- Upstash Redis等の外部ストアによるレート制限の実装
- TODO.mdに詳細記載

### 2. プライバシーポリシー更新（パターンC）

### 3. Firestore同期修正3件（持ち越し）
- 3分クールダウン未実装（usePlanStore.ts）
- 起動時Firestore読み込みの非ブロッキング化（useAuthStore.ts）
- forceSyncAllにタイムアウト追加

### 4. シークレットローテーション（推奨・緊急度低）
- リポジトリをpublicにする前に、Discord/FFLogs/Twitter/Firebaseの各シークレットを再生成すること
- 現時点ではPRIVATEかつ履歴除去済みのため急がない

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
- **git filter-branch実行済み** — 全コミットハッシュが変更されている。過去の引き継ぎ書に書かれたコミットハッシュ（`3b242c3`, `a02d48a`等）は無効

## バックアップについて
- `C:\Users\masay\Desktop\FF14Sim - コピー` にfilter-branch前の完全バックアップが存在
- プロジェクトが正常に動作し続けることを確認したら削除してよい
