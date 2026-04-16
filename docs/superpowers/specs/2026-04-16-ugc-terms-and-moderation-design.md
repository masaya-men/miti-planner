# UGC利用規約整備 + 共有時注意書き + 管理画面UGCモデレーション

## 背景

ユーザーがアップロードした画像（チームロゴ）がOGPとしてSNSで第三者の目に触れるため、プラットフォームとして最低限の免責が必要。Canva/YouTube/Discord/pixiv等すべてが対応済み。

現状:
- ユーザーは ShareModal からチームロゴ画像をアップロードできる
- 画像は `shared_plans` コレクションに `logoBase64` として保存される
- OGP画像として `/api/og` で生成・表示される
- 利用規約ページ (`/terms`) は存在するがUGC条項がない
- アップロードUI上に著作権に関する注意書きがない
- 問題のある画像を管理者が確認・削除する手段がない

## スコープ

3つの変更を行う:

1. **利用規約ページにUGCセクション追加** — 既存の `/terms` に独立セクションを新設
2. **ShareModalに注意書き追加** — ロゴアップロード部分にアイコン付き注意枠
3. **管理画面にUGC管理ページ追加** — shareId検索 → ロゴ確認 → 削除

## 1. 利用規約 — UGCセクション

### 変更対象
- `src/components/LegalPage.tsx` — TermsPage に新セクション追加
- `src/locales/{ja,en,zh,ko}.json` — 翻訳キー追加

### セクション名
「アップロードコンテンツについて」/ "About Uploaded Content"

### 7条項

| # | 条項 | 要旨 |
|---|------|------|
| 1 | 権利の帰属 | アップロードした画像の著作権はユーザーに帰属。当サービスへの譲渡は発生しない |
| 2 | ライセンス付与 | サービス提供に必要な範囲（OGP画像表示・共有ページ表示）で非独占的に利用する |
| 3 | ユーザーの保証 | 著作権を保有しているか、使用許可を得た画像のみアップロードすること |
| 4 | 禁止コンテンツ | 著作権・肖像権を侵害するもの、不適切なコンテンツの禁止 |
| 5 | 免責 | 故意または重大な過失を除き、アップロード画像に起因する損害の責任を負わない |
| 6 | 削除権限 | 違反が確認された場合、事前通知なくコンテンツを削除することがある |
| 7 | 通知窓口 | 著作権侵害等の連絡は Discord サーバーまたはメール（lopoly.contact@gmail.com）へ |

### 日本固有の法的配慮
- 消費者契約法: 「一切責任を負わない」は無効。必ず「故意・重過失を除き」の限定を付ける
- 2023年改正でサルベージ条項（「法律で許される限り」）も無効化済み
- 平易な日本語で記述し法律用語を避ける

## 2. ShareModal — ロゴアップロード注意書き

### 変更対象
- `src/components/ShareModal.tsx` — フォーマットヒント下に注意枠追加
- `src/locales/{ja,en,zh,ko}.json` — 翻訳キー追加

### 表示位置
「PNG / JPG / WebP (2MB max)」フォーマットヒントの下

### 見た目
- インフォメーションアイコン（i）+ テキスト2行
- 既存UIトーンに合わせた控えめなスタイル（テキストカラーは薄め）
- チェックボックスは不要（摩擦を避ける）

### 文面

**日本語:**
> ⓘ 著作権のある画像を許可なく使用しないでください。
> アップロードにより利用規約に同意したものとみなします。

**英語:**
> ⓘ Do not upload copyrighted images without permission.
> By uploading, you agree to the Terms of Service.

- 「利用規約」/ "Terms of Service" は `/terms` へのリンク

### i18nキー
- `team_logo.usage_notice` — 著作権注意の文
- `team_logo.usage_notice_terms` — 利用規約同意の文（リンクテキスト含む）

## 3. 管理画面 — UGC管理ページ

### 変更対象
- `src/components/admin/AdminUgc.tsx` — 新規ページコンポーネント
- `src/components/admin/AdminLayout.tsx` — NAV_ITEMS にUGC追加
- `src/App.tsx` — `/admin/ugc` ルート追加
- `api/admin/index.ts` — `resource=ugc` ハンドラ追加
- `src/locales/{ja,en,zh,ko}.json` — 翻訳キー追加

### 操作フロー
1. テキストボックスに共有URLをそのまま貼る（`https://lopoly.app/share/AbCd1234` でも `AbCd1234` でも可。自動でshareId部分を抽出）
2. Enterまたは「検索」ボタン
3. 該当プランの情報が表示される

### 表示する情報（個人情報なし）

| 項目 | 内容 |
|---|---|
| shareId | 共有ID |
| コンテンツ | コンテンツ名（contentId から引く） |
| プラン名 | title |
| 作成日 | createdAt のフォーマット表示 |
| ロゴ画像 | サムネイル表示（あれば） |

`shared_plans` にはユーザーのFirebase UID、メールアドレス等の個人情報は一切保存されていないため、このページで個人情報が見えることはない。

### アクション
- 「ロゴ削除」ボタン — `logoBase64` フィールドのみ削除。確認ダイアログ付き
- ロゴがない場合は「ロゴなし」と表示し、削除ボタンは非表示

### API

既存の `/api/admin` エンドポイントに追加:

**GET** `/api/admin?resource=ugc&shareId=xxx`
- `shared_plans/{shareId}` からドキュメント取得
- レスポンス: `{ shareId, title, contentId, createdAt, hasLogo, logoBase64 }`

**DELETE** `/api/admin?resource=ugc&shareId=xxx`
- `shared_plans/{shareId}` の `logoBase64` フィールドのみ削除
- レスポンス: `{ success: true }`

### UIスタイル
- 既存管理画面パターン（AdminLayout内、Tailwind）に合わせる
- AdminGuard による権限チェックは既存の仕組みで自動適用

## 4言語対応

すべての新規テキスト（利用規約条項、注意書き、管理画面ラベル）は `src/locales/{ja,en,zh,ko}.json` に翻訳キーを追加する。

## スコープ外
- 共有プラン一覧表示（重い・不要）
- ユーザーへの通知機能（規模に対してオーバー）
- 画像のAI自動審査
- プラン本体の削除（ロゴ画像の削除のみ）
