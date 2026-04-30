# LoPo Support Page 設計書

**作成日**: 2026-04-30
**ステータス**: ユーザー承認待ち
**関連**: なし（新規）

---

## 1. 概要

LoPo に支援（寄付）専用ページ `/support` を新設する。Ko-fi へ直接飛ばす現状を、LoPo 内で 4 言語の説明を経由する形に変更し、海外 Ko-fi UI で日本人ユーザーが躊躇する問題を解消する。

## 2. 背景・目的

### 背景

- LoPo は SQUARE ENIX の公式アイコンを使うため、広告収益化は MUL（Materials Usage License）違反確定
  - 詳細は memory `project_lopo_mul_constraint.md` を参照
- 寄付モデルは MUL 上もグレーだが、FFXIV Teamcraft / Garland Tools / XIVAnalysis 等の主要 FF14 ファンサイトが採用する業界デファクト
- 現状 Ko-fi リンクは LP フッター・サイドバー下部の 2 箇所に直リンク（`https://ko-fi.com/lopoly`）として存在するが、Ko-fi の英語 UI で日本人ユーザーが躊躇する
- 参考: <https://miramiru.co/support>（友人の FF14 ファンサイトの支援ページ。同じ動機で /support ページを作っている）

### 目的（優先順）

1. **多言語で説明を整える** — 日本語ユーザーが英語の Ko-fi で躊躇しないよう、ページ内で支援内容を 4 言語で説明
2. **透明性・トラスト構築** — 「個人運営のファンサイト」「SE 公認ではない」「資金は何に使う」を明記して安心感を出す
3. **転換率向上** — 説明込みでワンクッション挟むことで、Ko-fi に飛ぶ前に十分情報を出す

### 明示的に YAGNI（やらない）

- 段階プラン（Gold / Platinum 等）
- 特典・バッジ・Contributors リスト
- 寄付者ロール / コミュニティ化
- 目標金額表示（Goal）
- メンバーシップ機能
- 「LoPo は多言語対応してます」の言及（ページ自体が多言語対応されることで暗黙的に伝わる）

理由: 軽減表アプリの性質上、寄付者への適切なインセンティブが思いつかず（ユーザー判断 2026-04-30）、運用負担に対して効果が薄いため。

---

## 3. スコープ

### 含む

- 新規ページ `/support` の追加
- ja / en / ko / zh 4 言語対応
- 既存の Ko-fi 直リンク 2 箇所（LP フッター、サイドバー下部）を `/support` 経由に変更
- 戻るボタンの実装（`navigate(-1)` ベース、履歴なしは `/` フォールバック）
- Ko-fi 側プロフィール設定の最低限整備（ユーザー作業の整理）

### 含まない

- 寄付者の自動検出（Webhook 連携）
- 寄付の有料機能アンロック
- ハウジングツアー専用の支援文言（同じページで両ツールをカバー）

---

## 4. 設計

### 4.1 URL とルーティング

| 項目 | 値 |
|---|---|
| パス | `/support` |
| ルート登録 | `src/App.tsx` に `<Route path="/support" element={<SupportPage />} />` 追加 |
| 既存 Ko-fi 直リンク | LP フッター（`LandingFooter.tsx` line 118-119）とサイドバー下部（`Sidebar.tsx` line 1531）のリンク先を `https://ko-fi.com/lopoly` から `/support` に変更 |
| 外部 Ko-fi リンク | `/support` ページからのみ |

### 4.2 ページ構成（4 セクション + フッター）

上から順に縦並びで以下を表示する。

**Section 1: ヘッダー**

- タイトル: 「LoPo を応援する」
- サブタイトル: 「LoPo の運営支援はこちらから」
- 左上に戻るボタン: 「← 戻る」

**Section 2: LoPo について**

- 見出し: 「LoPo について」
- 本文: 「LoPo は個人で運営している FF14 のファンツールです。現在は軽減プランナーを公開中で、今後ハウジングツアープランナー等も追加予定です。」

**Section 3: 資金の使い道**

