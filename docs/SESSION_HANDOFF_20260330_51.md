# セッション引き継ぎ書（2026-03-30 第51セッション）

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

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第51セッション）で完了したこと

### Firestore端末間同期の修正

**背景**: ログイン済みの端末間（PCとスマホ等）でプランが全く同期されていなかった。

**発見した根本原因**:
1. `migrateOnLogin`がローカルの方が新しいプランをFirestoreに書き戻していなかった
2. `syncToFirestore`の完了時に、同期中に追加されたdirtyフラグまで全消去していた
3. `userPlanCounts`カウンターが壊れていた（過去の同期失敗でカウンターだけインクリメントされ、実際のプラン数と乖離）
4. エラーが`.catch(() => {})`で完全に握りつぶされていた

**修正内容（4ファイル）**:

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/planService.ts` | `migrateLocalPlansToFirestore`がローカルの新しいプランをFirestoreに書き戻す。`repairPlanCounts`関数を追加（ログイン時にカウンターを実データから再計算） |
| `src/store/usePlanStore.ts` | `syncToFirestore`にdirtyスナップショット方式+3分クールダウン。`forceSyncAll`に10秒タイムアウト。`migrateOnLogin`が新戻り値（dirtyIds）に対応 |
| `src/store/useAuthStore.ts` | チームロゴ読み込みをバックグラウンド化（loading: falseを先に設定） |
| `src/components/Layout.tsx` | エラーログ可視化、5分定期バックアップ同期追加、beforeunload警告をログイン中+未同期にも拡張 |

**確認済み**: PCで編集→スマホでリロード→同期を確認

### 確定した設計方針（第51セッション）

**Firestore同期のタイミング（確定）**:
- localStorage: 編集のたびに即保存（500msデバウンス）
- Firestore: タブ離脱 / ページ閉じ / プラン切替 / ログアウト / 5分定期バックアップ
- **編集のたびにFirestore同期はしない**（試行錯誤中の無駄を避ける）
- 3分クールダウンで過剰書き込み防止
- ログイン時にカウンター自動修復

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

## 最優先タスク（第52セッション）

### 1. アプリ動作パフォーマンスの最適化
- 起動時非ブロッキング化は完了済み
- React.memo追加（視覚変更後に対応）
- サイドメニュー・ヘッダーの開閉パフォーマンス最適化

### 2. Sidebar button入れ子問題
- HTML仕様違反の修正（a11y的にも問題）

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

## バックアップについて
- `C:\Users\masay\Desktop\FF14Sim - コピー` にfilter-branch前の完全バックアップが存在
- プロジェクトが正常に動作し続けることを確認したら削除してよい
