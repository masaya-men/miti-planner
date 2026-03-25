# セッション引き継ぎ書（2026-03-25 第7セッション）

## ★ セッション開始時の必須作業
**毎回のセッション開始時に、`docs/` フォルダ内の全計画書を必ず読むこと。**
CLAUDE.md の「セッション開始時の必須作業」セクションに一覧がある。
特に `docs/TODO.md` は最新の進捗・方針が集約されているため、最初に必ず確認する。

---

## 今回のセッションで完了したこと

### 1. Firestoreセキュリティルール + インデックスのデプロイ
- `firebase.json` + `.firebaserc` を新規作成
- `npx firebase-tools deploy --only firestore:rules` でルールをデプロイ済み
- `firestore.indexes.json` を作成し、`plans` コレクションの複合インデックス（ownerId ASC + updatedAt DESC）をデプロイ済み
- **planService.ts と セキュリティルールの整合性を詳細検証済み** — 致命的な不整合なし（90%準拠）
- planService.ts の未使用 `deleteDoc` インポートを削除（ビルド警告修正）

### 2. FFLogsインポートのログイン限定化
- **FFLogsImportModal.tsx**: 未ログイン時は「ログインが必要です」画面を表示。ログインモーダルへの導線あり
- **クライアント側レート制限**: 1時間あたり15回まで（localStorageでタイムスタンプ管理）
- **APIキー5組のラウンドロビン**: `api/fflogs/token/index.ts` を改修。`FFLOGS_CLIENT_ID_2〜5` / `FFLOGS_CLIENT_SECRET_2〜5` を環境変数で管理
- Vercel環境変数に4組の追加APIキーを登録済み（計5組）
- `.env.local` にも追加キーを記録済み
- i18nキー追加: `fflogs.login_required_title`, `login_required_description`, `login_button`, `rate_limit_exceeded`

### 3. モバイルボトムナビの改修
- **Statusタブ → Login/アバタータブに変更**
  - 未ログイン: LogInアイコン → タップでLoginModal
  - ログイン済み: ユーザーアバター画像 → タップでMobileAccountMenu（名前+ログアウト）
- **パーティシートにタブ切り替え追加**: [パーティ] [ステータス] の2タブ
  - `MobilePartyWithTabs` コンポーネントを Layout.tsx 内に新設
  - `MobileAccountMenu` コンポーネントを Layout.tsx 内に新設
- ボトムナビ構成: メニュー | パーティ | ツール | MY JOB | ログイン/アバター
- i18nキー追加: `nav.login`, `nav.account`, `nav.logout`, `nav.tab_party`, `nav.tab_status`

### 4. サイドバー展開状態のバグ修正
- **問題**: タブ復帰・プラン切替・ページリロード時にサイドバーが現在のプランのコンテンツを展開しない
- **原因**: `selectedContentId` が `useState(null)` で常にnullに初期化されていた
- **修正**: `Sidebar.tsx` で `selectedContentId` を `currentPlanId` の `contentId` で初期化 + `useEffect` で追従
- **確認未完了**: ユーザーによる動作確認がまだ

### 5. ログイン成功UXの改善
- **問題**: ログイン成功時に表が一瞬見えてから「おかえり/ようこそ」オーバーレイが出る（チラつき）
- **修正**: Layout.tsx で `justLoggedInUser` がある時に `z-[99998]` のフルスクリーン背景を即座に表示
- **確認未完了**: ユーザーによる動作確認がまだ

### 6. カスタムドメイン取得
- **lopoly.app** を Cloudflare Registrar で取得（$14.20/年）
- 名前の由来: Low Polygon（ローポリゴン）→ FF14のローポリブドウ → LoPo
- Cloudflare DNS に Aレコード設定済み: `@ → 76.76.21.21`（プロキシOFF = DNSのみ）
- Vercel に `npx vercel domains add lopoly.app` で追加済み
- **SSL証明書の発行・接続確認が未完了** — 次回セッション開始時に `https://lopoly.app` へのアクセスを確認すること

