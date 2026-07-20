---
paths:
  - "api/**"
---

# 公開APIエンドポイントのキャッシュ設計ルール

新規/既存問わず、`api/` 配下に**匿名ユーザーが読める公開エンドポイント**を作る・触るときは以下を必ず確認する。2026-07-20、この抜けが実機バグ(削除が反映されない)の根本原因になった実例あり。

## 1. Cache-Controlは `max-age` を必ず明記する(`s-maxage` だけにしない)

**Vercelはクライアント応答から `s-maxage` を除去する**(Serverless Functionの仕様)。`res.setHeader('Cache-Control', 'public, s-maxage=86400')` のように `max-age` を書かないと、Cloudflareに届く値は数字なしの `public` のみになり、Cloudflare独自の未知のデフォルトTTLで代替キャッシュされる(短すぎてコスト削減効果が薄れる/長すぎてデータが古く見える、どちらの事故も起こりうる)。

→ **必ず `s-maxage=N, max-age=N` の形で両方書く**(意図的にブラウザとCDNのTTLを分けたい場合を除き同じ値でよい)。

## 2. Cloudflare側にも専用Cache Ruleが要る(コードだけでは効かない)

既存の `bypass-dynamic-shell` ルールが `/api/*` を含む主要パスを一律バイパスしている。新しいエンドポイントをCloudflareにキャッシュさせたいなら、**Cloudflareダッシュボードで専用のCache Ruleを追加する必要がある**(コード側のヘッダーだけでは何も起きない)。

- Cache Rulesは「後にあるルールが勝つ」(Page Rulesと逆・last-match-wins)。新規ルールは**一覧の末尾に追加するだけでよい**(上位に動かす必要なし)。
- VercelがCloudflareに実際届ける値は `max-age` だけなので、Cloudflare側のエッジTTLは「キャッシュ制御ヘッダーを無視し、このTTLを使用します」で意図した秒数を明示指定するのが確実(「ヘッダーが存在する場合は使用」だと届いた `max-age` の値がそのまま使われるだけなので、`s-maxage`で意図していた値とズレることがある)。

## 3. TTLは実際のデータフローを追って決める(他ハンドラーの数字を安易にコピーしない)

「画面に表示される中身は別経路(クライアント側の直接fetch)でライブ取得している」エンドポイントなら、このHTML/APIレスポンス自体は長く(1日など)キャッシュしても実害が小さいことが多い。逆に「このレスポンスの値がそのまま画面や判定に使われる」ものは、意図した秒数を必ず守る。数字を決める前に「これが古いまま返ったら誰にどう見えるか」を自問する。

## 4. 既存の壊れたキャッシュはコード修正だけでは直らない

キャッシュヘッダーのバグを直してデプロイしても、**Cloudflareに残っている古いキャッシュはそのまま古い内容を返し続ける**。該当URLをCloudflareダッシュボードで手動パージ(Caching → Configuration → Purge Cache → Custom Purge → URL)しないと、ユーザーには古いキャッシュが自然に切れるまで反映されない。

---

詳細な実測結果 → memory `reference_vercel_cf_window_caching`。運用手順の実例 → `docs/superpowers/plans/2026-07-18-cost-hardening-ops-runbook.md`。
