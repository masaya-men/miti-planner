# セキュリティ修正 網羅的検証レポート（第45セッション → 第46セッション）

**検証範囲**: 18ファイル・28件の修正全て
**検証方法**: 全ファイルのコード精査 + TypeScript型チェック + Viteビルド + フロントエンド/バックエンド間の整合性確認
**検証日**: 2026-03-30

---

## ビルド結果

| 検証 | 結果 |
|------|------|
| TypeScript (`tsc --noEmit`) | **エラーなし** |
| Vite build | **成功**（10.14s） |

---

## 発見した問題一覧

### 🔴 重大（本番で機能が壊れている / 壊れる）— 2件

**1. popular API: コピーカウントが一切増加しない**
- **場所**: `api/popular/index.ts` 184-195行 + `src/lib/apiClient.ts`
- **原因**: サーバー側が `Authorization: Bearer <token>` からuidを取得する設計に変更されたが、フロントエンドの `apiFetch` はApp Checkトークンのみ付与し、**IDトークンを送信していない**
- **影響**: uidが常にnull → `alreadyCounted = true` → **全ユーザーでコピーカウントが増加しない**。人気ランキング更新が停止
- **修正方針**: `apiFetch` にFirebase IDトークンを付与するか、API側でuidなしでもカウントする方式に変更

**2. App Check強制化でOAuthログインが完全に壊れる**
- **場所**: `api/auth/discord/index.ts` 60行 + `api/auth/twitter/index.ts` 63行
- **原因**: `verifyAppCheck` がOAuthフローの`code`判定**より前**に実行される。OAuthコールバックは外部サーバーからのGETリダイレクトなのでApp Checkヘッダーを付与する手段がない
- **影響**: `ENFORCE_APP_CHECK=true` にした瞬間にDiscord/Twitterログインが403で全滅
- **修正方針**: コールバック（`req.query.code`が存在する）場合はApp Check検証をスキップ。state/PKCE検証がCSRF保護を担保済み

### 🟡 中程度（プレビュー環境 / 特定条件で問題）— 3件

**3. CSP: reCAPTCHAスクリプトがブロックされる可能性**
- **場所**: `vercel.json` CSPヘッダー
- **原因**: `script-src` に `https://www.google.com` が不足。reCAPTCHA Enterpriseは `www.google.com/recaptcha/enterprise.js` からスクリプトを動的ロード
- **影響**: CSP対応ブラウザでApp Checkトークン取得が失敗 → API呼び出し失敗の可能性
- **修正**: `script-src` に `https://www.google.com` を追加

**4. share-page: ホスト名ホワイトリストが間違っている**
- **場所**: `api/share-page/index.ts` 81行・95行
- **原因**: `lopo-eta.vercel.app` と記載（他の全APIは `lopo-miti`）
- **影響**: Vercelプレビューデプロイで共有ページが動作しない（本番は影響なし）
- **修正**: `lopo-eta` → `lopo-miti` に統一 + プレビュー用正規表現追加

**5. templates API: CORS正規表現が他APIと不整合**
- **場所**: `api/admin/templates/index.ts`
- **原因**: `/^https:\/\/.*\.vercel\.app$/` で任意のvercel.appサブドメインを許可（他APIは `lopo-miti` 限定）
- **影響**: セキュリティ修正の適用漏れ（admin認証必須なので実害は低い）
- **修正**: 他APIと同じ `lopo-miti` 限定の正規表現に統一

### 🟢 軽微 / 開発環境のみ — 3件

**6. fflogs.ts: 開発環境でFFLogsが動作しない可能性**
- **場所**: `src/api/fflogs.ts` 115-127行
- **原因**: `vite dev` では `/api/fflogs/token` にルーティングされない（vite.config.tsにproxy設定なし）
- **影響**: 開発環境でFFLogsインポート不可（`vercel dev` なら動作する）

**7. share API: Storageパス正規表現がピリオド非対応**
- **場所**: `api/share/index.ts` 74行
- **原因**: UIDにピリオドを含むケースに対応していない（`[a-zA-Z0-9:_-]+`）
- **影響**: 極めて低い（現在のプロバイダではピリオド入りUIDは発生しにくい）

**8. userPlanCounts delete: false（既存バグ・今回の修正とは無関係）**
- **場所**: `firestore.rules` 127行 + `src/store/useAuthStore.ts` 179行
- **原因**: アカウント削除バッチで`userPlanCounts`を削除しようとするが、ルールが`delete: false`
- **影響**: アカウント削除後に孤児ドキュメントが残る（try-catchで握りつぶされているため削除自体は成功する）

---

## ✅ 問題なし — 検証通過項目

| 領域 | 項目 |
|------|------|
| Discord OAuth | CSRF保護・JSON.stringify・details除去・メソッド制限・スコープ・SameSite |
| Twitter OAuth | 同上（tweet.readスコープ削除も問題なし） |
| share API | レート制限・ボディサイズ制限・viewCount重複排除・CORS・レスポンス構造 |
| fflogs/token | レスポンスフィルタ・CORS |
| auto-register | timelineEvents型チェック+500件上限 |
| admin/set-role | timingSafeEqual・App Checkバイパス・CORS |
| Firestoreルール | read制限・copyCount/useCount保護・version `>`・hasAll・sharedPlanMeta検証・create/delete |
| useAuthStore | ロゴ削除追加（try/catchでガード済み） |
| Layout/AdminLayout | email削除（レイアウト影響なし） |
| CSP（大部分） | Firebase Auth・Fonts・Storage・OGP・connect-src・frame-src全て適切 |
| xlsx削除 | import残なし・CSV自前実装・ビルド影響なし |

