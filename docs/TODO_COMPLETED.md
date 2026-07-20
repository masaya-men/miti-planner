# LoPo 完了済みタスクアーカイブ

このファイルはTODO.mdから移動した完了済みタスクです。思考の邪魔にならないよう分離しています。

### ✅ 2026-07-20 画像登録5枚目以降サイレント失敗バグ+投稿URL消失バグ = 修正・本番反映済
根因2件を特定・修正(直接main反映): ①`RegisterPage.tsx`のアップロードループが「先頭4枚だけ保存」というUI上の約束(hotfix25/26/27)を守らず全12枚を送っていた ②housingの主要ハンドラーが`applyRateLimit`の`scope`未指定でレート制限バケットを共有しており本来成功するはずの画像アップロードまで429で弾かれる(「1枚しか残らない」の本命)。詳細=`docs/.private/2026-07-20-housing-image-upload-4-limit-bug.md`。

**追加でBatch 1として設計→計画→サブエージェント実装(worktree)→最終レビュー(Opus)→merge→本番反映まで完了**(`docs/superpowers/specs/2026-07-20-housing-image-upload-postUrl-fix-design.md` + `docs/superpowers/plans/2026-07-20-housing-image-upload-postUrl-fix.md`): ③画像ピッカー自体を最初から4枚上限に作り直し(12枚選ばせる二段構え廃止)、一括で上限超過選択した場合は確認ボタン付きモーダルで知らせる ④投稿URL(postUrl)を貼った後に直接画像をアップロードするとpostUrlごと消える別バグを発見・修正(クライアント+サーバー双方。あわせて前から存在したTwitter/YouTube側のpostUrl host検証漏れも同時に解消)。全6タスク、タスクごとにfresh subagent実装→レビュー(Task4/5・最終レビューはOpus)→必要に応じ修正の2段階ゲートを通過済み。tsc+npm testフルグリーン(既知のEphemeralAddPanel7件除く)。

**残作業**: 新モーダルのスマホ実機見た目チェック(コード上は問題ないはず・要一度目視)。「画像の編集ができない」は仕様通り(バグでない)。複数投稿URL登録(Batch 2)はユーザー要望あり・別途brainstorming予定(URL1/2/3固定表示・並び替えなし・「元の投稿を見る」はURL1固定・編集画面からの追加も要望あり)。

**この調査中にハウジングが既に実質稼働中(104件登録・実ユーザー多数)と判明**、その中で画像品質バグ3件を新たに発見(次セッション最優先・詳細は`docs/.private/2026-07-20-housing-image-quality-and-cost-investigation.md`)。

### ✅ 2026-07-20 実機FB9件のうち6件を systematic-debugging で修正 (①④除く、⑤のみ次回へ)
- **②詳細ページに「＋ツアー」ボタン追加**: `HousingActionBar`にカードと同じ意匠(honeyピル+リップル)で新設。地域跨ぎブロック(`canAddToTour`)もカード側と同一ロジック。**訂正(2026-07-20)**: 初回実装でカードと同じ長い「ツアーに追加」ラベルをそのまま流用し確認なしでpushしてしまい、ユーザー指摘で発覚(操作バーの他ボタンは短い表記のため文言が長いと列がずれる、という過去の指定を見落とした)。表示文言を短縮した「ツアー」に修正し、アクセシブルネームは`aria-label`で完全な文言(「ツアーに追加」)を維持。**教訓は memory `feedback_deploy` に反映**(新UIはpush前に必ず一度止めてローカル確認を聞く)。
- **③詳細ページから登録時の元URL(X/YouTube/ハウジングスナップ)へ飛べるように**: `listing.postUrl`を「元の投稿を見る」リンクとして表示。**重要な防御**: unlisted(住所非公開)では元投稿の本文に住所が書かれていることが多いため、`isAddressHidden`と同条件で非表示にし間接的な住所漏洩を防止(peers セクションと同型の防御)。i18nキー`housing.detail.view_source`を4言語に追加(既存の未翻訳ブロックに合わせ暫定でja文言のまま)。
- **⑥住所を手入力した直後、右の地図ナビが古い位置のまま(番地チップの上下クリックで直る)**: 根因特定(`TourNavMap.tsx`)。同一ワード地図内(stepKey不変)でmodelだけ変わる「アイドル中の背景更新」パスは、ハイライト位置は更新する一方でパン/ズームカメラの再フィットをしていなかった(番地チップクリックは副次的なリサイズイベント経由で偶然直っていた)。該当パスに再フィット呼び出しを追加。回帰テスト(仮説検証→反転確認)を追加。
- **⑦iPhone Safariでハウジング画面の上下左右が少し見切れる**: `.housing-workspace`の`height:100vh`がiOS Safariのアドレスバー込みの大きいviewportを指すため。`.housing-shell`は既にモバイル時`100dvh`フォールバック済みだったが親の`.housing-workspace`が未対応だった。同じ`100vh; 100dvh;`フォールバックパターンを追加。**CSSのみの修正でjsdomでは検証不能、実機(iPhone Safari)での確認が必要**。
- **⑧スマホ右下のアカウントアイコンがログイン中でも未ログイン表示のまま**: `HousingBottomNav`のログイン項目アイコンが常に汎用`User`アイコン固定で、ヘッダー(`AppHeader`)の顔写真アバターと違い状態を反映していなかった。ログイン中は`profileAvatarUrl`があれば顔写真、無ければ頭文字絵文字を表示するよう修正。テスト3件追加。
- **①(ドロップダウン意匠統一)は「無理に変えなくてよい」とユーザー判断済で対応不要**。
- **⑤(YouTube概要欄の住所自動入力)は調査完了・実装保留**: 現状はYouTube動画の説明文(概要欄)を一切取得しておらず、動画IDからサムネURLを組み立てているだけ。概要欄を読むには公式YouTube Data API (v3)が必要で、ユーザー自身がGoogle Cloudで新規APIキーを取得する作業が要る(無料枠は1日1万ユニットで十分・費用面はほぼ問題ないがキー取得は本人作業)。次回セッションで実装するか判断待ち。
- **⑨(アカウントボタンのモーダルが画面中央より下寄り)は実機確認で解消済(2026-07-20)**: コード上は明確な原因を特定できなかったが、ユーザーが実機で再確認したところ直っていた。⑦の`.housing-workspace`の`100vh→100dvh`修正が副次的に効いた可能性(要因は未確定)。
- 検証: build ✅ (`tsc -b` + `vite build`) / vitest 3549+1 pass(既知 EphemeralAddPanel 7件のみ・環境依存で無関係と特定済み)。

### ✅ 2026-07-20 詳細ページのボタン高さ統一+スマホ下端余白+お気に入りアニメ強化(ユーザーの実機フィードバック経由)
- **詳細ページ操作バーのボタン高さ統一**: ♡(30px固定円)/「＋ツアー」(パディング差で35px)/シェア・ちがった(32px)/Xアイコン(30px)/…メニュー(40px固定円)がバラバラだった実機指摘を受け、`--housing-action-bar-btn-h: 32px` トークンを新設し全ボタンに適用。共有クラス(`.housing-card-fav`/`.housing-kebab-trigger`)は他画面でも使われるため、`.housing-action-bar` にscopeしたoverrideのみ追加し既定値は不変。
- **スマホ詳細ページの下端余白追加**: `.housing-detail-panel`(唯一のスクロール域)にボトムナビ高さ分の`padding-bottom`が無く、最後の要素がナビに隠れたままスクロールが止まる実機指摘。`.housing-listing-grid`で先に直した実機FB#9と同型のバグと判明、同じ計算式を適用。
- **お気に入りハートの押下アニメーション強化**(ユーザー要望、motion-designスキルで方針検討): 拡大バウンド1.35倍→1.5倍+軽いひねり(rotate)を追加(keyframeベースに刷新)、飛散パーティクル8個→14個・飛距離拡大+粒ごとの大きさ/タイミングをランダム化。土台の「弾んで粒が飛ぶ」仕組みは維持。背景に光る輪を足す③案は保留(①②で「十分」とユーザー判断)。
- 検証: build ✅ / vitest 3550 pass(既知 EphemeralAddPanel 7件のみ)。

### ✅ 2026-07-20 Cloudflare運用2件(cost-hardening-ops-runbook)完了+housing公開窓口のキャッシュ欠落バグ発見・修正
- **`api-popular-cache` / `housing-housinger-page-cache`ルールを新規作成・本番HIT実証済**(手順書=`docs/superpowers/plans/2026-07-18-cost-hardening-ops-runbook.md`)。手順書初版の「バイパスルールより上位に配置」は誤りと判明・訂正済み(公式: Cache Rulesは**後にあるルールが勝つ**=Page Rulesと逆。既存の`housing-public-window-cache`/`miti-public-window-cache`が`bypass-dynamic-shell`より下でも機能していた理由もこれで説明がつく)。
- **housinger専用ルールのエッジTTLは300秒でなく86400秒(1日)を採用**: `_housingerPageHandler.ts`はDiscord等のOGPプレビュー用メタタグ生成が主目的で、実際に画面へ表示される内容(プロフィール/一覧)はReact側が`getHousingerProfile`等で毎回Firestoreから直接ライブ取得するため、このHTMLのキャッシュ期間は画面内容の鮮度に一切影響しない。影響があるのは「編集直後にリンク共有した場合のOGPプレビュー文言/タブタイトルのみ」という限定的範囲と確認した上でユーザー承認・採用。
- **重大な副産物**: `api/housing/_publicWindow.ts`の全action(version/gallery/housinger/listing)がCache-Controlに`s-maxage`しか設定しておらず、Vercelがクライアント応答から`s-maxage`を除去する仕様([[reference_vercel_cf_window_caching]])によりCloudflareに具体的な秒数が一切届いていなかった(未知の長いデフォルトTTLで代替キャッシュ)。これが実機FB④「削除した物件が10分以上『探す』に残り続ける」の根本原因だった。全6箇所に`max-age`を追記し修正・build+vitest(3540 pass, 既知の無関係な失敗7件のみ)確認後デプロイ。旧キャッシュ(`?action=version`)をCloudflare側で手動パージし、本番で30秒キャッシュへの復帰を実測確認。gallery/housinger/listingは自然入替(数時間)に委ねた。
- 学び: max-age欠落はCloudflareが古い壊れたキャッシュを長期保持し続けるため、コード修正をデプロイしただけでは実ユーザーに反映されない→**該当URLの手動パージが必須**という手順を確立。

### ✅ 2026-07-18〜19 コスト・ハードニング本番反映後の実機不具合3件(即日修正・本番反映済)
- **共有ツアー参加APIのApp Check回帰**(commit `4aa61ebb`): join-shared-tourにverifyAppCheckを付けていたため、本当に未ログイン初回訪問者(getActiveAppCheck=peekで未初期化)が403で弾かれツアーに参加できなかった。本番curlで403を再現confirmしてから、`_searchPersonalTagsHandler.ts`/`api/popular`と同じ「App Check無し・rate limitのみ」パターンに揃えて解消。heartbeatでensureAppCheck()を発火させる代替案はコスト面の趣旨に反するため不採用。
- **住所非公開(unlisted)が探すから消える**(commit `c4f24517`): 地域フィルターは言語切替で未タッチでも既定地域が入る(他フィルターと違い実質デフォルトON)。unlistedはregion=undefinedのため地域フィルターに一律で弾かれていた。region未定義のリスティングは地域フィルター対象外として素通しするよう修正(server/area/sizeは従来どおり除外維持)。
- **Housing新規ユーザーの名前/アイコン変更403**: 別セッション(通常より非力なモデル使用)がensureUserDocumentユーティリティで応急修正(bc847128+645e7927)→司令塔が診断済みの追加バグ(providerData未定義でクラッシュ・既存テスト2件が実際に落ちていた)を発見し修正(commit `0d296ea8`)。ensureUserDocument自体のテストも新規追加(4ケース)。

### ✅ 2026-07-17 TODO整理で退避した検証済ステータス (元「現在の状態」)
- **FB第6〜8弾=全項目ユーザー実機OK確認済(2026-07-17)**: お気に入りPC⇔スマホ同期 / ツアー順+ピン / Xシェア / OGPページ風カード / 左パネル画像固定根治 / 跨ぎ通知非ブロッキング化 / スマホ地図整理。旧TODO記載の「④非同期=同期設計はbrainstormingから」はFB6実装で解消済=打ち切り。OGPカード2種(ハウジンガー+ツアー招待URL)のデザインブラッシュアップは新TODOとして継続(TODO.md 残TODO①)。
- 直近本番検証済: round1+round2(21項目・7-13)+P0+P1大規模耐性ハードニング(7-14・CF全ルールHIT実測・実機G2全PASS)。プライバシー=`personal_<hex>`はHMAC一方向ハッシュ。round2詳細=`.private/2026-07-13-register-production-test-feedback.md`。
- 2026-07-16 実機OK+本番反映: ダイアログ3種ガラス化+招待ボタン角丸 / 共有URL `hashed:`剥がし(C案) / 前デプロイ分5件(登録住所未入力UX・管理サイドナビscroll・Ko-fi→/support・マイページ10件・P3 unlisted UI)=全部OK。詳細=`.private/2026-07-16-next-session-dialog-tonmana.md`。
- スマホ対応FB第2〜5弾の内訳: 基盤(ナビ/FAB/シート/2列/全画面/ツアー横持ち→縦OK化)+トップ/フィルター▼ヘッダー/シート不透明+つまみ閉じ/行き方地図下部/終了/住所2行/次へ消失根治=sticky hover/トレイバー/カードをナビ下まで/スクロールバー右端/お気に入り2行化+文字ボタン。#A削除即反映/#Bお気に入り件数重複も修正。PC無変更。本番確認=全部OK(2026-07-17)。台帳=.superpowers/sdd/progress.md。①#B残ストリップ件数(`d6261a9d`) ②LP導線(`0aec3971`) ③中韓用語CSV=完了。
- P3補足: G7住所漏洩ゲート完全通過(curl+実機・住所文字ゼロ・地図/近隣なし)。triple protection+逆引き封じ(check-duplicate)。en翻訳=日英706/706キー数一致 / 共有ツアー本体=本番稼働(2026-07-16) / 地図左上フル住所=実装済。

### ✅ 2026-07-17 グローバル CLAUDE.md 剪定 (プロジェクト外メタタスク・承認済み)
- ~/.claude/CLAUDE.md を 301行→約80行へ。**削除ゼロ=移動+ポインタ化**: RTKコマンド表→`~/.claude/rtk-reference.md` / 画面環境38行→`design-philosophy-sizing.md` §12 / 推測抑制の出典7件→`~/.claude/anti-speculation-sources.md`。コスト×品質ルールは無変更。要点数値(1489/2.58/1920・2560/Playwright設定/clamp)と5原則本体・セキュリティ3層・RTK黄金律は本文に温存。プロジェクト側 CLAUDE.md は既にスリムのため対象外(ユーザー了承)。

### ✅ 2026-07-17 FB第8弾 (スマホ地図整理/OGPカード/画像固定バグ根治/跨ぎ通知非ブロッキング化)
- **スマホ地図オーバーレイ**(`5d9a9a1b`): 「デフォルト表示に戻す」スマホ非表示 / フル住所を左上10px起点でコンパス回避折返し / 経過時間の枠なし化。スマホ見学開始=タイマーチップのみ(`cf8ac37c`)。
- **ハウジンガーOGP「ページ風カード」案A**(`01fbe1cb`+`webp修正`): /api/og?type=housinger(HMAC署名・Edge・新規関数ゼロ・クローラーのみ&edge cache長期=ユーザー数比例コストなし)。アバター+名前+公開画像3枚。**WebP非対応バグを本番0byte→ローカル再現→マジックナンバー判定で根治**(ver=2でキャッシュ回避)。アバターがWebPの人はイニシャル表示(将来: アバターのPNG変換 or satoriのwebp対応待ち)。
- **左パネル画像固定バグ根治**(`c421e0b0`): 根因=useTweetVideoFrames の effect が「動画なし/未キャッシュ」時に前の家の frames を残す→ambient overlay だけ前の家の画像で固定(住所系は正常のためデータ無罪)。effect 冒頭で即 setFrames([])。失敗テスト先行で確認。ユーザーの7件ツアー再現情報(ピン2+クラシカルで固定)が決め手。
- **跨ぎ通知の非ブロッキング化**(`c50ae718`): 「移動しました(地図を見る)」ボタン/ack機構(crossingAckedIndex含む)を全撤去し pointer-events:none の帯へ。「次へ」の二段階ハイジャック廃止=常に1回で前進。共有ツアーの host/participant ack 同期も不要化。
- **トレイ書き戻しの脱落防止**(`c19909c2`)+**ピン留めツアーのパネル固定疑惑**=fuzz1000+実UI E2E で再現せず(真因は上の画像固定バグだった)。
- 検証: build ✅ / vitest 3468 pass(既知 EphemeralAddPanel 7件のみ)。