### 7. OGPデザイン候補の作成
- `public/ogp-preview.html` にプレビューページを作成
- **ユーザー選択: C-3（縦書きスリムロゴ）をベース**
- **確定方針**: 縦書き「LoPo」テキスト + ブドウロゴ（favicon-192x192.png）の組み合わせ
- バンドル共有（複数コンテンツ）のデザインも含む
- **実装未完了**: プレビューの最終確認 → api/og/index.ts への反映が次回の作業

### 8. 方針決定・記録
- **FFLogsインポートはログイン限定**（API保護 + ログインメリット強化）
- **チームロゴは画面内常時表示しない。OGP画像のみ**（デザイン優先）
- **マネタイズ**: アプリ内課金なし / YouTube誘導 / 支援リンク（Ko-fi/FANBOX/Patreon）
- **悪意あるAPI消費ユーザーはBAN可能**（Firebase Auth無効化、当面手動）
- **FFLogs APIキー増設方式**: 別アカウントでクライアント作成 → ラウンドロビン

---

## 未確認・未完了の作業（次回最優先）

### ★ 確認が必要なもの（ユーザーに操作してもらう）
1. **lopoly.app の接続確認** — `https://lopoly.app` にアクセスしてLoPoが表示されるか
2. **Firestore同期テスト** — PCでログイン+プラン編集+タブ切替 → スマホ（シークレットモード）でログイン → PCのプランが表示されるか
3. **サイドバー展開状態** — プランを開いた状態でタブ切替→戻った時にサイドバーが展開されているか
4. **ログイン成功のチラつき** — ログインした時に表が一瞬見えないか
5. **モバイルボトムナビ** — ログインボタンの動作、パーティシートのタブ切り替え
6. **OGPプレビュー** — `public/ogp-preview.html` をブラウザで開いてC-3dベースのデザイン最終確認

### ★ 実装が必要なもの（公開必須）
1. **OGP画像の実装** — C-3ベース + 縦書きLoPo + ブドウロゴ → `api/og/index.ts` に反映
   - ブドウロゴはBase64埋め込み（40KB、追加負荷なし）
   - 単一コンテンツ + バンドル共有の両方に対応
2. **支援リンクの設置** — Ko-fi / FANBOX / Patreon等をフッターに配置（ユーザーにどのサービスを使うか確認）
3. **ドメイン変更に伴う設定更新** — Firebase Auth の authorized domains に `lopoly.app` を追加、API CORS設定の更新

### ★ 実装が必要なもの（公開前推奨）
4. **ローディングインジケーター** — 言語切替・テーマ切替・テンプレート読み込み・プラン切替時に進行中表示
5. **既知バグの確認・判断** — FFLogs英語ログ言語取得問題、無敵ダメージ問題（公開を止めるほどか判断）
6. **コードクリーンアップ** — MitiPlannerロゴ削除、旧名称の残骸除去、index.htmlのog:image更新
7. **TODO.mdの重複記載整理**

---

## 重要な技術的知識（このセッションで追加）

### Firestoreインデックス
```
firestore.indexes.json:
- plans コレクション: ownerId ASC + updatedAt DESC
- デプロイ済み（firebase-tools deploy --only firestore:indexes）
- インデックス構築には数分かかる（デプロイ時点で構築開始）
```

### FFLogs APIキー管理
```
5組のAPIキーでラウンドロビン:
- FFLOGS_CLIENT_ID / FFLOGS_CLIENT_SECRET — メインキー（既存）
- FFLOGS_CLIENT_ID_2〜5 / FFLOGS_CLIENT_SECRET_2〜5 — 追加キー
- api/fflogs/token/index.ts で自動切り替え
- Vercel環境変数に全て Encrypted で登録済み
- .env.local にも記録済み

レート制限:
- FFLogs公式: 120秒あたり240リクエスト（キーごと）
- クライアント側: 1ユーザー1時間15回（localStorage管理）
- 5キー合計: 120秒あたり1,200リクエスト ≒ 同時120人対応可能
```

