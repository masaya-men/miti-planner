# セッション引き継ぎ書（2026-03-30 第45セッション）

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
- **修正件数を圧縮して報告する（第45セッションで発生）** — 監査で見つけた問題の件数と修正済み件数は常に正確に突き合わせること

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第45セッション）で完了したこと

### 1. 包括的セキュリティ監査の実施
3方面（API・フロントエンド・Firebase）から網羅的に監査を実施。**全35件の問題を検出**。

### 2. セキュリティ修正（35件中28件修正）

#### 高 (High) — 3件中3件対応
| # | 問題 | 修正内容 |
|---|------|---------|
| 1 | App Check非強制モード | 確認済み → Vercelに`ENFORCE_APP_CHECK=true`手動設定が必要 |
| 2 | OAuthトークンXSS | `'${customToken}'` → `${JSON.stringify(customToken)}` |
| 3 | /api/share認証なし | レート制限10回/分 + ボディ500KB制限 |

#### 中 (Medium) — 19件中17件対応
| # | 修正内容 |
|---|---------|
| 1 | Discord OAuthにCSRF保護（state+HttpOnly cookie）追加 |
| 2 | CORS: `*.vercel.app` → `lopo-miti(-xxx).vercel.app` に限定（全4ファイル） |
| 3 | エラーレスポンスから`details`を全削除（6ファイル） |
| 4 | FFLogsレスポンスをaccess_token+expires_inのみにフィルタ |
| 5 | viewCount: IPハッシュベースの重複排除 |
| 6 | plans updateルール: copyCount/useCount改ざん禁止 |
| 7 | sharedPlanMeta updateルール: title/planId型検証追加 |
| 8 | アカウント削除時にStorageチームロゴも削除 |
| 9 | ADMIN_SECRET: crypto.timingSafeEqual使用 |
| 10 | App Checkバイパス: POST+有効secret文字列の場合のみスキップ |
| 11 | CSPヘッダーをvercel.jsonに追加 |
| 12 | VITE_FFLOGS_CLIENT_SECRET → 開発環境もサーバーサイドプロキシ経由に統一 |
| 13 | popular POST uid自己申告 → サーバー側IDトークン検証 |
| 14 | timelineEventsの型チェック+上限500件 |
| 15 | admin/templatesサーバーデータ更新のフィールドホワイトリスト |
| 16 | Storageパス検証を正規表現で厳格化 |
| 17 | plans version楽観ロック `>=` → `>` |

#### 中 未対応 — 2件
| # | 問題 | 理由 |
|---|------|------|
| 1 | レート制限がインメモリ（Vercel Serverlessで実質無効） | 外部ストア（Redis/KV）が必要。月額コスト発生 |
| 2 | shared_plansアカウント削除時残存 | 新APIエンドポイント追加不可（Vercel Hobby 12関数上限） |
| 3 | localStorage認証トークンリスク | Firebase Auth標準動作。使用後即時削除で対策済み |

#### 低 (Low) — 13件中8件対応
| # | 修正内容 |
|---|---------|
| 1 | share-page hostヘッダーSSRF対策（ホワイトリスト検証） |
| 2 | contentIds上限20件に制限 |
| 3 | OGPエラーからシステム情報除去 |
| 4 | authエンドポイントHTTPメソッド制限（GET+OPTIONSのみ） |
| 5 | console.logからuserId除去 |
| 6 | 未使用xlsxパッケージ削除（高脆弱性解消） |
| 7 | Firestoreルール: plans version `>` に変更 |
| 8 | Firestoreルール: users updateにhasAll追加（フィールド削除防止） |

#### 低 未対応 — 5件
| # | 問題 | 理由 |
|---|------|------|
| 1 | Google Fonts integrity未設定 | 動的CSS生成でSRI不可。CSPで代替防御済み |
| 2 | 公開エンドポイントレート制限なし | #中1と同じ理由 |
| 3 | クライアント側バッチ削除の中断リスク | Cloud Functionsが必要（Vercel環境で対応困難） |
| 4 | Firestoreドキュメントパス未検証 | admin専用APIのみで影響限定的 |
| 5 | auth認証エンドポイントレート制限なし | #中1と同じ理由 |

### 3. その他の修正
- **auth.lopoly.app**: DNS反映確認済み。Googleログインが新ドメインで正常動作
- **Google OAuth redirect_uri_mismatch解消**: Google Cloud Consoleに`https://auth.lopoly.app/__/auth/handler`を追加（ユーザーが手動実施）
- **email表示削除**: Layout.tsx（モバイルメニュー）、AdminLayout.tsx（管理画面フォールバック）
- **Twitter OAuthスコープ**: `tweet.read users.read` → `users.read` のみに変更（不要な権限削除）
- **プライバシー方針確定**: パターンC（取得するが保存・利用しないと明記する）で合意