### ✅ 2026-07-17 FB第7弾 (第6弾成果への実機FB反映)
- **Xボタン**: アニメ発火をボタン全体の hover/focus に(TwitterXIcon を forwardRef 化しボタンから駆動)。詳細ページの X シェアは本文テキストなし=`text=`パラメータ自体を省略(URL+#LoPoのみ)。ハウジンガーページは表示名入り従来どおり。
- **トレイ刷新**: ピンを「最初/最後」2ボタン→lucide Pin 1個の「この位置に固定」へ(resolveTourOrder 新セマンティクス=自動順でも pinned は現在indexに固定・unpinnedだけ効率順で空きスロットへ。ピン押下時は表示順を実体化してから固定)。行に 40px サムネ+タイトル/住所2行+title属性ホバー全文(PC/スマホシート共通)。i18n pin_first/pin_last→pin。
- **スマホ見学開始の意図しないパネル**(`cf8ac37c`): 全画面ショーケースを撤去し、見学中は地図右上(コンパス直下)に「mm:ss 経過」チップのみ(pointer-events:none・PC右パネルは従来どおり)。
- **OGP検証(systematic-debugging)**: 本番実URLを Twitterbot UA で curl → 専用メタ(表示名/bio/pbs.twimg.com画像/large card)が正しく返ることを実証。ユーザーの「黒ロゴ」は X の URL 単位カードキャッシュが原因(`?v=2`付きで新カード確認可)。実バグはフォールバック og:image が相対 `/api/og` だった1点のみ→絶対URL化済。診断で housing_profiles=1件(isPublished:true)・公開listing 5件・代表画像ありも確認。
- 検証: build ✅ / vitest 3446 pass(既知 EphemeralAddPanel 7件のみ)。

### ✅ 2026-07-17 FB第6弾+follow-up (即修5+Xシェア改良+OGP+お気に入り同期+ツアー順)
- **即修5件** (`fd36aa45`/`69e0a7a9`): ⑦スマホ地図下帯=1行目エーテライト/2行目以降行き方全文 / ②マイページ準備中文言(新キー housing.mypage_coming_soon.* — 旧キーは死蔵 HousingComingSoonPage と共有のため温存) / ③個人タグ絞込リンクをハニー化 / ④⑤Xシェア(投稿元postUrl優先+常設ボタン)。⑥住所拡大は2転の末**全面撤回**(`4b104609`+followup)。
- **Xシェア磨き**: アニメ付きXアイコン(ユーザー提供・Tabler/MIT を framer-motion 移植) / intent に hashtags=LoPo / canonicalPostUrl で x.com/twitter.com の追跡クエリ除去(投稿後は t.co 短縮で常に23字扱い)。
- **ハウジンガーページ動的OGP**: /housing/housinger/:uid → /api/share?type=housinger rewrite(_housingerPageHandler・Hobby関数上限のため新規関数ゼロ)。公開条件を満たす時のみ 表示名+bio+公開listing代表画像(→avatar→/api/og)。住所はメタに出さない。
- **お気に入りFirestore同期**: users/{uid}/housing_favorites/main 1doc。/housing 滞在中のみ start(初回=サーバー∪ローカル・以降 onSnapshot+1.5sデバウンス書込・エコー遮断)。共有PC対策=最後に同期した uid を記録し別アカウントは union せず置換。rules 追加+**deploy済(2026-07-17)**。テスト15件。
- **ツアー順制御**: resolveTourOrder(未操作=効率順+最初/最後ピン固定、ドラッグ後=手動順+ピン)。表示順=開始順を常に一致。PC=トレイ行にグリップ+ピン2種+「効率順に並べ替え」/ スマホ=トレイバー「並べ替え」→ボトムシート(TourTrayList共有)。ハウジンガー「まとめてツアー」と空トレイ再開は従来どおり。
- 検証: build ✅ / vitest 3443 pass(失敗は既知の EphemeralAddPanel 7件のみ)。

### ✅ 2026-07-17 残バグ#B+LP導線+中韓用語CSV (3件)
- **#B残: 探すページ右カラムお気に入りストリップの件数** (`d6261a9d`): 生 `ids.length` → dedupe+解決済みのみ (`recent.length`)。解決プールも `mergeListingsForViewer`(公開+自分の登録) に統一し見出し側と同じ数え方に。テスト追加・vitest 19 pass・build ✅。
- **LP「ハウジングツアー」導線** (`0aec3971`): 上部ナビ+プロジェクトカード02 を COMING SOON トーストから `navigate('/housing')` へ。未使用になった showComingSoon state/トースト JSX も削除。`portal.housing_coming_soon` キーは4言語parity維持のため残置。
- **中韓翻訳用 用語CSV**: `docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv` (デスクトップにもコピー)。232行=エリア5/アパルトメント5/エーテライト92/DC12/ワールド89/サイズ5/タグ22/区画表記2。公式訳 (ffxiv-teamcraft places.json ja/en + ko/zh) と全件突き合わせ済み。ko/zh 要翻訳で残るのは LoPo 独自分 (タグ22/サイズ5/本街・拡張街2/注記1) のみ。DC/ワールドはゲーム内表記が英字のため ko/zh 対訳なし (韓中は独自サーバー群)。生成スクリプトは CSV と同じフォルダに保存 (`gen-housing-terms-csv.ts`)。

### ✅ 2026-07-15 登録改修3件 — 本番反映済 + ユーザー実機チェック通過
main `8e912670` / `a47856fe`。ユーザーが本番実機で確認OK (2026-07-15)。
- **⑥ 建物タイプ未選択ブロッカー解消**: 建物タイプを選ぶまで番地から下と地図を出さず、選択で展開。手入力で全部埋めても確認ボタンが灰色のまま押せなかったバグを解消。
- **⑦ 新規登録は写真か動画が必須** (編集・一時ツアーは対象外)。1つ入れると確認ボタンが押せる。
- **⑧ 部屋区分の2択→「FCハウスの個室ですか?」トグル**: default オフ=家全体 / オンで部屋番号欄。保存する中身 (roomKind/roomNumber) は従来どおり不変。

### ✅✅ 2026-07-13〜14 big3 本番リリース + 競合コピー増殖バグ根治 — 本番反映済
- **big3(2026-07-13)**: 探す地図FB / ハウジンガーPF / 一時ツアー + ④地域フィルタ連動 + ⑤ヘッダー横断検索(日本ワールドのカタカナ/ひらがな検索・PersonalTagFilter撤去) を main 反映 + `firebase deploy --only firestore`(rules+indexes)。実機checklist=`docs/.private/2026-07-12-big3-release-verification-checklist.md` B節+⑤節。残(ユーザー実機)=PF/⑤横断検索の目視。保留(非ブロッカー)=②建物タイプ切替がたつき(`0e07d7e1`効かず・要systematic-debugging)/通報はPFページ報告に委任(本番PF後決定)。
- **競合コピー増殖バグ(2026-07-14 本番デプロイ済・main `0eaa1c0a`)**: root cause=collab DO の serverTimestamp が Date.now を追い越し中身同一でも偽競合。修正=`src/lib/planContentEqual.ts`(共有中身一致ゲート)+`updatePlan`が`skipped_same_content`返す。build✅/vitest3301pass/敵対監査3回通過。残=数日実機監視のみ(共有プランで放置/切替→コピー生えない・既存表無事)。owner属性のpull巻き戻し=別問題。詳細=`.private/2026-07-10-conflict-copy-investigation.md`。memory [[reference_collab_plan_sync_false_conflict]]。

### ✅ 2026-06-15〜16 管理画面リデザイン全18ルート + スマホ最適化A + 共有タブ — 本番稼働
`npm run dev:admin` でヘッダー/2カラム/ウィザード4本/フォント。スマホ=共有2択・部屋発行・パーティ自動・Lv80 DB/星天交差1チャージ/深謀遠慮。**目視の最終確認はユーザー未実施のまま本番稼働中(任意・非ブロッカー)**。

### ✅✅✅ 2026-07-10 plot→size 表 / 住所抽出v2 / 住所誤爆の根治 / 行き方データ整備 — 全て本番反映済
詳細調査ログ=`docs/.private/2026-07-10-plot-size-table-and-address-v2.md`。
- **確定表を `src/data/housing/wardPlotSizes.ts` 化 + `getPlotSize(area, plot)`** (`0781d4cf`)。回帰ガード3系統(構造不変条件 / 全10マップの outline 面積 300/300 / 行き方本文との一致)。**表の再調査は不要**。⚠ Goblet の outline だけ 4 点で閉じていない多角形 → 靴紐公式は添字を wrap すること。
- **🐛行き方本文のサイズ誤記4件を修正**: Mist plot30・plot60 / Shirogane plot8・plot38 の「Ｌハウス」→「Ｍハウス」。private メモは本街2件だけ挙げていたが拡張街のミラー2件も同じ誤記だった。
- **size 自動導出 + 住所抽出v2** (`92a7769e`)。A案=size 欄は disabled の自動判定 (ハニーの auto-filled 表示は維持)。`validateAddress` に `mismatch_with_plot` を追加しサーバー側でも保証。og-fetch が本文テキスト(最大4000字)を返し、`extractHousingAddressFromPage` が title/description/本文/各行/隣接窓 を採点して最良の1行を採る。housingsnap の og:description は 120字で truncate され住所行が落ちるのが根因だった。
- **住所誤爆を辞書側で根治** (`28cb3e94`)。`masterData.ts` の DC/鯖 alias に「4文字未満のASCII略称」が63件 (`Man`/`Had`/`Ex`…、31件が英単語と衝突。`Mat` は Mateus鯖 と Materia DC の両方に登録され自己矛盾)。**パーサは表記ゆれデータしか見ていない。汚れていたのは辞書**。→63件削除 + `masterDataAliases.test.ts` で再登録を機械的に禁止 → 文脈ゲート/質フィルタ/`opts` 引数を全撤去 (パーサ95行減)。エリアの `Gob`→Goblet 等は実在するので残す。memory [[feedback_no_speculative_alias_data]]。
- **Firestore `/master/servers` を同期** (`npx tsx scripts/seed-servers.ts`)。⚠ **住所抽出は静的 `masterData.ts` を直 import、他画面は Firestore (`useServerData`)** の二重系。`/admin` の alias 編集は住所抽出に反映されない。同期前の Firestore は `housingAreas` が旧 `name_jp` 形式で `AdminServers.tsx` の `area.name[lang]` と噛み合わず、/admin サーバー画面が壊れていた。
- **ゴブレット拡張街 (plot 31-60) の行き方 30件を追加** → 全300区画に行き方が入った。**Google スプレッドシートは引退、`directions-src/*.csv` が唯一の正典**。memory [[reference_housing_directions_csv_canonical]]。
- **本番実機OK (ユーザー)**: housingsnap URL → Shirogane 21区58番地 Mハウス。文言2件削除 (「家 (S/M/L)」の括弧 / 「31 以上は拡張街です」注記・`dd348e01`)。
- 検証: build EXIT 0 / vitest 2793 pass。敵対的レビュー4視点で「had→Hades 捏造の復活」「`keepBestQuality` が area の正解を英単語に奪われる退行」を検出→修正済。

### ✅✅✅ 2026-07-09 ハウジング詳細ページ改修 (P1掃除 / P2大パネル1枚化 / A・B・C) + P3 編集フォーム一本化 — main 統合・本番反映完了
main `12fa481f` (詳細改修) と `cba9f69f` (P3)。設計/計画=`docs/superpowers/…2026-07-08-housing-detail-*`、台帳=`.superpowers/sdd/progress.md`。安価モデル(haiku)で subagent-driven 実装 → opus 最終レビュー「Ready to merge: Yes」。
- **P1 掃除**: 死にコード + 旧ワークスペース経路 + 旧作成フォームを撤去 (-5950 行)。
- **P2 大パネル1枚化**: シェル子ルート統合。モーダル / フルページの二本立てを撤去しツアー地図を流用。
- **A/B/C**: A=写真ヒーロー + 固定レール(地図の透け重なり修正・脱ピル・脱色箱バナー) / B=ギャラリー(大メイン contain で見切れ無し + 縦サムネ列をバー無しフェード + クリックで差替) / C=テキスト収納スクロール + 見出し=住所(任意タイトル不要) + ハートを「探す」と統一(pop / 粒子 / honey)。
- **P3 編集フォーム一本化**: `RegisterPage` を `mode='edit'` 対応にして編集も担わせ、編集は詳細 → 新ページ `HousingEditPage` (`/housing/listing/:id/edit`) への route 遷移に一本化。旧編集フォーム 3 枚 (HousingEditModal / HousingRegisterModal / HousingRegisterView) を撤去。方式A=編集で写真は変えない。build✅ / vitest 2696 pass。

### ✅✅ 2026-07-09 ツアー左右パネル刷新 + 見学タイマー (Project B) — main 統合・本番反映完了
ブランチ `feat/housing-tour-panel-restructure` (tip `4c839aed`) は **main の祖先 = マージ済・push 済**(2026-07-10 に `git merge-base --is-ancestor` で確認)。TODO.md 側に長く残っていた「未マージ・→main ff-merge」 という記述は**誤り**だった。反復詳細=`docs/.private/2026-07-08-tour-panel-iteration-notes.md`。
- **内容**: store / useElapsed / i18n 4言語 / 左パネル(タイトルを画像上・DC撤去・紹介文空は「──」・次目的地=タイトル+住所・最下部寄せ) / 操作3ボタン(1行・左右小中央大・honey次へ) / 見学タイマー(移動中=行き方 ⇄ 見学中) / 家の発光(オーバーレイ実輪郭) / 北コンパス / 行き方「エーテライト：〜」 / 右パネル収束 + マップ演出(dip遷移・エーテライト名ラベル・操作ヒント・ステップのバネアニメ・自動追従スクロール・リング最終100%・完了ボタン。commit `c451bf29`)。
- **同ブランチで併せて**: アパートのツアー地図で最寄りエーテライト名が出ない不具合修正(`2493e550`) / ツアー完了のオーバーレイ化(`c6c3beb6`) / 登録URL欄 autoComplete=off(`32c6ef00`) / テーマ切替の日の出・日の入り縦リビール(`133f8d86`)。
- **⚠ 残 UI 4件はマージ後も未着手のまま** (TODO.md「ハウジング」節に転記済): ①B4「目的の家に行き方」吹き出し(家側) ②経路を家の縁で終端(刺さり解消) ③家と道の枠線根治 ④地図クロスフェード再挑戦(ズームイン破綻で `6404ab74` revert・現行は dip)。

### ✅✅✅ 2026-07-08 ハウジング「生きたカード」全面配線(段階2) — main 統合・本番反映完了 (finishing-a-development-branch)
ブランチ `feat/housing-living-card-rollout`(spec+plan+4タスク+2fix)を **ff-merge → push → Vercel 自動デプロイ**。main `2c0b95a0`。spec/plan=`docs/superpowers/{specs,plans}/2026-07-08-housing-living-card-rollout*`。
- **狙い/核心**: 新シェル世代(探す/お気に入り/ツアー)の静止画カードを、旧 workspace の完成済み生きたカード機構(画像クロスフェード + 動画スポットライト cap1・15s順送り)へ配線。詰まりは1箇所=`HousingPlaybackProvider` が旧 `HousingWorkspace` にしか mount されず新世代は NOOP 静止→**`HousingShell` の <Outlet/> に mount** で全新世代ページを対象化。各カードは旧 `HousingCard` 同型 hook を再利用(再発明ゼロ)。
- **タスク**: T1 `2c869cfb` Provider mount / T2 `13695d48` `ListingCard`(探す/お気に入り共通・画像+動画) / T3 `8d2aa632` お気に入りプレビュー strip(`FavPreviewThumb` 抽出・画像のみ) / T4 `4941d443`+`3aeda634` ツアー hero(画像+動画・vacuous assert 強化) / M1 `2c0b95a0` hero ラッパー角丸回帰修正。
- **進め方/検証**: 3並列監査(動く機構/ゲーティング/全サーフェス棚卸し)→brainstorming→spec→plan→**subagent-driven**(実装者→task reviewer→fix ×4)→**opus 最終ブランチレビュー=Ready to merge Yes**(Critical/Important ゼロ)。build EXIT0・vitest 新規fail ゼロ(既知legacy5=TopBar4+HousingWorkspace1のみ)。ベース img 残しで既存テスト非破壊。旧 workspace 世代は不触。実機OK(ユーザー)。
- **残 follow-up(任意)**: 詳細peers配線(シェル外) / `representativeImage` 3重複撤去 / `useIsScrolling`(window前提)が body overflow:hidden で非発火の件。詳細=memory [[project_housing_phase_status]]。

### ✅✅✅ 2026-07-08 ハウジングツアー中央地図 Phase3(レイアウト再編)+ツアーUX調整①〜⑨ — main 統合・本番反映完了 (finishing-a-development-branch)
ブランチ `feat/housing-tour-map-phase3-layout-reorg`(12コミット)を **fast-forward merge → push → Vercel 本番自動デプロイ**。main `95ce47e4`。plan=`docs/superpowers/plans/2026-07-08-housing-tour-map-phase3-layout-reorg.md`。
- **内容(①〜⑨)**: ①Phase3レイアウト再編(左=目的地ショーケース/右=進行状況・ステップ一覧を右へ移設・NextDestination→**TourShowcasePanel**改名・共有grid不変で `.housing-tour-page--reorg` modifierにスコープ=DEV RouteAuthoringPage非回帰) ②マップ既定ズーム**上限scale2**(`MAX_DEFAULT_SCALE`・手動は8維持) ③シロガネ外周の無名黒境界道(id/mask無しpath)を道トーンへ再着色 ④推定時間UI撤去(トレイ推定時間+StatusBar ETA+4言語ロケールキー) ⑤いいねハート押下FB(pop1.35+8粒・`HousingFavHeart`・reduced-motion対応) ⑥トレイ件数のみ表示(`MAX_TOUR`撤去) ⑦お気に入りプレビュー横スクロール(flex nowrap/4件目見切れ/ホイール横送りネイティブ登録) ⑧地図perf(SVGホストの重いdrop-shadow撤去・にじみ対策でwill-change不採用) ⑨家の枠線を道と同じ0.42へ統一。
- **検証**: build EXIT0 / フルvitest=5既知legacy fail(TopBar4+HousingWorkspace1・mainにも存在・無関係)+新規0。マージ検証で④の追従漏れ(StatusBar ETA テスト)を1件修正コミット(`95ce47e4`)。見た目(にじみ/重さ/枠線)はユーザー実画面DPR2.58ゲートでOK。
- **残(次セッション最優先)**: ⑤ツアー左パネル再構成/⑥右パネル再構成(見学開始フェーズ moving↔viewing)/🐛家と道の枠線がまだ「別物」に見える根治(区画の白fillコントラスト差の疑い)。

### ✅✅✅ 2026-07-06 ハウジングツアー大ブランチ — main 統合・本番反映完了 (finishing-a-development-branch)
ブランチ `feat/housing-tour-nav-m1`(84コミット・複数スパン)を **fast-forward merge → push → Vercel 本番自動デプロイ**。台帳=`.superpowers/sdd/progress.md` 末尾に全経緯。
- **内容**: ①M1「ツアー中(Nav)ページ」(実ページ化・地図/前後連動/報告モーダル/完了/空状態) ②P2+P4 本物のナビ化(orderTourStops 自動並替・全5エリア地図遅延ロード・**実エーテライト起点データ全300区画**・最寄りエーテライト→家のゴージャス経路) ③実箱ハイライト+アパートナビ ④座標破損バグ根治(parse-ward-svg 中心計算の H/V/C+rotate 対応・全ward JSON house座標を実SVG中心へ外科補正+回帰テスト) ⑤中央地図 Phase1(改善1投影起点/2箱縁停止/3波紋撤去/8枠線色トークン化・**道の黒残り根治**=`path[mask], path[id$="(Stroke)"]`の2系統対応) ⑥家の入口手動補正ツール(DEV専用 `/housing/dev/entrances`・vite dev直保存) ⑦**全10マップ入口採取276区画**+Figma再エクスポートで道漏れ解消(家座標0移動で保全)。
- **検証**: build EXIT0 / vitest 5既知legacy fail+2636 pass(新規0) / 全7スパン opus 最終レビュー済(各 Ready to merge・fix適用済)。座標補正の他機能波及=登録ミニマップで厳密改善と実証。DEV ツール本番非露出=dist grep 0 で実測。
- **繰延(Phase2/P3)**: M1小物 b〜e(Esc/凡例同色/右カラム/死にキー title)・死にコード少々。
- main `beb8d702`。ユーザー確認「本番でいい(URL非公開で未露出)」で go。

### ✅ 2026-07-03 探すカードの「ツアー追加」ボタン欠落 — 根治・本番反映・実機OK (TODO.mdから移動)
**症状**: 探すページのカードでツアー追加ボタンが不可視。**メインアカウント(登録所有者)ログイン時のみ**再現(非ログイン/別アカウント/新品ブラウザは正常)。多セッション難航・初回は「旧SW配信」と誤判定(BUILD表示のSHA化計器で新JS配信を確認して反証)。
**真因**: `.housing-listing-grid` の `grid-auto-rows:auto` が、カードmediaの `padding-top:75%`(%パディング高さ)を、ログイン後 loadMine で自分の登録が**動的追加**される再レイアウト時に 0 とみなし、行を~32pxに潰す→footer(ボタン)を overflow:hidden で切り落とし。ユーザー実機DevToolsで `grid-auto-rows:max-content`→201px復元・`content-visibility:visible`→変化なし(無罪)を直接計測して断定。
**修正**: `.housing-listing-grid` に `grid-auto-rows: max-content`(commit 41cffd85)。build/vitest緑・本番配信CSS(index-OfMvwhFl.css)に反映確認・ユーザー実機OK。
**副産物+教訓**: StatusBar の版表示を実git短SHA化(vite define + `__HOUSING_BUILD__`、commit 75ca023・残置=遠隔診断計器)。教訓=遠隔UI障害は実機の computed style を1コマンドで取れ・合成再現の"正常"は無罪証明にならない(memory `reference_css_grid_autorows_padding_collapse` / `feedback_remote_ui_bug_devtools_first`)。

### ✅ 2026-06-30 PS5リモプ貼り付けUI /stgy 88字修正 — 本番稼働・実機OK (TODO.mdから移動)
スマホ→PS5の共有コード貼り付けは**90字以内が必須**(リモプのキーボード制限。超過で「無効な文字」)。既定170→**88字**・上限90に修正(2026-06-30 実機OK)。コード=`src/lib/strategyCode.ts`。角カッコ`[ ]`はコードの一部として残す。複数`[stgy:...]`は1個ずつ処理(将来まとめ対応の余地)。

### ✅ 2026-06-20 Vercel Pro→Hobby 移行判断の実測詳細 (判断=Hobby安全・TODO.mdから移動)
課金API実測(6/12-19)= Edge Requests ピーク 16,127/日(6/12・閾値33Kの48%)・平均9,178/日(月換算275K=枠の27.5%)・直近土日(6/14-15)も約40%。Function Inv/転送量も全て5-6%。全指標2倍以上の余裕で減少傾向。ユーザー確認済(6/20)=ハウジング未公開・広告未稼働→今すぐ Hobby OK。team=pro 確認済(user 表示は northstar で hobby と出るが課金は team)。残アクション(TODO.md 側に保持)=7/11前に Dashboard で Hobby 切替・将来の広告つき公開時に Pro 復帰判断。

### ✅ 2026-07-01〜07-02 ハウジング再構築 第1〜第3スパン(土台+探す+お気に入り) — **main 統合・本番反映済**
ブランチ=`feat/housing-rebuild-foundation-browse` (tip `a90c103a`)。2026-07-10 時点で main の祖先 (= マージ済・origin/main に push 済) であることを `git merge-base --is-ancestor` で確認。当時の「merge は登録ページ完成まで保留・ローカルのみ」 という記述は**過去のもの**。
全面再構築(全7ページ+シェル・ページ単位再デザイン=挙動先行M1〜M6を撤回)。台帳=`.superpowers/sdd/progress.md`、spec/plan=`docs/superpowers/{specs,plans}/2026-07-01-housing-*`。
- **第1スパン=土台+探す骨組み**: HousingShell+上部6タブ(URLルート)/AppHeader(ブランド/検索/タブ/テーマ/通知/アバター)/探す3カラム/ComingSoonで他5タブ暫定着地。
- **第2スパン=探す 参考UI忠実化+粗一掃**: 質感A案(濃紺フラットパネル=液体ガラス湾曲撤去/ハニー主・青選択)/4列グリッド+「一覧N件」見出し+並び替え/DDフィルタ(複数選択維持)+サイズ同幅セグメント/トレイN/20+お気に入りプレビュー/文字見切れ解消/多エージェント監査74粗→修正/広告撤去(Ko-fi優先)。ハウジング460テスト緑・build緑。
- **第3スパン=お気に入りページ(Task2〜8)**: 左オンボ3ステップ(教育のみ・✅進捗なし)/中央=複数選択グリッド+タブ[すべて/最近追加]+一括バー/右トレイ+ツアー開始(マナー通知)/同住所の重複自動追加(expandTourWithDuplicates)/i18n4言語+parityテスト。仕上げ=AI感払拭(色付きalert箱撤去→ヘアライン注記)+番号センタリング+中央カラム縦余白リズム統一(バー↔カード密着解消)。`.claude/rules/housing-design.md` に質感A案条項追記。commits `08987d13`/`5bcb57e1`/`852f9462`/`32e1480f`。
- **最終レビュー(opus・`e7f87d5e..852f9462`)=Critical/Important なし・マージ可能**。build緑・お気に入り27テスト緑・フルvitest 2365pass/5既知legacy fail(TopBar4+HousingWorkspace1・workspace配下・無関係)。

### ✅ 2026-06-30 ユーザー報告対応 — 完了(2026-07-01 確認)
- レベル/ステータスが軽減表に未反映だったバグを修正デプロイ済。報告者へ取り込み直し案を返信済。

### ✅ 2026-06-30 数値入力の業界水準化 Phase 1 — 本番デプロイ済・実機OK
- **🆕 2026-06-30 本番デプロイ済=数値入力の業界水準化 Phase 1**: 共通部品 `src/components/ui/NumericInput.tsx`(文字列保持/空欄OK/桁区切りはblur整形=カーソル飛びなし/全角/NaN防止/min・max・小数オプション/全選択維持) と `TimeInput.tsx`(M:SS・裸秒・全角・空=null・正典parseTimeString利用) を新設。移行=EventForm(ダメージ×2・時刻)/AASettings(AAダメージ)/PartyStatus(HP・WD・MND・DET×5)/BoundaryEditModal(開始終了時刻)。旧FormattedNumberInput と各所の重複時刻ヘルパー撤去。SDD 6タスク+各レビュー+opus最終=Ready to merge・実機OK。**対象外(意図的)**=admin49件(Phase 2保留・マスタ書込でリスク)/housing(空欄既にOK・独自デザイン)/HeaderTimeInput/ActivityScrub。spec/plan=`docs/superpowers/{specs/2026-06-30-numeric-input-standardization-design.md,plans/2026-06-30-numeric-input-standardization.md}`。

### ✅ 2026-06-30 イベント時刻の MM:SS 入力対応 — 本番デプロイ済
- **🆕 2026-06-30 本番デプロイ済=イベント時刻の MM:SS 入力対応**: EventForm の時刻欄を「秒のみ」→ `6:15`/裸秒どちらも入力可・編集時はM:SS表示・全角正規化・常時ヒント+placeholder(4言語)。既存 `parseTimeString`/`formatTime` 再利用(admin と同方式)・データモデル無変更。ついでに共有 `formatTime` の負値バグ修正(`-90`→`-1:30`)。テスト32+build緑。ユーザー判断で即本番。

### ✅ 2026-06-29 共同編集の重さA根治 + メモURLリンク化#1 + /stgy(PS5リモプ貼付) — 本番デプロイ済・実機OK
- **✅ 2026-06-29 本番デプロイ済**: ①**共同編集の重さA根治**(カーソル描画を CursorOverlay に隔離し Timeline をカーソルパケットで再描画させない・実機OK) ②**メモURLリンク化#1**(通常表示のみhttp(s)→新タブ・SDD+opus最終Ready=Yes)。**🆕PS5リモプ貼り付けアシスト(/stgy)=✅本番デプロイ済(2026-06-29)。スマホ専用1画面・コード分割コピー。デザインはApple iOS純正風(専用`src/styles/stgy.css`・LoPo本体トンマナ/ダークライトと独立・SF/ヒラギノ・iOSブルー・グループ化カード・自前iOS風トースト)。スクロールは通常縦スクロール(min-height:100dvh+body背景iOS化。固定100dvh内部スクロールはキーボードで段差が出るため廃止)。入口=軽減⋯メニュー(別タブ)+LP「ユーティリティ」枠(03カード+右上ナビ・当面は直接/stgy)。実機OK。ゲーム内プレビューは符号非公開で不可。次=スプシ取込スマホ本格対応(作業順#3)**。

### ✅ 2026-06-26 有名スプシ取込: パーティ割当を独立ステップ化(デッドエンド解消) — 本番デプロイ済・ユーザー実機OK
有名スプシ(行列形式)で複数フェーズ(P1〜P5)を貼って最後に作成しようとすると、割当UIが「表示中の貼り付け表の列ヘッダー」内にしか無いのに「フェーズを追加」で表示がクリアされるため、**最後に割当する手段が消えて詰む**致命的デッドエンドを解消。spec/plan=`docs/superpowers/{specs,plans}/2026-06-26-spreadsheet-party-assignment-step*`。main fast-forward(65d28ec0→`39f0be6e`・実装7コミット `017f93ed..39f0be6e`)→push→Vercel本番自動デプロイ。
- **設計=取込モーダルを2→3ステップ化**(1=コンテンツ選択 / 2=表を貼る / 3=パーティ割当)。割当は貼り付け状態と無関係に常に開けるので詰まない。**スコープ=有名スプシ(matrix)経路のみ**。自作スプシ(grid)は単一ブロックで列が常時表示=この詰みは起きないため現状維持(枠セレクタは`source==='grid'`限定)。
- **自動仮割当=既存`resolveImportParty`を再利用+拡張**(ハードコーディング無し)。Task1で**タンクcanonical順(ナイト→戦士→暗黒→ガンブレでMT/ST)・ヒラPH/BH(白/占→H1・学/賢→H2)**を新規追加(DPSサブロール順は既存)。`seedAssignment`(Task2)が検出ジョブを空き枠に自動充填しつつ**手動編集は保持**(prune→保持→空き埋め)。フル8人でも無操作で「作成」に到達可。
- **メモ③対応**: 「戻る」はデータ保持・「やり直す(クリア)」ボタン新設(モーダル閉じ直し不要)。
- **実装=SDD 4タスク(各TDD+2段レビュー)**: T1 resolveImportParty全ロール一般化+`dpsOrder.ts`にTANK_ORDER/HEALER_PURE/HEALER_BARRIER追加 / T2 `seedAssignment`純関数 / T3 i18n5キー×4言語 / T4 モーダル3ステップ化(PartyAssignmentStep新設・footer分岐・自動シード配線・matrix枠セレクタ撤去・クリア)。
- **最終レビュー(opus whole-branch)=Ready to merge: Yes**(Critical/Importantゼロ・デッドエンド解消/grid非破壊/共有関数の created-data非回帰[partyOverride常時付与]/seedAssignment純粋性 全確認)。`npm run build`(tsc厳密)OK・関連テスト全緑(partyAssignment20/モーダル46/resolveImportParty7/buildPlanFromSheets18/gridRowsFromResult19/i18n parity)・既知5fail(TopBar4+HousingWorkspace1)のみ。
- **実機検証(ユーザー)**: 有名スプシでP1〜P5追加→ステップ3で8枠自動充足→無操作で作成OK・枠入替/戻る保持/やり直し/grid回帰 確認。

### ✅ 2026-06-24 取込v2③ 攻撃の対象(MT/ST)テンプレ引き継ぎ + 管理ツールバーsticky化 — 本番デプロイ済・ユーザー実機OK
取込フローv2 本番前ブラッシュアップ③。取込先コンテンツに管理者テンプレが在るとき、スプシ取込の攻撃名→テンプレ技を照合し**対象(AoE/MT/ST)だけ**を引き継ぐ。spec/plan=`docs/superpowers/{specs,plans}/2026-06-23-import-target-carryover*`。main fast-forward(fe12ff6b→`746476ba`・コード6コミット `276ff4f4..746476ba`)→push→Vercel本番自動デプロイ。ロールバック=該当コミット revert。
- **確定方針=精度優先**: マッチは正規化(括弧除去/NFKC/空白除去)後の完全一致＋管理登録のスプシ別名のみ。**編集距離の曖昧一致はやらない**(対象の誤付け=タンバスMT/ST誤誘導が有害)。引き継ぐのは `target` のみ・既存targetは上書きしない・非破壊。テンプレ無/contentId null/fetch失敗/未マッチ/等距離衝突=何もしない(取込は止めない)。管理と取込は**同一関数**で照合(DRY=管理で見た結果=本番結果)。
- **実装=SDD 4タスク(各TDD+2段レビュー)**: T1 純粋モジュール`carryOverTargets.ts`(normalize/find/resolve/apply/report)+`TimelineEvent.sheetAliases?: string[]`+`stripParenthetical` export化 / T2 `applyTemplateTargets.ts`(getTemplate→補完)+`SpreadsheetImportModal.handleConfirm`配線 / T3 TemplateEditor「スプシ表記」列(`updateCell` case+i18n4言語) / T4「対象マッチ確認」モーダル(`parseMitigationSheet`→`buildSheetMatchReport`・i18n9キー×4言語)。fix=④ESC閉じで入力/結果リセット(`99b9998d`) / 空攻撃名がテンプレ空名イベントに誤マッチする経路を遮断+回帰テスト(`3bb7bfd1`・精度優先)。
- **最終レビュー(opus whole-branch)=Ready to merge: Yes**(Critical/Importantゼロ・DRY/非破壊/上書きなし/失敗握り/後方互換 全確認)。`npm run build`(tsc厳密)OK・`npx vitest run`=2125 passed/5既知fail(TopBar4+HousingWorkspace1のみ)。
- **管理ツールバーsticky化(同梱・`746476ba`)**: テンプレ編集ツールバーを本文スクロール上端にsticky固定+旧フッターの保存/元に戻すをツールバー右端へ一本化(下フッター廃止)。長い表でも保存が常に届く。実機(dev:admin)でsticky維持/行マスク/BulkEditPopover非クリップ確認。設計=brainstormingでA案(全部固定+保存一本化)承認。
- **実機検証**: ①管理=「スプシ表記」列表示・別名保存OK / ②ユーザー=テンプレ有取込で対象が概ね入る・誤マッチなし(③マッチ確認モーダル・テンプレ無し挙動は本番で最終確認)。**後追い(任意)**=carryOverTargetsのname.jaのみマッチにコメント明記 / matched_no_targetの等距離衝突細分。

### ✅ 2026-06-23 取込フロー v2前半 + ①取込モーダル誘導型ウィザード化 — 本番デプロイ済・ユーザー実機OK
取込フローv2前半(満杯時削除取込ゲート/コンテンツ選択前段化/誤紐付け根治の2バグ修正)+本番前ブラッシュアップ①(取込モーダルを誘導型ウィザード化)。main fast-forward(a61f9f7c→`50c64d7d`・27コミット)→push→Vercel本番デプロイ。
- **v2前半**: `contentSelection.ts`(NewPlanModalと共通化)/`importWithLimitCheck.ts`(満杯ゲート=既存`LimitResolutionSheet`流用)/`LimitResolutionSheet`マウントをLayout一元化/取込モーダルにコンテンツ選択UI+onImport async/Timeline配線(誤紐付け根治)。最終レビューCritical(満杯解消後にshare取込storeのstatus汚染で空ShareImportSheetが幽霊化)→fix `47d1aa54`(shareWasIdleガード+回帰テスト2)。実機2バグ(picker未プリセレクト/再選択巻戻り)→fix(`resolveInitialSelection`でcontentId優先復元/初期化effectを「開いた瞬間のみ」dep[isOpen]+refに限定)→実機OK。spec/plan=`docs/superpowers/{specs,plans}/2026-06-23-import-flow-v2-phase1*`。
- **①誘導型ウィザード**: 1画面1ステップ化(軽減も&ジョブ検出=4step/他=3step: 設定→貼付ループ→パーティ※条件付き→確認)。貼り方ガイド常時表示(A1クリック→Ctrl+A→Ctrl+C→下枠Ctrl+V)/フェーズ名任意(空→`Phase N`実体化・`buildPlanFromSheets.ts:46`が`s.phaseName`直使用のため必須)/黄(未追加)赤(未割当)ゲート移植/i18n4言語。**核心=機能ロジック不変のpresentation刷新**: 再選択バグ修正の2 useEffect(初期選択復元dep[isOpen]+ref/`[detectedJobIds]`でassignmentリセット)・全useMemo・全ハンドラをbyte-identicalに保持(opusレビューで実ファイル照合)。新規モジュール`importWizard.ts`(純粋遷移+`resolvePhaseName`)。SDD4タスク各TDD+レビュー、最終全体レビュー(opus)=Critical/Importantゼロ。tsc0/build成功/新規32緑(全vitest既知失敗5のみ)。spec/plan=`docs/superpowers/{specs,plans}/2026-06-23-import-guided-wizard*`。ロールバック=該当コミットrevert。**後追い(別タスク)**=③攻撃対象(MT/ST)未着手 / step4で`no_phases`時の理由非表示(旧来同挙動) / skipped表示のamber直値→app-amberトークン化 / 攻撃名見切れマーキー(event-or-attack spec§5)。

### ✅ 2026-06-23 ⑦敵攻撃 "or"(2択攻撃) — 本番デプロイ済・ユーザー実機確認OK
機能アイデア⑦。1つのボス技が状況で2択に分岐するケースを `TimelineEvent.altName: LocalizedString` で「A or B」表示。**名前だけ変わる(ダメージ同じ)確定モデル**。手動編集(EventForm)+管理(TemplateEditor)+描画(TimelineRow)を整備。spec/plan=`docs/superpowers/{specs,plans}/2026-06-22-event-or-attack*`。
- **実装=6タスクTDD**: ①`altName`型追加+名前整形純関数`formatEventName`(A or B連結・最大2択) ②i18n `event.or_connector`/`alt_name_*`+管理 altname ヘッダ4言語(パリティテスト付き) ③TimelineRow が `formatEventName` 経由描画 ④EventForm の or(別名)入力(全空なら altName 無しで保存) ⑤管理TemplateEditor に or技名4列+`updateCell` が `altName.xx` 処理 ⑥`formatEventName` デッドコード三項除去(レビュー指摘)。
- **追加UX/整理**: EventForm の or 欄を攻撃名直下に密着配置+説明サブラベル / **カンペ(PipView)除外**=挑発・エーテルフロー・ドロー系・アーサリースター(`cheatSheetFilters.ts` に共有ヘルパー統一) / **未使用 `CheatSheetView.tsx`(546行)を dead code として削除**。
- **検証**: `npm run build`(tsc -b 型/未使用クリーン)+full suite **2039 passed**(既知failure5=TopBar4/HousingWorkspace1 のみ・⑦と無関係)。main へ fast-forward マージ(02471ca5→6471e816・13コミット)→push→Vercel本番デプロイ。ロールバックは該当コミット revert。**後追い(別タスク)**=スプシ action「A or B」自動分割→altName(§4) / 攻撃名見切れマーキー(§5)。

### ✅ 2026-06-23 スプシ取込バグ修正一式(Bug① collab no-op / Bug② 末尾フェーズ黙殺 / 作成不可理由の明示) — 本番デプロイ済・ユーザー検証OK
ユーザー報告(1回目だけ壊れ2回目で直る/後半欠け/フェーズ時間ずれ/末尾に空フェーズ要)を systematic-debugging + 多エージェント敵対検証4体で調査し**根本原因2つを特定**。反証=非collabのフェーズ境界/後半落ち/描画clipは repro で犯人でないと実証。
- **Bug①(collab no-op)**: collab-ON 表のオーナーが**開いた瞬間に自動接続**(`reconcileCollabForPlan` の connect)→`_collabActive=true`。その状態で取込すると `loadSnapshot` が `useMitigationStore.ts:656` のガードで **no-op** → `handleSheetImport` が `getSnapshot()` で「取込データ」でなく**「直前に開いていた表」**を読み、新プランがそれで作られる(取込直後 disconnect で `_collabActive=false`→2回目は効く=「2回目で直る」)。**ソロでは出ない**。修正=取込コミットを `commitImportedPlan.ts` に切出し、NewPlanModal同様「**先に disconnect→保存→loadSnapshot→確定**」。防御=disconnect でフラグが残る異常系でも `exitCollabMode` で確実に解除(データ正確性を session teardown の成否に依存させない/フラグ注入だけでローカル検証可能に)。TDD4観点緑。main `994b9111`・ユーザー本番検証OK。[[reference_commitnewplan_loadsnapshot_contract]]
- **Bug②(draft黙殺)**: モーダルで最後の貼付を「フェーズ追加」せず確定すると末尾フェーズが黙って捨てられていた(`handleConfirm` が `entries` のみ参照)。A案=**貼り付け欄に未追加の内容が残る間は「作成」不可+警告**で取りこぼしを原理的に防止。文言「次の→このフェーズを追加」「追加済みフェーズ」見出し。
- **作成不可理由の明示(ユーザー指摘)**: ボタンが灰色の理由がスクロール先でしか分からなかった→押せない理由を1つ返す純関数 `importBlockReason` でフッターに出し分け(未追加draft=黄/**パーティ未割当=赤**(上のパーティ編成へ誘導)/フェーズ無し)。`canConfirmImport` は importBlockReason に統合し削除(DRY)。文言4言語。main `ca98bd32`。
- **検証**: 各TDD(RED→GREEN)+build(tsc -b)クリーン+フルスイート既知5失敗のみ(回帰0)。実機Playwright(dev)で「貼りっぱなし=作成不可+黄警告/追加=作成可」「パーティ未割当=赤警告+作成不可/全割当=作成可」をスクショ確認(`C:\Users\masay\AppData\Local\Temp\sheetcheck\pw_bug2_*.png`/`pw_party_*.png`)。spec/plan=`docs/superpowers/{specs,plans}/2026-06-23-sheet-import-no-silent-phase-drop*`、調査記録=`docs/.private/2026-06-23-spreadsheet-import-issues.md`。**後追い(v2 brainstorming)**=5/5選択削除取込/途中取込/コンテンツ選択前段。

### ✅ 2026-06-21 人気スプシ軽減表 取り込み機能 — 本番投入(忠実性 徹底チェック+根治済)
機能アイデア⑥。人気スプレッドシート軽減表(タイムライン+軽減割当+パーティ)を貼り付け→自動マッピング→確認→新規軽減表に反映。SDD全6タスク完了後、**実データ全5タブ(P1ケフカ〜P5混沌ケフカ)の取り込み忠実性を徹底チェック**して根治→merge `c52463ca`(--no-ff)→push→Vercel本番デプロイ success(lopoly.app 200)。
- **検証手法**: 実スプシ各タブTSVを temp(公開リポ非コミット)に取得→`parseMitigationSheet`→`buildPlanFromSheets` に通し**全列のTRUE-runと配置を1:1突合**するハーネス + **多エージェント敵対監査4体**(配置/イベント・フェーズ/解決・枠/rising-edge破壊役)で独立検証。実機Playwright(dev5173・全5タブ貼付)で **技521/軽減218/パーティ8/入らなかった技1** がオフライン計算と完全一致、junk無し、プラン作成・描画OK。
- **根治6件**: ①連続TRUEの畳み込みを duration基準→**rising-edge**(run先頭1配置)。効果終端の幽霊配置を根治(ニュートラルセクト/パッセージ/マントラ等で軽減 231→218)。最大run span 29s<全mit recast で under-count 反例ゼロを実証。 ②P2-P5先頭の**タイトル行(Phase列=TRUE/FALSE)を除外**(junkイベント"P2_ゴッドケフカ"等4件+ゼロ幅'TRUE'フェーズ4件を除去)。 ③フェーズを**シート単位で塊化→開始時刻順**(境界Total Time重なりの女神↔開幕ピンポンを解消・35→23)。 ④**全滅技(Hit=9,999,999)を enrage 化**し数値を出さない(イベントは残す・6件:裁きの光×3/メテオ/バウル/ミッシング・ゼロ)。 ⑤モーダルの**フェーズチップを実配置数表示**に(旧=生TRUEセル数で誤解)。 ⑥**版違いスキル(reprisal/feint/addle)のLv100版解決を回帰テストで固定**(配列順依存の退行検出)。
- **触ったファイル(本セッション)**: `src/lib/sheetImport/{buildPlanFromSheets,parseMitigationSheet,types}.ts`+各test / `resolveSheetSkill.test.ts`(版違い回帰) / `src/components/SpreadsheetImportModal.tsx`(チップ)。**非介入**=FFLogs/`importTimelineEvents`/`importModes`(branch全体でgrep確認済)。build/tsc/35テスト緑・full suite 1995 passed(既存failure5のみ)。
- **ユーザー判断結果**: モーダル確定ボタン=モノクロのまま承認 / 全滅技=enrage扱い(イベント残す) / **5/5上限の破壊チューザー(置換/削除UI)は後追い**(現状は上限時 安全停止トースト)。spec/plan=`docs/superpowers/{specs,plans}/2026-06-21-spreadsheet-import*`。ロールバック=`git revert c52463ca`。

### ✅ 2026-06-21 管理画面FFLogsタイムライン取り込み(置き換え/追記) — 本番デプロイ済・ユーザー実機確認OK(ボタン色承認+両取り込み動作)
機能アイデア⑤の管理画面版。管理者がFFLogsレポートURLからテンプレのボス技タイムラインを直接取り込めるモーダルを新設(これまでは「ユーザー側で取り込み→共有URL→プランから昇格」の手数が必要だった)。**置き換え/追記の2モード**(空テンプレ時は選択肢なしで一発)。ワイプログで前半→クリアログで後半フェーズを足す「途中から追加」を管理画面でも可能に。
- **設計の核=既存ユーザー側(軽減表編集)の取り込みを1ミリも壊さない**: 共通化したのは「URL解析(`parseFflogsUrl`)」と「取得シーケンス(`fetchAndMapFflogs`)」の2点のみ。ストア`importTimelineEvents`は**物理的に非介入**。取得の不変条件(Promise.all 5本の順序/translateフラグ/`mapFFLogsToTimeline`引数順=日英取り違えが無言で起きる最危険点)を**逐語移植+テストで固定**。テンプレ用フェーズ追記は独立純粋関数`resolveTemplatePhaseAppend`(ストアPhase型と非互換のため共通化せず別実装)。
- **実装=subagent-driven 5タスクTDD**: ①parseFflogsUrl抽出(7/7) ②fetchAndMapFflogs抽出(6/6) ③resolveTemplatePhaseAppend(6/6) ④管理画面モーダル`FflogsTimelineImportModal`+i18n 4言語(`admin.tpl_fflogs_import_*` 16キー×ja/en/ko/zh) ⑤AdminTemplates配線+ツールバー「FFLogs取り込み」ボタン(紫翻訳ボタンの右・sky色・承認済)。各タスク+全ブランチ最終レビュー(opus)=Ready to merge=Yes・Critical/Important 0。`tsc -b --force`(app/api)/full suite 1960 passed(既存failure5のみ)/回帰ゲート3本(importModes/useMitigationStore.importModes/collab)無改変緑。
- **触ったファイル**: 新規=`src/lib/fflogs/{parseFflogsUrl,fetchAndMapFflogs}.ts`+test / `src/utils/templateImportPhases.ts`+test / `src/components/admin/FflogsTimelineImportModal.tsx`。改変=`FFLogsImportModal.tsx`(共通関数呼び出しへ差し替え・挙動不変) / `admin/{AdminTemplates,TemplateEditorToolbar}.tsx` / `locales/{ja,en,ko,zh}.json`。**非介入**=`useMitigationStore.ts`/`importModes.ts`(読み取りのみ)。
- merge `2786a292`(--no-ff)→push `1713a974`。spec/plan=`docs/superpowers/{specs,plans}/2026-06-20-admin-fflogs-import*`。ロールバック=`git revert 2786a292`。**スコープ外(別タスク)**=①スプシ軽減表のタイムライン読込 / Phase1.5再アンカー / 管理画面取り込みのレート制限。

---

## 完了 (2026-06-20 TODO 整頓で移動 — 進捗同期 / データ破壊復旧 / 警告矢印 / 管理画面 / スマホ最適化 / Cloudflare / バグ根治 ほか)

> TODO.md の「現在の状態」肥大化解消のため詳細を移動 (2026-06-20)。本番デプロイ済 or 検証済の大項目。開いている実機確認/pending は TODO.md に 1〜数行で残置。

### ✅ 2026-06-20 共同編集中の進捗同期(Plan2) + 他参加者打点トースト — 本番公開・2タブ実機OK
進捗の打点を memos と同じ Yjs コレクション同期レーン(`progressPoints`)に載せ、collab 中は**全員ぶんを匿名 union**で同期・永続化(Firestore はネスト `data.progress.*`)。スカラー(cleared/活動日数/時間)は planMeta(LWW)。打点に固定 id 付与で同時記録の事故防止。設計=匿名 union(A案)・「誰の進捗を正に」論点を消した。設計/計画=specs・plans/2026-06-19-collab-progress-sync。
- **多エージェント敵対監査(3観点並列)が Critical 2件検出→根治**: ①setMeta が進捗 meta キー未マッピングで `schAetherflowPatterns`(表の学者自動配置データ)を破損(`metaKeyForField` 抽出で根治) ②旧形式(id 欠落)進捗点が collab seed の `dedupeById` で消滅(api `decideLoadFull` で id backfill + store 防御)。両方 TDD 修正+再レビュー済。**進捗操作が表データを参照ごと一切変えないことを回帰テストで永久ロック**(`toBe`)。データ安全=各タスクレビュー+opus 最終+敵対監査+修正再レビュー+非collab保存経路の自己検証(Layout.tsx:307 collab 中 Firestore 抑制)。main `17cee31`/worker `lopo-collab` 再デプロイ。
- **他参加者打点トースト**(main `870cc1a5`・クライアントのみ): 他参加者(Yjs origin≠'local')が初期同期後(entered)に新しい点を追加したときだけ既存トーストを自タブにも表示。純粋関数 `newlyAddedRemotePoint`+`showRemoteToast`(トーストのみ・データ非書込)。レビュー Approved・2タブ実機OK。
- **defer Minor(データ消失経路なし)**: insertProgressPointAt の collab 非委譲=削除Undoが collab で一過性(設計上対象外) / collab 中の空 note 削除が非対称(飾り) / UndoLastPointButton の null 防御 / 旧 SDD 繰越(pending Undo クリア等)。**スマホ記録対応は別タスク**(TODO に残置)。

### ✅ 2026-06-16 データ破壊バグ 緊急対応 — 根治2件デプロイ済 + PITR復旧完了・PITRオフ済
**根治2件 (main eb1e49b)**: ①非collab=保存先を持ち主(`_loadedPlanId`)に固定(`persistWorkingStore`/`commitNewPlan`)で他プラン破壊を根治(455cc20/23eb334/5e18a33) ②collab=create 冒頭で `useCollabSessionStore.disconnect()` してから初期化(別部屋への委譲全消しを根治・collabCreateGuard.test.ts)。
**PITR切り分け＆復旧**: PITR 一時ON(earliestVersionTime=06-16 04:44 UTC)。正しい過去読み=read-only tx+readTime(memory `reference_firestore_pitr_disabled`)。新規スクリプト probe-pitr-timeline/sweep-pitr-losses/restore-from-pitr/set-pitr.ts。固定 plan_31aee72d=197軽減を一発全消し→PITR直前版(v459)で完全復旧✅(backup=docs/.private/backups/)。UMAD×2 は境界前空化+兄弟無し→復元不能(本人再構築)。全件スイープで境界後新規被害=残0。後始末済=PITRオフ/recovery-0608 削除。**フォロー(機能)は TODO に残置=自己対処できる管理画面**。

### ✅ 2026-06-17 軽減競合の双方向警告+画面外ガイド矢印 — main マージ&本番デプロイ済・実機確認OK (2026-06-20 ユーザー確認)
機能アイデア③。同じ軽減の CD 被りを `findSameSkillCdConflicts`(resourceTracker)で常に派生検出→競合アイコン黄色脈動(`animate-conflict-pulse`)。前方向も赤の見た目のままクリック解放(`conflictOverride`)。ドラッグも競合位置へ許可(`ALLOW_DRAG_INTO_CONFLICT=true`)。画面外なら列中央上端∧/下端∨にシェブロン矢印(`ConflictOffscreenArrows`)+クリック自動スクロール(PCのみ)。「置いた時は既存の相手だけ光る」=`lastPlacedMitigationId`(セッションのみ)。dev 列幅スライダー撤去。設計=specs/2026-06-17-mitigation-conflict-bidirectional-warning-design.md。全48競合テスト+build緑。

### ✅ 2026-06-17 管理画面リデザイン 全18ルート + 2026-06-16 サンドボックス (branch `feat/mobile-bottom-nav-redesign`・未push・要実機は TODO 残置)
共通シェル `AdminPage`(固定ヘッダー=ページ名+件数+主要操作 / 本文だけスクロール=A案)へ全14ナビページ移行+ウィザード4本を外側スクロール容器化。管理画面のみフォント M PLUS 1(`[data-admin-page]`スコープ・本体不変)。AdminLayout main を `overflow-hidden flex-col` 化。設計=specs/2026-06-17-admin-redesign-design.md。フォロー(低)=AdminStats/AdminSkills の見出し直書き(i18n 負債)/サンドボックス data 系 fixtures 未整備。
**サンドボックス**=管理画面をデプロイ/ログイン無し・本番非接触でローカル確認(`npm run dev:admin`→`/admin/templates` 60件ダミー)。本番ビルドは dead-code 除去で開発コード0。実装=`src/dev/sandboxMode.ts`+`src/dev/adminSandbox/`、本体改変3箇所は全て `import.meta.env.DEV && isAdminSandbox()` ガード。memory `reference_admin_sandbox`。

### ✅ 2026-06-16 バグ修正3件 (branch `feat/mobile-bottom-nav-redesign`)
- **軽減追加モーダルでチャージ技のリキャストが出ない**: 真因=`validateMitigationPlacement`(resourceTracker.ts)のチャージ分岐が早期return+実効1チャージで文言ゼロ。A案=`getTimeUntilNextCharge` で次チャージ秒算出→effMax=1 は通常「CD残○○s」/effMax≥2 はバッジ+回復中「次チャージ○○s」。i18n `next_charge_in` 4言語。chargeLevelGate.test.ts +4=11緑。実機確認はユーザー。
- **リキャスト行(ヘッダー)クロックが配置直後に出ない**: 真因=`syncRecastRow` の deps に `timelineMitigations` 無し→新規配置が `--cd-display:none` のまま。修正=useCallback 抽出し `timelineMitigations` 変化で即再同期。recastRow.test.ts にチャージ技ケース追加。
- **スマホ通知モーダルがメニューシート裏に隠れて既読不可**: `SystemNotificationModal` z `z-[100]`→`z-[9999]`。Playwright で前面+既読可動確認。

### ✅ 2026-06-15〜16 スマホ最適化A(ボトムナビ)+共有タブB+追加修正 — 本番反映済 (残=本番スマホ総点検は TODO 残置)
ナビ5タブ化(メニュー/インポート/カンペ/共有/ログイン)・Undo/Redo常設・パーティ/自動ボタンのメニュー集約・MY JOB ハイライトトグル・☕支援可視化(MobileBottomSheet `fillContent`)・共有タブ(`useShareFlow` 1ソース化・PCミラー)。スキルデータ=チャージのレベルゲート(`chargeMinLevel:88`)+学者「深謀遠慮」追加(seed済)。「共同編集2択が出ない」=バグ無し(未ログインはコピー直行が設計通り)。設計=specs/2026-06-15-mobile-optimization-design.md・2026-06-16-mobile-share-tab-design.md。

### ✅ 2026-06-12 Cloudflare 前段化 本番稼働中
apex `lopoly.app` を orange 化・静的のみ Cache Rule・全検証緑(SSL Full strict / CF-RAY / /assets・manifest は MISS→HIT / /api・/sw.js は DYNAMIC 素通し)。原因=急増×PWA で1訪問十数個の静的リクエスト。詳細=docs/.private/2026-06-12-cloudflare-fronting-handoff.md + memory `project_cloudflare_caching_priority`。

### ✅ 2026-06-03 同期安定化 Step1+2+① デプロイ済 (残=Step3/GC cron は TODO 残置)
業界水準ソフトデリート(墓標)+墓標ベースマージ+同期インテント永続化を TDD で実装・本番投入。「別端末で消失/削除→復活/リロードで一瞬復活」を根治。新規 `src/lib/mergePlans.ts`・`src/store/planPersist.ts`、`planService.ts`/`usePlanStore.ts` 改修。詳細=docs/.private/2026-06-03-realtime-collab-and-sync-notes.md Phase5+6。

### ✅ 2026-06-18 表の情報列固定(PC横スクロール) 機能をまるごと撤回・起点8fbc78dへ復元
ユーザー判断=リスク過多で撤回。理由=sticky 固定は containing block 内でしか踏ん張れず窓を狭めるとドリフト残る根本弱点。完全解消は sheetWidth と固定機構を分離する2パネル化(高リスク)が必要で価値に見合わず。撤去footprint=Timeline.tsx/TimelineRow.tsx/Timeline.layoutHooks.ts/index.css/collab/cursor.css を 8fbc78d へ復元 + TimelineInfoColumns.tsx/timelineFrozenInfo.test.tsx 削除。検証=src/が8fbc78dと差分0/build EXIT=0/vitest 1803緑/Playwright 実機OK。

### ✅ 2026-06-12 データ破壊バグ「キャッシュ全消し desync で空が非空を上書き」根治 (branch `feat/collab-yjs-binary-persistence`)
根因=plan.data と mitigation-storage の二重 localStorage が desync + 書込/読込ガードの非対称。修正=①空上書きガード(`updatePlan` で非空を空で上書きしない=`src/lib/isEmptyPlanData.ts`) + ②起動時ブートストラップ(`src/lib/bootstrapMitigation.ts`・Layout マウントで desync 検出時に plan.data を miti へ復元)。TDD 17緑/全1653緑。墓標06-10の129軽減を `scripts/restore-fixed-plan.ts` で復元済。

## 完了 (2026-06-08〜15 共同編集 一般公開 / Cloudflare 前段化 / タイムライン種別・スキル棚卸し / コピーUI / タンクスイッチ / 通知ベル)

> TODO.md の「現在の状態」肥大化解消のため移動 (2026-06-15)。本番デプロイ済の大項目。pending サニティは TODO.md に 1 行で残置。

## 完了 (2026-06-18 共同編集中の Undo/Redo ②-c・per-user CRDT undo・本番デプロイ&実機確認済)

**機能**: 「共同編集中は Undo/Redo が効かない(オーナーも参加者も)」を `Y.UndoManager` の per-user undo で解消。`trackedOrigins:['local']` で自分の編集だけ逆操作(リモートは origin=provider オブジェクトで構造上捕捉不可)。scope=solo 履歴と同じ5型。store の undo/redo は collab 中 handlers 経由で UndoManager へ委譲(set 外で呼ぶ=入れ子 set 回避)、ボタン活性は `_collabCanUndo/Redo` フラグ連動。新規=`src/lib/collab/planUndoManager.ts`+`collabUndoIntegration.test.ts`。コミット 55c1a51〜3bb4151。設計=specs/2026-06-17-collab-undo-redo-design.md。

**🛡 MAX effort/Ultracode で3回の多エージェント敵対監査(計48ag)→データ消失4経路を根治**:
- ①reseed が undo スタックに乗り復帰直後 Ctrl+Z で復元データ消失 → onSynced の reseed 直後に `planUndo.clear()`(31cce89)
- ②undo/redo が `set()` 内 handler 呼びで store↔Y.Doc **恒久 desync** → 確立パターン(get()判定→set外でhandler→早期return)へ(71c6797)
- ③enter/exitCollabMode が `_history` 残留→revoke/disconnect 後 Ctrl+Z で入室前へ巻き戻り **Firestore 恒久上書き** → enter/exit で `_history/_future` クリア(71c6797)
- ④編集者ジョイナー(active&&readonly)の undo が委譲前に弾かれ no-op → ガードを `_collabReadonly && !_collabActive`(71c6797)
- ⑤no-op mock テストが desync 検出不能 → 実 Y.Doc+observeDeep 結線の統合回帰テスト(71c6797)
- ⑥**既存バグ**: confirmAetherflow/AstrologianDrawChain が collab 委譲を持たず次の observeDeep で消える → `upsertItems('timelineMitigations', chain)` 委譲(09efc66)
- ⑦テスト vmThreads flaky → afterEach(e9fa1ac)
- 最終検証=dataSafe=TRUE/新規Critical・Importantゼロ/全体1803 pass(既知housing5のみ)/build EXIT0。

**実機2タブ確認OK (2026-06-18 本番・捨てプラン)**: per-user/退出後巻き戻し無し+再読込でデータ生存/全消しUndo/SCH・AST連鎖同期。検証中の「片側だけ旧挙動」は2タブが別バージョン(片方未リロード)が原因と判明(memory `reference_collab_two_client_version_skew`)。

**関連で発見した別件(未修正・先送り)**: 共同編集 再接続時の「一部欠け」データ消失(near-term backlog)→ [.private/2026-06-18-collab-reconnect-partial-loss.md](./.private/2026-06-18-collab-reconnect-partial-loss.md)。編集者ジョイナーで手動ドロー時に連鎖プロンプト非表示(軽微・データ影響なし)。

## 完了 (2026-06-17〜18 軽減競合 双方向警告 / 情報列固定 撤回)

> TODO.md 「現在の状態」整理で移動 (2026-06-18)。本番デプロイ済 or 撤回確定の大項目。

- **✅ 軽減競合の双方向警告+画面外ガイド矢印 完成・本番デプロイ&実機確認済 (2026-06-17)**: 機能アイデア③。同じ軽減のCD被りを `findSameSkillCdConflicts`(resourceTracker)で常に派生検出→競合アイコンを黄色脈動(`animate-conflict-pulse`)。前方向(既存CD中に重ねる)も赤の見た目のままクリック解放(`conflictOverride`)。ドラッグも競合位置へ許可(`ALLOW_DRAG_INTO_CONFLICT=true`・false で旧ブロック復活)。競合相手が画面外なら列中央 上端∧/下端∨ にシェブロン矢印(`ConflictOffscreenArrows`)+クリックで自動スクロール(PCのみ)。「置いた時は既存の相手だけ光る」=`lastPlacedMitigationId`(セッションのみ)。dev列幅スライダー撤去。設計=specs/2026-06-17-mitigation-conflict-bidirectional-warning-design.md / 計画=plans/同名。全48競合テスト+build緑。
- **✅ 表の情報列固定(PC横スクロール) 機能をまるごと撤回 (2026-06-18・origin/main `10165c0` revert・デプロイ済・実機検証OK)**: ユーザー判断=リスク過多で撤回。sticky固定は containing block(clientWidth)内でしか踏ん張れず、窓を狭めるとドリフトが残る根本弱点。完全解消には sheetWidth と固定機構の分離(2パネル化=メモ/カーソル座標系の再構築・高リスク)が必要で価値に見合わず。撤去footprint=Timeline.tsx/TimelineRow.tsx/Timeline.layoutHooks.ts/index.css/collab/cursor.css を 8fbc78d へ復元 + TimelineInfoColumns.tsx/timelineFrozenInfo.test.tsx 削除。検証=src/が8fbc78dと差分0/build EXIT=0/vitest 1803緑(既知housing5のみ赤)/Playwright実機=固定ペイン消滅・横スクロール正常。**再着手しない方針**(再挑戦なら sheetWidth と固定機構の分離=B案が前提)。

- **タンクスイッチ(挑発スキル) 本番デプロイ済・実機OK (2026-06-15)**: 挑発を置くと同一フェーズ内・以降の攻撃の on対象 MT⇄ST を反転(derived/非破壊)。中核=純粋関数 `getEffectiveTarget`(TDD 10緑)+全計算/表示サイト適用(Timeline/CheatSheet/PC行/スマホ行)+recast30s通常スキル(`isTankSwap`・全タンク4ジョブ)+アイコン切替アニメ(framer-motion)+autoPlan除外。最終レビューで1件発見→修正(CheatSheet行表示/致死)。追従修正=duration:0でレーン重なり回避が効かない不具合(`ovDur=Math.max(1,duration)`)+表示順を無敵後・LB前へ。**ずれ防止手順を確立**=mockDataに`provoke_*`追加→デプロイ→seed-icons(差分のみUP)→seed-skills-stats(ADDITIVE・既存164無変更・挑発4のみ追加・dataVersion++で全ユーザー反映)。⚠順序=コードdeploy→seed(逆だと0値スキルが見える)。表示順ソートは静的`getMitigationPriority`経由のため並び替えは再seed不要。設計=specs/2026-06-15-tank-switch-provoke-design.md / 計画=plans/2026-06-15-tank-switch-provoke.md。
- **システム通知 視認性向上 本番デプロイ済・実機OK (2026-06-15)**: ①通知バーのベルに未読赤ドット(業界標準バッジ)②サイドバー折りたたみ時、ハンドル上に未読時のみベルボタン(`SystemNotificationHandleButton`・クリックでモーダル直接オープン・トグル誤発火防止)。縦位置は展開時バーと同じ高さ(`bottom-[78px]`、ハンドル列とコンテンツ列が同高の兄弟である性質を利用)。
- **タイムライン 種別クリックループ + デバフ軽減不可属性 (2026-06-15・main `6ef7bf9` push 済→Vercel自動デプロイ)**: ①種別アイコンをPCクリックで物理→魔法→ユニーク3循環(`PcTypeToggle`・対象トグルと同経路=collab/undo安全) ②イベントに `ignoresDebuffMitigation` フラグ=ONでデバフ系軽減(リプライザル/フェイント/アドル/ディスマントル=`Mitigation.appliesAsDebuff`)の**%軽減だけ**無効化(バリア/無敵/プレイヤーバフは効く・C案)。編集=モーダルchk、表示=種別アイコンを赤箱(PC/モバイル/カンペ・`DamageTypeIcon`統一)。計算3箇所(Timeline本体/EventForm逆算/CheatSheet)に`isMitigationBlockedByEvent`スキップ。TDD・全レビューAPPROVED・ローカル実機OK。**`appliesAsDebuff`はFirestore反映済(`add-applies-as-debuff.ts`外科同期29件)=デプロイ直後から本番で機能。** 追従修正: 赤枠が攻撃名を右に押す不具合(モバイル用md:hiddenがTooltip内側のみ→PCで空ラッパがgap)を根治 push済(`a7144f1`)。
- **スキルデータ棚卸し+seed安全化 (2026-06-15・同push)**: mockData↔Firestore差分を公式ジョブガイドで照合→**mockData6スキルを公式値に修正**(シェルトロン/ホーリーシェルトロンrecast5、インターベンション10、ハート64/ダクミ66/ホーリズム76、sheltronアイコン)。Firestoreは元々正しく書込不要。**`seed-skills-stats.ts`を既定ADDITIVE化**(既存skill上書き禁止・新規idのみ・`--force-overwrite`明示時のみ旧挙動・`--dry-run`有)=管理画面編集がseedで巻き戻る地雷を根治。ズレ確認=`inspect-skill-recast-diff.ts`。memory `feedback_skill_firestore_sync` 更新済。
- **タイムライン コピーUI ブラッシュアップ (2026-06-15・コミット `235c5ca`)**: コピーボタンを「左端absolute」→「on対象トグルの左」へ移動([TimelineRow.tsx](../src/components/TimelineRow.tsx) `PcCopyButton` 切り出し)。対象アイコン(on)は右端固定・対象なし(AoE)行はコピーが右端。非ホバー=w-0で攻撃名フル幅(省略減)/ホバー時のみw-8に開き重ならず収まる(150ms)。ユーザー実機確認「完璧」。build EXIT=0。
- **共同編集 一般公開 完了 (2026-06-14・branch `feat/collab-public-release`・main push 済・Worker ver 5a6762aa)**: admin gate を撤去し全ユーザーに開放（[ShareButtons.tsx](../src/components/ShareButtons.tsx) `!isAdmin`→`!user`＝編集ログイン必須/閲覧誰でも）+ 診断ログ撤去。公開前ブラッシュアップ全完了=①人数分ドット+awareness自己修復（resync要求で非対称欠落も「待つだけ」で収束・$0維持）②カーソルON/OFF英語状態トグル一本化+ON→アイコン選択導線③アイコンゲート化+オーナーヘッダーにもcompact PresenceControls。**🔒失効バグ根治（業界水準・サーバ強制）**=`/destroy`が永続失効フラグ+全接続close(4001)、`onConnect`が失効フラグで新規拒否、client は4001で再接続停止+「終了しました」表示。**データ安全（構造確認済）**=失効/destroy/GCは`plans`本体を書き換え/削除しない（CRDT+local-first+空上書きガード+破壊保存ガード+墓標勝ち+GCはcollabRoomsの失効docのみ）。collab136緑/worker14緑/build EXIT=0。**残=ユーザーの公開後サニティ（本番でログイン→共有→2ブラウザ→失効）→TODO.md に残置。** memory `project_realtime_collab_status` 参照。
- **(旧経緯) admin gate内デプロイ済の経緯**: collab全段は本番デプロイ済。Task8 第2弾=2ブラウザ実機E2Eで出た指摘を全部修正・デプロイ済(2026-06-13 PM)。#7 データ安全=再接続時に空のサーバ内容で手元を上書きしない・空の部屋には手元をid単位applyUpsertで再シード / #4 editorジョイナー編集不可を根治(ゲートを`_collabReadonly && !_collabActive`=純粋閲覧者のみブロック) / font戻し+横幅一致 / PresenceControls compact版 / #6 人数上限表示=reissueで旧部屋max引き継ぎ / #3d 人数=接続リスト由来(サーバ`getConnections()`由来`/count`を接続時+入退室時だけ取得=$0維持)。
- **Cloudflare 前段化 実施完了・本番稼働中 (2026-06-12 早朝)**: 2026-06-11〜12 ユーザー急増で Vercel 無料枠 Edge Requests 1M 振り切れ→暫定で Vercel Pro 化($20/月)・サイトは終始 UP。原因=急増 × PWA で1訪問十数個の静的リクエスト。根治=apex `lopoly.app` を Cloudflare orange 化+静的のみ Cache Rule。**全手順完了・全検証緑**(SSL Full strict / Rocket Loader OFF / Browser TTL=Respect headers / Bot Fight OFF / Cache Rules 2本[bypass-dynamic-shell + cache-static]/ CF-RAY出る・/assets MISS→HIT・manifest/registerSW HIT・/api と sw.js は DYNAMIC素通し)。Cloudflare はデータに無罪(Firestore 直通=別経路)。**残=数日 Vercel Edge Requests 実測→約33K/日以下を確認したら Pro($20)→Hobby に戻す→TODO.md に残置。** 詳細=[docs/.private/2026-06-12-cloudflare-fronting-handoff.md](./.private/2026-06-12-cloudflare-fronting-handoff.md) + memory `project_cloudflare_caching_priority`。
- **共同編集 列増殖 根治=本番デプロイ完了・実機+データ確認済 (2026-06-12 早朝)**: Yjsバイナリ永続化を全9タスクTDDで実装完了(subagent-driven)。Phase1=根治(機序固定テスト+DOストレージへバイナリチャンク永続化+onLoadバイナリ復元優先+flushSave二層保存)/Phase2=片付け(/destroy+revoke配線+GC cron)/Phase3=汚染データ修復スクリプト/Phase4=id一意の多層防御。真因=サーバ側 collab ワーカーの Yjs seed が複数の独立 doc を合流(`buildSeedDocFull` が onLoad ごとに `new Y.Doc()` を JSON から組み直す→y-partyserver onStart が DO 起動ごとに再 seed→旧 identity と合流→onSave が Firestore 全置換→雪だるま)。検証=root 1628緑/worker 57緑/build EXIT=0。branch 11コミットを main へ ff push `f543ef4`+ Worker再デプロイ ver 4dd5a608。2ブラウザで失効→再発行を反復しても partyMembers=8 維持=列増殖根治を実機+データ確認。follow-up=B-1 空上書きバグ根治+ B-2 閲覧者 read-only 多層防御も本番デプロイ済(f543ef4→7d733b3)。詳細=docs/.private/2026-06-11-collab-rollback-root-cause.md 第2版 + plans/2026-06-11-collab-yjs-binary-persistence.md。
- **共同編集=本番公開試行→重大バグ→ロールバック→プラン属性ライフサイクル再設計 (2026-06-11)**: collab を admin gate で本番公開試行→「別の表を開くと壊れが引き継がれる(横に列増殖)」発覚→即ロールバック。根本原因=collabライフサイクルがプラン非束縛(disconnectは revoke/reissue のみ・プラン切替/✕/離脱で切れず`_collabActive`残留)。再設計=collabを「プラン属性ON/OFF」化(スプレッドシート/Notion/Figma型)。被害=端末メモリのみ・リロードで直る・Firestore/localStorage無傷=データ破壊ゼロ。ブランチ`feat/collab-plan-attribute-lifecycle` で Task1-7 TDD完了+systematic-debugging で徹底検証(コミット cec103e/35dc08a/d2382a0/e014998/13f63c6/879a0ba/e438196)→main へ ff マージ済(HEAD e438196)。yjsバンドル分離(main 2,804→2,706KB)。
- **軽減表バグ3件修正 (2026-06-10・`feat/collab-stage4b2-live-cursors`→公開ブランチにマージ済)**: ①イベント編集でダメージ0上書き(初期化×再計算effect競合→lazy init+`computeInitialDamageState`純関数) ②ドラッグ後ツールチップ残留(setPointerCaptureでmouseleave不発→document pointerdownで強制消去) ③表展開/折畳でスクロール飛び(中央時刻記録→`reanchorScrollTop`でアンカー維持)。全TDD・build緑・テスト30緑。
- **Vercel デプロイ失敗ブロッカー=解決済・本番反映完了 (2026-06-08)**: 根因=Hobby の Node Serverless 12個上限(room.ts追加で13個)。修正=`api/collab/{load,save,room}.ts`→`index.ts`1関数統合+`vercel.json` rewriteで旧URL維持。Node 13→11個。push `2c74a3c`→`lopo-r0zqim9ke` Ready・本番スモーク全緑。⑤-1+⑤-2a 本番反映済(UI非露出で休眠)。詳細=[docs/.private/2026-06-08-vercel-deploy-blocker-handoff.md](./.private/2026-06-08-vercel-deploy-blocker-handoff.md)。

## 完了 (リアルタイム共同編集 段取り①〜⑤・④ 実装ログ — TODO.md から移動 2026-06-16)

> 共同編集は **2026-06-14 一般公開済み・本番稼働**。下記は完成までの段取り別実装ログ (歴史保存用)。現行の正典ステータスは memory `project_realtime_collab_status`。

- **リアルタイム共同編集 (✅段取り①=部屋+WS骨組み 本番デプロイ済→次は段取り②)**: 1軽減表を複数人同時編集。方式確定=**Yjs(CRDT)+Cloudflare Durable Objects (ライブラリは y-partyserver/partyserver。PartyKit CLI は買収され後継)**、カーソル=P2Pで$0、保存=Firestoreへ間引き書き戻し。**Workers無料プラン$0ハードストップ前提でコスト有界化**(編集8席/閲覧20/同時30/緊急停止)。**DOは無料枠要件でSQLite-backed (new_sqlite_classes) 必須**。設計書=[specs/2026-06-03-realtime-collab-design.md](./superpowers/specs/2026-06-03-realtime-collab-design.md) / 段取り①計画=[plans/2026-06-03-realtime-collab-step1-room-skeleton.md](./superpowers/plans/2026-06-03-realtime-collab-step1-room-skeleton.md)。**段取り①実装=`workers/collab/` (本体src/非干渉・別Worker)、本番=https://lopo-collab.masaya-maeno0106.workers.dev (空の部屋。本体未統合なのでユーザー影響ゼロ)、5テスト緑**。**✅段取り②-a 同期エンジン main マージ済(2026-06-04)=[plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md](./superpowers/plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md)**(設計書 [specs/...2a-design.md](./superpowers/specs/2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md) §9 改訂が正典)。**休眠状態=UI入口なし・collabProvider未import→本番bundle非混入・ユーザー影響ゼロ**。サーバ `Room`=`YServer`化+`hibernate:true`($0)+在室数`getConnections()`+index.tsで`x-partykit-room`フォールバック。実機確認済(本番node 2クライアントで同期/late-join/同時add両方残る + 2ブラウザで双方向ドラッグ同期)。クライアント=`src/lib/collab/`(変換+collabProvider:cascade込みhandlers+observeDeep)、store委譲分岐(yjs非依存)、Firestore自動保存抑制。⚠onLoad/onSave未実装=全員退室で揮発(③で恒久保存)。⚠usePlanStoreテストは複数同時実行でvmThreads汚染失敗(単独緑・②-a前から既存・無関係)。
- **✅段取り③(Firestore恒久保存)本番稼働(2026-06-04)=[plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md](./superpowers/plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md)**(設計書 [specs/...stage3...design.md](./superpowers/specs/2026-06-04-realtime-collab-stage3-firestore-persistence-design.md))。方式=**案B(DOはVercel受付係 `/api/collab/load`・`/api/collab/save` に委譲・共有シークレット認証・既存保存ロジック再利用)**。DO `onLoad`(seed)/`onSave`(debounce 5s/15s)/`onClose`(最後の退室でflush)+**破壊保存ガード**+**墓標ガード(削除が勝つ)**。seedはサーバー(onLoad)が正→client seed撤去。room鍵=plan IDのまま(分離は⑤)。テスト=純粋9+変換3+HTTP7+既存6 全緑・build緑。**✅Task10本番稼働=secret(Vercel prod sensitive+Cloudflare wrangler secret同値)+`wrangler deploy`済・本番スモーク全緑**(load正secret→200/誤→401・Yjs sync成立・onLoad空seed・破壊保存ガードphantom無)。⚠**踏んだ罠=api/相対importの`.js`拡張子漏れで本番500**(修正済・memory `reference_vercel_api_esm_js_extension`)。⚠**初回syncレイテンシ**(onLoad fetch待ち・⑤で「接続中」表示)。
- **段取り⑤(③の後)=共同編集の実入口 [設計書化済 2026-06-05・⑤を3分割]=[specs/2026-06-05-...stage5-collab-entry-design.md](./superpowers/specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md)**: 核心=共有はコピーで別ID化([MitigationSheet.tsx:209](./../src/components/MitigationSheet.tsx#L209))→現状plan ID部屋鍵では繋がれない。解消=**`collabRooms/{roomToken}`対応表(token→planId)**。確定方針=常設リンク(案A・無期限)/**オーナーのみ失効・再発行・配布**/最大人数(既定8=フルパーティ)/緊急停止/**編集ログイン必須(段階導入・公開条件にサーバ認証含む)**/ジョイナーは一時ビュー(自分の一覧に増えない)/注意=初回モーダル+常時赤バナー/パスワード無し。コピー共有(ShareModal)無傷。順序: ③→⑤→②-b→②-c。
  - **✅⑤-1/⑤-2a/⑤-2b 完了(2026-06-05〜08)**: ⑤-1=ルーム解決層(`_roomLogic` token→planId・`COLLAB_DISABLED`緊急停止) / ⑤-2a=ルーム管理API(`/api/collab?action=room`・IDトークン+ownerId照合・発行/失効/再発行/上限) / ⑤-2b=満員拒否(`onBeforeConnect`で`/count`照合・fail-open・`collabCapacity.ts`純ロジック)。
  - **✅⑤-3a=オーナー入口UI 実装済(2026-06-08)**: 共有2択+ルーム発行/人数/失効/再発行+表ツールバー常設チップ+`startCollabSession`roomToken化+オーナーパネル(i18n4言語)+SYSTEM_MAX 28→20。設計書[specs/...stage5-3a...md](./superpowers/specs/2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md)/計画[plans/...stage5-3a...md](./superpowers/plans/2026-06-08-realtime-collab-stage5-3a-owner-entry.md)。
  - **🔀順番B決定(2026-06-08)=[docs/.private/2026-06-08-collab-roadmap-order-B-decision.md](./.private/2026-06-08-collab-roadmap-order-B-decision.md)**: ②-b(全PlanDataライブ同期)を②-b-1(軽量要素)/②-b-2(partyMembers)に2分割→⑤-3b(ジョイナー閲覧)→⑤-3c(ログイン編集)→④(presence)。
  - **✅②-b-1=軽量PlanData同期(events/phases/labels/memos/設定) 完了(2026-06-08)**: [specs/...stage2b1...](./superpowers/specs/2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)/[plans/...stage2b1...](./superpowers/plans/2026-06-08-realtime-collab-stage2b1-plandata-sync.md)。
  - **✅②-b-2=partyMembersライブ同期+ジョブ変更カスケード 実装済(2026-06-09)**: partyMembersを新Y.Arrayキーでid単位同期(computedValuesは受信側でローカル再計算)。ジョブ変更カスケード+bulk mitigation3種を委譲化。**新ハンドラ`batch(ops)`** でpartyMembers+mitigationsを1 transaction原子反映。ソロ計算はcompute*純関数に抽出しソロ/collab共有(DRY)。設計[specs/...stage2b2...](./superpowers/specs/2026-06-09-realtime-collab-stage2b2-partymembers-sync-design.md)/計画[plans/...stage2b2...](./superpowers/plans/2026-06-09-realtime-collab-stage2b2-partymembers-sync.md)。**PlanData全要素ライブ同期エンジン完成**。
  - **✅⑤-3b=ジョイナー読み取り専用ライブビュー 完了(2026-06-09)**: `/collab/:roomToken`(lazy chunk)で部屋を読取専用ライブ表示。contentIdをseed配送。漏洩防止2層=①専用ページがLayout自動保存を通らない②`_collabReadonly`でlocalStorage persist skip+退室時rehydrate。設計[specs/...stage5-3b...](./superpowers/specs/2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md)/計画[plans/...stage5-3b...](./superpowers/plans/2026-06-09-realtime-collab-stage5-3b-joiner-view.md)。
  - **✅⑤-3c=注意UI+ログインゲート+編集解禁 完了(2026-06-09)**: ジョイナーが部屋ごとフル警告同意+ログインで編集解禁。persist skip と canEdit を分離・同意は roomToken キー・オーナー名は発行時ラベル(PII無)。設計[specs/...stage5-3c...](./superpowers/specs/2026-06-09-realtime-collab-stage5-3c-edit-unlock-design.md)/計画[plans/...stage5-3c...](./superpowers/plans/2026-06-09-realtime-collab-stage5-3c-edit-unlock.md)。
  - **✅④-a=サーバ側編集認証 完了(2026-06-10)**: **Vercel受付係 verify委譲**(`/api/collab?action=verify`・Firebase Admin verifyIdToken・接続時1回で$0維持)。WS upgrade のみ in-place 認可(詐称ヘッダ除去+fail-closed)→DO `isReadOnly`override で未認証書込破棄。設計=specs/2026-06-10-...stage4a.../計画=plans/2026-06-10-...stage4a。
  - **✅④-b 設計+④-b-1(presence roster)+④-b-2(P2P live カーソル) 完了(2026-06-10)**: roster=既存WS awareness全員配信 / 動くカーソルのみ P2P自前WebRTCメッシュ(メーター外$0)。座標=既存Memo `(timeSec,xRatio)`流用・実名なし(ジョブアイコン+自動配色)。プライバシー=既定OFFオプトイン+ON時IP正直説明modal+OFFで即close+IP非保存。描画=transform直書き+rAF lerp(高頻度setState禁止遵守)。設計=specs/2026-06-10-...stage4b/4b2/計画=plans/...stage4b1/4b2。

## 完了 (2026-06-02〜03 動画モーダル / OGP・memo修正 / YouTubeライブ / Cloudflare Worker)

- **動画埋め込み式モーダル `VideoRecorderModal` (本番投入・実機検証済)**: subagent-driven-development で全7タスク (CSP `www.youtube.com` / i18n 4言語 / `parseYouTubeId` 10テスト / `useYouTubePlayer` / モーダル本体 / Timeline 連携 + `PipRecorder` 撤去)。公開後 UI 改善 (`36c356c`): 白基調復活(`--share-modal-bg`)/モーダル拡大(1400px・左flex-3)/ヘッダ撤去(×フロート)/軽減グリッド pip 6列/ストップウォッチ rAF 滑らか化(動画位置基準・500ms 再同期)。既存編集フロー(EventForm variant='modal')無改変。残フォロー(低優先・任意): 埋め込み不可/年齢制限の誘導UI / モバイル対応 / 閉じても state 保持で前動画残る。設計=specs `2026-06-02-video-recorder-modal*`。
- **OGP/memo 修正 (デプロイ済)**: ① OGP 障害2件 — `/api/og` ルート衝突 (取得器を `/api/og-fetch` 分離) / `CONTENT_META` 二重管理→`contents.json` 自動生成 (Vercel Node Function は JSON import 不可で 500 → `contentsOgpData.ts` TS定数化、`node scripts/generate-ogp-data.mjs` で再生成) ② メモ leak = 新規プランが前プランの `memos` 引継ぎ→ `memos:[]` 追加 + 回帰テスト ③ `/assets/*` immutable 1年キャッシュ。
- **YouTube ライブ配信対応 (実機確認済)**: `parseYouTubeId` の path 正規表現に `live` 追加 (`embed|shorts|v|live`)、`youtube.test.ts` 2ケース。時刻ロジック/UI/`useYouTubePlayer` 無改変。CSP 追加不要。設計=specs `2026-06-02-video-recorder-modal-design.md` §11。
- **Cloudflare Worker 移設 (2026-05-29)**: Twitter 動画 → `media.lopoly.app` (Worker `lopo-media-proxy`) で Vercel egress ゼロ化。env `VITE_MEDIA_PROXY_BASE_URL` で制御 (外せば即ロールバック)。worker=`workers/media-proxy/`。設計=specs|plans `2026-05-29-housing-video-cf-worker`。memory `project_cloudflare_caching_priority`

## 完了 (2026-05-28 一覧住所順化 + 自分物件バッジ)

「左上=自分、 2 番目=後から登録」 違和感の解消。 順序を変えるか識別を入れるかでユーザーと議論し、 「両方やる」 結論。

### 主な変更

- **sortListingsForGallery を住所順に変更** ([src/lib/housing/sortListingsForGallery.ts](../src/lib/housing/sortListingsForGallery.ts)): 旧仕様 (グループ代表 createdAt desc) → area (HOUSING_AREAS 順) → DC → server → ward → buildingType (house 先 / apartment 後) → plot or (apartmentBuilding → roomNumber) の昇順。 同住所内は従来どおり lastConfirmedAt desc → createdAt desc で安定化
- **「あなたの登録」 ピル追加** ([src/components/housing/workspace/HousingCard.tsx](../src/components/housing/workspace/HousingCard.tsx)): listing.ownerUid === viewerUid のときカード左上に honey-gold グラデのピル表示。 pointer-events: none で押下を妨げない
- **i18n 4 言語追加**: housing.workspace.card.mine_badge (ja/en/ko/zh)
- **テスト追従**: sortListingsForGallery 8 件 + useHousingListingsStore 2 件更新、 全 445 件緑

### 設計判断

- 「自分の物件を先頭に持ってくる」 案は他人物件の発見性を下げるため不採用 (ハウジングの本質 = 他人の家を回る楽しみ)
- 地図ビューと整合させるため住所階層昇順 → 「ミストの家を順に見る」 が自然
- 識別は順序ではなくバッジで分離 = 順序問題と識別問題を独立に解決

## 完了 (2026-05-28 §3.8 完全クローズ・進捗 UI 再設計 + UX 全面改善)

§3.8 「ちがった」 1 撃 hide の進捗バー視認性 + UX 課題を 1 セッションで全部解消。 教訓は memory に恒久化。

### 主な変更

- **進捗 UI 再設計**: 底辺 4px solid バー → **ピル全体を `transform: scaleX()` で左→右に塗りつぶし**。 動画背景 + DPR 2.58 環境で 4px バーが視認不能だった根本対策 ([src/styles/housing.css])
- **凍結バグ修正**: `transition: width 32ms × 16ms setInterval` の干渉で Chromium 合成スレッドが幅を確定できず凍結 → `transition: none` + transform 化で完全解消
- **塗り形状の歪み修正**: `border-radius: inherit` を fill 要素から削除。 親 button の `overflow:hidden + 999px` で pill 形状に外側クリップさせる構造に変更 (= scaleX で fill 自身の角丸が縦長楕円化する問題を排除)
- **button 文言を「ちがった」 1 単語に圧縮**: hint / 押下中の残時間 text 全廃。 「2 秒長押し」 「あと X.X 秒で非表示」 という強い語感を排除。 進捗はピル塗りで完結 ([src/components/housing/listing/HousingLongPressButton.tsx])。 数字幅変動による button 揺れも text 廃止で本質解決
- **caption 配置移動**: 「古い情報ならご協力を」 を section title 直下 → 各 peer 行内 button 直上の縦並び action wrapper へ。 button と説明文を物理的に近接させて意味の紐付けを保証
- **自分の物件は peer から除外**: `ownerUid === viewerUid` フィルタを追加 ([src/components/housing/listing/HousingDetailModalRoute.tsx])。 サーバが `cannot_report_own` 403 を返す仕様に UI 側で対処、 ユーザーが失敗トーストで困らされる前に button を出さない
- **Optimistic UI 化**: `setHiddenPeerIds` を fetch 開始と同時に実行。 失敗時のみロールバック。 サーバ応答待ち 1-2 秒のタイムラグを解消
- **親 store 即反映**: `HousingDetailContent` に `onPeerHidden` callback を追加 → `HousingDetailModalRoute` で `useHousingListingsStore.remove(peerId)` を呼ぶ。 詳細モーダル閉じた後の一覧画面でリロード必須だった症状を完全解消
- **toast 文言ソフト化**: 成功 → 「ご協力ありがとうございます！」 / 失敗 → 「うまくいきませんでした、 もう一度お試しください」。 「通報」 「処理」 「非表示」 という重い語感から逃げる。 i18n 4 言語更新 (ko/zh は ja コピー)
- **不要 i18n キー削除**: `long_press_hint` / `long_press_remaining` 全言語から削除、 `--housing-longpress-fill` token も dead code 化したので削除
- **教訓の恒久化**: 「操作後の UI 反映 = Optimistic UI + 親リスト store に伝搬。 リロード必須/タイムラグはバグ扱い」 を memory `feedback_ui_reflects_server_state_immediately` に保存。 過去複数回起こしている同類症状 (ユーザー「これ系毎回起きてます」) を恒久ルール化

### 残課題 (次セッション以降)

- **peer の自分/他人の視覚識別 + 並び順検証**: ユーザー指摘 (左上 = 自分、 2 番目 = 後から登録 の違和感)。 自分除外で button 自体は解消したが、 識別ヒント自体は不在
- **「通報」 文言全体見直し**: 自発的通報モーダル等の他箇所はまとめて見直し予定
- **§3.8 残りの実機検証**: 重複 drop でツアー自動追加 + トースト / 単独 listing で section 非表示

設計書: [docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2 / §3.8]

---

## 完了 (2026-05-27 セッション #60 後半・Phase 2-4 重複登録時のベル通知)

α 公開期限撤回後の 1 セッション 1 タスク方針で、 重複対応 Phase 2-4 を実装 + 実機検証 OK。

### 主な変更

- **notification 型拡張**: `'duplicate_alert'` 追加、 `reason` を type='housing_report' 専用に optional 化 ([src/types/notification.ts])
- **`_registerListingHandler` 拡張**: 登録 transaction 後 best-effort で、 同 addressKey の生きてる他オーナー全員に `type='duplicate_alert'` 通知を batch 作成 ([api/housing/_registerListingHandler.ts])
- **`NotificationItem` type 分岐**: housing_report と duplicate_alert を i18n キー別に render ([src/components/housing/notifications/NotificationItem.tsx])
- **`HousingDetailModalRoute` ガード**: `reportNotice` (= 通報案内バナー) は type='housing_report' のときだけ生成。 duplicate_alert は spec §3.4 「シンプル A 派 (タップ = listing 詳細遷移、 ボタン直埋め込みナシ)」 に従いバナー無し
- **i18n 4 言語**: `housing.notifications.item.duplicate_alert` 追加 (ko/zh は ja コピー)

実機検証 (別アカ → メインで同住所登録 → 別アカのベルに通知): 通知届く + タップで listing 詳細に飛ぶまで動作 OK。 設計書: [docs/.private/2026-05-27-housing-video-3frame-and-phase2.md §3.4]

### 残課題 (公開後 / 次セッション以降)

- 通知メッセージの listingTitleSnapshot が `description` 空時に **addressKey raw** (例「Mana|Pandaemonium|Mist|W1|B1|A25」) で出る → `formatHousingAddress` 経由の表示用住所をスナップショットすべき
- 通知ドロップダウン全般の UI/UX 刷新 (ユーザー「今 UI/UX ひどい」 指摘)

---

## 完了 (2026-05-27 セッション #60・ハウジング α 公開向け 5/27 開発デー一括)

ハウジング 5/28 23:59 α 公開に向け、 アパート対応 + 多言語化 (masterData 案 B ネスト) + マップ→list デフォルト + /admin 通報モデ案 B を 1 日で完了。 typecheck + 純関数 vitest (40/40 pass、 ゾンビ 0) + build 6.67s 成功。

### 主な変更

- **アパート対応 (全層)**: `apartmentBuilding: 1 | 2` (本街/拡張街) を schema/validate/addressKey/フォーム/6 カード/galleryAdapter/sortByAddress に追加。 **register/update API の致命的バグ修正** (旧実装は apartmentBuilding を保存/更新フィールドに含めず = アパート登録/編集で号棟情報が落ちる)
- **フォーム改修**: [HousingRegisterAddressFields.tsx] を全面リライト。 建物タイプラジオ + apartment 時の号棟 1/2 + 部屋番号 1-90 入力に切替
- **6 カード apartment 対応**: 新 util `formatHousingAddress.ts` (house/apartment 分岐 + 多言語住所組み立て) を経由に統一。 例「ミスト・ヴィレッジ 23区 トップマスト1号棟 #15」/「Mist W23 The Topmast Bldg.1 #15」
- **MapBubbleCard 住所文字撤去**: ユーザー方針「マップ時は地図で見えるから不要」、 aria-label のみ維持
- **多言語化 (案 B ネスト)**: masterData の `name`/`apartment_name` を `{ja,en,ko,zh}` ネストに刷新 (公式英語名は FFXIV Wiki 由来確認済)。 新 util `areaName.ts`、 admin 4 言語編集 UI、 parseHousingFromText 全言語マッチ。 ko/zh は ja コピー (日英先行公開方針)
- **マップ→list デフォルト**: `useHousingViewStore` default を `'pinterest'` に (sampleWardLayout 偽配置隠し)
- **/admin 通報モデ 案 B**: 新規 API `_housingReportsHandler.ts` (GET + PATCH hide) + Firestore composite index + `AdminHousingReports.tsx` (画像+住所+通報数+「物件を見る」/「非表示にする」) + サイドナビ + ルート + i18n
- **i18n 4 言語**: housing.register.building_type / apartment_building / errors.apartmentBuilding/roomNumber/roomKind + admin.housing_reports.*

### α 公開時の妥協 (公開後対応)

- UI コンポーネント test の追従更新 (フォーム大改修で既存 test が確実に落ちる、 本セッションでは実行せず)
- 通報モデの復帰 (isHidden→false) / BAN / 異議申し立てアプリ内 UI / 30 日後物理削除 cron
- マップ実データ化 + アパート位置定義 (`APARTMENT_SPOT[area]`)
- ko/zh の翻訳実値 (現在 ja コピー)
- カードデザイン本格刷新 (Allmarks 風、 リッチメディア化と合わせて)

---

## 完了 (2026-05-26 セッション #59・軽減表 perf 改善 A+C + 通知マーキー長文時爆速バグ修正)

ユーザー報告「スクロール若干カクつく / メモリ 600MB-1.3GB」 を root cause investigation。 実機計測 (ブラウザ Claude + ユーザー手動 Console) で「行 1,200+ × 14 セル絶対配置 × 仮想化なし × hover 連鎖 × forced reflow」 を特定。 A+C の最小変更で push、 ユーザー実機体感「滅茶苦茶軽くなった」 確認済。 B/D はスキップ判定 (理想値達成、 ROI 低)。

### 完了内容

- **A (content-visibility)**: [src/components/TimelineRow.tsx:172-178] の行 className に `[content-visibility:auto] [contain-intrinsic-size:auto_50px]` 追加。 ビューポート外 1,200 行を style/layout/paint からスキップ。 1 行変更
- **C (ResizeObserver 化)**: [src/components/TimelineRow.tsx:14-37] の `EventNameSpan` の truncation 判定を、 `onMouseEnter` での `scrollWidth > clientWidth` 比較 (forced sync layout の典型) から、 `useEffect` + `ResizeObserver` で onMount + 親幅変化時にのみ計算するように変更。 hover 時はステート参照のみ → forced reflow 撲滅
- **通知マーキー修正**: [src/components/SystemNotificationBar.tsx] バーが title + body 連結を 18s 固定で流す → **長文時に速度爆発バグ**。 業界標準 (タイトルのみ・本文はモーダル展開) + 速度可変式 (60 px/sec、 最小 8s、 ResizeObserver で親幅追従) に変更。 ユーザー報告から発覚→約 30 分で hotfix まで完了
- **ハーフバグ**: 初回 push 後 Rules of Hooks 違反 (`useLayoutEffect` を early return の後に置いた) で React error #310 → 本番真っ白。 すぐ hotfix push (effect を hooks 全部の後 / early return の前に移動)

### 計測実証 (修正前 → 修正後)

| 指標 | 修正前 (配置なし基準) | A 単独 (配置あり) | **A+C (配置あり)** |
|---|---|---|---|
| fps.avgFrameMs | 16.85 | 17.72 (悪化に見える) | **16.60** |
| framesOver16ms% | 23.6% | 45.7% | **21.6%** |
| framesOver33ms | 3 | 12 | **0** ← 1 フレーム落ち完全解消 |
| worstFrameMs | 33.4 | 33.50 | **16.80** ← 半減 |
| p95FrameMs | (未取得) | 33.30 | **16.80** ← 理想値 |
| slowEvents pointer 384ms | 5 件 | 0 件 | 0 件 |

DMU 1 本目 (A 単独計測) は heap 高 (135.7MB) でノイズあり、 FRU_LoPo (配置 200 倍) で A の効果を正しく確認。 C 追加で全環境で理想値達成。

### 学び

- **content-visibility は CPU 削減には効くが DOM ノード数は減らない** (= タブメモリ 850MB は別軸。 DOM 73,060 個由来、 将来仮想化 react-window で対処可能だが大改修)
- **`onMouseEnter` で scrollWidth 比較は forced reflow の典型**。 ResizeObserver で onMount+リサイズ時のみが業界水準 (memory `reference_perf_forced_reflow_resizeobserver`)
- **Rules of Hooks 違反は build (tsc) で catch できない**、 動的に出る → ESLint `react-hooks/rules-of-hooks` 有効化必要 (残課題)
- **マーキー長文時爆速バグは duration 固定 + span 幅可変の構造的問題**。 速度可変式 (px/sec) で本質解決
- **計測手段**: ブラウザ拡張 Claude は background tab で `document.visibilityState='hidden'` 扱いで RAF 0 frames → 実機ユーザー手動 Console が最も確実。 5 秒スクロール + `sc.scrollTop += 40` で 60fps 計測可能

### 残課題 (公開後)

- SystemNotificationBar.test.tsx を title のみ仕様に追従更新
- ESLint `react-hooks/rules-of-hooks` 有効化
- 「表を展開する」 click handler 394ms (#59 計測で別ボトルネック判明)
- メモリ振れ本質改善 (仮想化、 大改修)

## 完了 (2026-05-26 セッション #58 follow-up・実機 feedback 反映 5 件)

軽減アプリ全般のフィードバック反映。 メモ機能 v1 後の細かな見た目バグを 5 件、 1 件ずつ実機確認しながら修正。

### 完了内容

1. **メモ文字色をアプリ標準トークンへ** ([commit](fix(memo)#色)、 `src/components/Memo/memo.css`): `color: var(--color-text, #fff)` の fallback `#fff` が両モード適用されていたバグ。 `--color-text` 自体が未定義トークンだった。 `var(--color-text-primary)` に変更し、 ライトモード用 `.theme-light .plan-memo` で text-shadow を白縁取りに反転。 → ダーク=#F0F0F0 白文字+黒縁取り / ライト=#171717 黒文字+白縁取り
2. **メモボタン白い箱の高さを AA と一致** (`src/components/Timeline.tsx`): `Tooltip wrapperClassName` の `!h-auto` が `h-6` を打ち消していて、 メモボタンの白い箱が中身に張り付くほど低かった。 構造を AA と完全同形 (外側 div > Tooltip > button) にリファクタ。 wrapperClassName を `!w-full !h-full` に最小化、 `!important` 数 3→2 に削減、 `!justify-start` 撤去
3. **致死ダメージセルの「箱」 撤去** (`src/components/TimelineRow.tsx`): `bg-red-500/10` (ピンク背景、 initial commit 由来) と `shadow-sm` (アニメ統合 2eb3637 由来) の二重装飾が「数字の周りの四角」 として見えていた。 IIFE まるごと撤去で 4 行 add / 27 行 delete。 致死は赤文字+太字+アニメで MobileTimelineRow と挙動統一
4. **コピーボタンを absolute へ移動** (`src/components/TimelineRow.tsx`): Copy ボタンが flex 列で常時 20px の枠を予約していて、 攻撃名がホバー前から短く省略されていた。 slot 親 (relative) の absolute 子要素に移し、 非ホバー時のレイアウト負担ゼロに。 `pointer-events-none` で非インタラクティブ化、 `bg-app-bg + ring` でホバー時のみ右端に浮き上がる。 1 イベント版 / 2 イベント版両方で同じパターン
5. **AnimatedDamage 縦位置補正** (`src/components/AnimatedDamage.css`): `.dmg-layer-enter` に `align-items: center` が無く文字グリフが上端寄りに座っていた (`.dmg-layer-exit` には元から center あり = 対称性崩れ)。 1 行追加で 22px slot 内中央配置、 左の平文ダメージとベースライン揃う

### 学び (将来同種の問題に流用)

- **`!important` 過剰使用は危険**: メモボタンの `!h-auto` が `h-6` を打ち消したのは典型。 `wrapperClassName` で Tooltip default 打ち消すときは「最小限の上書き」 を意識
- **「視覚的ノイズの箱」 は背景 + 影の合わせ技で発生**: 単一の `bg-*` だけでなく `shadow-sm` も「輪郭」 として見える。 撤去するなら両方
- **絶対配置 + ホバー出現パターン**: Copy ボタン pattern は他にも応用可能 (=「常時 layout 予約はゼロ、 ホバー時のみ出現」)
- **flex layer の align-items 抜け**: アニメーション系で「上端寄りに見える」 ときは flex container の align-items を確認
- **DevTools の問題パネル**: ページエラー 0 が最重要。 「互換性を破る変更」 23 件はほぼサードパーティ起因で対処不能

### 次セッションで対応 (申し送り)

- **スクロール perf 検査** (ユーザー報告: メモリ 600MB-1.3GB / スクロール若干カクつく)
- Performance タブ録画 → ボトルネック特定 → 仮想化等の根治
- 見た目維持 (現状デザインを変えない方針) で進める
- **アプデ告知は保留**: 本日の見た目 5 件 + perf 改善をまとめて 1 回で告知する方針 (ユーザー判断、 細切れより「まとめて改善」 の方が体験良い)。 perf 完了時に再ドラフト

---

## 完了 (2026-05-25 セッション #57-58・軽減表メモ機能 v1)

**目的**: 軽減表シート上に任意位置の plain text メモ。 縦=時間軸固定 / 横=フリー、 DnD 可、 100 個 × 100 文字上限、 既存ゴミ箱メニュー統合、 PC のみ。

**spec/plan**: `docs/superpowers/specs/2026-05-25-mitigation-memo-design.md` / `docs/superpowers/plans/2026-05-25-mitigation-memo-plan.md` (17 task)

### 完了内容

- **Phase 1 (#57、 Task 1-10、 18 commits)**: `PlanMemo` 型 + `MEMO_LIMITS` 定数 + 後方互換、 座標変換ヘルパ (`timeSecToY`/`yToTimeSec`/`xRatioToPx`/`pxToXRatio`/`clampXRatio`)、 `useMitigationStore` に `toolMode` + メモ CRUD + AA との排他、 4 言語 i18n (ja に値、 en/ko/zh は ja コピー)、 `MemoOverlay`/`MemoInputBox`/`MemoFloatingBar` 新規、 Timeline 鉛筆アイコン (AA ボタン隣、 PC のみテキスト)、 メモモード切替、 シートクリック → 入力 → 確定で `PlanData.memos[]` に追加 + Firestore 5 分クールダウン同期
- **Phase 2 (#58、 Task 11-13)**: pointer events 自作 DnD (4px しきい値で click/drag 切替、 `yToTimeSec` 逆引きで動的高さ対応、 ドラッグ中は inline style 直接更新で React 再レンダー最小化、 pointerup でのみ markDirty)、 メモクリック → 編集モード InputBox (空文字確定で削除、 spec §4.5 確認なし)、 右クリック即削除 (誤操作リスク低のため確認なし)
- **Phase 3 (#58、 Task 15-16)**: `ClearMitigationsPopover` 末尾に「メモを全削除」 メニュー追加 + 確認ダイアログ (variant=danger)、 `ConfirmDialog` の `confirmLabel`/`cancelLabel` をオブジェクトで上書き可能化 (メモ全削除のみ「全削除/やめる」、 既存は OK/キャンセル 維持)、 上限警告 toast は handleSheetClick で実装 (101 件目で `memo.limit_reached`)
- **テスト**: 21 新規 tests (planMemo.compat 3 + coords 10 + useMitigationStore.memo 8)、 全 151 files / 1088 passed (FAIL 0)
- **本番デプロイ**: git push main → Vercel 自動デプロイ → lopoly.app

### #57 Phase 1 学び (重要 fix 連発、 将来同種の sheet 上 overlay 機能に流用)

① ツールバー列ズレ (AA + メモを Area B 内に並列配置・AA ラベル「AA追加モード」→「AA追加」 短縮)、 ② メモボタンのトンマナ不一致 (= AA と同じ `bg-app-toggle` 統一)、 ③ MemoInputBox glassmorphism 化 (`glass-tier3 z-[9999]` + 320px + `text-app-md`)、 ④ シートクリック衝突 (`handleCellClick` 先頭に `toolMode === 'memo'` ガード追加)、 ⑤ **`mix-blend-mode: difference` は LoPo glassmorphism 背景で実質透明化** → 撤去 + text-shadow 3 段で代替、 ⑥ **scrollOffset 二重加算バグ** (`sheetContainerRef` が `scrollContainerRef` の子だから `getBoundingClientRect().top` は既にスクロール反映済、 scrollTop 加算しない)、 ⑦ **LoPo Timeline は行高さが動的** (`sheet container height` は gridLines を累積する dynamic 計算) → 線形変換 `y = time × pps` 使えず、 `timeToYMapRef` 逆引き (`timeSecToY`/`yToTimeSec`) で再実装、 ⑧ メモゾーン制限 = DOM ベース (`[data-member-id]`) でメンバー列の左端を境界 (CSS 変数 `--col-header-chunk-w` は calc 式で `getComputedStyle` が文字列のまま返し parseFloat 失敗)

### Phase 4 (後追い、 必要に応じて)

- en/ko/zh の memo 翻訳キー正式翻訳 (現状 ja 値コピー先行)

## 完了 (2026-05-21〜22 セッション #51-52・ハウジング Phase 3 ③: SNS 画像表示 + ツイート連動ライフサイクル)

**プラン**: `docs/superpowers/plans/2026-05-21-housing-sns-image-lifecycle-plan.md` (全 9 Task)。 画像バイナリは保存せず `pbs.twimg.com` の CDN URL を参照保持、 ツイート削除で物件を soft delete (開いた時チェック + ローリング cron の二段)。

### 完了内容

- **Task1**: 共有 `tweetSyndication.ts` (`checkTweetStatus`/`syndicationUrl`) + `tweet-meta` DRY 化
- **Task2**: `HousingListing` に `tweetId` / `lastTweetCheckAt`
- **Task3**: `validateImage` / `buildListingImageFields` (純関数、 ogImageUrl は pbs.twimg.com 限定)
- **Task4-5**: 登録フォーム→onSubmit→`toRegistrationDraft` に画像 (postUrl/ogImageUrl/tweetId) を通す
- **Task6**: 登録ハンドラが `imageMode:'none'` 決め打ちを廃止し `buildListingImageFields` で保存
- **Task7 (D)**: サーバー検証つき削除 `purge-if-tweet-gone` (家主チェックなし・syndication 再確認、 いたずら削除不可)
- **Task8 (C)**: 物件を開いた時にツイート生存確認→削除済みなら soft delete + 一覧除去 + toast + 自動クローズ
- **Task9 (E)**: 毎日 4:00UTC ローリング cron + 複合インデックス (imageMode/deletedAt/lastTweetCheckAt、 deploy 済)
- **実機検証 (2026-05-22)**: (A)(B) 登録→プレビュー/カード/詳細に画像表示 OK、 (C)(D) ツイート削除→開いた時に soft delete (`deletedAt` 確認済)。 一覧カードのサムネは [HousingCard.tsx] に既存実装で自動表示
- **重要バグ修正2件**: ⓐ 自動入力再適用で手動編集が巻き戻る→取得結果ごと1回ガード (`HousingRegisterSnsUrlField`)。 ⓑ **削除済みツイートは syndication が 404 でなく 200+`TweetTombstone` を返す**→`checkTweetStatus` を tombstone 対応 + 開いた時チェックは edge キャッシュ回避で purge 直接呼び (memory `reference_tweet_deleted_tombstone`)
- **学び**: 初回「画像出ない」真因は PWA 旧 JS キャッシュ (toRegistrationDraft はクライアント側)。 テスト基盤 vmThreads ハング対策は memory `reference_vitest_vmthreads_hang` 厳守
- **残 (次セッション)**: UX 改善ⓐ反映遅延ⓑtoast 見逃し→目立つ通知 / ④ アパート対応 / 削除済みツイートの登録拒否 (tweet-meta tombstone→404)

## 完了 (2026-05-21 セッション #45-46・ハウジング Phase 3: 家主編集削除 / 詳細表示 / 通報 + 通知)

**目的**: ハウジングツアーに「家主編集・削除 / 物件詳細表示 / 通報フロー + 通知」 を業界水準準拠で追加 (動く骨組み)。

**設計/プラン**: spec `docs/superpowers/specs/2026-05-20-housing-phase3-design.md` / plan `docs/superpowers/plans/2026-05-21-housing-phase3-plan.md` (25 タスク)。

### 完了内容

- **基盤 (Group A)**: `HousingListing.deletedAt` (soft delete) 追加、 `HousingNotification` 型 + 型ガード、 Firestore Rules (housing 編集/通報/通知 + deletedAt 改竄防止)、 i18n キー (detail/edit/delete/report/guide/notifications、 ja/en/ko/zh)
- **編集削除 (Group B)**: update-listing / delete-listing API ハンドラ、 HousingRegisterModal の edit モード化、 HousingEditModal / HousingDeleteConfirm / HousingDetailKebab、 useHousingUpdate / useHousingDelete
- **詳細表示 (Group C)**: HousingDetailContent / Modal / Layout / Page / ModalRoute、 ActionBar / PhotoGallery / ShareButton、 **react-router background-location パターン** (`/housing/listing/:id`、 一覧→モーダル / 直アクセス→フルページ)。 旧 inline expand (HousingCardExpanded) 廃止
- **通報 + 通知 (Group D)**: report-listing API (transaction で reports doc + reportCount +1 + 通知 doc + 自動非表示判定)、 list-notifications / mark-notification-read API、 HousingReportModal (reason 5 択) / HousingReportGuideModal (reason 別 CTA)、 NotificationBell / Dropdown / Item / useNotifications (onSnapshot 購読)、 TopBar にベル配置
- **仕上げ (Group E/F)**: ActionBar→ReportModal 接続、 既存 CenterArea/routes テストを新遷移仕様に追従、 housing テスト 325 pass / 0 fail、 build + tsc OK、 Firestore Rules デプロイ済

### 確定した設計判断

- Intercepting Routes は Vite SPA で不可 → background-location パターンで代替
- `deletedAt` (家主削除) と `isHidden` (運営非表示) は役割分離。 一覧は `isHidden==false && deletedAt==null`
- 通知 doc に **reporterUid を書かない** (家主に渡らない、 プライバシー原則)
- API ハンドラのユニットテストは見送り (firebase-admin ESM 制約で既存パターンなし)、 React 側は TDD
- 新ハンドラ 3 本は `api/housing/index.ts` の action ルーティング経由 = Vercel 関数本数は増えない

### 残課題 (次フェーズ)

- 実機 E2E 確認 (通報→通知→ガイド→編集/削除)、 一覧の MockListing → 実 Firestore 連携、 HousingCardExpanded 撤去、 30 日 cron、 異議申し立て UI、 en/ko/zh 翻訳

---

## 完了 (2026-05-20 セッション 43・ハウジング ログイン UI 整備の修正)

**目的**: セッション #42 で実装したハウジング ログイン UI のユーザー検証で見つかった 2 件の修正。

### 完了内容

1. **経路 B (登録モーダル → ログイン誘導) フロー修正**: HousingRegisterFormModal が未ログインユーザーにも form を直接表示していたため「ログインしてください」 が表示されない不具合。 user (useAuthStore) で分岐し、 未ログイン時は `HousingLoginPrompt context="register"` を表示するよう修正 (commit `ada0140`)。 これで経路 B + 経路 B × b (× で両方閉じる) が動作確認済

2. **hash 化説明文言の改善**:
   - `housing.login.notice.item2` (ja のみ更新、 en/ko/zh は空文字フォールバック):
     旧: 「受け取るのは ID (ハッシュ値) だけ ... 受け取りません」 (誤解されやすい)
     新: 「LoPo が保存するのは Discord ID のハッシュ値だけです。 ハッシュ値は元の ID に戻せない形なので、 運営者を含めて誰も Discord ID を復元できません。」
   - `housing.login_prompt.register.lead`: 「Discord ログインで物件を登録できます。 Discord ID は復元できない形 (ハッシュ値) で保存されます。」 (ja 更新、 他は空文字)
   - `legal.terms.terms_section2_body` (4 言語): 「Discord または X (Twitter)」 → 「Discord」 (Twitter 廃止済の事実反映)

### 教訓

- 「受け取る」 と「保存する」 の区別: Discord OAuth scope=`identify` で username/avatar は技術的に届くが、 サーバーコードで destructure で破棄 (`api/auth/_discordHandler.ts:146`)、 保存はしない。 「受け取らない」 は誤り、 「保存しない」 が正確
- 業界水準 (Twitter / GitHub / Slack 等の OAuth 利用サービス) は受け取る/保存する の細かい区別を説明しない。 シンプルに「保存しない」 で十分、 詳しすぎると不安を煽る

### 残課題 (UI 整え時にまとめて対応予定)

- TopBar ログインボタンとアバター丸のサイズ違いでガタつく問題 (問題 6)
- 未ログイン時の登録モーダルが背低くなる見た目違和感 (HousingLoginPrompt のコンパクトサイズに引きずられる)

---

## 完了 (2026-05-20 セッション 42・ハウジング ログイン UI 整備)

**目的**: ハウジング (`/housing`) に Discord ログイン UI 一式を導入。 hash 化完了で「LoPo は連絡できません」 が事実として真になった状態で文言適用。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-housing-login-ui-design.md](superpowers/specs/2026-05-20-housing-login-ui-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-housing-login-ui.md](superpowers/plans/2026-05-20-housing-login-ui.md)
- **戦略 B 採用**: ハウジング専用 UI を新規作成、 認証データ操作ロジックは hook `useAccountActions` で LoPo と共通化
- **新規 hook**: `src/hooks/auth/useAccountActions.ts` (avatar / displayName / signOut / delete 5 操作)
- **新規 store**: `src/store/useHousingModalStore.ts` (login / account / register モーダル状態 + URL クエリ駆動)
- **新規 UI**: `HousingLoginModal.tsx` / `HousingAccountModal.tsx` (ハニーゴールドトンマナ、 HousingPanelModal ラッパー流用)
- **TopBar 右端**: 未ログイン → pill ログインボタン、 ログイン済 → アバター丸 (LoPo の感覚と統一)
- **URL クエリ駆動**: `?register=open` で登録モーダルを開閉、 ブラウザバックで閉じる業界水準 UX
- **モーダルスタッキング**: 登録 (z-50) + ログイン/アカウント (z-60) の 2 層、 data-modal-role 属性で CSS から切替
- **× で閉じる挙動**: 経路 B (登録モーダル経由) では両方一緒に閉じる + URL クリア (`closeLogin` の fromRegister 分岐)
- **i18n**: `housing.login.*` / `housing.account.*` / `housing.topbar.*` の 22 キーを ja 値で追加、 en/ko/zh は空キーで先行 (fallbackLng='ja' + returnEmptyString=false で ja にフォールバック)
- **CSS**: housing.css に 22 クラス + 15 token 追加、 ハードコード 0 件 (housing-design.md 準拠)
- **既存 LoPo の refactor**: `LoginModal.tsx` も同じ `useAccountActions` を使うよう変更 (動作変更ゼロ)

### 6 項目達成状況

| # | 項目 | 状態 |
|---|---|---|
| 1 | ハウジング版 LoginModal | ✅ |
| 2 | ハウジング版 AccountModal (5 機能、 ローカル取込は除外) | ✅ |
| 3 | TopBar 右端 ログイン/アバターボタン | ✅ |
| 4 | モーダルスタッキング (z-50/60、 data-modal-role) | ✅ |
| 5 | ログイン後の登録モーダル復元 (saveReturnUrl 拡張 + ?register=open) | ✅ |
| 6 | × で閉じた時の挙動 (経路 A/B 分岐) | ✅ |

### 結果

ハウジング画面で完全に独立したログイン UI が動作。 LoPo 軽減表側の認証データ操作ロジックは hook 共有でメンテナンス 1 箇所に集約。 hash 化と組み合わせて「LoPo は連絡できない / 個人情報を持たない」 主張が UI 文言で真として伝わる状態に。

## 完了 (2026-05-20 セッション 41・hash 化マイグレーション Step 2 完了)

**目的**: Discord 10 件の Firebase uid を `discord:<生 ID>` → `hashed:<HMAC-SHA256(id+secret)>` に移行し、 LoPo 内部からも元 Discord ID を復元不能にする。 GDPR pseudonymization 完全達成。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md](superpowers/specs/2026-05-20-hash-migration-step2-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-hash-migration-step2.md](superpowers/plans/2026-05-20-hash-migration-step2.md)
- 新規ヘルパー: `api/_lib/hashUid.ts` (HMAC-SHA256, server-only)
- 新規スクリプト: `scripts/hash-migrate-users.ts` (backup/dry-run/execute/rollback) / `scripts/preflight-hash-migration.ts` / `scripts/verify-hash-migration.ts` / `scripts/fix-avatar-urls-for-uid.ts`
- 環境変数: `LOPO_PSEUDONYM_SECRET` を Vercel sensitive (prod/preview) + .env.local + iPhone メモ の 3 箇所に保管 (rotation 不可)
- アプリ側変更: `api/auth/_discordHandler.ts` (hashUid 経由) / `src/components/LoginModal.tsx` / `src/components/WelcomeSetup.tsx` / `src/utils/logoUpload.ts` の prefix 判定撤廃 / `scripts/check-admin-claims.ts` の hashed: 対応
- プライバシーポリシー文書更新 ja/en/ko/zh (`legal.privacy_section1d_*`)
- prod 実行: 10/10 件 hashed 化、 verify 全 PASS、 check-admin-claims で確認

### 課題 / 教訓

- **migration script の順序バグ**: 初回 execute 後の再 execute で window sweep が正規の hashed: Auth user を誤削除するバグを本番で発見。 即座に rollback + script 修正 + 再 execute で復旧
- **本人 Storage 消失**: 上記バグの auto-rollback で本人 Storage が消えた (backup は metadata のみで実体復元不可)。 LoPo UI 経由で再アップロードで対応
- 学び: Step 順序は単独 task テストだけでなく「reentrant scenario (=失敗後の再実行)」 テストも必須

### 結果

LoPo の認証システムが「個人情報を持たない」 大原則を完全達成。 プライバシーポリシーの主張が文字通り真になった。

## 完了 (2026-05-20 セッション 40・hash 化マイグレーション Step 1 完了)

**目的**: hash 化マイグレーション (Step 2) のテスト対象を Discord 専用に絞り、 「個人情報を持たない大原則」 の前提条件を整える。 廃止プロバイダー (Twitter / Google) 由来の uid 残骸を関連データごと完全削除。

### 完了内容

- **設計書**: [docs/superpowers/specs/2026-05-20-legacy-user-cleanup-design.md](superpowers/specs/2026-05-20-legacy-user-cleanup-design.md) (Step 1 完全仕様 + §3.4 クロス参照対応)
- **実装プラン**: [docs/superpowers/plans/2026-05-20-legacy-user-cleanup.md](superpowers/plans/2026-05-20-legacy-user-cleanup.md) (13 タスク、 subagent-driven 実行)
- **新規スクリプト**: [scripts/delete-legacy-users.ts](../scripts/delete-legacy-users.ts) (Dry-Run + Execute、 idempotent、 prefix/admin 二重防御 + bare Firebase UID 対応、 cross-ref scan 付き)
- **prod 実削除**:
  - Firebase Auth: 14 件削除 (Twitter 12 + Google 2)
  - Firestore documents: 29 件削除 (plans 18 / userPlanCounts 8 / users 2 / housing_user_meta 1)
  - Cross-references: 0 件 (廃止ユーザーは現役機能未使用 = Task 7 dry-run で予測通り)
  - Storage files: 0 件
- **検証**: scripts/check-admin-claims.ts 再実行で「総 10 件 / Discord のみ / admin 1 (本人) / Twitter Google グループ消滅」 確認
- **既存機能影響**: ゼロ。 Discord 10 件 (本人 admin + 他 9 名) は一切変更なし、 ハウジング・軽減表・LP 正常動作維持
- **Vercel デプロイ不要** (scripts/ のみの変更で本番動作に影響なし)

### Step 1 中に発見した plan 欠陥

- `assertPrefixSafe` が bare Firebase UID (Google built-in provider が生成する 28 文字英数字 UID) を弾くバグを Task 7 で発見・修正 (commit e5ebd4c)。 spec / plan は `google:` プレフィックス前提で書かれていたが実 uid は prefix 無し
- 新規 Discord ユーザー 1 件 (`discord:704...`、 2026-05-19 15:28 UTC 登録) が prep memo 後に追加されていた → Step 2 対象は **Discord 10 件** (本人 1 + 他 9) に確定

### 結果

prod は Discord 10 件のみ、 hash 化マイグレーション Step 2 (本体) の前提条件達成。 Step 2 brainstorming に直行可能。

## 完了（2026-05-19 セッション 39・hash 化マイグレーション準備調査）

**背景**: ハウジング ログイン UI 整備の brainstorming 中、 認証実装の中身 (`firebaseUid = discord:<生 ID>`) が「個人情報を持たない大原則」 と乖離していることが判明。 hash 化マイグレーションを**ハウジング UI 整備より優先**で実施する方針に転換。

### 完了内容 (調査 + 準備、 実装はまだ)

- **認証フロー全文読了**: `api/auth/_discordHandler.ts` (181 行) / `api/auth/index.ts` (18 行) / `src/store/useAuthStore.ts` (312 行)
- **hash 化処理の不在を確定**: 全リポジトリ grep (`createHash|sha256|pseudonym|anonymiz|hash.*id|hash.*uid|salt`) でゼロヒット。 `crypto` モジュールは OAuth state パラメーター生成にのみ使用
- **23 ユーザー把握**: Firebase Console + 新規スクリプト [scripts/check-admin-claims.ts](scripts/check-admin-claims.ts) で確定。 Discord 9 / Google 2 (廃止) / Twitter 12 (廃止)
- **admin 状況確定**: 本人 Discord 1 件のみ ✅、 他人ゼロ、 旧 Google admin はクリア済み
- **3 層 admin 防御の堅牢性確認**: フロント (AdminGuard) / API (verifyAdmin) / Firestore Rules すべて role==='admin' チェック、 Custom Claims は秘密鍵署名で偽造不可
- **設計書 §6.4 / §11 / §16 / §17.2 読了**: quota = 累計 30 + 31〜は 1 日 5、 信用スコア/BAN は Phase 3 で予定 (現時点未実装)、 通報の自動非表示は 3 件で発火 (運営介入なし)
- **プライバシーポリシー文書 確認**: `docs/superpowers/specs/2026-03-30-privacy-policy-update-design.md` 読了、 Discord ID の扱いが明文化されていないことを確認
- **新規スクリプト**: `scripts/check-admin-claims.ts`
- **準備メモ**: `docs/.private/2026-05-19-hash-migration-prep.md` (3 ステップ計画 + brainstorming 8 論点 + 文言素材)
- **memory 追記**:
  - `feedback_housing_design_independent.md` (ルール先読み手順 + 新規モーダル要素は事前承認フロー追加)
  - `feedback_housing_admin_complete.md` (新規 — ハウジング運営作業は全部 /admin で完結)
  - `project_hash_migration_status.md` (新規 — 計画状況)
- **ハウジング ログイン UI 文言確定**: 「ユーザー目線・柔らかく・嘘なし」 で 3 bullet 形式 (hash 化完了後に LoginModal に適用)
- **Phase 3 通報フロー仕様 確定**: 自分の登録は編集・削除可、 「ちがった」 通報で登録者にアプリ内通知、 異議申し立ては LoPo Discord DM 受付 → 管理画面で reportCount リセット、 すべて `/admin` で完結

## 完了（2026-05-19 セッション 38・ハウジング登録モーダル トンマナ統一）

**背景**: Phase 2A 検証中に判明した「中身まったく見えない」「タグが長すぎる」 を根本対応。

### 完了内容 (15 commit、 push + Vercel デプロイ完了)

- 新モーダル本番未反映を修正 (HousingWorkspace の旧 HousingRegisterModal を HousingRegisterFormModal に差し替え)
- panel chrome 統一 (HousingPanelModal 新規追加、 LiquidGlassPanel ラッパー + housing-panel-head)
- モーダル中身もハウジングトンマナ化 (.housing-input / .housing-textarea / .housing-label / .housing-register-form の form 基礎 CSS 新規追加 121 行)
- HousingRegisterTagPicker 再設計 (147 タグ flex-wrap → 選択 chips + 検索 + カテゴリタブ + 高さ固定 200px)
- 確認モーダル `<pre>{JSON.stringify}</pre>` → `<dl>` 構造化表示に整形
- i18n 4 言語に `tag_search_placeholder` / `tag_no_results` / `tag_pick_hint` / `tags` / `room_number` / `parent_house_size` 追加
- 登録 API 400 解消、 実機で登録成功確認済 (X URL 貼って自動入力 → 即「登録する」 押せる動線完成)
- 触ったファイル: HousingPanelModal (新規) / HousingRegisterFormModal / HousingRegisterForm / HousingRegisterChecklist (新規) / HousingRegisterTagPicker / HousingRegisterDescriptionField / FavoritesModal / HousingWorkspace / styles/housing.css / locales 4 言語 / housingFieldState (test 含む)

### 既知バグ (hash 化完了後に再開)

- `fieldState.confirm()` を呼んでも state="confirmed" に切り替わらない (右上 ✅ バッジ・checklist の「そのままで OK」 両方とも Playwright で click しても state 不変)。 React StrictMode / useCallback closure / createPortal 越しの reconciliation のいずれかが疑い。 isReadyToSubmit を auto-filled 許容にして回避中

## 完了（2026-05-19 セッション 37・ハウジング Phase 2A 登録モーダル + SNS URL 自動推定 実装）

**背景**: セッション 36 で確定した設計書 (`docs/superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md`) + 17 task TDD 実装計画 (`docs/superpowers/plans/2026-05-19-housing-sns-auto-extraction.md`) を `superpowers:subagent-driven-development` skill で完走。

### 完了内容 (17 task + 5 fix commit、 main へ直 commit)

- **Task 1** `9637c74`: `parseTweetUrl` 純関数 (X URL → tweet ID、 7 test PASS)
- **Task 2** `e8354de`: `parseHousingFromText` 骨格 + masterData に `Small`/`Medium`/`Large` alias 追加 (2 test PASS)
- **Task 3** `f207090` + `7ecd47c`: 略称・俗語・自由文・棄却ケース対応 (11 test PASS、 substring 探索 + 日本語 ward-plot fallback、 ASCII 短 alias 誤一致防止 fix)
- **Task 4** `b0412eb`: `LavenderBeds` aliases に「葉脈」 追加
- **Task 5** `f271191` + `942763a`: Vercel Edge Function `/api/tweet-meta` (syndication CDN プロキシ、 7 test PASS、 LoPo 初の Edge runtime、 photos 型安全性向上 + vitest 環境衝突 fix)
- **Task 6** `fc6f316`: `useHousingFieldState` hook (5 state 遷移、 7 test PASS)
- **Task 7** `5bf7cac`: `housing.css` にバッジ + ✅ チェックアニメ (bounce + draw + ripple + glow) + スピナー + slide-in/out class 追加 (199 行)
- **Task 8** `b77d801`: `HousingRegisterFieldBadge` コンポ (5 test PASS)
- **Task 9** `2b84291`: i18n 4 言語に 30 キー追加 (`snsUrl` / `tweetPreview` / `fieldBadge` / `fieldError` / `address` / `type` / `confirm` / `cancel`)
- **Task 10** `e12674d`: `HousingRegisterSnsUrlField` + `useTweetFetch` hook (7 test PASS、 AbortController 経由のキャンセル対応)
- **Task 11** `318bb58`: `HousingRegisterTweetPreview` (3 test PASS)
- **Task 12** `aa6e76c`: `HousingRegisterTypeSelector` + `RoomNumberField` + `ParentHouseSizeField` (3 test PASS)
- **Task 13** `1744237`: `HousingRegisterAddressFields` に番地 31-60 で拡張街注記表示 (2 test 追加)
- **Task 14** `f89c6a4`: `HousingRegisterForm` 統合 (state + 自動入力配線 + 動的フィールド、 3 test PASS、 150ms ずらしタイピング演出 + `prefers-reduced-motion` 対応)
- **Task 15** `a627e1f`: `HousingRegisterFormModal` (createPortal + body scroll lock + 最終確認サブモーダル、 4 test PASS、 既存 `workspace/HousingRegisterModal` との名前衝突回避のため別名採用)
- **Task 16** `e165ddd`: `HousingPage` の `register` タブを新モーダルに置き換え (1 file 変更、 旧 `HousingRegisterView` は workspace shell 等 3 箇所が参照のため未削除)
- **Task 17** `(本コミット)`: `network` error key を 4 言語に追加、 TODO.md + TODO_COMPLETED.md 更新、 push、 デプロイ確認
- **Task 6 follow-up** `(別 commit)`: `parseHousingFromText` の `dc`/`server` 変数に明示的型注釈追加 (Vercel tsc 厳密モード対応)

### 検証

- **build**: green (`npm run build` 6.05s success)
- **vitest**: 120 files / 910 tests PASS / 2 skipped (pre-existing Sub-spec 2B 用) / 0 failed
- **TypeScript**: strict mode clean (`tsc -b` 0 errors)

### Plan からの逸脱 (記録、 詳細は session 37 ログ参照)

1. **Plan が Next.js App Router 前提だった** → Vite + Vercel Functions 構造に全面読み替え (LoPo は React Router + Vite)
2. `'use client'` ディレクティブ削除、 `useTranslations from next-intl` → `useTranslation from react-i18next` + 完全キーパス
3. テストでの `vi.stubGlobal('fetch')` top-level 呼び出しが vitest を破壊 → `vi.spyOn(globalThis, 'fetch')` パターンに統一
4. `Small`/`Medium`/`Large` alias を masterData に追加 (Plan 欠落)
5. 日本語「6番地6番」 形式の wardPlot fallback 正規表現追加 (Plan 欠落)
6. `HousingRegisterForm` で既存 `AddressFields` の renderBadge prop 化を避け、 dc/server/area/ward/plot は inline 再実装 (互換性最大化)
7. `HousingRegisterFormModal` という別名採用 (Phase 1 `workspace/HousingRegisterModal` との衝突回避)
8. `HousingRegisterView.tsx` 削除を見送り (3 箇所が参照、 Phase 1 互換維持)

### Phase 2A polish (次セッション以降の優先度低)

- `HousingRegisterView.tsx` の dead-code 撤去 (workspace/HousingRegisterModal も併せて整理)
- `AddressFields` を新モーダルに統合する `renderBadge` 拡張 (現状 inline 重複)
- `/api/tweet-meta` の rate limiting (Cloudflare 移行時に Workers KV 利用)
- tweet photos の `alt` 属性アクセシビリティ向上 (現状 `alt=""`)
- substring 探索 false positive 監視 (アパート 「アパート」 が無関係テキストに誤一致するリスク)

---

## 完了（2026-05-18/19 セッション 34・ハウジング 個室・アパート対応 schema 確定）

**背景**: Phase 2B (Sub-spec 2B 系) 着手前にスキーマ確定が必須 (`docs/.private/2026-05-17-housing-room-types-design.md` で議論メモあり)。 公式仕様を調べ直し (Empyreum wing 概念は誤解、 削除確定。 FC 個室 1-512 / アパ部屋 1-90 / 個人宅は個室不可 等)、 議論メモ §7 の論点 5 件を brainstorming → spec → plan → subagent-driven の標準フローで完走。 UI 本格刷新は **本セッション scope 外** (Sub-spec 2B 系の別 plan で扱う)。

### 完了内容

- **Spec 作成**: `docs/superpowers/specs/2026-05-18-housing-room-types-design.md` (確定論点まとめ)
- **Plan 作成**: `docs/superpowers/plans/2026-05-18-housing-room-types.md` (7 task + 統合確認)
- **Task 1** (`4e2eb89`): 定数追加 (`PRIVATE_CHAMBER_RANGE` 1-512) + `PLOT_RANGE` を 1-30 に訂正 (subdivision 別)
- **Task 2** (`5777c31`): `HousingListing` 型を spec §3.1 で全面置換 — `subdivision: 'main'|'sub'`, `buildingType: 'house'|'apartment'`, `ownerType: 'personal'|'fc'`, `roomKind: 'private_chamber'|'apartment_room'`, `roomNumber` 追加、 旧 `apartmentRoom` 廃止、 `HOUSING_SIZES` から `'Apartment'`/`'PrivateRoom'` 削除
- **Task 3** (`c493328`): `buildAddressKey` を新キー構造 (`${dc}|${server}|${area}|W${ward}|S${sub}|H${plot}|C${room}` 等) で全面置換 + TDD 9 ケース、 `AddressInput` 型シグネチャ先取り更新。 ownerType は key 非参加 (誤登録での重複検知漏れ防止)
- **Task 4** (`2e5a173` + follow-up): `validateAddress` を整合性制約 4 パターン (個人宅 / FC 全体 / FC 個室 / アパ部屋) + 不正組合せ 8 reject で全面書き直し + TDD 12 ケース
- **Task 5** (`0ed4c0c`): `api/housing/_registerListingHandler.ts` の listing 構築を新 schema 対応 (条件付き spread 形式)
- **Task 6** (`32810f8` + follow-up): `firestore.rules` の `housing_listings` create/update に整合性制約 4 パターンを `||` で表現、 helper 5 個新規追加 (`isValidSubdivision`/`isValidBuildingType`/`isValidOwnerType`/`isValidPrivateChamberNumber` 等)、 既存 `isValidHousingSize`/`isValidPlot` も縮小修正
- **Task 7** (`8941d11` + follow-up): `src/lib/housingListingsService.ts` に関連登録特定クエリ 3 つ追加 (`findChambersInPlot`/`findHouseForChamber`/`findApartmentRoomsInWard`) + TDD 4 ケース
- **Task 8** (`db5cafa`): 既存 UI (HousingRegisterAddressFields/HousingRegisterView)、 store (useHousingFilterStore)、 mock (mockListings)、 Filter (FilterPanel) を新 schema 互換に暫定対応、 既存テスト 4 ファイルの fixture 修正、 Apartment 関連テスト 2 件を `it.skip` 化 (Sub-spec 2B で復活前提のコメント明示)
- **Final review fixes**: i18n 4 言語の plot.out_of_range を 1〜60 → 1〜30 に訂正、 `ChamberQuery`/`ApartmentQuery` に `dc`/`server` フィールド必須追加 (Sub-spec 2B 詳細ページ実装前に異 DC/サーバー混入リスクを潰す)

### 検証

- **build**: green (`tsc -b && vite build` success)
- **vitest**: 109 ファイル 850 PASS / 2 skipped (Sub-spec 2B 用、 意図的) / 0 failed
- **TypeScript**: strict mode clean
- **gitleaks**: pass

### Spec / Plan 未対応の引き継ぎ事項 (Sub-spec 2B)

- 登録モーダル 4 タイプ選択 UI (spec §4.1)
- 物件詳細ページの関連登録表示 (spec §4.2)
- 通報 UI 分離 + 家主異議申し立て (spec §5.2/§5.3、 運営連絡先 URL 決定含む)
- Phase 1 設計書 (`2026-05-07-housing-tour-phase1-design.md`) の §4.2/§4.3/§6.1/§6.5/§7/§9.3 改訂
- skip テスト 2 件 (FilterPanel Apartment チップ / HousingRegisterAddressFields Apartment 選択) の新 schema 対応

### ファイル変更概要

- 新規: spec / plan / 3 テストファイル (`src/__tests__/housing/{housingDuplicate,housingValidation,housingListingsService}.test.ts` — vitest config に合わせて配置)
- 修正: 型定義 / validation / addressKey / handler / Rules / service / 既存 UI 5 ファイル / 既存テスト 5 ファイル / i18n 4 言語

---

## 完了（2026-05-18 セッション 33・軽減アプリ 共有チュートリアル UX 刷新）

**背景**: ユーザー実機検証で `share` チュートリアル (2 ステップ) に 3 つの UX バグが判明。 ① 軽減表を開いていないと共有ボタンが出ず TutorialMenu から起動できない、 ② ステップ 2/2 表示中に背後の「共有について」 モーダル (PopularConsentDialog) が操作可能、 ③ 2/2 終了で ShareModal が強制クローズされ最初からやり直し。 brainstorming → writing-plans → executing-plans の標準フローで完走。

### 完了内容

- **設計判断**: 起動ロジック「案 C」 採用 — TutorialMenu からの初学を廃止し、 共有ボタン初回クリック時に自動発火、 完了/スキップ後にメニューに項目出現する流れに。 z-index 重ね順は既に意図通りだったので変更不要 (下: ShareModal `9999` → 中: PopularConsentDialog `10000` → 上: TutorialBlocker `10001` → TutorialCard `10002`)
- **Task 1**: `tutorialDefinitions.ts` の `shareTutorial` を 2 ステップ → 1 ステップに削減 (`share-1-done` のみ、 旧 `share-1-open` ステップ削除)
- **Task 2**: `useTutorialStore.confirmExit` で `activeTutorialId === 'share'` のときスキップでも `completed.share = true` をセット (再学習導線確保)、 vitest 3 件追加
- **Task 3**: `TutorialOverlay` の TutorialBlocker active 条件を `target=null && pill='next'` でも全面ブロックに拡張 (バグ ② 修正)
- **Task 4**: `ShareModal` の `completeEvent('share:modal-opened')` 削除 + 未使用 import 整理
- **Task 5**: `ShareButtons` の onClick で `completed.share === false && !isActive` のとき `startTutorial('share')` 自動発火、 強制クローズ useEffect (27-35 行) 削除 (バグ ③ 修正)
- **Task 6**: `TutorialMenu` の表示条件に `id !== 'share' || completed['share']` フィルター追加 — share 項目は完了/スキップ後のみ表示
- **Task 7**: i18n 4 言語 (ja/en/zh/ko) から `tutorial.share.open.message` キー削除

### 検証

- **vitest**: 109 ファイル 851 件 PASS (+3 from session 32 = 848 → 851)
- **TypeScript**: strict mode clean
- **build**: 成功、 PWA precache 199 entries (5.95 MB)
- **実機検証**: デプロイ後にユーザー目視で確認予定 (UX バグ性質上 Playwright での機械検証は不向き)

### ファイル変更

- 変更: `src/data/tutorialDefinitions.ts`, `src/components/ShareButtons.tsx`, `src/components/ShareModal.tsx`, `src/components/tutorial/TutorialOverlay.tsx`, `src/components/tutorial/TutorialMenu.tsx`, `src/store/useTutorialStore.ts`, `src/locales/{ja,en,zh,ko}.json`
- 新規: `src/__tests__/useTutorialStore.share.test.ts`, `docs/superpowers/specs/2026-05-18-tutorial-share-improvements-design.md`, `docs/superpowers/plans/2026-05-18-tutorial-share-improvements.md`

### 既存ユーザーへの影響 (合意済)

`completed['share']` が `false` の既存ユーザーは、 デプロイ後 1 回だけ案内カードが出る。 「わかった」 で消えて以降は通常動作。 「そんなに使われてないから OK」 でユーザー承諾済。

---

## 完了（2026-05-18 セッション 32・Housing Sub-spec 2B Plan F (Finishing)）

**背景**: セッション 31 で Plan B/D/E まで完成、ユーザー実機確認で基本動作 OK。残り「リリース可能化」 (登録モーダル接続 / ルート整備 / a11y / E2E / 親仕様改訂) を Plan F として一括対応。subagent-driven-development スキルで 12 task + final gap fix を完走。

### 完了内容

- **Task 1**: `src/lib/housing/housingListingsMockService.ts` 抽象層 (Phase 2 で Firestore に差し替え予定、既存 `housingListingsService.ts` (Firestore 同住所検索) と命名衝突回避のため `Mock` 接尾辞)
- **Task 2**: `src/lib/housing/useReducedMotion.ts` フック + AutoScrollList 統合 (SceneryVideo は既存のインライン match、refactor は iterate-first で後回し)
- **Task 3**: `SkeletonCard` (pinterest / right-panel variants、reduced-motion で shimmer 停止)、housing.css に新規 token + class 追加、ビュー未接続だが Phase 2 で接続予定
- **Task 4**: `HousingToast` (info / error variants、`role="status"`、ref guard で onClose identity の timer reset を回避)、グローバル `showToast()` と二重化を JSDoc で明記
- **Task 5**: `HousingRegisterModal` で Sub-spec 2A の `HousingRegisterView` をラップ、未ログイン時は LoginModal 連携、`window.location.hash = 'register'` レガシールートを置き換え、4 言語 i18n 完備
- **Task 6**: TopBar に検索 input 追加、`useHousingFilterStore.setSearchText` に直結 (既存 i18n `topbar.search_placeholder` 再利用)
- **Task 7**: `/housing/p/:listingId` で該当カード pre-expanded、`useParams` → `focusListingId` → CenterArea → PinterestView (useEffect で URL 変更にも追従)、CenterArea が focus 時に強制 pinterest mode 切替
- **Task 8**: `/housing/tour/:tourId` で local store に listings あれば auto-enter (ref guard で再発火防止、`useHousingTourStore.getState()` で subscriber 化を避ける)、Phase 2 で Firestore 復元
- **Task 9**: a11y スモークテスト追加 (全 button accessible name 必須 + 全 img alt 必須)、既存コードは compliant で fix 不要、ガードとして将来回帰検知
- **Task 10**: Playwright E2E 4 シナリオ追加 (browse / filter / listing-url / tour-url) 全 pass
- **Task 11**: 親仕様 (`2026-05-07-housing-tour-phase1-design.md`) §7/§8/§10.1/§11.2/§18 を Sub-spec 2B 参照に書き換え (-131 / +22 行)
- **Task 12**: 最終ビルド検証 (vitest 847 pass、tsc clean、build OK、Plan F の E2E 4 件 pass)
- **Gap fix**: 「完了の定義」 で TopBar register CTA が必須だったが Task 5 時点で抜けていた → TopBar に register ボタン追加 (favorites と theme の間、honey-soft pill)

### 設計判断

- **housingListingsService 命名衝突**: 既存 `src/lib/housingListingsService.ts` (Firestore 本物) と plan の指定パス `src/lib/housing/housingListingsService.ts` が同名だったため、Mock 側を `housingListingsMockService.ts` にリネームしてヘッダーコメントで境界明示
- **ハードコード color/px 完全排除**: housing-design.md の strict rule (TSX 内 rgb/rgba/hex 直書き禁止) を全実装で遵守、必要に応じて新規 token をhousing.css に追加 (`--housing-skeleton-block` / `--housing-toast-info-bg` / 等)
- **defensive infra**: SkeletonCard / HousingToast / housingListingsMockService の 3 つは Phase 2 統合を JSDoc で明示、Plan F 時点ではビュー未接続でも OK

### コード品質・検証

- **commits**: 21 (各 task TDD → spec review → code quality review → fix → 必要に応じて再 review)
- **vitest**: 847 pass (Session 31 から +27)、新規 8 test files
- **TypeScript**: strict mode clean (`tsc --noEmit` エラーなし)
- **build**: 5.92s、PWA precache 199 entries (5.9 MB)
- **Playwright**: Plan F の 4 件 pass、pre-existing `timeline-responsive` 5 件 fail は別件
- **subagent-driven-development**: implementer → spec reviewer → code quality reviewer の 3 段階で各 task 検証、scope creep 防止に有効
- 実機検証は次セッションで対応 (push + Vercel deploy 後)

---

## 完了（2026-05-16 セッション 24・攻撃ジャンプ UI スマホドリルダウン化）

**背景**: スマホで攻撃ジャンプ UI を開き複数回出現する攻撃名を押すと、 1段目 (検索 + 攻撃名リスト) と 2段目 (出現箇所サブリスト) が縦積みになり、 ポップオーバー全高 (最大 ~750px) が可視高さを超えて 2段目選択肢が画面外にはみ出して押せない問題。

### 完了内容

- **スマホでドリルダウン方式に変更** ([HeaderMechanicSearch.tsx](src/components/HeaderMechanicSearch.tsx)): `isMobile && selectedMechanic !== null` のとき 1段目を非表示にして 2段目を入れ替え表示。 2段目ヘッダに「←」 戻るボタン (`ChevronLeft`) と「×」 閉じるボタンを並べた。 PC は左右並列のまま (現状維持)
- **i18n キー追加**: `timeline.nav_mechanic_back` を 4 言語 (ja/en/zh/ko) に追加

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 実機本番で OK 確認済

---

## 完了（2026-05-16 セッション 23・共有取込シート UX 整備）

**背景**: セッション 22 で残った共有取込プレビューのホイール不可をついに完全解消 (子コンポーネント側の取りこぼし)。 ついでにスマホ軽減追加シートをジョブ別セクション化し、 共有取込/上限解消シートのトンマナを「みんなの軽減表」 と統一。

### 完了内容

- **共有取込プレビュー ホイール完全復活**: セッション 22 では親 [ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) の useSmoothWheelScroll を撤去したが、 子の [MitigationSheetPreview.tsx](src/components/MitigationSheetPreview.tsx) 内部にもう 1 つ自前 spring が残っていた。 prop `disableSmoothScroll` で個別 ON/OFF できる構造に変更 → ShareImportSheet からだけ disable。 MitigationSheet / LimitResolutionSheet は従来通り spring 維持
- **スマホ軽減追加シート ジョブ別セクション化**: [Timeline.tsx](src/components/Timeline.tsx) のフラット 5 列 + 複雑 scope ソートを廃止 → パーティ編成順 (MT→D4) のジョブ別セクション + 各セクション内は PC モーダルと同じ `getMitigationPriority` 順。 セクションヘッダーに「MT [ジョブアイコン] 暗黒騎士」 表示
- **スマホ軽減追加シート 使用不可オーバーレイ視認性向上**: グレーアウト `bg-black/60` → `bg-black/30`、 メッセージを box 中央 → 下端配置で奥のスキルアイコンを透視可能に、 button に `overflow-hidden` 追加で文字はみ出し防止
- **共有取込/上限解消シートのトンマナ統一**: `--glass-tier3-bg: var(--share-modal-bg)` でライト白基調化、 高さ `h-[80vh]` 固定 / 角丸 `rounded-t-[20px]` / 左カラム PC 幅 280px / padding `p-3` で「みんなの軽減表」 と統一 ([ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) / [LimitResolutionSheet.tsx](src/components/LimitResolutionSheet.tsx))
- **MitigationSheetPreview ヘッダー整理**: `getJobLabel` (substring(0,3) 雑切り) を撤去 → ジョブ列ヘッダーをジョブアイコン (14px) に、 SKILL 列ヘッダー文字を削除 (列幅は維持)。 3 シート (共有取込 / 上限解消 / みんなの軽減表) すべてに反映

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 実機本番で OK 確認済

**結果**: 「共有取込モーダルだけトンマナ違う」 「ジョブ名が変に省略」 「ホイール効かない」 の 3 大課題が同セッションで解消。 「みんなの軽減表」 と「共有取込」 で見た目が揃い、 ユーザーが期待していた統一感を実現。

---

## 完了（2026-05-16 セッション 22・バグ 5 件 + admin リファクタ + 同期ボタンインジケータ化）

**背景**: セッション 21 末で記録した 4 バグ (スマホアイコン見切れ / DMU 出ない / ホイール不可 / 同期 error 一時表示) を解消。 途中で admin 「コンテンツ管理」 が長年機能していなかったことが判明し、 一括修正。 同期ボタンも仕様確定済の「インジケータ化」 を同セッションで実装。

### 完了内容

- **致命: スマホ Timeline 左端ジョブアイコン見切れ** ([Timeline.tsx](src/components/Timeline.tsx)): MitigationItem (PC 用ドラッグアイコン) rendering ブロックに `!isMobileTimeline` ガード追加。 元々 mobile は MitiIcons (MobileTimelineRow 内) が表示を担うのに PC 用も呼ばれて colStart=0 で左端に貼り付いていた。 1 行修正
- **高: DMU が NewPlanModal に出ない**: `scripts/seed-contents.ts` を新規作成し contents.json → Firestore /master/contents をスマートマージ書込。 DMU 含む全 64 items を反映。 副次的に「contents.json 更新後の Firestore 同期問題」 を 1 コマンド化
- **高: NewPlanModal の並び順**: [NewPlanModal.tsx](src/components/NewPlanModal.tsx) の filteredBosses をシリーズ単位で patch 降順にソート。 「新しいパッチが上」 のユーザー期待を回復
- **高: admin コンテンツ管理が機能していなかった (積年バグ)**: ドロップダウンの KNOWN_SERIES の ID (`arcadion_hw` 等) が実体 (`aac_heavy` 等) と乖離していて NewPlanModal に出ないという長年の地雷。 [AdminContentForm.tsx](src/components/admin/AdminContentForm.tsx) / [AdminContents.tsx](src/components/admin/AdminContents.tsx) / [ContentWizard.tsx](src/components/admin/wizard/ContentWizard.tsx) の 3 ファイルで (1) KNOWN_SERIES 撤廃して CONTENT_SERIES から動的取得 (2) 絶 (ultimate) は seriesId = id 自動 + 新規時は series 同時作成 (3) 新シリーズモードに名前 (JA/EN) 入力追加 + series オブジェクトを API に同送
- **高: admin 同期ボタン smart merge 統一**: [_syncHandler.ts](api/admin/_syncHandler.ts) が JOBS/MITIGATIONS/patchStats を完全上書きしていて、 admin で追加したスキル / ジョブを消す危険があった。 seed-skills-stats.ts と同じスマートマージ方式に統一。 [seed-skills-stats.ts](scripts/seed-skills-stats.ts) もジョブ / patchStats のマージを追加して挙動を統一
- **高: 共有リンク取込プレビュー ホイール不可**: `useSmoothWheelScroll` の hook が条件レンダリング要素には `enabled` プロップを渡す必要がある (= hook の JSDoc にも明記された罠) のに、 [ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) / [LimitResolutionSheet.tsx](src/components/LimitResolutionSheet.tsx) / [LocalImportDialog.tsx](src/components/LocalImportDialog.tsx) の 3 箇所で渡していなかった。 全て `enabled: isOpen` 相当を渡す形に修正
- **中: 同期 error 一時表示**: `pullFromFirestore` ([usePlanStore.ts](src/store/usePlanStore.ts)) の失敗が `_cloudStatus='error'` を設定していた。 5 分定期 PULL / タブ切替 PULL の失敗が「再試行成功後にしばらくしてエラー表示 → リロードで治る」 の原因。 PULL は読み取りのみでデータ影響なしなので、 失敗時は直前の状態を維持するように変更。 PUSH 失敗のエラー表示は維持
- **同期ボタン UI インジケータ化** (相談で仕様確定済): [SyncButton.tsx](src/components/SyncButton.tsx) を「ボタン」 から「インジケータ」 に格下げ。 通常時 = CloudCheck (色なし・文言なし) / 同期中 = RotateCw くるくる回転 (色なし・文言なし) / エラー時のみ赤 + 文言 (タップで再試行)。 スマホ FAB からは sync メニュー完全撤去 ([MobileFAB.tsx](src/components/MobileFAB.tsx))

### 副産物 (継続利用ツール)

- **`scripts/seed-contents.ts`**: contents.json → Firestore /master/contents をスマートマージ同期。 今後 add-content.mjs で新ボス追加後に 1 コマンドで Firestore 反映できる
- **`scripts/audit-contents.ts`**: Firestore master/contents の健全性チェック。 「seriesId が壊れた items が無いか」 等を一発で監査

### TODO / memory 更新

- TODO.md の「相談したい」 から同期ボタン UI 改修 entry を完了として削除
- バグセクションから完了 4 件 (致命 / 高 3 / 中 1) を削除
- memory `feedback_content_firestore_sync.md` を更新: 「seed-contents.ts を実行する」 が正規ワークフロー

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 既存 Firestore データに対しては audit-contents で「異常なし」 確認済

**結果**: ローカル開発を最大限活用しつつ admin の積年バグも一掃。 「今後 admin から普通に追加すれば NewPlanModal にもサイドメニューにも出る」 状態を確立。 Vercel ビルド 1 つで全部反映。

---

## 完了（2026-05-13 セッション 19 終盤・タイムライン末尾 stop + 点線廃止 + ジャンプドロップダウン scroll + vitest hang 対策）

**背景**: 占星ドロー chain prompt 完了後、 ユーザーがタイムライン本体の挙動に複数の懸念を表明。 また vitest プロセスの hang 問題が顕在化したため、 開発環境改善も並行実施。

### 完了内容

- **タイムライン末尾の scroll stop** (commit b30b537): 内側コンテンツ div に `overflow-hidden` 追加 + 末尾余白 70vh → 50vh。 子要素 (フェーズ overlay 等) の overflow が親の scrollHeight に含まれなくなり、 最終イベントが画面中央付近で確実にスクロール末尾になる。 フェーズ高さ計算ロジックには一切触らない (= 過去苦労した安定区画を保護)
- **リキャスト点線描画廃止** (commit b30b537): `<div className="...border-dotted...">` 削除。 セッション 18 のリキャスト専用行が clockswipe 形式で十分代替可能なため。 副次的に「学者列だけ点線が下まで伸びる」 本番限定バグ (= 真因不明、 ローカルでは再現せず) の疑似解決
- **ジャンプドロップダウン scroll 修正** (commit 18733ac): `HeaderGimmickDropdown` / `HeaderPhaseDropdown` / `HeaderMechanicSearch` の内部リストが内部スクロール不可だった問題を、 `onWheel` で `scrollTop += deltaY` する形に変更。 ユーザー要望どおりスムーズスクロールは使わず最もシンプルな実装
- **vitest プロセス hang の自動 cleanup hook** (.claude/settings.local.json): Windows + Git Bash + npx 環境でセッション間にゾンビ vitest が蓄積する問題。 SessionStart hook で 1.5h 以上経過した vitest プロセスを自動 kill。 vitest.config.ts にも teardownTimeout / hookTimeout 追加

### コード品質・検証

- npm run build 6.03s 成功 (TypeScript strict mode)
- 過去の SCH バグ 2 件 + ユーザー報告データ (`afterLastEvent: []`) 検証 → 想定通り
- ユーザー実機での 「学者列だけ伸びる」 症状は真因不明のまま (= 描画削除で疑似解決)、 必要なら別セッションで再調査の余地あり
- リキャスト計算 (resourceTracker / scholarAutoInsert) は完全別ファイルで描画変更に影響なし

**結果**: 4 つの commit (c225291 / 18733ac / b30b537 / 設定変更) を本番デプロイ。 セッション 19 全体としては実装 + 検証 + 開発環境改善まで完了。

---

## 完了（2026-05-13 セッション 19・占星術師ドロー chain prompt）

**背景**: セッション 18 末で実装方針確定済みだった「ユーザーが手動で astral_draw / umbral_draw を 1 個置いた時に "以降 60 秒毎に交互配置しますか?" と確認するモーダル」を完成。 学者の AetherflowChainPromptModal パターンを流用、 違いは「交互ロジック」 のみ。

### 完了内容

- `buildAstrologianDrawChainFrom()` 追加 (src/utils/astrologianAutoInsert.ts) — startKind と逆のスキルから 60s 毎に交互配置、 既存ドローとの時刻差 <60s でスキップ (リキャスト 55s より安全マージン)
- `useMitigationStore` に `astrologianDrawChainPrompt` state + `dismiss`/`confirm` action 追加。 partialize 対象外で localStorage 非永続化 (リロード時に勝手に出ない)
- `addMitigation` で `!autoHidden` かつ astral_draw / umbral_draw 配置時にプロンプト トリガー
- `AstrologianDrawChainPromptModal.tsx` 新規 64 行 — AetherflowChainPromptModal と同一デザイン (glass-tier3 / 青 OK ボタン / Esc・×・背景クリックで閉じる)
- i18n 4 言語追加 (FF14 公式訳語準拠: ドロー/Draw/점지/抽卡)
- `Layout.tsx` でモーダル統合

### コード品質・検証

- vitest 678/678 PASS (新規 8 件含む)、 npm run build 5.98s 成功
- 過去 SCH バグ 2 件 (9eafdf8「元の位置に戻る」 / 9787fd8「リキャスト未満配置」) の判例を AST 側でも回避確認済み: 5 store サイトすべて `hasAnyAstrologianDraw` ガード設置済み、 衝突閾値 60s で recast 55s より厳しめ

**結果**: 実装 ~250 行、 1 セッション完結 (見込み ~150 行を超えたのはテスト追加分)。 commit 後 push + Vercel デプロイまで完了。

---

## 完了（2026-05-13 セッション 18・リキャスト専用行 ツールバー統合版）

**背景**: セッション 17 で表エリア全幅化 (T/H 151px、 6 アイコン対称) を完了。 次の目玉機能として「現在時刻でリキャスト中のスキルを FF14 ゲーム内 HUD と同じ clockswipe 形式で表示」 を実装。 brainstorming で「ツールバー統合 (案 C1)」 を採択 — 新規行を作らず、 既存ジョブアイコンを controlBar に物理移動し、 元のヘッダー位置にリキャスト中アイコンを配置。

**設計書 / 計画書**:
- `docs/superpowers/specs/2026-05-13-recast-row-design.md`
- `docs/superpowers/plans/2026-05-13-recast-row.md`

### 完了内容

- **clockswipe 形式**: FF14 公式と同一 (12 時起点・時計回りに透明領域広がる、 conic-gradient で実装)
- **配置済みスキルのリキャスト中のみ表示**、 明けたら即非表示 (動的)
- **列ごと**: T/H 列最大 6 個、 DPS 列最大 2 個。 超過時は残時間短い順に削除 → 残ったものを配置時刻順で並び替え
- **同 species 複数配置は最近 1 回に集約** (= ゲーム内 HUD と同じ動作)
- **スクロール上端時刻に連動**: ref + CSS variable で DOM 直接更新 (React 再レンダーなし、 GPU 描画)
- **ツールバー統合 (案 C1)**: ジョブアイコンを `JobPickerRow` として controlBar に物理移動、 ヘッダーには `RecastRow` を配置 → 新規行ゼロ
- **位置整合**: Playwright で 8 メンバー列実測、 本文配置済みアイコンと x 座標完全一致 (diff 0.00px)
- **視認性ブラッシュアップ**: overlay 0.55→0.40、 残秒テキスト 10→8px
- **Clock アイコン ON/OFF トグル** (Area C、 デフォルト ON、 localStorage 永続化)
- **Tooltip 対応** (各 RecastIcon にスキル名表示)
- **テーマトークン経由** (ダーク/ライト両対応)
- **i18n** ja/en/ko/zh

### コード品質

- 純粋関数 (recastRow.ts): 16 ユニットテスト、 nested Map 衝突回避、 上限/並び順/同 species 統合 全カバー
- React コンポーネント: forwardRef + useImperativeHandle、 静的 DOM 戦略 (アイコン追加削除なし、 CSS variable で表示切替)
- Map 化最適化 (mitigationDefs O(N×M) → O(N))
- 既存機能リグレッションゼロ (handleScrollSync、 ジョブピッカー機能、 配置済みアイコン、 フェーズオーバーレイ 全て無傷)

**結果**: feat/recast-row ブランチで TDD → spec/code-quality 2 段階レビュー × 7 タスク → main マージ。 vitest 669/669 PASS、 tsc clean、 build ✓。 Playwright 実機検証済み。

---

## 完了（2026-05-12 セッション 17・表エリア全幅化 / メンバー列幅拡張）

**背景**: セッション 14 で sizing 思想 v2 (container max-width 1489) を導入したが、 「フォーカスモード時にタイムラインが画面端まで広がる」 という本来の目的が未達。 メンバー列幅 (T/H 126 / DPS 53) の合計が利用可能幅に届かず、 タイムライン右側に約 153px の空白が残っていた。

**設計書 / 計画書**:
- `docs/superpowers/specs/2026-05-12-table-area-fullwidth-design.md`
- `docs/superpowers/plans/2026-05-12-table-area-fullwidth-implementation.md`

### 完了内容

- T/H 列幅 126 → **151px** (6 アイコン対称、 セッション 16 の対称性思想踏襲)
- DPS 列幅 53px 維持 (2 アイコン対称)
- 各メンバー列の左右マージン **2.9px** (新規 CSS 変数 `--col-member-pad-x`、 実機目視確定)
- 縦スクロールバー非表示 (グローバル、 管理画面 `[data-admin-page]` のみ復活)
- 横スクロールバーは残す (通常モード時の「あえて溢れさせる」 UX 目印 = サイドバー閉じ導線)
- 構造リファクタ: `getColumnCssVar` をマージン込み全幅返却に拡張、 Timeline.tsx / TimelineRow.tsx の inline calc 一元化
- `useMeasuredMemberLayout` で padding 吸収 (内側エリア計測)
- dev tool: ColumnWidthSlider にマージンスライダー追加 (動的微調整可)

**結果**: 1 commit + 1 merge push 済、 vitest 636/636 PASS、 tsc clean、 build ✓

---

## 完了（2026-05-12 セッション 16・軽減アイコン列の対称化 + 互い違いバグ修正 + 左飛びバグ部分修正）

**背景**: セッション 15 で軽減アイコン中央寄せシフトを実装したが「ユーザー意図と乖離」 で revert。 セッション 16 で真因解明:
- 真因は「列幅を超えてる」 ではなく「**最大個数を置いたときの左右余白が非対称**」
- 整数列幅では DPR 2.6 環境で完全 0 ズレ不可能 (subpixel rendering の構造的制約)
- 同時に互い違い配置のバグ + 「左から飛んでくる」 バグも発見

**結果**: 3 commits push 済 (24308e0 / 5a7abc1 / b983c78)、 vitest 636/636 PASS、 tsc clean、 build ✓

### 完了内容

- **列幅 対称化** (b983c78): T/H 126px / DPS 53px 固定 (viewport 非依存)
  - 真因 = DPR snap 3 要因の累積:
    1. 列ヘッダー `border-r` 1px → DPR 2.6 で 0.77 CSS px に snap
    2. アイコン inner div `border border-app-border` も同様に snap → 絵柄が outer の 0.8px 内側
    3. 絶対配置 `style.left` の subpixel round で実描画位置が +0.5px → 5 個並べで累積バイアス
  - 整数列幅では W=125.36 が真の完全対称、 整数化で 0.23px ズレ残 (許容)
  - 列幅は viewport / サイドメニュー / 表エリア幅 いずれにも依存しない固定値
- **互い違いバグ修正** (b983c78): `displayItems.sort` を時刻順最優先に変更
  - 旧: recast 順最優先 → 短 recast の異時刻アイコンが先に配置 → 長 recast (上段、 時刻早い) が後から衝突回避で右にずれていた
  - 新: 時刻順最優先、 同時刻のみ recast/horoscope/id でタイブレーク
- **左飛びバグ修正 (部分)** (24308e0): `MitigationItem` に `layoutReady` prop、 layout 未確定間 visibility: hidden
  - ローカル dev では消失したが本番で再発 → 次セッションで再対応
- **DEV 用ツール** (b983c78): `ColumnWidthSlider.tsx` 新規 (`import.meta.env.DEV` のみ表示)
  - スライダーで列幅をリアルタイム変更 + 実 DOM 計測 (アイコン位置・罫線距離) 表示
  - 本番ビルドには含まれない

### 振り返り / 教訓

- ユーザーの観察報告 (「右余白がない」) を「右側にめり込む」 と推測で誤解した時間があった → user_reports_are_facts ルール再確認
- 整数列幅 + 整数 CSS px の世界では DPR-snap の影響で完全対称は数学的に不可能、 これを認めた上で「ほぼ対称」 を許容するのが正解
- アイデア (リキャスト専用行、 表エリア全幅化、 効果中スキル最上行残し) を記録漏れしていた問題が発覚 → `feedback_record_ideas_immediately.md` 追加で再発防止

### 残課題 (セッション 17 へ引き継ぎ)

- 列幅 0.5px ズレ (許容範囲、 列幅拡張時に同時治療予定)
- 表エリア全幅化 / リキャスト専用行 / 効果中スキル最上行残し の 3 大計画 (詳細: `docs/.private/2026-05-12-table-area-improvements.md`)

---

## 完了（2026-05-12 セッション 16 末・左から飛んでくるバグ 根本治療）

**背景**: セッション 16 で `layoutReady` (1 フレーム visibility:hidden) を実装したが本番で再発。 brainstorming で真因を特定し、 React の `useLayoutEffect` で根本治療。

**結果**: ユーザー本番実機 OK 確認。 1 commit push 済。

### 真因

`useEffect` は paint **後**に実行される → 1 pass 目で `colStart=0` のアイコンが画面に paint された後、 2 pass 目で正位置にジャンプ。 これが「左 (x=0) から飛んでくる」 現象。

プラン切替 (C) で発生しなかった理由 = Timeline コンポーネントが unmount されず `memberLayout` Map が継続保持されていたため。 A (ハードリロード) / B (別ページから戻る) では新規マウントで Map がリセット → 1 pass が必ず空。

### 修正内容

`src/components/Timeline.layoutHooks.ts` の **1 行のみ**変更:

```diff
-import { useState, useEffect } from 'react';
+import { useState, useLayoutEffect } from 'react';
...
-  useEffect(() => {
+  useLayoutEffect(() => {
```

`useLayoutEffect` は paint **前**に実行され、 内部の `setState` も同期再 render される。 結果として 1 pass 目の「colStart=0」 状態は paint されず、 2 pass 目の正位置のみが画面に出る。 ユーザー視覚的には「最初から正位置にある」 状態。

### 既存機能の保持

- `MitigationItem` の `layoutReady` prop + `visibility: hidden` ロジックは保険として維持
- 既存テスト 636/636 そのまま PASS
- パフォーマンス影響なし (useLayoutEffect 内は 8 要素の `offsetLeft`/`offsetWidth` 読込のみ、 1ms 未満)

### 設計書 / 実装プラン

- `docs/superpowers/specs/2026-05-12-left-flying-icons-fix-design.md`
- `docs/superpowers/plans/2026-05-12-left-flying-icons-fix.md`

### 振り返り / 教訓

- brainstorming で真因を分析する段階で「プラン切替で発生しない理由」 を考察したのが突破口
- ユーザー仮説「ローディング画面で隠れている」 は方向は正しいが原因が違った (= Timeline の unmount 有無)
- 1 行変更で根本治療できた = React の lifecycle 理解が決定的に重要だった

---

---

## 完了（2026-05-12 セッション 15・UI 調整 — 全 shell 中央寄せ + 軽減アイコン均等分散 + ツールバー仕切り整合）

**背景**: セッション 14 で sizing 思想 v2 を適用した後、 ユーザーが実機 (DevTools 3840 emulation) で確認したところ 3 件の課題を発見:
1. ヘッダーとサイドメニューが ultrawide で広がっていく (Timeline 単独のみ中央寄せだった)
2. 軽減アイコンの左右余白が非対称 (列幅いっぱいに置いても右側に余白が残る)
3. ツールバーの仕切りが表の縦罫線とズレており、 列を進むごとに累積していた

**結果**: 3 commits、 build / vitest / tsc / playwright (6/6) 全 PASS

### 完了内容

- **Task A** (b3954c9): app-shell 全体を 1489px 中央寄せ
  - `src/components/Layout.tsx` 最外層 (`data-app-shell`) に `md:max-w-[var(--container-max)] md:mx-auto` 適用
  - `src/components/Timeline.tsx` の単独 max-width を除去 (二重化回避)
  - Playwright 中央寄せテストを `data-app-shell` ベースに更新、 左右余白の差 < 5px を assert
  - **挙動**: ultrawide で Sidebar + 主コンテンツ全体が 1489px に収まり、 両側に均等余白
- **Task B** (4605a48): 軽減アイコンを均等分散配置
  - `src/components/Timeline.tsx` の配置ロジックを 3 phase に分離 (placement → cluster shift → rendering)
  - Phase 1: 既存のレーン詰めロジック (PLACEMENT_STEP=12) で `candidateLeft` 確定
  - Phase 2: 非仮想アイコンが 2 個以上のとき `clusterShift = (colWidth - minLeft - maxLeft - ICON_WIDTH - 2*VISUAL_OFFSET) / 2` を計算
  - Phase 3: `absoluteLeft = colStart + VISUAL_OFFSET + candidateLeft + clusterShift`
  - **挙動**: 1 個のときは左寄せ維持 (中央配置の不格好さを回避)、 2 個以上は左右余白均等
  - 例 (タンク列 125px、 5 アイコン): 旧 [0, 12, 24, 36, 48] → 新 [24.5, 36.5, 48.5, 60.5, 72.5]、 両側余白 26.5px
- **Task C** (04532be): ツールバー仕切り線を表列幅 CSS 変数と整合
  - `src/components/Timeline.tsx` の control bar 3 箇所 (Area B/C/D) の固定 px を `calc(var(--col-*-w) - 1px)` に置換
  - Area B: `md:w-[199px]` → `md:w-[calc(var(--col-mechanic-w)-1px)]` (MECHANIC 列上)
  - Area C: `md:w-[99px]` → `md:w-[calc(var(--col-counter-w)-1px)]` (U.Dmg 列上)
  - Area D: `md:w-[99px]` → `md:w-[calc(var(--col-counter-w)-1px)]` (Dmg 列上)
  - **挙動**: 全 viewport (1366-3840) でツールバー仕切りが表列境界と pixel 単位で揃う、 累積ズレ消失

### 検証

- build PASS、 vitest 636/636 PASS、 tsc clean、 Playwright 6/6 PASS

---

## 完了（2026-05-12 セッション 14・sizing 思想 v2 適用 — 全プロジェクト共通思想に統合）

**設計書**: [docs/superpowers/plans/2026-05-12-sizing-philosophy-application.md](superpowers/plans/2026-05-12-sizing-philosophy-application.md)
**統合 spec**: [docs/superpowers/specs/2026-05-12-sizing-philosophy-alignment.md](superpowers/specs/2026-05-12-sizing-philosophy-alignment.md)
**全プロジェクト共通思想**: `C:\Users\masay\.claude\design-philosophy-sizing.md` (v2、 max=base + container max-width)
**結果**: 5 commits、 build / vitest / tsc / playwright (6/6) 全 PASS

### 背景

AllMarks 側で全プロジェクト共通の sizing philosophy が確定 (`~/.claude/design-philosophy-sizing.md`)。 「開発者画面 = MAX、 ultrawide では余白増えるだけ」 という思想を LoPo にも適用。 セッション 13 で実装した「max = base × 1.4〜1.6」 (上下伸縮型) を「max = base」 (上限固定型) に修正。

### 完了内容

- **Task 1** (a740cd0): 列幅 7 token の clamp max を base に統一
  - col-th-w: 180 → **125** (base)、 col-dps-w: 80 → **50**、 phase 80→60、 label 70→50、 time 80→60、 mechanic 280→200、 counter 140→100
  - 1366 ノート: vw 自然値で base × 0.917 ≈ 92% 縮小 (不変)、 1489 で base、 1920+ で **max 固定**
- **Task 2** (91e491f): Playwright 期待値を新方針に更新
  - 1366: 115/46、 1489: 125/50、 1920+: **125/50 で固定** (旧 161/64, 180/80 から変更)
- **Task 3** (78cd6e0): 共通基盤トークン追加
  - `font-size: 16px` を `:root` に明示 (ブラウザ font 設定の影響を無効化)
  - `--container-max: 1489px` (= 開発者画面幅、 ultrawide で中央寄せ用)
  - `--text-scale-multiplier: 1` (将来のアプリ内 text size UI 用に予約)
- **Task 4** (b5b8532): font-size tokens 15 個 を clamp+vw 化 (max=base)
  - 全 14 token (-plus 含む) を PC 用 media query で clamp 上書き
  - 1489 で既存 px 値 (10/11/12/13/14/16/18/20/24/26/36) と一致、 1920+ で max 固定
  - モバイル (< 768px) は既存固定 px のまま (変更なし)
- **Task 5+6** (6b46c78): Timeline 最外層に container max-width 適用 + audit
  - Timeline.tsx 最外層に `md:max-w-[var(--container-max)] md:mx-auto` + `data-timeline-root` 属性
  - **適用判定 (audit 結果)**:
    - Timeline 最外層: **適用** (ultrawide で間延びするメインコンテンツ)
    - LandingPage: **見送り** (内部で既に max-w-[1200px] mx-auto 自己完結)
    - Layout.tsx の Sidebar + main flex container: **不適** (Sidebar ごと制限される)
    - Sidebar / Modal: **不適** (既存 max-w 持つ、 portal mount 等)
  - Playwright 中央寄せ assertion 追加 (3840 viewport で container 幅 ≤ 1489 + container.x > 0)
- **Task 7** (本コミット): TODO 整理 + plan/spec ファイルを追加 + push

### 検証結果

| viewport | T/H 列 | DPS 列 | font-size-base (10px ベース) |
|---|---|---|---|
| 1366 ノート | 115px | 46px | 9.16px (92%) |
| **1489 (本人)** | **125px** ← max | **50px** ← max | **10px** ← max |
| 1920 | **125px** ← 固定 | **50px** ← 固定 | **10px** ← 固定 |
| 2560+ | **125px** ← 固定 | **50px** ← 固定 | **10px** ← 固定 |
| 3840 | **125px** + 中央寄せ余白 | **50px** + 中央寄せ余白 | **10px** + 中央寄せ余白 |

build PASS、 vitest 636/636 PASS、 tsc clean、 Playwright 6/6 PASS (5 viewport + container max-width 中央寄せ assertion)。

### 追加メモ

- `getColumnCssVar()` / `useMeasuredMemberLayout` フックは変更不要 (CSS 変数経由なので clamp 値変更を自動追従)
- `getMemberRefCallback` (セッション 13 で追加) は不変動作確認済
- グローバル `~/.claude/CLAUDE.md` の LoPo 固有メモも削除済 (思想ノイズクリーンアップ)
- アプリ内 text size 設定 UI (`data-text-scale` 属性 + multiplier) は将来 Phase で実装、 CSS 変数のみ予約済

---

## 完了（2026-05-12 セッション 13・タイムライン列幅フルレスポンシブ化 C 案）

**設計書**: [docs/superpowers/plans/2026-05-12-timeline-full-responsive.md](superpowers/plans/2026-05-12-timeline-full-responsive.md) (7 タスク・940 行)
**実行**: `superpowers:subagent-driven-development` で各 task に implementer + spec reviewer + code quality reviewer の 3 段階レビュー
**結果**: 11 commits、636/636 vitest PASS、Playwright 5/5 PASS、tsc clean、build success

### 完了内容
- **Task 1** (07a1146, 064dbfa): `src/index.css` に列幅 CSS 変数追加。`--col-th-w: clamp(110px, 8.395vw, 180px)` / `--col-dps-w: clamp(45px, 3.358vw, 80px)` / `--col-phase-w` / `--col-label-w` / `--col-time-w` / `--col-mechanic-w` / `--col-counter-w` / `--col-header-chunk-w` / collapsed バリアント。1489 基準で全 viewport を proportionally にカバー
- **Task 2** (4f8b706, db6f5f7): `getColumnCssVar(role)` を `src/utils/calculator.ts` に追加。CSS 式 `'var(--col-th-w)'` / `'var(--col-dps-w)'` を返す。旧 `getColumnWidth` は `@deprecated` 注釈付きで一旦残置
- **Task 3** (cbc4c65, 81b1bca): `src/components/Timeline.tsx` の固定 px Tailwind クラス 15 箇所を `w-[var(--col-*-w)]` に置換。RAW/TAKEN の冗長な `md:` prefix 整理
- **TimelineRow.tsx 設計書漏れ補正** (1ebd982): PC body 行を担う `src/components/TimelineRow.tsx` の 7 箇所も同じパターンで CSS 変数化。Header と Body の列幅整合性を確保
- **Task 4** (c6edda1, 44f0ec1): `src/components/Timeline.layoutHooks.ts` 新規作成。`useMeasuredMemberLayout` フックで `offsetLeft`/`offsetWidth` + `ResizeObserver` + `window.resize` 監視。`refVersion` state + ref-callback パターンで初回マウント時の ref 解決を処理。`data-member-role` / `data-member-id` 属性追加 (Playwright 用)。`MAX_LEFT` 計算を `layout?.width ?? fallback` に置換
- **Task 5** (9409c67): deprecated `getColumnWidth()` を `calculator.ts` から削除。`src/` 配下の参照 0 件確認
- **Task 6** (3f18abc): Playwright 5 viewport (1366/1489/1920/2560/3840) 回帰テスト追加。`@playwright/test` devDependency + chromium のみインストール。1489 で `Math.round(width) === 125` (tank) / `=== 50` (dps) 厳密検証。他 viewport は ±0.5px tolerance
  - **付随バグ修正**: `setMemberHeaderRef` のインライン ref コールバック `(el) => ...` が毎レンダーで新インスタンス生成 → React が detach/attach 繰り返し → `setRefVersion` 無限ループ → ErrorBoundary。`getMemberRefCallback(id)` を `useRef<Map>` でキャッシュし安定化
- **Task 7** (3bde442 + 本コミット): TODO 更新 + push

### キーポイント
- **1489 厳密検証**: `1489 * 0.08395 ≈ 125.00` (T/H), `1489 * 0.03358 ≈ 50.00` (DPS) が clamp の中央域で確定。Playwright で round 後の整数値で `.toBe(125)` / `.toBe(50)` 厳密一致
- **2pass 測定の挙動**: 初回レンダーで refs が null のため軽減アイコンは fallback (125/50) で 1 フレーム描画。その直後の useEffect で実測値に上書き
- **DPR 非依存**: clamp + vw は CSS 論理 px ベース。本人 DPR 2.58 / 多数派 DPR 1 でも計算結果同じ
- **Phase 2 (別プラン)**: フォント (`--font-size-*`) と spacing の rem 化は影響範囲が広い (LP/モーダル/サイドバー全体) ため別建てに切り出し済

### 検証結果
| viewport | tank 実測 | dps 実測 | 期待 |
|----------|----------|---------|------|
| 1366 | ~115px | ~46px | clamp min 寄り |
| **1489 (本人)** | **125px (round 厳密)** | **50px (round 厳密)** | 基準値 |
| 1920 | ~161px | ~64px | 多数派 |
| 2560 | 180px | 80px | max クランプ |
| 3840 | 180px | 80px | max クランプ |

## 完了（2026-05-08）

### Sub-spec 2A: Registration (画像なしモード) 完了 2026-05-08
- [x] タグマスタ 147 件 × 4 言語 i18n (`src/data/housingTags.ts` + ja/en/ko/zh.json)
- [x] フォーム入力検証 純粋関数 (`src/utils/housingValidation.ts`、validateAddress/Tags/Description/RegistrationDraft)
- [x] 登録枠 D 案ロジック 純粋関数 (`src/utils/housingQuota.ts`、累計 30 まで無制限 + 30 超過後 1 日 5 件、UTC 日付ベース、同日削除で count 戻し)
- [x] 同住所キー生成 純粋関数 (`src/utils/housingDuplicate.ts`、`buildAddressKey` で `dc|server|area|W{n}|P{n}|size[|R{n}]` 形式)
- [x] `HousingListing.addressKey: string` 必須フィールド追加 (型 + firestore.rules 検証 + 本番 rules デプロイ)
- [x] Firestore listings 読取 service (`src/lib/housingListingsService.ts`、`findListingsByAddressKey`)
- [x] `/api/housing` 3 アクション (can-register / register-listing / check-duplicate)、Admin SDK + AppCheck + RateLimit + runTransaction でアトミック
- [x] API クライアントラッパー (`src/lib/housingApiClient.ts`、QuotaExhaustedError 含む)
- [x] HousingPage 3 タブ (探す/回る/登録) 切替 + URL ハッシュ同期 (`HousingPage.tsx` + `HousingTabBar.tsx` + `HousingPlaceholderView.tsx`)
- [x] 登録フォーム本体 (`HousingRegisterView.tsx`) + 住所入力フィールド + タグピッカー (5 件上限) + 紹介文入力 (200 文字) + 残り枠表示 + 重複警告ダイアログ + オンボーディングダイアログ + 未ログインプロンプト
- [x] App.tsx の `/housing` ルートを `HousingComingSoonPage` から `HousingPage` に差し替え
- [x] 437 tests PASS (既存 + 新規 約 80 件) / tsc clean / npm run build 成功
- [x] Playwright 自動チェック 7/7 OK (3 タブ表示 / オンボーディング初回 → 「はじめる」で閉じる / LocalStorage flag で再訪時 0 / 未ログイン `/miti` 誘導 / 探す・回るタブのプレースホルダ)
- 設計書: `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` §6 / §11 / §12
- 実装プラン: `docs/superpowers/plans/2026-05-08-housing-sub-spec-2a-registration.md` (26 tasks、3,682 行)
- 実装フロー: subagent-driven-development で各タスクごとに implementer + spec reviewer + quality reviewer の 3 段階レビュー
- スコープ外 (後続): 画像 3 択 (SNS URL / サムネアップロード) は Sub-spec 2C / ギャラリー検索は Sub-spec 2B / リキッドグラス + ルーペは Sub-spec 2C 以降

## 完了（2026-05-01）
- [x] **PiP（Floating Timeline）復活**: 過去に「Chrome の Document Picture-in-Picture API は OS レベル透過不可」で UI 非表示にしていたカンペビューを復活。仕様変更: ①透過機能完全撤去（将来 Chrome 透過対応で再検討）②単一選択 → 多選（個別/全員/任意組合せをジョブピッカー多選で統合）③自ジョブ未設定時 全員フォールバック ④透過の代わりに背景カラーピッカー追加（テーマ別デフォルト #0F0F10/#FAFAFA + localStorage `pip-bg-color` 永続化、HTML5 native input[type=color] + LoPo 風小色丸ボタン）⑤PC 起動ボタン disable 撤廃（自ジョブ未設定でも開ける）⑥モバイル FAB「カンペ」項目復活。設計書 `docs/superpowers/specs/2026-05-01-pip-revival-design.md`、実装プラン `docs/superpowers/plans/2026-05-01-pip-revival.md`、subagent-driven-development で 8 task + 最終レビュー進行。純粋関数 3 つ（`computeCueItems` / `computeInitialSelection` / `getDefaultBgColor`）を `src/utils/pipViewLogic.ts` に TDD 抽出（16 tests）し、PipView.tsx 本体改修。i18n 4 言語で 3 キー追加 / 2 キー削除。最終 328 tests PASS（既存 312 + 新規 16）、tsc clean、`npm run build` 成功。最終レビューで Important 1 件（cursor-pointer 欠落）fix 済み、Minor 3 件は本番実機確認で判断、Nice-to-have 2 件は次タスクで対応可。
- [x] **「自分のプラン」バッジ機能 諦め決定**: 共有 API が ownerId を Firestore に書き込んでいないため動作不能。LoPo は個人特定情報を一切収集しない方針 → ownerId 書き込みは仕様禁止。今後は公式ロゴ OGP で自分のプランを識別する運用に切替。バッジ実装コードは残置（_popularHandler.ts と PopularBrowseView.tsx）、撤去するかは別途相談。

## 完了（2026-04-28）
- [x] **OGP プレビュー「永遠に生成中」5 段階修正**: ①SW NetworkOnly で `/og/` を SW 介入から除外 ②`<img>` に key 追加で URL 変更時の再マウント保険 ③`setOgImageUrl(null)` 挟みで bail-out 回避 ④closure 回避で `processLogoFile` から logoUrl 引数化（真の根本原因） ⑤PUT レート制限 5→15 で連続操作の失敗トースト解消。
- [x] **野良主流 OGP 表示ポリシー整理**: プラン名 OGP 焼き込み機能を全削除、ボトムシート/X 共有テキストからプラン名撤去、共有モーダル初回 POST 直前に同意ダイアログ、ロゴトグル＝身元公開意思の明確化、4 言語常駐キャプション。
- [x] **致命バグ修正＋自動採番**: 野良主流ボトムシートからのコピーで `ownerId: ''` 空文字になり雲同期で「別端末で削除」誤判定→プラン消失バグを修正（`ownerId: 'local'` 統一）。`generateUniqueTitle` で野良コピー＋下にコピーの両方で同コンテンツ内重複時に `(2)` 自動採番。
- [x] **PopularConsentDialog ライトモード白背景化**: 他主要モーダルと同じ `--share-modal-bg` 適用。
- [x] **スマホ空行操作対応**: イベントのない行でもタップ→軽減追加シート、長押し→EventModal が開くよう `events.length > 0` ガード撤去。

## 完了（2026-04-20）
- [x] **LP SEO 改善（レベル 1）**: index.html / 4 言語 locale / LandingPage.tsx を更新、「FF14 軽減表」等の検索キーワードをメタタグに反映（多言語 ja=軽減表、en=mitigation sheet、ko=경감 시트、zh=减伤轴）。
- [x] **Vercel 2026 年 4 月セキュリティインシデント対応**: Vercel CLI 導入、監査（不正侵入痕跡ゼロ確認）、全カスタム環境変数を production/preview で sensitive 化（29本）。

## 完了（2026-04-18）
- [x] **サイドバータブのリセットバグ修正**: プラン削除/コピー等の操作でタブが勝手に零式へ戻るバグを解消。useEffect 依存配列から `plans` を外し、`currentPlanId === null` の else 分岐を削除（ユーザー選択中のタブを保持）。旧サイドバーUI時代の名残。
- [x] **ヘッダー縦罫線の太さ統一**: 3本の罫線を `w-px shrink-0` で統一（サブピクセル圧縮対策）。完全に揃わないケース残るが実害なしで放置判断。
- [x] **フェーズ/ラベル隣接規約の本質修正**: 境界罫線消失バグを根本解消。新規約 `phase[i].endTime + 1 === phase[i+1].startTime` で描画仕様と整合。`loadSnapshot` 時に旧規約データを自動修復。全219テストPASS、実機検証済み。
- [x] **隣接フェーズ/ラベル境界追従**: `updatePhase/Label*Time` 4関数で追従挙動を統一。被せた側が隣を追従、最低幅1秒で停止。新規テスト19ケース追加。
- [x] **最終フェーズ/ラベル endTime 修正**: `ensurePhase/LabelEndTimes` に `maxTime` 引数追加、15呼び出し元で `timelineEvents` 最大時刻を渡すよう修正。
- [x] **admin画面 i18n キー生表示修正**: ja/en/zh/ko 全4言語で `admin` オブジェクトの閉じ `}` 位置ズレ修正（`ugc_*`/`featured_*` キーが backup 内に誤配置）。
- [x] **Phase 3 実装完了**: 管理画面 Featured 設定UI + OGP 高速化 + 削除防止。`PATCH /api/popular`、`AdminFeatured.tsx`、`/og/{hash}.png` 静的配信、`keepForever` で cron 削除除外。11 commits。
- [x] **3層防御の自動診断 全プロジェクト対応**: `check-secret-defense-layers.sh`（SessionStart 診断）、`setup-secret-defense.sh` に Layer C 自動適用追加、グローバル CLAUDE.md にセキュリティ標準セクション追加、Booklage にも適用。
- [x] **シークレット漏洩 3層防御 導入**: Layer A (SessionStart worktree scan) / Layer B (gitleaks pre-commit) / Layer C (GitHub Secret Scanning + Push Protection)。worktree に staged で残っていた `.env.vercel-check` が契機（commit/push 未遂、実害なし）。
- [x] **Phase 2 本番観察完了**: UID 重複排除、anonId 新規記録、App Check 強制、クライアント dedup すべて動作確認。
- [x] **shared_plans 管理人テスト 179件一括削除**（ツイート用 `5lCMACDB` のみ残存）。
- [x] **OGP 画像 X 表示問題 最終解決**: Firebase Storage 静的キャッシュ + Lazy 生成 + 週次 Cron。`lopoly.app/og/{hash}.png`、30日未使用削除、4言語 Privacy Policy `privacy_section6` 追加。

## 完了（2026-04-17）
- [x] フェーズ/ラベル追加: 強制2秒間バグ修正（endTime計算: containingPhase引き継ぎ+maxEventTimeフォールバック）
- [x] ボトムシートUX改善: 初期ロード全面スピナー + コピー進捗実値・パルス・最低400ms（本番確認済み）
- [x] 通知音パス修正: FFXIV_SE/FFXIV_Notification.mp3 へ更新
- [x] 野良主流ランキング再設計 + Phase 1/Phase 2 実装
- [x] タンクLBスキル追加（Lv1/2/3 × 4ジョブ）

## 完了（2026-04-16 後半）
- [x] リタージーオブベル: 管理画面から追加→Firestoreデータ修正（ID正規化+family追加）→seed事故で消失→mockData.ts追加で復元
- [x] 管理画面SkillWizard改善: クリーンID生成（ランダムサフィックス廃止）、family入力欄追加、IDプレビュー・編集・重複チェック
- [x] seed-skills-stats.tsをマージ型に変更（管理画面追加スキルがseedで消えない）
- [x] ディヴァインカレス: requiresWindow=30追加（Divine Grace 30秒ウィンドウ）

## 完了（2026-04-16）
- [x] OGP共有画像: アスペクト比維持（正方形強制→長辺1056pxリサイズ、object-fit: contain）
- [x] 共有モーダル: ライトテーマ視認性改善（--share-modal-bg変数でShareModalのみ白背景化）
- [x] 利用規約: UGCセクション追加（著作権帰属・ライセンス・免責・削除権限・通知窓口、4言語対応）
- [x] ShareModal: ロゴアップロード注意書き追加（利用規約リンク付き、4言語対応）
- [x] 管理画面: UGC管理ページ追加（shareId検索→ロゴ確認・削除）
- [x] プラン複製バグ修正: コピー→開く→「別端末で削除」誤判定を修正（ownerId:'local'設定）
- [x] NewPlanModal: パーティクリア漏れ修正（前プランのジョブ引き継ぎバグ）
- [x] UIブラッシュアップ: タイムライン行ホバーライン（4セル下辺、CSS変数調整可能）
- [x] ライトモード: 5モーダル白背景化（削除確認・FFLogs・ログイン・オートプラン・新規作成）
- [x] チュートリアルカード: 緑バーはみ出し修正（overflow-hidden）
- [x] UGC管理: ロゴ削除時にハッシュブロックリスト登録（SHA-256で再共有防止、個人情報保存なし、4言語対応）
- [x] ヒールスキル15種追加（WHM6/SCH4/SGE4/AST1、4言語対応、公式データベースから正確なデータ取得）
- [x] 秘策：展開戦術を個別スキルに分離（秘策+展開戦術）
- [x] アスペクト・ヘリオス/コンジャンクション・ヘリオスを常時表示化
- [x] リリーゲージ実装（初期3、20秒リチャージ、ハート・オブ・ソラス消費）
- [x] ケーラコレ/タウロコレの軽減10%排他制御（exclusiveWith機能追加）
- [x] 鼓舞/Eディアグノシスのhidden解除
- [x] 展開戦術バリアコピー実装: 鼓舞のバリア値（バフ込み）を参照してパーティにコピー、鼓舞選択UI付き
- [x] 秘策(SCH)クリ確・ゾーエ(SGE)×1.5の消費型バフをバリア計算に反映
- [x] 生命回生法・クラーシス等のtarget指定healingIncreaseをバリア計算に反映
- [x] 展開戦術の効果時間を鼓舞の残り時間に動的連動
- [x] 瞬発スキル（duration≤1秒）のエフェクト棒を非表示化
- [x] 罫線トグルボタンの即時反映修正（getState()→リアクティブ購読）
- [x] 法務: 利用規約整備 — UGC著作権免責・ライセンス付与・禁止事項・削除権限・通知窓口（消費者契約法配慮）

## 完了（2026-04-14）
- [x] プラン複製時に最新テンプレートのイベントを自動使用（軽減・パーティは保持、圧縮済みプラン対応）
- [x] 幽霊フェーズ除去: CSVインポート残骸のデフォルトフェーズ削除+テンプレート読み込み時自動フィルタ
- [x] ラベル列折り畳み機能（Shift+L / ドロップダウンボタン、16pxバー、localStorage永続化）
- [x] ラベル列スマート連動（フェーズ畳み時：ラベルありなら残る、なしなら自動折り畳み）
- [x] フェーズ名空白対応（テンプレートで空名→オーバーレイ非表示、ドロップダウンはPhase Nフォールバック）
- [x] フェーズ名変換修正（Sidebar/usePlanStore: || → ?? でフォールバック除去）

## 完了（2026-04-13）
- [x] フェーズ/ラベルのendTime必須化リファクタ
- [x] サイドバー大幅改築（設計確定・実装完了）
- [x] SVGパスエラー: LoPoButton.tsxのpathをResizeObserver+数値計算に修正
- [x] Firestore削除同期エラー: ownerId='local'除外+権限エラー時リトライ停止
- [x] WHMリタージーオブベル: 管理画面から追加+Firestoreデータ修正済み
- [x] SCH鼓舞激励の策 / SGE Eディアグノシス: hidden解除+展開戦術バリアコピー実装
- [x] UGC管理: ロゴ削除→ハッシュブロックリスト方式で解決
- [x] 管理ダッシュボード（シンプル版）— ユーザー数・プラン数 + 外部リンク3つ
- [x] ランディングページのLangToggle（2言語→4言語対応）
- [x] コンテンツ名のzh/ko翻訳（contents.json + 管理画面対応）
- [x] Firestoreへのzh/koマイグレーション実行（63件反映済み）
- [x] スキル・ジョブ名のzh/ko翻訳（mockData.ts 21ジョブ+123スキル、Firestore同期済み）
- [x] テンプレート技名のzh/ko翻訳機能（管理画面FFLogsモーダル拡張済み）
- [x] 古いプランの自動アーカイブ（30件超過時）→ 過去零式は自動アーカイブ化済み
- [x] 全カテゴリ7日未使用でサイレント圧縮済み

## 完了（2026-04-09）
- [x] フッターglass効果: Layout.tsx + PopularPage.tsxにglass-tier3 glass-frame適用
- [x] チュートリアルSTEP1-3サイドバーハンドル右罫線消失バグ修正（右側代替ライン追加）
- [x] 同一時刻イベントの表示順保証: MT→ST→AoEの順で常に表示（Timeline.tsx eventsByTime）
- [x] PC版ヘッダー開閉ハンドル・SyncButton雲アイコンの位置ずれ修正（glass CSS定義順序修正）
- [x] PC版パーティ編成モーダルのクリック不能修正（endDrag再レンダー+SlotItem内部定義問題）
- [x] パーティ編成D&D時テキスト選択反応修正（user-select:none追加）
- [x] パーティ編成ジョブアイコン常時表示に変更
- [x] スマホ長押し時テキスト選択修正（user-select:none追加）
- [x] スマホヘッダーコンテンツ名省略修正（subtitleサイズ+muted色に縮小）
- [x] glass-panelのborder/shadow除去、画面いっぱい化
- [x] FAB言語切替を横一列spring展開に実装
- [x] 長押しチュートリアルをMobileGuide 6枚目に追加
- [x] ラベル分裂 → Phase/Labelリファクタリングで根本解決
- [x] テンプレートエディタ空ラベル編集不可 → undefinedマッチ修正

## 完了（2026-04-06 セッション2）
- [x] ジョブ名ツールチップが言語設定に追従しない → getPhaseName()でzh/ko対応、フォールバック順en優先に修正
- [x] Tooltipのz-indexをモーダルより上に変更（9999→99999）
- [x] テンプレート保護: 管理画面保存時にlockedAt自動付与（FFLogs自動登録で上書き防止）
- [x] テンプレートエディタ一括編集（チェックボックス選択 + AAフィルタ + 一括変更ポップアップ）
- [x] AA一括対象指定（MT/ST等を一括で設定）→ 一括編集機能に統合
- [x] 技名ソート・フィルタ（AAのみ表示→一括指定等）→ AAフィルタに統合
- [x] 翻訳管理画面にジョブ名カテゴリを追加（スキルカテゴリ内、zh/ko翻訳管理可能に）
- [x] ClearMitigationsPopoverのジョブ名表示を多言語対応
- [x] PartySettingsModalの残存ハードコード（job.name?.ja）を修正

## 完了（2026-04-06）
- [x] **新規作成で空テーブル** — テンプレート読み込みスキップ、コンテンツ名+プラン名のみ保持、hideEmptyRows=false
- [x] **互換配置UIの青ハイライト** — 選択中カードを透き通った青（blue-500/10）に変更、resetは赤のまま
- [x] **フォーカスモード左右対称化** — 右罫線ストリップ追加（フォーカスモード時のみ表示、スプリングアニメーション）
- [x] **フォーカスモード用ボタン** — 右ストリップにテーマ切替・ジョブハイライト・保存インジケーター（弾むアニメーション付き）
- [x] **フッター間隔修正** — mb-2→mb-4、ヘッダーハンドル〜表の間隔と統一
- [x] **フォーカスモード時ヘッダー間隔修正** — paddingTop 36→23で展開時と同じ間隔に
- [x] **保存インジケーターアニメーション修正** — animate-spin→animate-pulse（雲が回転しなくなった）
- [x] **サイドバーカテゴリボタン横スクロール** — ホイールで横スクロール対応

## 完了（2026-04-05 セッション2）
- [x] **チュートリアルデータ消失の根本修正** — ログイン後プラン自動読み込み廃止、スナップショットsessionStorage保存、チュートリアル中localStorage永続化停止
- [x] **FFLogsダメージ精度改善** — cast2パス方式、AoE中央値（タンク除外）、同名技統一、パケット分離マージ、両タンクTB扱い、playerDetailsネスト対応、FFLogsモーダルz-index修正、ログインボタン修正、multiplier+max+5%バッファ、TB同名技統一、auto-register LocalizedString対応
- [x] **スマホUI大幅改善** — 軽減ボトムシート、リキャスト表示、メニュー排他制御、ノッチ対応、競合ハイライト
- [x] **PC UI改善** — ラベル末尾表示修正、ツールチップ、ジョブアイコン拡大
- [x] **バグ修正** — スプシダメージ取込、WelcomeSetupキャンセル、logsインポート全面書換、保存警告削除、zh/ko黒塗りバグ
- [x] **myMemberIdスナップショット共有** — 端末間でmyMemberIdを共有

## 完了（2026-04-05 整理）
- [x] **言語切替UIの見直し** → 地球儀アイコン+ドロップダウンにシンプル化（ツールチップ・ホバー反転・回転アニメーション付き）
- [x] **GitHub Public化** → リポジトリ公開、シークレット漏洩チェック・.gitignore徹底完了
- [x] **セキュリティ・プライバシー調査** → Public化前に実施済み
- [x] **デザイントークン Phase 2** → タイポグラフィ値調整完了（CSS変数の値変更のみで全UI反映）
- [x] **PC⇔スマホ同期が全く機能しない** → 修正済み（PULL追加・forceSyncAll安全化・タイムスタンプ比較・インジケータ3段階化）
- [x] **PWAでGoogleログインできない** → Googleログイン自体を廃止。Discord/Twitterはリダイレクト方式のためPWAでも動作
- [x] **チュートリアルSTEP1: スクロール禁止してないため進行不可になる** → wheel/touchmoveブロック追加
- [x] **チュートリアル開始時: サイドバーの罫線が一部消える** → チュートリアル中のみ代替罫線表示
- [x] **新プランを開いたとき表の一番上にスクロールされない** → currentPlanId監視でscrollTopリセット
- [x] **エクスポート/インポート機能** → バックアップ/復元として実装済み（個人情報除外、平文JSON、2段階確認）

## 完了（2026-04-01）
- [x] **管理者ログインモード** — LoginModalにisAdmin時のみ黄色の管理画面ボタン表示。メアドやUID漏洩なし（Firebase Custom Claims判定）
- [x] **フォントサイズ全体拡大** — data-font-scale="1"、最低12px、表エリア・フッター除外
- [x] **チュートリアル全面刷新** — mainマージ+デプロイ済み
- [x] **テンプレート管理画面リデザイン設計書** — 承認済み（`docs/superpowers/specs/2026-04-01-template-editor-redesign.md`）
- [x] **βフィードバック整理** — `docs/BETA_FEEDBACK.md` に11項目を対応状況付きでまとめ

## 完了（第63セッション 2026-03-31）
- [x] **コントロールバーのアイコン配置見直し** — チートシートボタンをArea Cに無効化状態で移動。フローティングビュー切り替えUI削除
- [x] **ヘビー級まとめ共有** — まとめて共有モード中、シリーズ名横にチェックボックス追加。各層の1番目のプランを一括選択/解除
- [x] **AA設定ボタンのスタイル修正** — 黒塗り→アウトライン+ホバー反転
- [x] **コピートーストのスタイル統一+ESC対応** — 他トーストと同じデザインに統一、ESCでキャンセル可能
- [x] **キーボードショートカット追加** — S(サイドバー), H(ヘッダー), P(パーティ), F(フォーカスモード)
- [x] **ツールチップのテーマ配色統一** — 反転配色を廃止、ダークはダーク/ライトはライトに

## 完了（第61セッション 2026-03-31）
- [x] **管理画面ウィザードファースト刷新** — 全11タスク実装完了＋本番デプロイ。ウィザード共通フレームワーク（useWizard + AdminWizard）、ダッシュボードをアクションカード方式に刷新、コンテンツ/テンプレート/スキル/ステータス各ウィザード、スキル編集/ジョブ追加ウィザード、バックアップ復元API+画面、監査ログAPI+画面。新規10ファイル、変更5ファイル、i18n 149キー追加

## 完了（第60セッション 2026-03-31）
- [x] **12関数→7関数に圧縮完了** — admin(3→1), auth(2→1), template(2→1), share+share-page(2→1)に統合。`_` プレフィックスのハンドラーファイル+ルーターindex.ts方式。Discord/Twitter開発者コンソールのコールバックURL変更済み
- [x] **OGP画像追加** — public/ogp.pngが存在せずDiscordプレビューが表示されなかった問題を修正
- [x] **プラン未選択時の空パネルデザイン刷新** — 完了確認
- [x] **ステータス表示** — ライトモードでデザイン見直し完了確認
- [x] **Firestoreバックアップ設定** — 週次（月曜）自動バックアップ、14日保持で設定完了
- [x] **LoPo管理マニュアル作成** — 全キー・URL・手順を `C:\Users\masay\Desktop\LoPo管理マニュアル\` に保存

## 完了（第58セッション 2026-03-31）
- [x] **ログイン促進UI実機確認＆改善** — シークレットウィンドウで表示確認OK。ShareModalゲストヒント文言をチームロゴ限定→汎用表現に改善。サイドバー名前入力ダイアログにもログイン促進テキスト+LoginModal追加
- [x] **CSP強化** — vercel.jsonに`object-src 'none'`（プラグイン禁止）、`base-uri 'self'`（baseタグ注入防止）、`form-action 'self'`（フォーム送信先制限）を追加

## 完了（第57セッション 2026-03-31）
- [x] **i18nハードコーディング精査** — PartyStatusPopover(スキル名21個→SKILL_DATA動的取得)、MitiPlannerPage/LandingPage(document.title)、CsvImportModal(UIテキスト全件)、ErrorBoundary(エラーメッセージ)、ConsolidatedHeader/ShareButtons/SharePage(defaultValue日本語削除)、CheatSheetView/TimelineRow(alt属性)
- [x] **非ログインユーザーへのログイン促進UI** — NewPlanModal・ShareModalに非ログイン時のさりげない案内テキスト+ログインリンク追加（★実機確認未完了→第58セッションで要確認）

## 完了（第56セッション 2026-03-31）
- [x] **アプリ動作パフォーマンスの最適化** — React.memo（MitigationItem, ContentTreeItem, SaveIndicator）+ useShallow（Timeline, Sidebar, ConsolidatedHeader, CheatSheetView, Layout）+ useCallback（Timeline内6ハンドラ）+ Layout.tsx分割（MobileHeader, MobilePartySettings切り出し）
- [x] **サイドメニュー・ヘッダーの開閉パフォーマンス最適化** — 上記React.memo+useShallowで対応
- [x] **イベントポップオーバー改善** — glass-tier3追加、削除ボタン赤文字+角丸、Escape対応
- [x] **Redo修正** — Ctrl+Shift+Zでe.keyが大文字'Z'になる問題をtoLowerCase()で解決 + canUndo/canRedoリアクティブセレクタ追加
- [x] **MyJobボタン黄色統一** — PartySettingsModal, MobilePartySettings, ConsolidatedHeader, MobileBottomNavの全箇所で黄色に変更
- [x] **JobMigrationModalライトモード修正** — text-white→text-app-text、ダーク専用背景除去、createPortalでbody描画（ヘッダー埋まり問題修正）
- [x] **オートプランi18n翻訳キー追加** — auto_plan_title/confirm/confirm_mobileをen.json/ja.jsonに追加
- [x] **ConfirmDialogのi18nハードコーディング修正** — confirmLabel/cancelLabelをt()キーに変更

## 完了（第55セッション 2026-03-30）
- [x] **MitigationSelectorにEscapeキー対応追加** — useEscapeCloseフック適用。対象選択サブビュー表示中はEscでスキル一覧に戻り、スキル一覧でEscを押すとモーダル全体を閉じる段階的閉じ動作

## 完了（第54セッション 2026-03-30）
- [x] **Escapeキーでモーダル・メニューを閉じる** — useEscapeCloseフック（スタック機構付き）で全モーダル14個+ポップオーバー3個+Sidebar⋮メニューに対応
- [x] **PartyStatusPopover contentLanguage依存修正** — useMemoの依存配列にcontentLanguageを追加（言語切替時にスキルプレビューが再計算されないバグ修正）
- [x] **パーティメンバーID定数の共通化** — Layout.tsx(2箇所)・Timeline.tsx(2箇所)・useTutorialStore.ts(1箇所)の重複をsrc/constants/party.tsに集約

## 完了（第53セッション 2026-03-30）
- [x] **Sidebar: button入れ子問題** — 親button→div role=button化、ホバーボタン表示、⋮メニューPortal化、削除ボタン追加、プラン名ツールチップ、レイアウト変更

## 完了（第51セッション 2026-03-30）
- [x] **Firestore同期修正** — 端末間同期が動作していなかった問題を修正。migrateOnLoginでのFirestore書き戻し、dirtyフラグ管理、3分クールダウン、forceSyncAllタイムアウト、カウンター自動修復（repairPlanCounts）、5分定期バックアップ同期
- [x] **Firestore同期: 3分クールダウン実装** — syncToFirestoreに_lastSyncAtチェック追加
- [x] **起動時Firestore読み込み非ブロッキング化** — チームロゴ読み込みをバックグラウンド化
- [x] **forceSyncAllタイムアウト追加** — 10秒でタイムアウト（ログアウトハング防止）
- [x] **beforeunload警告拡張** — ログイン中+未同期の変更がある場合にも警告表示

## 完了（第50セッション 2026-03-30）
- [x] **プライバシーポリシーの内容確認** — 第50セッションで全面改訂済み（9→11セクション、外部サービス表・保存期間表新設、平易な日本語化）

## 完了（第45セッション 2026-03-30）
- [x] **包括的セキュリティ監査** — API・フロントエンド・Firebase 3方面から35件の問題を検出、28件修正
- [x] **OAuth CSRF保護** — Discord OAuthにstate+HttpOnly cookie追加
- [x] **OAuthトークンXSS修正** — JSON.stringifyエスケープ（Discord/Twitter）
- [x] **全APIエラーレスポンスからdetails除去** — 6ファイル
- [x] **CORS制限強化** — *.vercel.app全許可 → lopo-miti(-xxx)のみ
- [x] **/api/share保護** — レート制限+ボディサイズ制限+viewCount IP重複排除
- [x] **ADMIN_SECRETタイミングセーフ比較** — crypto.timingSafeEqual使用
- [x] **Firestoreルール強化** — plansのread制限、copyCount/useCount改ざん防止、version楽観ロック、users hasAll
- [x] **アカウント削除時Storageロゴ削除追加**
- [x] **VITE_FFLOGS_CLIENT_SECRET露出リスク解消** — 開発環境もサーバーサイドプロキシ経由
- [x] **CSPヘッダー追加**（vercel.json）
- [x] **email表示削除**（Layout.tsx、AdminLayout.tsx）
- [x] **Twitter OAuthスコープ最小化** — tweet.read除去
- [x] **未使用xlsxパッケージ削除**（高脆弱性解消）
- [x] **auth.lopoly.app DNS反映確認** — Googleログイン正常動作

## 完了（第44セッション 2026-03-30）
- [x] **Googleログイン画面のドメイン表示修正** — auth.lopoly.appサブドメインをFirebase Hosting+Cloudflare DNSで設定、authDomainを変更（DNS反映待ち）
- [x] **サイドバー畳み時のアイコン化** — isOpen判定で☕のみ表示
- [x] **全モーダル×ボタンの反転ホバー統一** — 15ファイルの×ボタンにhover:bg-app-text hover:text-app-bgを適用
- [x] **ステータス設定のタイトル統一** — 「パラメータ設定」→「ステータス設定」
- [x] **TANK/HEALER/DPSラベルのライトモード視認性改善** — dark:修飾子で色分け
- [x] **FFLogsインポートモーダルのz-index修正** — createPortalでbody直下にレンダリング
- [x] **デザイン改善6画面確認済み** — フェーズ追加・共有プレビュー・削除確認・オートプラン・FFLogs・ログイン画面OK
- [x] **ToDo全体の整理・外部レビュー指摘の追記** — 運用・品質基盤セクション追加（テスト・エラー監視・バックアップ・a11y・法的確認等）
- [x] **ToDo確認用HTML作成** — docs/todo-review.html（チェックボックス+コピー機能付き）

## 完了（第43セッション 2026-03-30）
- [x] **ライトモードのモーダル背景改善** — glass-tier3のライトモードデフォルトを `transparent→rgba(255,255,255,0.65)` + `blur 2px→12px` に変更。サイドバー・ヘッダーは `glass-frame` クラスで元の値を維持
- [x] **スライドオーバーのバックドロップ暗転削除** — PartySettingsModal, PartyStatusPopoverのbg-black/50を除去
- [x] **JobPickerのバックドロップ暗転削除**
- [x] **共有モーダルのヘッダー改善** — bg-app-surface2/40追加、OGPプレビュー背景を60%透過に

## 完了（第42セッション 2026-03-29）
- [x] **アクセントカラー導入** — CSS変数でblue/red/amber定義。全モーダル・ダイアログのボタンに適用済み
- [x] **ツールチップ反転表示** — glass-tier3変数上書き方式でテーマ反転
- [x] **パルス設定のlocalStorage永続化**
- [x] **MitigationSelector グラスモーフィズム復活**
- [x] **ClearMitigationsPopover 角丸修正**
- [x] **PartyStatusPopover text-whiteハードコード→テーマ変数化**
- [x] **人気ページの「ランキング」文言削除**

## 完了（第40セッション 2026-03-29）
- [x] **OGP画像の多言語対応** — vitest導入、OGPロジックをogpHelpers.tsに切り出し（32テスト）、CONTENT_METAにenフィールド追加、getContentName/trySeriesSummary多言語対応、共有データにlangフィールド保存、OG画像・メタタグの言語切替
- [x] **テストフレームワーク導入（vitest）** — vitest導入済み。ogpHelpersのテスト32件
- [x] **Discord鯖のチャンネル設計・権限設定** — コミュニティ機能ON、ルール設定、チャンネル構成整備、@everyone権限制限、βテスター用カテゴリ作成
- [x] **Discord Bot設計** — 設計書作成完了（`docs/superpowers/specs/2026-03-29-lopo-discord-bot-design.md`）

## 完了（第39セッション 2026-03-29）
- [x] **共有モーダル: ロゴ/画像の操作修正** — share APIにPUT追加、ロゴ追加/変更/削除時にshareデータ上書き更新
- [x] **プランの端末間同期の信頼性修正** — Firestoreを正として扱うマージロジックに変更
- [x] **プランの端末間同期の信頼性調査** — 第39セッションで調査・修正完了

## 完了（第35セッション 2026-03-29）
- [x] **バグ修正: コンパクト表示のエフェクト棒** — 軽減の効果時間バーがコンパクト表示で1行分はみ出す問題を修正（空行は直前の可視行で切り詰め）

## 完了（第34セッション 2026-03-28）
- [x] **管理者向け運営マニュアル作成** — `docs/ADMIN_OPERATIONS_MANUAL.md` に作成済み
- [x] **バグ修正: AAアイコン** — text-app-text-muted → text-app-text-sec（ライトモード視認性向上）
- [x] **バグ修正: パルスカラーパレット** — GradientSliderにoverflow-hidden + getValueFromXサム幅考慮
- [x] **バグ修正: SELECTテキスト** — text-white/40 → text-app-text-muted（ライトモード対応）
- [x] **Discord通知刷新** — GitHub Commit Webhook廃止 → 管理画面データ更新時にユーザー向け自動通知（DISCORD_UPDATE_WEBHOOK_URL）
- [x] **CSVエクスポート** — サイドバーのプラン⋮メニューからCSVダウンロード機能を追加
- [x] **ADMIN_REFERENCE.md更新** — FirebaseプランSpark→Blaze修正

## 完了（第30セッション 2026-03-28）
- [x] **Firebase App Check有効化** — reCAPTCHA Enterprise設定・サイトキー作成・Vercel環境変数追加・Firebase Console登録
- [x] **Firestoreセキュリティルールのデプロイ** — master/templates/backups/admin_logsのルール追加・firebase deploy完了
- [x] **ログアウト高速化** — forceSyncAllの直列ループをPromise.allSettledで並列化（50-70%高速化）
- [x] **管理画面UI改善** — Toast成功/失敗区別・selectドロップダウン背景色・フォームUX全面改善（例をラベル横に表示・シリーズドロップダウン化・層選択・上級者設定折りたたみ）
- [x] **管理基盤 Phase 0〜1 セットアップ完了** — 第28-29セッションで実装、第30でApp Check+ルール+UI改善

## 完了（第29セッション 2026-03-28）
- [x] **管理者ロール初回セットアップ** — ADMIN_SECRET設定・curl実行・/admin動作確認OK
- [x] **Firebase App Check導入（コード実装）** — フロントエンド初期化・APIクライアント・サーバー検証・全API統合
- [x] **管理基盤 Phase 1 実装** — コンテンツ・テンプレートのFirestore移行完了
- [x] **Firestoreシーディング** — 63コンテンツ+18シリーズ+25テンプレート投入
- [x] **Googleログイン修正** — Google Cloud APIキーのウェブサイト制限追加

## 完了（第28セッション 2026-03-28）
- [x] **管理基盤 Phase 0 実装** — 管理者ロール(Custom Claims)、管理画面骨組み(/admin)、APIレート制限、監査ログ、プラン複製機能、GoogleログインPWA対応、CORSホワイトリスト化

## 完了（第27セッション 2026-03-28）
- [x] **管理基盤・マスターデータFirestore移行 設計書作成** — 全ゲームデータのFirestore移行計画（→ `docs/管理基盤設計書.md`）

## 完了（第26セッション 2026-03-28）
- [x] **コンテキスト最適化** — CLAUDE.mdの必読リスト2層化、古い引き継ぎ書4件削除、TODO完了タスクアーカイブ、セッション終了時クリーンアップルール追加
- [x] **サイドバーボタンのホバーアニメーション追加** — ボタン群に白黒反転+active:scale-95、カテゴリ/レベルタブにも同様、ツリー要素にactive:scale-[0.98]
- [x] **言語設定がページ間で引き継がれないバグ修正** — i18n.tsの初期化時にlocalStorageから保存済み言語を復元するよう修正
- [x] **ダンジョン・レイド・その他のプラン作成対応** — SavedPlanにcategoryフィールド追加、NewPlanModalで自由入力対応、サイドバーでカテゴリ別表示、Firestore保存/復元対応
- [x] **NewPlanModal改善** — レベル・カテゴリ未選択スタート、「任意」ラベル削除、Enterキーで作成、未入力項目の案内表示、コンテンツ選択をドロップダウンから1列フラットリストに変更

## 完了（第25セッション 2026-03-28）
- [x] **サイドバー・ヘッダー接合部の線の統一** — glass-tier3のborder個別上書きユーティリティ追加、2重/3重線を解消
- [x] **コントロールバー区切り線をテーブルカラムと位置揃え**
- [x] **「まとめて共有」ボタン名変更**

## 完了（第24セッション 2026-03-28）
- [x] **タイムライン枠のガラス表現強化** — glass-panelにボーダー光沢+影追加
- [x] **テーブル横罫線のオン/オフトグル追加** — コントロールバーにRows3アイコンボタン
- [x] **ヘッダー区切り線の視認性向上** — ダーク:白25%、ライト:純黒
- [x] **サイドバー選択中プランのインジケーター** — 開いているプランだけに左直線
- [x] **CSS変数の一括視認性向上** — --color-border/--glass-borderの値変更
- [x] **EventModalツールチップ簡素化** — スキル名のみ表示

## 完了（第23セッション 2026-03-27）
- [x] **パルス設定デフォルト値全面見直し**
- [x] **パルスカラー変更が即時反映されないバグ修正**
- [x] **グローをスライダー化**
- [x] **カスタムカラーピッカー追加**
- [x] **パルス設定パネルをcreatePortalでbody直下に配置**
- [x] **距離・速度・太さ・光の強さのマッピングテーブル再設計**

## 完了（第22セッション 2026-03-27）
- [x] **古い引き継ぎ書21ファイル削除**
- [x] **CORE_UPGRADE_PLAN.md/GRAPL_PROJECT_PLAN.md更新** — LoPo統一
- [x] **零式ホバー光走りバグ修正** — overflow:hidden追加
- [x] **光走りが要素縦横比で歪む問題修正** — 200vmax化
- [x] **backdrop-filterビルド消失問題の全箇所修正** — Lightning CSS対策
- [x] **TECH_NOTES.md新設**
- [x] **PWA: apple-touch-icon追加 / SW autoUpdate化**
- [x] **共有モーダルがヘッダー下に隠れる問題修正**
- [x] **パルス設定パネル全面リニューアル / グロー実装**
- [x] **Google Cloud APIキー制限設定**

## 完了（進行中セクションから）
- [x] **Firestoreプラン保存の実装** — ログインユーザーのプランをクラウドに永続化（2026-03-25）
- [x] **プライバシーポリシー・利用規約ページ** — Googleログインに必須（2026-03-25）
- [x] **プラン件数制限の実装** — 1コンテンツ5件 / 合計50件 / 30件超で圧縮警告（2026-03-25）
- [x] **FFLogsインポートをログイン限定に変更** — API保護 + ログインメリット強化 + 5キーラウンドロビン（2026-03-25）
- [x] **Firestoreセキュリティルール + インデックスのデプロイ** — firebase.json / firestore.indexes.json 作成、Firebase CLIでデプロイ（2026-03-25）
- [x] **モバイルボトムナビにログインボタン追加** — Status→Login/アバターに変更、パーティシートにタブ（パーティ/ステータス）統合（2026-03-25）
- [x] **カスタムドメイン取得** — lopoly.app（Cloudflare Registrar）、DNS設定済み（2026-03-25）

## 完了（チュートリアル）
- [x] モバイル: 簡易ガイド（スワイプカード4枚）で代替。デスクトップチュートリアルはモバイルで自動起動しない（2026-03-24）
- [x] サンドボックス方式に改修 — 既存データを退避→復元。警告ダイアログ削除（2026-03-25）

## 完了（バグ修正）
- [x] サイドバー: 開いている表のコンテンツが展開（選択）状態になっていないことがある（2026-03-25修正済み）
- [x] ログイン成功UX: ウェルカム画面をLayout.tsxで全面表示に統合、表のチラつき防止（2026-03-25修正）
- [x] ログアウト時にlocalStorageプラン・軽減データクリア — アカウント切替時の違和感を解消（2026-03-25）
- [x] リダイレクトログイン（Discord/X）の認証中画面追加 — 戻り時のチラつき防止（2026-03-25）
- [x] Xログイン時のアバター代替表示 — photoURLなし時にイニシャル円表示（2026-03-25）
- [x] サイドバーのプランアイテムにcursor-pointer追加（2026-03-25）
- [x] 新規プラン作成時のパーティ構成引き継ぎバグ修正 — ジョブとMY JOBをリセット（2026-03-25）
- [x] テンプレート読み込み中のローディングインジケーター追加（2026-03-25）
- [x] 未ログインでタブを閉じる前のブラウザ確認ダイアログ追加（2026-03-25）
- [x] コード・ファイルクリーンアップ: MitiPlannerロゴ削除、旧名称の残骸除去、index.htmlのog:image更新（2026-03-25対応済み）
- [x] チュートリアルのサンドボックス化: Playwright通しテスト全ステップ合格。party-closeステップ正常動作確認済み（2026-03-25）
- [x] EventModal軽減選択バグ修正: チュートリアルStep9dでvisibleMitigationsチェックが原因で2つ目以降のハイライトが消える問題を修正（2026-03-25）
- [x] OGP: ShareModalにプラン名表示ON/OFF切り替えUI追加（2026-03-25）
- [x] プラン削除時にuseMitigationStoreのデータがクリアされない — 削除後に次のプランに自動切替、0件ならクリア（2026-03-25修正）
- [x] **保存インジケーター改修** — フェイク表示→実際のlocalStorage保存完了を反映するリアクティブ方式に改修。localStorage:500msデバウンス即保存、Firestoreイベント駆動同期（2026-03-25修正）
- [x] ヘッダーのプラン名が長いとき省略されず保存インジケーターが隠れる — inline style truncateで修正（2026-03-25修正）
- [x] **テーマフラッシュ防止** — index.htmlにインラインスクリプトでReact前にテーマ適用（2026-03-25修正）
- [x] **フェードオーバーレイ** — 言語/テーマ/プラン切替時にアニメーション付きトランジション。DOM直接操作でGPU 60fps（2026-03-25）

## 完了（スマホ対応）
- [x] モバイルヘッダーにコンテンツ名・プラン名を表示（2026-03-24）
- [x] ハードコード日本語のi18n化 — ツールシート・軽減フロー・戻るボタン・ボトムナビ（2026-03-24）
- [x] モバイルのpaddingTopアニメーション問題を修正（2026-03-24）
- [x] モバイル軽減フロー改善 — イベントコンテキスト表示・配置済み軽減数バッジ・ポップオーバーから「軽減を追加」（2026-03-24）
- [x] モバイルポップオーバーを画面中央配置（2026-03-24）
- [x] ボトムナビ全タブ排他制御トグル化（2026-03-24）
- [x] 表の表示領域拡大 — モバイルのmargin/roundingを除去してフルスクリーン表示（2026-03-24）
- [x] パーティ編成モバイル専用UI（2026-03-24）
- [x] 軽減追加フロー全面改修 — ボトムシート一覧式（2026-03-24）
- [x] ボトムナビz-index修正（2026-03-24）
- [x] シート/モーダルをボトムナビの上に配置（2026-03-24）
- [x] 表の二重padding解消（2026-03-24）
- [x] サイドバーのモバイル幅修正（2026-03-24）
- [x] 軽減一覧のレベルフィルタ追加（2026-03-24）
- [x] 軽減一覧を5列フラット表示に改修（2026-03-24）
- [x] パーティ設定が閉じた時にDOMから消えない問題修正（2026-03-24）
- [x] コントロールバーをモバイルで非表示（2026-03-24）
- [x] サイドバーのモバイルフル幅表示（2026-03-24）
- [x] パーティ編成/ステータスをMobileBottomSheet化（2026-03-24）
- [x] MY JOB設定フロー実装（2026-03-24）
- [x] ダメージ数値をモバイルで短縮表示（2026-03-24）
- [x] ヘッダーカラム名モバイル短縮（2026-03-24）
- [x] ボトムナビ白黒デザイン化（2026-03-24）
- [x] モバイルヘッダーh-9に縮小（2026-03-24）
- [x] ポップオーバーアイコン色を白黒統一（2026-03-24）
- [x] iOSキーボード閉じ後のビューポートずれ修正（2026-03-24）
- [x] ジョブ変更時のマイグレーション確認 — モバイルにもJobMigrationModal統合済み（2026-03-25）
- [x] サイドバーのモバイル幅 — fullWidthプロパティ追加、styleタグハック削除（2026-03-25）

## 完了（機能・UI）
- [x] チュートリアル通しテスト全ステップ合格（2026-03-25）
- [x] Google ログイン
- [x] Discord ログイン（2026-03-23）
- [x] Service Worker の /api/ 除外
- [x] ログインメニュー ホバー→クリック型
- [x] デバッグ用 alert 全削除
- [x] Discord/Twitter 共通 OAuth ポップアップヘルパー統合
- [x] Vercel環境変数にTwitterキー追加
- [x] Discord アイコン・表示名表示
- [x] Twitter(X) ログイン（2026-03-23）
- [x] ログインメニュー クリック型+ツールチップ+ログアウト赤字+多言語対応
- [x] ログインモーダル化（2026-03-23）
- [x] ログイン方式をリダイレクト方式に変更
- [x] ログイン成功ウェルカムオーバーレイ
- [x] トップページにログイン導線を配置
- [x] インターベンション/原初の猛りバグ修正
- [x] アダーガルゲージ計算バグ修正
- [x] 共有ボタン移動
- [x] 共有機能（2026-03-24）
- [x] サイドバー導線刷新（2026-03-24）
- [x] サイドバーモノクロ化（2026-03-24）
- [x] プラン名インライン編集（2026-03-24）
- [x] 同コンテンツ複数プランUX（2026-03-24）
- [x] 自動保存フィードバック（2026-03-24）
- [x] ヘッダーのヒーロータイトル修正（2026-03-24）
- [x] 動的OGP画像生成（2026-03-24）
- [x] 複数選択→まとめて共有（2026-03-24）
- [x] 共有UIモーダル化（2026-03-24）
- [x] 複数選択をプラン単位に変更（2026-03-24）
- [x] コンテンツ選択→名前入力フロー（2026-03-24）
- [x] UI白黒ルール適用（2026-03-24）
- [x] 共有モーダル修正（2026-03-24）
- [x] 削除ボタン英語表示崩れ修正（2026-03-24）
- [x] FFLogsツールチップ改善（2026-03-24）
- [x] チュートリアル修復（2026-03-24）
- [x] 名前入力フロー改善（2026-03-24）
- [x] 新規作成フロー改善（2026-03-24）
- [x] サイドバー改善（2026-03-24）
- [x] 削除UI改善（2026-03-24）
- [x] ヘッダー改善（2026-03-24）
- [x] プラン0件オーバーレイ（2026-03-24）
- [x] 英語表現修正（2026-03-24）
- [x] チュートリアル基盤改修（2026-03-24）
- [x] チュートリアル全面改修（2026-03-24）
- [x] 数値入力の全角→半角自動変換（2026-03-24）
- [x] チュートリアル中のテーマ・言語切替を常時操作可能に（2026-03-24）
- [x] セキュリティ修正（2026-03-25）
- [x] crypto.randomUUID()のフォールバック追加（2026-03-25）
- [x] デバッグ用console.log削除（2026-03-25）
- [x] Firestoreプラン保存（2026-03-25）
- [x] プライバシーポリシー・利用規約ページ（2026-03-25）
- [x] プラン件数制限（2026-03-25）

## 2026-05-28 ハウジングデザイン刷新セッション
- [x] ハウジング配下リデザイン: housing.css 7 箇所 (gradient/999px ピル → 単色/角丸 6-10px) + 4 .tsx (Onboarding/DuplicateWarning/RegisterAddressFields/RegisterView) の LoPo Tailwind 排除 → housing class。 「あなたの登録」 ピルも透過+枠線にモダン化
- [x] 一覧カード AllMarks 風化: メタ情報 (title/size/tags) 削除 + column masonry + カバー比率カード
- [x] 画像 aspectRatio で CLS ゼロ化 (8 タスク, subagent-driven): syndication から photo 寸法取得 (photoAspectRatios) → draft → Firestore (sourceImageAspectRatios) → galleryAdapter → カード事前確定。 動画 videoAspectRatio 経路を踏襲。 build + 573 テスト + final review OK。 **※実機確認 (登録→反映) は次セッション持ち越し** (新規登録の手間でユーザー未確認)
- [x] dev 専用 vite proxy (/api を本番転送)。 Twitter 動画 dev 再生バグの root cause = vite が Vercel Edge Function 非実行 (環境制約)、 proxy で解決。 memory `reference_vite_dev_api_proxy`

## 完了 (2026-06-20 リビデ正確モデル化 + 現在の状態から移動)

- **✅ リビデ(Living Dead/DRK)正確モデル化 本番デプロイ済(2026-06-20)**: 二段階モデル=リビデ窓内[t,t+10)で最初に致死(リビデ無敵を除いた軽減後ダメ≧対象maxHp)になる被弾を引き金tT→そこからウォーキングデッド10秒[tT,tT+10)だけ生存(Invuln)。引き金前の非致死は通常ダメ・窓内致死無しなら無効・WD窓はリビデ窓を超えて伸びる。**表示**=ダメージ列はInvuln据え置き(i18n変更なし)+タイムラインに白黒リビデアイコン(死亡時刻tTに表示・詠唱と同時刻=使った瞬間死亡の時だけ+1で親アイコンと重なり回避・サイズw-3.5でペンタゴン系と光学的に揃える)。**データ駆動**=`Mitigation.walkingDeadDuration`(living_dead=10)を持つ無敵だけ二段階・id決め打ち無し・他無敵3種(インビン/ホルムガング/ボーライド)不変。**計算集約**=純粋関数`src/utils/livingDead.ts`(resolveLivingDeadSurvival等・単体テスト11)をCheatSheetView/Timeline両damageMapが利用しズレ防止。**品質**=subagent-driven(Task1-5各review clean)+多エージェント総点検4領域clean+opus最終レビューでImportant 1件=I-1(致死判定がバリア吸収前→spec§3/既存致死表示と乖離)をシールド後へ移動して根治。build緑/vitest1941passed。**Firestore同期**=`scripts/sync-walking-dead-duration.ts`(--force-overwrite回避の外科的更新・dataVersion++)。**非対象**=回復要否(最大HP相当回復が間に合うか)・HP経時追跡・autoPlanner精緻化は別途。spec/plan=`docs/superpowers/{specs,plans}/2026-06-20-living-dead-modeling*`。実機OK(ユーザー確認・置き場所/サイズ含め確定)。
- **✅ FFLogsインポート 取り込みモード選択 本番デプロイ済(merge 6fd3939)**: 3モード(置き換え・軽減も削除/置き換え・軽減は残す[既定]/追記)。collab `importBulk` は `clearMitigations` で分岐。append の既存phase endTime silent mutation 根治。実機OK。Phase1.5=再アンカー/Phase2=スプシ取込⑥+導線チューザーは継続TODO。
- **✅ ブランチ消失=解決済(2026-06-20調査)**: `feat/mobile-bottom-nav-redesign` のコミットは全て main にマージ済(tip=609fab97)。ラベル削除だけで作業ロスゼロ。

## 2026-06-30 (現在の状態から退避)
- **スプシ取込のレベル/ステータス未反映バグ修正(本番済・実機OK)**: `commitImportedPlan` が currentLevel/stats を Lv100固定だったのを `levelForContent` 単一窓口新設+`buildImportedPartyMembers` level必須化で修正。敵対監査2回(計9体)でデータ消失なし確認。後始末(ファイアウォール7878/`/clip`撤去)も完了。報告者対応クローズ。
- **スマホ スプシ取込(textarea貼付方式・本番済だが実シート取込不可)→棚上げ**: iOS readText ブロック回避で textarea+onChange 採用、useIsMobile 追加、スマホ縦リスト割当。但し有名スプシ(grid)は実機で取り込めず=構造的に不可と判明し、スマホ取込UI自体を非表示化+「あらゆるスプシ対応」を本命ゴールとして棚上げ(TODO.md 棚上げセクション参照)。spec=2026-06-30-mobile-spreadsheet-import-paste-design.md ほか。
