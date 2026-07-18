# コスト・ハードニング + OGP実用化 設計書 (2026-07-18)

## 背景

ハウジンガーカードOGPのブラッシュアップ相談から、敵対的コスト監査に発展。過去の大規模ハードニング(2026-07-14〜15、5体敵対監査)は住所非公開・登録クォータが対象で、**その後(7-15〜7-17)に追加された機能はこの監査の対象外だった**。今回3体の敵対監査(OGP経路/Vercel直撃系全体/Firestore読み取り系)を実施し、複数の穴を発見。詳細な監査ログ・証拠(ファイル:行番号)は `docs/.private/2026-07-18-cost-audit-findings.md` に集約済み(本設計書は対応方針のみ)。

**重要な訂正**: 共有ツアーの「数百人でも1円未満」という設計書(`2026-07-15-shared-tour-sync-design.md`)の試算は、実際の単価(Firestore $0.06/10万読み取り)で検算した結果**正しかった**。見つかった穴は「人数が増えると危険」ではなく「上限が無いので悪意ある妨害に無防備」という性質。慎重な設計自体は機能していた。

## スコープ(確定・優先順)

1. `/api/popular` Cloudflare Cache Rule追加(運用作業)
2. 共同編集 load/save/verify にレート制限追加(コード・最小リスク)
3. 共有ツアー 参加人数ソフト上限300人(コード)
4. ハウジンガーOGPカード 安全キャッシュ経路への繋ぎ直し(コード・見た目不変)
5. ハウジンガーページ本体 専用Cache Rule化(運用作業)
6. ツアー招待OGPカード 新規作成(コード+UI追加)

OGPの本格的なビジュアル作り込み(ハウジンガーカードのデザイン刷新等)は別途「余裕があるとき」に着手。今回はコスト0円化と、ツアー招待の最小限の見た目実装のみ。

---

## 1. `/api/popular` Cloudflare Cache Rule

- **現状**: Vercel自身のキャッシュ(`s-maxage=900`)はHITしているが、Cloudflareは`cf-cache-status: DYNAMIC`で毎回オリジン転送(本番curl実測・再現性確認済み)。6月危機と同一パターンが現在進行形。
- **対応**: Cloudflare Cache Rules に `/api/popular` 専用ルールを追加。Eligible for Cache、Edge TTL は Vercel側 `s-maxage=900` と揃える。キャッシュキーは `contentIds` クエリを含めて正規化(実装時に実際のクエリパラメータ構成を確認)。
- **実施方法**: Cloudflareダッシュボード操作。ユーザーと対話形式で1ステップずつ案内、各ステップ後に本番curlで検証(既存の2026-06-12 runbook方式を踏襲)。

## 2. 共同編集 load/save/verify レート制限

- **現状**: `api/collab/_loadHandler.ts` / `_saveHandler.ts` / `_verifyHandler.ts` に `applyRateLimit` 呼び出しが無い(他の公開APIには全て存在)。正規トラフィックはCloudflare Worker経由の共有シークレット認証のみのはずだが、レート制限が無いため誰でも無制限に到達できる。
- **対応**: 3ハンドラの冒頭(既存の `authorizeCollab()` チェックの前後、実装時に自然な位置を判断)に `applyRateLimit(req, res, N, windowMs, {scope:'collab', globalMax:M})` を追加。数値は正規のWorker由来トラフィックの実際の頻度を上回る値に設定(既存の他エンドポイントの値を参考に実装時決定)。
- **リスク方針**: 既存の共同編集ロジック(マージ・同期エンジン)には一切触れない。追加するのは「窓口の一番手前の連打チェック」のみで、それより奥の処理は無変更。
- **検証**: 単体テスト(閾値到達で429を返す)+ 手動で2タブ共同編集を実際に動かし正常動作を確認してから完了とする。

## 3. 共有ツアー 参加人数ソフト上限(300人)

- **現状**: `shared_tours/{token}/live/current` への参加者の `onSnapshot` 購読数に上限が一切ない。認証不要・tourToken(nanoid・推測不能)を知っていれば誰でも購読可能。
- **対応(ソフト上限)**:
  - 新設サブコレクション `shared_tours/{tourToken}/presence/{sessionId}`。sessionIdはクライアント生成・sessionStorageに保持。
  - 新設API `api/housing?action=join-shared-tour`(Admin SDK・認証不要・POST)。処理: ①ツアーの存在/live確認 ②`count()`集計クエリで`lastSeenAt`が直近90秒以内のpresence件数を取得(1回の読み取り課金・安価) ③300件未満ならこのsessionIdのpresenceをupsert(`lastSeenAt: now`)し`{ok:true}` ④300件以上は`{ok:false, reason:'full'}`。
  - クライアント(JoinTourPage): mount時にjoin API呼び出し。`ok:false`なら「満員です」表示で`live/current`のonSnapshot購読を開始しない(満員の人はコスト発生ゼロ)。`ok:true`なら購読開始+60秒ごとにjoin API再呼び出し(heartbeat)。
  - presence掃除: 既存GC cron(`gc-shared-tours`)にpresence古いドキュメントの削除も追加。