### 4. プライバシーに関する事実確認結果
| プロバイダー | emailスコープ要求 | email取得 | Firestore保存 |
|---|---|---|---|
| Google | Firebase SDKが強制（止められない） | される | されない（ルールで明示禁止） |
| Discord | `identify`のみ（emailなし） | されない | されない |
| Twitter | `users.read`のみ | されない | されない |

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `api/auth/discord/index.ts` | CSRF保護(state+cookie)、JSON.stringify、details除去、メソッド制限 |
| `api/auth/twitter/index.ts` | JSON.stringify、details除去、メソッド制限、tweet.readスコープ削除 |
| `api/share/index.ts` | レート制限、ボディサイズ制限、viewCount IP重複排除、CORS限定、Storageパス厳格化、details除去 |
| `api/popular/index.ts` | uid IDトークン検証、contentIds上限、CORS限定、details除去 |
| `api/fflogs/token/index.ts` | レスポンスフィルタ、CORS限定、details除去 |
| `api/admin/set-role.ts` | timingSafeEqual、App Checkバイパス修正、CORS限定 |
| `api/admin/templates/index.ts` | フィールドホワイトリスト |
| `api/template/auto-register/index.ts` | timelineEvents型チェック+上限 |
| `api/share-page/index.ts` | hostヘッダーSSRF対策 |
| `api/og/index.ts` | エラーメッセージ情報除去 |
| `firestore.rules` | plansのread制限、copyCount/useCount改ざん防止、version `>`、users hasAll、sharedPlanMeta検証 |
| `src/store/useAuthStore.ts` | アカウント削除時Storageロゴ削除追加 |
| `src/api/fflogs.ts` | 開発環境もサーバーサイドプロキシ経由に変更 |
| `src/components/Layout.tsx` | user.email表示削除 |
| `src/components/admin/AdminLayout.tsx` | user?.emailフォールバック削除 |
| `src/utils/logoUpload.ts` | console.logからuserId除去 |
| `vercel.json` | CSPヘッダー追加 |
| `package.json` | xlsxパッケージ削除 |
| `docs/TODO.md` | セキュリティ残課題セクション追加 |

---

## 最優先タスク（第46セッション）

### 1. ENFORCE_APP_CHECK の手動設定（最重要・即時）
- Vercelダッシュボード → Settings → Environment Variables
- 名前: `ENFORCE_APP_CHECK`、値: `true`
- Production, Preview, Development 全てに追加
- **追加後、再デプロイが必要**
- これがないとApp Checkが防御として全く機能しない

### 2. セキュリティ残課題7件の対応
**TODO.mdの「セキュリティ残課題」セクションに全7件が詳細に記載されている。**

最も影響が大きいのは**レート制限のインメモリ問題**。Vercel KVまたはUpstash Redisの導入を検討すべき。

### 3. プライバシーポリシー更新
パターンC（メールアドレスの取得と非保存を明記）の文言をプライバシーポリシーに反映する。

### 4. Firestore同期の修正3件（前セッションからの持ち越し）
- 3分クールダウンの実装（usePlanStore.ts）
- 起動時Firestore読み込みの非ブロッキング化（useAuthStore.ts）
- forceSyncAllにタイムアウト追加

### 5. npm audit対応
- firebase-adminの依存ツリーに19件の脆弱性（うち9件high）
- firebase-admin自体のアップデートで解消される可能性

---

## 公開までの進捗

```
全体: ████████████████████████░ 約95%完了
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

## 重要な技術的注意
- **backdrop-filter直書き禁止** → `--tw-backdrop-blur` 変数パターンを使う（TECH_NOTES.md参照）
- **authDomain**: `auth.lopoly.app`（Firebase Hosting経由。直接lopoly.appにしてはいけない）
- **サイドバー・ヘッダーのCSS**: 苦労して整えた見た目なので慎重に扱う
- **×ボタンのスタイル**: 全モーダルで反転ホバー統一済み（`hover:bg-app-text hover:text-app-bg`）。新規モーダル追加時も同じパターンを使うこと

## セキュリティ修正に関する注意（第45セッション追加）
- **エラーレスポンスにdetailsを含めない** — 全APIで統一済み。新規追加時も`{ error: 'メッセージ' }`のみ
- **CORSは`lopo-miti(-xxx).vercel.app`のみ** — `*.vercel.app`全許可は禁止
- **OAuthのHTMLテンプレートにトークンを埋め込む場合は必ず`JSON.stringify`** — シングルクォートで囲まない
- **Firestoreルールでclient側から変更不可のフィールド**（copyCount, useCount）は`== resource.data.xxx`で保護
- **CSPヘッダーをvercel.jsonで管理** — 新しい外部リソースを使う場合はCSPの更新が必要