---

## 修正の優先順位と対応状況

| 優先度 | 問題 | 状態 |
|--------|------|------|
| **即時** | #1 copyカウント不動 | ✅ **修正済み・検証通過**（apiClient.tsにIDトークン自動付与） |
| **即時** | #2 App Check + OAuth干渉 | ✅ **修正済み・検証通過**（コールバック時のみApp Checkスキップ） |
| **高** | #3 CSP reCAPTCHA不足 | ✅ **修正済み・検証通過**（script-srcにwww.google.com追加） |
| **中** | #4 share-page lopo-eta | ✅ **修正済み・検証通過**（lopo-miti統一+プレビュー対応） |
| **中** | #5 templates CORS | ✅ **修正済み・検証通過**（正規表現をlopo-miti限定に統一） |
| **低** | #6-8 | 未対応（開発環境 / 将来リスク） |

### 追加リファクタリング（検証通過済み）
- Admin系7コンポーネントの冗長なAuthorization手動付与を削除（apiFetchが自動付与するため不要になった）

---

## 各問題の詳細な技術的裏取り

### #1 popular API コピーカウント問題 — 詳細

**サーバー側 (`api/popular/index.ts` 184-195行)**:
```
const authHeader = req.headers.authorization || '';
const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
// ...
const decoded = await adminAuth.verifyIdToken(authToken);
uid = decoded.uid;
```

**フロントエンド (`src/lib/apiClient.ts` の `apiFetch`)**:
- App Checkトークン (`X-Firebase-AppCheck`) のみ付与
- `Authorization` ヘッダー（Firebase IDトークン）は**一切付与していない**

**呼び出し元 (4箇所)**:
- `PopularPage.tsx` 165行: 単一プランコピー時POST
- `PopularPage.tsx` 220行: まとめてコピー時POST
- `SharePage.tsx` 165行: マルチプランコピー時POST
- `SharePage.tsx` 201行: 単一プランコピー時POST
- 全て `apiFetch` を使用

**結果**: uid常にnull → 221-224行の`else`ブランチ → `alreadyCounted = true` → カウント不増加

### #2 App Check + OAuth干渉問題 — 詳細

**Discord (`api/auth/discord/index.ts`)**:
- 60行: `if (!(await verifyAppCheck(req, res))) return;` ← codeパラメータ判定より前

**Twitter (`api/auth/twitter/index.ts`)**:
- 63行: `if (!(await verifyAppCheck(req, res))) return;` ← codeパラメータ判定より前

**`src/lib/appCheckVerify.ts`**:
- `ENFORCE_APP_CHECK=true` + ヘッダーなし → 403で拒否 (14-16行)
- `ENFORCE_APP_CHECK=true` + 不正トークン → 403で拒否 (27-29行)
- `ENFORCE_APP_CHECK` 未設定 → 素通り

**OAuthコールバックの特性**:
- 外部サーバー（Discord/Twitter）がブラウザを302リダイレクトでAPIに戻すGETリクエスト
- ブラウザの通常ナビゲーション = カスタムHTTPヘッダーを付与する手段なし
- X-Firebase-AppCheckヘッダーは絶対に付かない

### #3 CSP reCAPTCHA問題 — 詳細

**現在のscript-src**:
```
'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com
```

**reCAPTCHA Enterpriseが動的ロードするスクリプト**:
| ドメイン | 用途 | CSPに含まれるか |
|---|---|---|
| `https://www.google.com/recaptcha/enterprise.js` | エントリポイント | **不足** |
| `https://www.gstatic.com/recaptcha/releases/...` | リリースバンドル | 含まれている |

**Firebase App Check初期化**: `src/lib/appCheck.ts` で `ReCaptchaEnterpriseProvider` を使用。`index.html` に外部scriptタグはなく、SDK内部で動的ロード。

### #4 share-page ホスト名問題 — 詳細

| ファイル | ホスト名 | プレビュー対応 |
|---|---|---|
| `api/share/index.ts` | **lopo-miti** | 正規表現あり |
| `api/popular/index.ts` | **lopo-miti** | 正規表現あり |
| `api/share-page/index.ts` 81行 | **lopo-eta** | なし |
| `api/share-page/index.ts` 95行 | **lopo-eta** | なし |

### #5 templates CORS問題 — 詳細

| ファイル | 正規表現 | 範囲 |
|---|---|---|
| `api/admin/set-role.ts` | `/^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/` | lopo-mitiのみ |
| `api/admin/templates/index.ts` | `/^https:\/\/.*\.vercel\.app$/` | **任意のvercel.app** |

---

## このファイルについて

- #1〜#5は第46セッションで修正済み・検証通過・デプロイ済み
- #6〜#8は軽微/開発環境のみのため、必要に応じて対応
- 全問題が解消されたらこのファイルを削除し、概要を `docs/TODO_COMPLETED.md` に移動する