- **位置づけ(ユーザー確認済み)**: これは「ソフト」上限。join APIを経由せず直接onSnapshot購読することは技術的に防げないが、tourTokenが推測不能なため正規参加者が迂回する動機は無く、この防御レベルで妥当と判断。完全に破られない上限(トークン発行制の読み取りゲート)は別途必要になれば将来検討。

## 4. ハウジンガーOGPカード 安全化(見た目は変更しない)

- **現状**: `api/share/_housingerPageHandler.ts` が `og:image` / `twitter:image` に `/api/og?type=housinger&...&sig=...` を直接埋め込み、Cloudflareの安全なキャッシュ経路(`/og/:hash.png`)を通らずVercelを直撃する。
- **対応**: `/share/:id`(通常の共有プラン)が既に使っている「パラメータからimageHashを算出 → `og_image_meta`コレクションに保存 → `og:image`には`/og/${hash}.png`を使う」という実績のある型を、`type=housinger`のパラメータ(uid/name/avatar/img配列)にも適用する。
- satoriのレイアウト自体(`_housingerCard.ts`)は無変更。
- 副次: `DEFAULT_OG_IMAGE`(裸の`/api/og`)やカード生成失敗時のフォールバックも可能な範囲でこの安全経路に寄せる(低頻度のため完全対応できなくても許容)。

## 5. ハウジンガーページ本体 専用Cache Rule

- **現状**: 汎用HTML短期キャッシュルール(SPAシェル`/`向けに設計)に偶然マッチしてキャッシュされている状態。専用ルールではないため、将来そのルールの条件式が変わると気づかれずにキャッシュが外れるリスクがある。
- **対応**: Cloudflareに `/housing/housinger/*` 専用Cache Ruleを追加。TTLはVercel側 `s-maxage=300` と揃える。
- **実施方法**: 1と同時にCloudflareダッシュボード操作として実施。

## 6. ツアー招待OGPカード 新規作成

- **背景画像**: ユーザー提供の `MAP.png`(1366×768・既にぼかし加工済み)。`src/assets/og/tour-invite-bg.png` 等に配置し、ビルド時にbase64データURIとして埋め込む(外部fetch不要・housinger cardのアバター取得のような失敗点が無く、より単純で確実)。
- **レイアウト**: 背景画像をcover表示 → 中央に「LoPo Housing Tour」をハニーゴールド(`#ffc987`→`#ffb35a`グラデーション、housing.cssの既存トークンと同値)で重ねる → その下に幹事が入力した短いテキストを表示。
- **幹事入力欄**: 招待発行UI(`TourInvitePanel.tsx`)にテキスト入力(任意)を追加。上限文字数は既存の類似フィールド(例: ハウジンガーbio上限)を参考に実装時に決定。発行時に `shared_tours/{tourToken}` メタへ保存(不変・スナップショットと同じタイミングで確定)。
- **生成経路**: `/api/og` に `type=tour` を追加。4と全く同じ安全パターン(`/og/:hash.png`)に最初から乗せる(未対応のまま作らない)。
- **新規ルーティング**: `vercel.json` に `/housing/tour/:tourToken` → `/api/share?type=tour&token=:tourToken` のrewriteを追加(現状は動的OGPが存在せず汎用カードにフォールバックしている)。専用HTMLハンドラ(`_tourInvitePageHandler.ts`)を`_housingerPageHandler.ts`と同型で新規作成。

---

## 実装順序の提案

- 1・5はCloudflareダッシュボード操作(対話形式・本番設定変更のため深夜/低トラフィック帯を推奨)。2・3・4・6はコード変更で並行可能。
- 依存関係: 6は4と同じ安全キャッシュパターンを再利用するため、4を先に実装してパターンを確立してから6に着手すると効率的。

## テスト方針

- 2: レート制限閾値の単体テスト + 手動2タブ共同編集確認(必須ゲート)。
- 3: join API・presence count・上限到達時拒否・GC対象判定を単体テスト。実機で複数タブ参加を確認。
- 4・6: 生成→Storage保存→2回目以降はStorage配信、を確認するテスト。実機でog:imageヘッダの内容確認。

## リスクと注意点

- 共同編集(2)は最も慎重に扱う。既存ロジック(マージ・同期エンジン)は一切変更せず、窓口の入口チェックを追加するのみ。
- 300人上限(3)は「ソフト」であることを明記。完全な悪用防止が必要になれば将来的にトークン発行制の読み取りゲートを検討。
- Cloudflare操作(1・5)は本番環境の設定変更のため、各ステップ後に本番curlで検証してから次へ進む。

## 今回やらないこと

- ハウジンガーカード・ツアー招待カードの本格的なビジュアル作り込み(色・レイアウトの刷新)は別途後日。
- 完全に破られない参加人数上限(トークンゲート方式)。
- モデレーション判断(別途brainstorming保留中)。