- 見出し: 「資金の使い道」
- 箇条書き 3 項目:
  - サーバー費（Vercel・Firebase）
  - ストレージ費（共有プランの保存・OGP 画像生成）
  - 開発・運用にかける時間

**Section 4: Ko-fi で支援する**

- 見出し: 「Ko-fi で支援する」
- 補足説明: 「Ko-fi は寄付プラットフォームです。1 杯 ¥500 から、任意金額で支援できます。」
- 大きな Ko-fi ボタン（外部リンク `https://ko-fi.com/lopoly`、`target="_blank"` `rel="noopener noreferrer"`）

**Footer: SE 免責**

- 本文: 「本サイトは SQUARE ENIX の公式サイトではありません。SQUARE ENIX 社と関係はありません。」

### 4.3 デザイン方針

既存の LegalPage 系（`PrivacyPolicyPage.tsx` / `TermsPage.tsx` / `CommercialDisclosurePage.tsx`）と同じトンマナに合わせる。

- 黒背景（ダーク） / 白背景（ライト）の既存テーマ準拠
- DESIGN.md のカラーパレット・タイポグラフィに従う
- 中央寄せ、最大幅 720px 程度の縦長レイアウト
- glass-tier3 のセクション枠（既存 LegalPage 同様）
- 装飾アニメーションなし
- ConsolidatedHeader を使用（言語切替・テーマ切替・ログイン状態が表示される）
- フォント・サイズは `--font-size-*` トークンを流用

### 4.4 戻るボタンの動作

```tsx
const navigate = useNavigate();
const handleBack = () => {
  if (window.history.length > 2) {
    navigate(-1);
  } else {
    navigate('/');
  }
};
```

挙動:

- 通常（履歴あり）: 直前のページに戻る（LP・軽減表・将来のハウジングツアーいずれでも対応）
- 履歴なし（URL 直接アクセス・外部リンクから来た）: LP (`/`) にフォールバック

### 4.5 Ko-fi 側プロフィール設定（ユーザー作業）

`https://ko-fi.com/lopoly` の管理画面で以下を整備する。

| 項目 | 内容 | 必須度 |
|---|---|---|
| **About 文** | 「LoPo（FF14 ファンツール）の運営者です。個人運営のファンサイトで、サーバー費を支援いただけたら嬉しいです。」を ja / en / ko / zh の 4 言語で改行併記 | 必須 |
| **カバー画像** | LoPo ロゴ + 黒背景。既存 OGP 画像（`public/ogp.png`）流用可 | 必須 |
| **アバター** | LoPo の "LoPo" マーク。既存ファビコンや `apple-touch-icon.png` 流用可 | 必須 |
| **サンキューメッセージ** | 「ご支援ありがとうございます！LoPo の運営を続けられます。」を 4 言語で改行併記 | 必須 |
| **支援種別** | 単発 Tip のみ | 必須 |
| **目標金額（Goal）** | 設定しない（未達でモチベ低下・動機不純化リスク回避） | 不要 |
| **メンバーシップ** | 設定しない（コミュニティ化しない方針） | 不要 |
| **Shop / Commission** | 設定しない | 不要 |

### 4.6 多言語化キー

新規追加する i18n キー（4 言語ぶん）。日本語の文言は本設計書で確定済み、他 3 言語は実装時に翻訳。

```
support.title              "LoPo を応援する"
support.subtitle           "LoPo の運営支援はこちらから"
support.about_heading      "LoPo について"
support.about_body         "LoPo は個人で運営している FF14 のファンツールです。現在は軽減プランナーを公開中で、今後ハウジングツアープランナー等も追加予定です。"
support.usage_heading      "資金の使い道"
support.usage_items        "サーバー費（Vercel・Firebase）,ストレージ費（共有プランの保存・OGP 画像生成）,開発・運用にかける時間"
support.kofi_heading       "Ko-fi で支援する"
support.kofi_note          "Ko-fi は寄付プラットフォームです。1 杯 ¥500 から、任意金額で支援できます。"
support.disclaimer         "本サイトは SQUARE ENIX の公式サイトではありません。SQUARE ENIX 社と関係はありません。"
support.back               "← 戻る"
```

