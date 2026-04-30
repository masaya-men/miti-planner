# LoPo Support Page 設計書

**作成日**: 2026-04-30
**最終更新**: 2026-05-01（Revision 2: 想い・Ko-fi 説明・金額表・派手 CTA を追加）
**ステータス**: 実装中
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

### 4.2 ページ構成（Revision 2: 7 セクション + フッター）

ファーストビューで個人運営者の素直なトーンを伝え、Ko-fi の心理的ハードル（カード情報・アカウント登録の不安）を下げ、ユーモアで親しみを作る構成。

上から順に縦並びで以下を表示する。

**Section 1: ヘッダー**

- タイトル: 「LoPo を応援する」
- サブタイトル: 「LoPo の運営支援はこちらから」
- 戻るボタンは LegalPageLayout の共通ヘッダー（`← LoPo`）を使用

**Section 2: 私の想い（Revision 2 で新規追加・ファーストビュー）**

- 見出し: 「私の想い」
- 本文: 「LoPo は私が個人で開発している FF14 のファンツールです。バグや足りない機能もまだまだ多いですが、長く使ってもらえるツールにしていきたいです。」

**Section 3: LoPo について**

- 見出し: 「LoPo について」
- 本文: 「LoPo は個人で運営している FF14 のファンツールです。現在は軽減プランナーを公開中で、今後ハウジングツアープランナー等も追加予定です。」

**Section 4: 資金の使い道**

- 見出し: 「資金の使い道」
- 箇条書き 3 項目:
  - サーバー費（Vercel・Firebase）
  - ストレージ費（共有プランの保存・OGP 画像生成）
  - 開発・運用にかける時間

**Section 5: Ko-fi とは（Revision 2 で新規追加・心理的ハードル下げ）**

- 見出し: 「Ko-fi とは」
- 本文: 「Ko-fi は英国発のクリエイター支援プラットフォームです。アカウント登録は不要で、クレジットカード・Apple Pay・Google Pay から数クリックで支援できます。決済は Stripe が処理するため、カード情報が LoPo に渡ることはありません。単発の寄付も、月額サポートも選べます。」

**Section 6: 支援するとどうなるの？（Revision 2 で新規追加・ユーモア）**

- 見出し: 「支援するとどうなるの？」
- 5 段階の金額表（テーブル形式または並列カード）:

| 金額 | アイコン | 内容（事実） | 効能（ユーモア） |
|---|---|---|---|
| ¥500 | ☕ | ちょっといいコーヒー 1 杯 | 私がその日 1 日にこにこ過ごせます |
| ¥1,000 | 🍱 | ランチ 1 食分 | 一人で開発を続ける深夜でもポジティブでいられます |
| ¥3,000 | 💪 | プロテイン 1 kg | 開発筋力がアップします |
| ¥5,000 | 🛒 | プロテイン 1 kg + ヨーグルト + 納豆 + 鶏むね肉 1 kg + 卵 + バナナ | タンパク質特化のスーパー袋、開発筋力フルマシマシ |
| ¥9,000 | 💪💪💪 | プロテイン 3 kg | 筋力もにこにこも開発時間も全部マシマシ、来月の LoPo も元気に動きます |

ユーモアの方針: 個人運営者の「私」が見えるトーン、押し付けがましくない、自虐ユーモア混ぜる、miramiru の「石油王」と同系統の親しみやすさ。

**Section 7: Ko-fi で支援する（CTA、Revision 2 で派手化）**

- 見出し: 「Ko-fi で支援する」
- 大型 CTA ボタン（外部リンク `https://ko-fi.com/lopoly`、`target="_blank"` `rel="noopener noreferrer"`）
- ボタンスペック:
  - サイズ: 既存 `px-6 py-3 text-app-2xl` → `px-12 py-5 text-app-3xl` に拡大
  - 絵文字 ☕ を文字より大きめに表示（`text-app-5xl`）
  - シャドウ: `shadow-2xl`、ホバーで上方向に `-translate-y-1`、`scale-105`
  - 角丸: `rounded-2xl`
  - サブテキスト「単発 / 月額どちらも OK」をボタン下に小さく
  - DESIGN.md 準拠（白黒のみ、機能色 NG）。`bg-app-text text-app-bg` の反転スタイルでテーマ問わず映える

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