### カスタムドメイン
```
lopoly.app:
- 取得: Cloudflare Registrar（$14.20/年）
- DNS: Cloudflare（Aレコード @ → 76.76.21.21、プロキシOFF）
- Vercel: npx vercel domains add lopoly.app 実行済み
- SSL: 自動発行（数分〜数時間）
- 由来: Low Polygon → ローポリゴンのブドウ（FF14の伝説的な低ポリグレープ）→ LoPo → lopoly
```

### モバイルボトムナビ（変更後）
```
変更前: メニュー | パーティ | ステータス | ツール | MY JOB
変更後: メニュー | パーティ | ツール | MY JOB | ログイン/アバター

- ステータスはパーティシート内のタブに統合
- MobileBottomNav.tsx: onStatusOpen → onLoginOpen に変更
- Layout.tsx: MobilePartyWithTabs（タブ切り替え）+ MobileAccountMenu（ログイン済みメニュー）を追加
```

### OGPデザイン方針
```
確定: C-3ベース
- 左パネル（68〜76px幅）: 縦書き「LoPo」テキスト + ブドウロゴ
- 右パネル: コンテンツ名（大）+ プラン名（小）+ カテゴリタグ
- 白い短いアクセントライン（左下）
- 全て白黒（CLAUDE.mdルール準拠）
- バンドル共有: 同じ左パネル + 右に番号付きリスト

プレビューファイル: public/ogp-preview.html
※画像パスは相対パス（icons/favicon-192x192.png）に修正済み
```

---

## ファイル変更一覧（今回のセッション）

| ファイル | 変更内容 |
|---------|---------|
| `firebase.json` | **新規** Firestoreルール+インデックス設定 |
| `.firebaserc` | **新規** Firebaseプロジェクト紐付け |
| `firestore.indexes.json` | **新規** 複合インデックス定義 |
| `src/lib/planService.ts` | 未使用deleteDocインポート削除 |
| `src/components/FFLogsImportModal.tsx` | ログインチェック+レート制限追加 |
| `api/fflogs/token/index.ts` | 5キーラウンドロビン対応 |
| `src/components/MobileBottomNav.tsx` | Status→Login/アバターに変更 |
| `src/components/Layout.tsx` | パーティタブ化+アカウントメニュー+ログイン成功チラつき防止 |
| `src/components/Sidebar.tsx` | selectedContentIdの初期化+追従修正 |
| `src/locales/ja.json` | nav/fflogs i18nキー追加 |
| `src/locales/en.json` | 同上（英語版） |
| `docs/TODO.md` | 方針・バグ・完了タスク大量更新 |
| `public/ogp-preview.html` | **新規** OGPデザインプレビュー（開発用・本番には含めない） |
| `.env.local` | FFLogs追加APIキー4組を記録 |

---

## ユーザーからのフィードバック（このセッションで受けたもの）

1. **スマホでログインできない** → ボトムナビにログインボタンを追加して解決
2. **ステータス設定はスマホで不要** → パーティシート内タブに移動
3. **ログイン成功時に表が一瞬見える** → チラつき防止オーバーレイ追加（確認未完了）
4. **言語/テーマ切替時にインジケーターが欲しい** → TODO記録済み（未実装）
5. **テンプレート/プラン読み込み時もローディング表示** → TODO記録済み（未実装）
6. **サイドバーが展開されない** → 修正済み（確認未完了）
7. **MitiPlannerロゴは削除してよい** → TODO記録済み（未実装）
8. **OGPはC-3ベース + 縦書きLoPo + ブドウロゴ** → プレビュー作成済み（実装未完了）
9. **ドメインURLに本名が入っている** → lopoly.app を取得して解決
10. **レート制限1時間5回は少なすぎる** → 15回に緩和済み
