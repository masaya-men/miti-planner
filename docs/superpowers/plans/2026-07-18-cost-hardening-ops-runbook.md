# Cloudflare Cache Rule 追加 運用手順書(コスト・ハードニング 項目1・5)

> 設計書: `docs/superpowers/specs/2026-07-18-cost-hardening-and-ogp-design.md` §1・§5。実行は本番Cloudflareダッシュボードの手動操作。2026-06-12の前段化runbook(`docs/.private/2026-06-12-cloudflare-fronting-handoff.md`)と同じ「1ステップずつ検証」方式。深夜/低トラフィック帯に実施推奨。

## 対象2件

1. `/api/popular` — Vercel自身は `s-maxage=900` でキャッシュ済みだが、Cloudflareが `cf-cache-status: DYNAMIC` で毎回オリジン転送している(本番実測・複数回再現済み)。専用Cache Ruleを追加してCloudflare側でもキャッシュする。
2. `/housing/housinger/*` — 現状は汎用HTML短期キャッシュルール(SPAシェル`/`向け)への偶然の便乗でキャッシュされている(専用ルールではない)。専用Cache Ruleを追加して安定させる。

## 前提確認(実施前に1回)

- Cloudflareダッシュボードで `lopoly.app` ゾーンを開く。
- 既存Cache Rules(Caching → Cache Rules)を確認し、`/api/*` Bypass・`/assets/*` 等の既存ルールを壊さないことを確認する。

## Step 1: `/api/popular` 専用Cache Rule作成

Cloudflare → Caching → Cache Rules → 新規ルール作成:

- ルール名: `api-popular-cache`
- マッチ条件: `URI Path` `equals` `/api/popular`(または `starts with` `/api/popular` — クエリ文字列 `contentIds=...` はPathに含まれないため、Pathマッチで十分)
- 実行アクション: `Cache eligibility` = `Eligible for cache`
- Edge TTL: `Override origin and use this TTL` → `900` 秒(Vercel側の `s-maxage=900` と揃える)
- Browser TTL: `Respect origin TTL`(オリジンのヘッダに従う・既存方針どおり)
- **重要**: このルールは既存の `/api/*` Bypassルールより**上位(先に評価される順)**に配置する。Cloudflare Cache Rulesは上から順に評価され、最初にマッチしたルールが適用されるため、`/api/*` Bypassが先にあるとこの新ルールが一切効かない。

配置後、ルール一覧の順序を確認: `api-popular-cache` が `/api/*` Bypassより上にあることを目視確認する。

### 検証(必須・ここで一度止まる)

```bash
curl -sI "https://lopoly.app/api/popular?contentIds=p1s" | grep -iE "cf-cache-status|age:"
```
1回目: `cf-cache-status: MISS`(初回のみ)が出るはず。
```bash
curl -sI "https://lopoly.app/api/popular?contentIds=p1s" | grep -iE "cf-cache-status|age:"
```
2回目: `cf-cache-status: HIT` かつ `age:` が0より大きい値になっていることを確認する。**HITが出るまで先に進まない。**

異常時(HITにならない/エラーが出る): ルールのマッチ条件(Path完全一致かstarts withか)とURLパスの綴りを再確認。それでも直らなければルールを一旦無効化(Disable)して元の状態(Bypassのみ)に戻す。

## Step 2: `/housing/housinger/*` 専用Cache Rule作成

Cloudflare → Caching → Cache Rules → 新規ルール作成:

- ルール名: `housing-housinger-page-cache`
- マッチ条件: `URI Path` `starts with` `/housing/housinger/`
- 実行アクション: `Cache eligibility` = `Eligible for cache`
- Edge TTL: `Override origin and use this TTL` → `300` 秒(Vercel側の `s-maxage=300` と揃える)
- Browser TTL: `Respect origin TTL`
- 配置順: 既存の汎用HTML短期キャッシュルール(SPAシェル `/` 向け)より**上位**に置く。このパスは現状そのルールに偶然マッチしてキャッシュされているため、専用ルールを先に評価させることで「狙って設計されたキャッシュ」に切り替える(挙動自体は変えず、依存関係だけ明示化する)。`/api/*` Bypassより上位であることも確認(このパスは `/api/` で始まらないため通常は無関係だが、ルール順序の一般原則として確認)。

### 検証(必須)

```bash
curl -sI "https://lopoly.app/housing/housinger/<実在する公開uid>" | grep -iE "cf-cache-status|age:"
```
1回目: `MISS`。
```bash
curl -sI "https://lopoly.app/housing/housinger/<同じuid>" | grep -iE "cf-cache-status|age:"
```
2回目: `HIT` かつ `age:` が増えていることを確認。

**ログイン・共同編集への影響確認(回帰):**
```bash
curl -sI "https://lopoly.app/" | grep -iE "cf-ray"
```
`cf-ray` が出ることを確認(apex全体のproxy自体が壊れていないこと)。実際にブラウザでログインが正常に動作することも1回確認する(auth.lopoly.appは別サブドメインで無関係のはずだが、念のため)。

## Step 3: 完了確認

- 両ルールとも `HIT` を確認できたら完了。
- Cloudflareダッシュボードの Analytics → Caching で数分待ち、`/api/popular` と `/housing/housinger/*` のCache Ratioが上がり始めていることを確認(即座に反映されない場合はしばらく待って再確認)。

## ロールバック(異常時・即時)

該当ルールをCloudflareダッシュボードで無効化(Disable)するだけで、直前の状態(Bypassのみ・Vercel直撃)に即座に戻る。データや設定の破壊は起きない。

## この後

- Vercel Observability(Edge Requests)で `/api/popular` と `/housing/housinger/*` のヒット数が下がっていくことを数日かけて確認する(即効性は無いが傾向として下がるはず)。
- コード側の対応(Task 4: ハウジンガーOGPカードの安全化)と合わせて、ハウジンガーページ関連の全経路(HTML本体+OGP画像)がCloudflare保護下に入る。