### 4.6 多言語化キー（Revision 2: 既存 10 + 新規 10 = 20 キー）

日本語の文言は本設計書で確定済み、他 3 言語は実装時に翻訳。

**既存 10 キー（Revision 1 で確定）:**

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
support.back               "← 戻る"（※ LegalPageLayout 流用のため未使用、削除候補）
```

**新規 10 キー（Revision 2 で追加）:**

```
support.heart_heading      "私の想い"
support.heart_body         "LoPo は私が個人で開発している FF14 のファンツールです。バグや足りない機能もまだまだ多いですが、長く使ってもらえるツールにしていきたいです。"
support.kofi_about_heading "Ko-fi とは"
support.kofi_about_body    "Ko-fi は英国発のクリエイター支援プラットフォームです。アカウント登録は不要で、クレジットカード・Apple Pay・Google Pay から数クリックで支援できます。決済は Stripe が処理するため、カード情報が LoPo に渡ることはありません。単発の寄付も、月額サポートも選べます。"
support.amounts_heading    "支援するとどうなるの？"
support.amount_500         "☕ ¥500 — ちょっといいコーヒー 1 杯。私がその日 1 日にこにこ過ごせます。"
support.amount_1000        "🍱 ¥1,000 — ランチ 1 食分。一人で開発を続ける深夜でもポジティブでいられます。"
support.amount_3000        "💪 ¥3,000 — プロテイン 1 kg。開発筋力がアップします。"
support.amount_5000        "🛒 ¥5,000 — プロテイン 1 kg + ヨーグルト + 納豆 + 鶏むね肉 1 kg + 卵 + バナナ。タンパク質特化のスーパー袋、開発筋力フルマシマシ。"
support.amount_9000        "💪💪💪 ¥9,000 — プロテイン 3 kg。筋力もにこにこも開発時間も全部マシマシ、来月の LoPo も元気に動きます。"
support.cta_subtext        "単発 / 月額どちらも OK"
```

`usage_items` は既存の `privacy_section1_auto_items` と同じパターンでカンマ区切り → 配列化して bullet 表示。

金額カードの内容も `amount_500` 〜 `amount_9000` を 1 文ずつ表示する単純な並列リストとして実装する。テーブルや段階プランの装飾は最小限。

`/support` 内の Ko-fi ボタンの表示文言は **既存 `footer.kofi`**（4 言語対応済み）を流用する。

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

## 5. 実装規模（Revision 2 反映）

| 項目 | 量 |
|---|---|
| 新規ファイル | `src/components/SupportPage.tsx`（150〜180 行） |
| 修正ファイル | `App.tsx`、`LandingFooter.tsx`、`Sidebar.tsx`、`public/sitemap.xml`、`LegalPage.tsx`（scroll 修正 + LegalPageLayout export） |
| i18n 追加 | 20 キー × 4 言語 = 80 エントリ（既存 40 + Revision 2 で +40） |
| 工数感 | 半日〜1.5 日（翻訳含む） |

## 5.1 スクロール位置リセット（Revision 2 で追加）

`LegalPageLayout` の useEffect に `window.scrollTo(0, 0)` を追加。

理由: `/miti` でスクロールして下端にいる状態で `/support` 等の Legal 系ページに遷移すると、前ページのスクロール位置が引き継がれてヘッダーや見出しが画面外に流れる UX バグがあった。マウント時にトップへリセット。

副次効果: PrivacyPolicyPage / TermsPage / CommercialDisclosurePage にも同じ修正が効くため、既存ページの UX も同時に改善される。

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
