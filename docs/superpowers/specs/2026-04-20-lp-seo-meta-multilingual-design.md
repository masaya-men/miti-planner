# LoPo LP SEO 改善 — 多言語メタタグ対応

- **日付**: 2026-04-20
- **対象**: LP (`/`) の SEO メタタグ（title / description / OGP / Twitter Card）
- **ステータス**: ユーザー承認済み（実装可）

## 目的

LoPo を検索エンジンから発見されやすくする。現状は以下の問題がある。

1. 主戦場の日本語検索で、狙うべきキーワード（「軽減表」「軽減シミュレーター」「スマホ」等）がほぼ入っていない
2. 日本語モードで `document.title` が `"LoPo — FFXIV Tool Portal"`（英語）に上書きされている
3. `index.html` のメタタグが日本語固定（ハードコーディング）で、英語・韓国語・中国語ユーザーにも日本語の meta が返る
4. LP の本文（h1・カード説明）はほぼ英語で、日本語の可読情報は「軽減プランナー」「ハウジングツアー」の 2 ワードのみ

本改修では **LP の見た目と機能を一切変えず**、メタタグのみを改善する（= レベル 1 のみ。レベル 2 以降は本スペックの対象外）。

## 非対象

- LP の新規セクション追加・見た目変更
- 新規ページ（戦闘コンテンツ別 LP・ガイド記事等）
- 構造化データ（JSON-LD）
- Search Console 連携・sitemap 拡張

## 設計方針

### 文言方針（ユーザー承認済み）

- 「無料」は title から外す
- 既存のスプレッドシート系ツールや FFLogs に言及しない（喧嘩を売らない）
- 「リアルタイム共有」等の誇張は使わない（事実は URL ベースのスナップショット共有）
- 日本語は「軽減表」を中心キーワードに据える
- 各言語のコミュニティ実用語を使う（ハードコーディング禁止ルール遵守のため、翻訳を locale に分離）

### 各言語の中心キーワード

| 言語 | 中心ワード | 補助ワード |
|---|---|---|
| 日本語 | 軽減表 | 軽減シミュレーター／スマホ対応 |
| English | mitigation sheet | mobile-friendly |
| 한국어 | 경감 시트 | 모바일 지원 |
| 中文 | 减伤轴 | 移动端支持 |

（韓国 DCInside / Inven、中国 Bilibili / 百度での実用頻出ワードを採用。中国語「减伤轴」は LoPo のタイムライン構造と意味が合致するため採用）

### 文言（確定）

#### 🇯🇵 ja

- title: `LoPo｜FF14 軽減表シミュレーター｜スマホ対応`
- description: `FF14の軽減表をスマホでも作れるシミュレーター。タイムライン上に軽減スキルを配置して、ダメージを自動計算。作成したプランはURLで共有できます。`

#### 🇺🇸 en

- title: `LoPo｜FFXIV Mitigation Sheet Simulator｜Mobile-Friendly`
- description: `Build your FFXIV mitigation sheet on mobile or desktop. Place mitigation skills on a timeline and see damage calculated automatically. Share plans via URL.`

#### 🇰🇷 ko

- title: `LoPo｜FF14 경감 시트 시뮬레이터｜모바일 지원`
- description: `FF14 경감 시트를 모바일에서도 만들 수 있는 시뮬레이터. 타임라인에 경감기를 배치하면 데미지가 자동 계산됩니다. 작성한 플랜은 URL로 공유할 수 있습니다.`

#### 🇨🇳 zh

- title: `LoPo｜FF14 减伤轴模拟器｜移动端支持`
- description: `在手机上也能制作FF14减伤轴的模拟器。在时间轴上放置减伤技能，自动计算伤害。制作的方案可通过URL分享。`

## ファイル変更

### 1. `index.html`

- `<title>` を日本語（ja 文言）で更新
- `<meta name="description">` を日本語（ja 文言）で更新
- `<meta property="og:title">` / `<meta property="og:description">` を日本語で更新
- `<meta name="twitter:title">` / `<meta name="twitter:description">` を日本語で更新

（= 静的デフォルトは日本語。主ユーザー層 + `<html lang="ja">` に合致）

### 2. `src/locales/{ja,en,ko,zh}.json`

- 既存の `app.page_title_landing` の値を新しい日本語中心キーワード版に更新
- 新規キー `app.page_description_landing` を追加
- `page_title_*` と同じ `app` 名前空間内に置き、既存 `page_title_planner` と並ぶ形で揃える

`app.page_title_landing` の使用箇所: `src/components/landing/LandingPage.tsx` の 1 箇所のみ（他ページは `page_title_planner` や独自の document.title を使用）。

### 3. `src/components/landing/LandingPage.tsx`

現状の useEffect を拡張。言語切替時に以下を全部更新する。

```ts
useEffect(() => {
  const title = t('app.page_title_landing');
  const description = t('app.page_description_landing');

  document.title = title;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
}, [t, i18n.language]);
```

`i18n.language` を deps に入れることで、言語切替時にも確実に再実行される（`t` 関数は言語変更で参照変わるはずだが念のため）。

### 4. LP の離脱時（cleanup）

LP を離れた後に meta が LP 用のままでは、他ページ（/miti 等）の OGP が LP の文言になってしまう可能性がある。

ただし /miti 側が自分で meta を設定していれば問題ない。調査して必要なら cleanup を追加する（本スペックでは軽く調査のみ、LP 離脱時の cleanup は後続タスクで判断）。

## 静的 vs 動的メタの動作（ユーザー認識用）

- **SNS シェア時のプレビュー**: `index.html` の静的タグが使われる（Twitter・Discord・Facebook のクローラーは JS を実行しない）。→ 常に日本語で表示。日本人中心のユーザー層なので実害なし。
- **Google 検索のインデックス**: Googlebot は JS を実行するため、動的更新された meta も読める（ただし反映まで数日〜数週間のラグ）。

## リスク

- 既存 SEO: 現状キーワード不足のため下がるものがない（底上げ期待）
- 表示: なし（LP 見た目変わらず）
- Vercel ビルド: 1 回消費

## 実装手順

1. `index.html` 書き換え（title / description / OGP / Twitter 4 ペア）
2. `src/locales/ja.json`: `seo` セクション追加、`app.page_title_landing` 削除
3. `src/locales/en.json`: 同上
4. `src/locales/ko.json`: 同上
5. `src/locales/zh.json`: 同上
6. `src/components/landing/LandingPage.tsx`: useEffect 拡張
7. `npm run build` で型チェック + ビルド成功確認
8. `npm run test`（vitest）でテスト成功確認
9. 手動確認: LP を dev で開き、言語切替時にタブ名・description が変化するか devtools で確認
10. `docs/TODO.md` 更新
11. commit → push（Vercel 自動デプロイ）

## 動作確認チェックリスト

- [ ] ja モードで LP を開く → タブに `LoPo｜FF14 軽減表シミュレーター｜スマホ対応` と表示
- [ ] devtools で `<meta name="description">` の content が日本語文言になっている
- [ ] 英語切替 → タブ名と description が英語に変わる
- [ ] 韓国語・中国語も同様
- [ ] ビルドが通る（`npm run build` で tsc エラーなし）
- [ ] テストが通る（`npm run test`）
- [ ] LP の見た目が変わっていない

## 追加作業（本スペック外、将来検討）

- レベル 2: LP 本文（Hero サブタイトル、カード説明）に日本語キーワードを盛り込む（デザイン相談が必要）
- レベル 3: 構造化データ（SoftwareApplication / FAQPage の JSON-LD）
- Search Console 導入と実際のキーワード流入計測