`usage_items` は既存の `privacy_section1_auto_items` と同じパターンでカンマ区切り → 配列化して bullet 表示。

`/support` 内の Ko-fi ボタンの表示文言は **既存 `footer.kofi`**（4 言語対応済み: ja "Ko-fiで応援" / en "Support on Ko-fi" / ko "Ko-fi에서 지원" / zh "在 Ko-fi 上支持"）を流用する。新規キーは追加しない。

### 4.7 既存リンクの置き換え

| ファイル | 修正内容 |
|---|---|
| `src/components/landing/LandingFooter.tsx` line 118-119 | `<FooterLink href="https://ko-fi.com/lopoly" external>` → `<FooterLink to="/support">` （内部リンク化、external prop 削除） |
| `src/components/Sidebar.tsx` line 1526-1531 | `<a href="https://ko-fi.com/lopoly" target="_blank">` → React Router `Link to="/support"` |

外部 Ko-fi 直リンクは `/support` ページの「Ko-fi で支援する」ボタンのみとする。

### 4.8 SEO 対応

- `useCanonicalUrl('/support')` を追加（既存ページと同じパターン）
- `public/sitemap.xml` に `/support` を追加（priority 0.4 程度）

---

## 5. 実装規模

| 項目 | 量 |
|---|---|
| 新規ファイル | `src/components/SupportPage.tsx`（200 行程度） |
| 修正ファイル | `App.tsx`（Route 追加）、`LandingFooter.tsx`（リンク先変更）、`Sidebar.tsx`（リンク先変更）、`public/sitemap.xml`（URL 追加） |
| i18n 追加 | 10 キー × 4 言語 = 40 エントリ |
| 工数感 | 半日〜1 日（翻訳含む） |

---

## 6. リスクと対策

| リスク | 評価 | 対策 |
|---|---|---|
| MUL 違反疑義 | グレー（明文での禁止解釈は可能だが、業界デファクト） | 主要 FF14 ファンサイトと同じ寄付モデル、SE が問題視した記録なし。SE から通告が来た場合は即対応する用意 |
| Ko-fi 側設定が未整備でも `/support` が公開される | 中 | Ko-fi 側設定を **`/support` デプロイ前** にユーザーが完了する必要あり。実装プランで明記 |
| 既存リンクから直リンク → /support に変わってクリック数が減る | 低 | 1 クリック増えるが、説明を読んでもらう価値の方が大きい。離脱率は miramiru で問題化していない |
| 戻るボタンが意図と違う場所に飛ぶ | 低 | `navigate(-1)` + `/` フォールバックの組み合わせで一般的な期待に合致 |

---

## 7. 検証

### 自動テスト

- `vitest` ベース: SupportPage の i18n キー解決テスト・戻るボタンのフォールバック動作テスト
- `vitest` で 既存の build / test が引き続き通ること

### Playwright E2E（実機相当）

1. `/support` を直接開く → 戻るボタンを押すと LP に飛ぶ
2. LP フッターから `/support` に来る → 戻るボタンで LP に戻る
3. サイドバーから `/support` に来る → 戻るボタンで `/miti` に戻る
4. Ko-fi ボタンを押す → 新規タブで `https://ko-fi.com/lopoly` が開く
5. 4 言語切り替えてすべての文言が表示される

### 手動確認（ユーザー）

- 4 言語の翻訳精度（特に zh / ko）
- LegalPage と並べてデザインの一貫性

---

## 8. 参考リソース

- <https://miramiru.co/support>（参考サイト）
- 既存ページ: `src/components/PrivacyPolicyPage.tsx` / `TermsPage.tsx` / `CommercialDisclosurePage.tsx`
- DESIGN.md: `.claude/rules/DESIGN.md`
- MUL 制約: memory `project_lopo_mul_constraint.md`
- FFXIV 著作物利用許諾条件（日本語）: <https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc>
