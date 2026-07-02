# ハウジング登録ページ (Register) 設計書

> - **スパン**: ハウジング全面再構築 第4スパン (土台+探す → お気に入り → **登録** = merge 解禁ゲートの最後の 1 枚)
> - **ブランチ**: `feat/housing-rebuild-foundation-browse` (継続・ローカルのみ)
> - **正典ビジュアル**: 骨格 = `C:/Users/masay/Downloads/HousingTour_theme/ChatGPT Image 2026年5月29日 16_53_32.png` (3カラム+左縦ステッパー) / 右カラム部品の中身 = 同 `23_06_56 (6).png` (入力チェック・重複チェック・土地プレビュー)。GPT 画像は「構造」の設計図であり見た目は写さない。
> - **質感**: 質感A案 (`.claude/rules/housing-design.md:31-42`)。濃紺フラット・2アクセント (ハニー=主アクション / 青=選択・進行)・AI感払拭・余白リズム・トークン100%。
> - ユーザーは本書を読まない。確認は実画面 (CSS 1489x679 / DPR 2.58) で行う。本書は Claude が道に迷わないための地図。

## ゴール

1. `/housing/register` を ComingSoonPage から本実装ページへ差し替え、新シェルで「URL 貼付→自動入力→ミニマップ点灯→公開」が実機で最後まで通る。
2. 新データ 3 種を導入する: **タイトル (必須・50字)** / **公開設定 (公開/非公開)** / **公開終了日時 (任意・遅延評価)**。非公開は Firestore ルールで他人からデータごと取得不能にする。
3. **土地ミニマッププレビュー**: 全 10 マップの地図データを本体に組み込み、住所選択で該当区画が光る再利用可能な小型部品を新設する (M5 の一部前倒し・ツアー/詳細でも使う資産)。

## ユーザー承認済みの設計判断 (2026-07-02 brainstorming)

- スコープ = 磨き直し + タイトル/公開設定は必須追加 (ユーザー明言)。下書き = 非公開登録で代替、サーバー下書き機構は作らない。
- 公開設定 = 2択 + 任意の終了日時。**期限は遅延評価** (cron なし。読む側が表示時に `now > publishUntil` 判定。表示判定は閲覧端末の時計、登録時の過去日時チェックはサーバー時計)。開始日時・承認制限定公開は見送り。
- ミニマップは今回入れる (「初めからあると嬉しい」)。エーテライトは入力欄にしない (住所から自動算出可能・将来ツアー側で)。
- ステッパー = スクロール追従の 1 枚フォーム (真のウィザードにしない。SNS 自動入力が一気に埋まる魔法を見せるため)。
- **ライブインジケーター**: ステップ表示は 未入力=枠丸 / 入力中(現在地)=青 / セクション有効=チェックへアニメーション。✅を最初から付けない ([[feedback_form_ux_progress]])。
- 画像取得のローディング明示: 貼付→取得中スケルトン→成功(枚数)→失敗(理由+対処)。
- **OGP サイトからの住所自動入力**: og-fetch は既に title/description を返す (`api/og-fetch.ts:110-116`) → `parseHousingFromText` を同テキストにかける。サーバー変更不要。「読み取れたら埋める・だめなら画像だけ」。実装時に allowlist 4 サイト (`src/lib/housing/ogpHostAllowlist.ts:18-23`) の実 URL で検証。
- オートセーブ: 入力途中を localStorage に自動保存・再訪時に「復元しました (破棄する)」。登録成功・明示破棄でクリア。
- **重複チェックは非公開も匿名で衝突検出** (ユーザー指摘による修正): 公開重複=従来どおり詳細表示、非公開重複=「非公開の登録が◯件あります (内容は表示されません)。住所をもう一度ご確認ください」の匿名行のみ。重複ベル通知は非公開の持ち主にも届ける (本人向けなので漏洩なし)。

---

## パートA: データ基盤 (タイトル・公開設定・期限)

### A-1. 型とバリデーション

- `HousingListing` (`src/types/housing.ts`) に追加: `title: string` / `visibility: 'public' | 'private'` / `publishUntil: number | null`。**timestamp は number (epoch ms)** — types 層の既存規約 (`src/types/housing.ts:12-18`「Firebase SDK import を types 層に持ち込まない」) に従う。Firestore との変換はサーバー/adapter 層。
- `housingValidation.ts` (クライアント/サーバー共用) に追加: title = **送信された場合のみ** trim 後 1〜50 字 / visibility = 2 値 (省略可) / publishUntil = null か「サーバー現在時刻より未来」(登録・更新時)。
- **タイトル必須の適用範囲 (後方互換・重要)**: 旧登録モーダル (HousingRegisterFormModal) は `/housing/p/:listingId` 等で本番稼働中 (`HousingWorkspace.tsx:145`) かつ title 欄を持たない。共有バリデーションで title を無条件必須にすると旧経路の登録が全滅する。→ **サーバーは title 未送信を許容し、visibility 未送信時は `'public'` を必ず書き込む** (これが A-3 のバックフィル空白期間も塞ぐ)。**必須の強制は新 RegisterPage と編集モーダルのクライアント検証**で行う。サーバー側の無条件必須化は旧経路撤去後 (将来スパン)。
- 実効公開判定の共用純関数を新設: `isEffectivelyPublic(listing, nowMs)` = `visibility !== 'private' && (!publishUntil || publishUntil > nowMs)`。isHidden / deletedAt の既存フィルタとは併用 (責務を混ぜない)。配置は `src/utils/` (素の TS・client/server 共用可能に)。
- quota: 非公開登録も登録枠を消費する (乱用防止・判定を単純に保つ)。

### A-2. サーバー API

- `_registerListingHandler.ts`: draft に新 3 項目を受け、検証して doc に保存。**visibility 未送信時は `'public'` をサーバーが必ず書き込む** (旧クライアント互換 + 新 doc に必ずフィールドが載る保証)。
- `_updateListingHandler.ts`: 更新 payload に title / visibility / publishUntil を追加 (`:95-118` の対象拡張)。addressKey 再計算等の既存挙動は不変。
- `_checkDuplicateHandler.ts`: レスポンスは **additive 拡張** — 既存キー `duplicates` (現行形 = `{id, ownerUid, createdAt, tags}`、`_checkDuplicateHandler.ts:57-67`) を**そのまま温存**し、公開分のみ格納。`privateMatchCount: number` を追加。旧クライアント (`HousingRegisterFormModal.tsx:199` / `HousingRegisterView.tsx:169` / 既存テスト) は無傷で動き続ける。**非公開 doc の詳細 (タイトル・画像・オーナー等) は一切返さない**。isHidden=false フィルタは既存どおり。新 RegisterDuplicatePanel の「公開重複の表示」も現行 entry のフィールド範囲 (登録日・タグ) で組む — タイトル/画像を出すためのレスポンス拡張はしない。
- duplicate_alert ベル通知 (`_registerListingHandler.ts:124-159`): 従来どおり同 addressKey の全オーナーへ (非公開の持ち主含む)。変更なしで要件を満たすことを確認する。

### A-3. Firestore ルールと読み取りクエリ

- `firestore.rules` の `housing_listings` read (`firestore.rules:264` 現在 `allow read: if true`) を締める:
  `allow read: if resource.data.visibility == 'public' || (isAuthenticated() && resource.data.ownerUid == request.auth.uid);`
  **素朴な等価比較を使う** (`resource.data.get(field, default)` は list クエリの静的証明で扱える保証が裏取りできず不採用。バックフィル + サーバー default 付与で「visibility の無い doc は存在しない」を保証する方が単純で安全)。
- **クエリのルール適合**: ルールはフィルタではなく静的証明。一覧系クエリに `where('visibility', '==', 'public')` を明示追加しないと query 全体が拒否される。対象は `housingListingsService.ts` の 5 関数すべて: `getGalleryListings` / `findListingsByAddressKey` / `findChambersInPlot` / `findHouseForChamber` / `findApartmentRoomsInWard`。サービス関数を書き換えるため legacy ページ含む全ルートが同時に追従する。**新ルール × 5 クエリが list を通ること + 他人の非公開 getDoc が拒否されることを、ルール deploy 前に Firestore エミュレータ (@firebase/rules-unit-testing) で検証する** (テスト節参照)。
- **自分の登録クエリを新設**: `getMyListings(uid)` = `where('ownerUid', '==', uid)` (+ createdAt desc)。**auth 復元は非同期で、store の `load()` は冪等ガード付き 1 回きり (`useHousingListingsStore.ts:46-47`) のため合流機構を明示設計する**: 公開クエリは従来どおりシェルマウントで即 load。自分クエリは store に `loadMine(uid)` を新設し、useAuthStore の auth 状態確定/変化を購読して uid 確定時に fetch → id dedup で merge、ログアウト時は自分専用分 (公開クエリに居ない doc) を除去。表示側の `isEffectivelyPublic || 自分` フィルタと二重防御。
- **複合インデックス**: `getGalleryListings` は既に `isHidden == false + orderBy createdAt desc` (既存 index = isHidden+createdAt、`firestore.indexes.json:12-18`) なので、visibility を足した **`(visibility ASC, isHidden ASC, createdAt DESC)`** と、getMyListings 用 **`(ownerUid ASC, createdAt DESC)`** を `firestore.indexes.json` に登録 ([[reference_firestore_composite_index]])。equality のみの 4 関数はマージ結合で動く可能性があるが、**実装時にエミュレータ/実機で missing-index エラーを確認して必要分を登録する (推測しない)**。
- **既存 doc のバックフィル**: `scripts/` に admin SDK スクリプトを新設し、visibility 未設定の全 doc へ `visibility: 'public'` を一括付与 (既存物件は全て本人のテストデータ = 安全 [[feedback_housing_data_disposable]])。title は付与しない (表示側 fallback で対応)。**実行タイミングは開発着手直後** — dev も本番と同じ live Firestore ([[reference_master_data_live_firestore]]) のため、先に流さないと開発中の新クエリで一覧が空になる。
- **本番反映の順序 (罠)**: visibility 条件のない旧コード × 新ルール = 一覧が permission-denied。逆 (新コード × 旧ルール read:true) は動く。→ **①バックフィル (開発着手時に実施済) → ②アプリデプロイ (merge。サーバーの visibility default 付与を含む) → ②の直後に保険の再バックフィル 1 回 (①〜②の間に旧サーバーコードが作った visibility 無し doc を救う) → ③ `firebase deploy --only firestore:rules`**。

### A-4. 表示への波及

- **ListingCard**: タイトル行を新設 (無い既存物件は `formatHousingAddress` 由来の住所表示で代替)。自分の非公開 =「非公開」バッジ / 自分の期限切れ =「期限切れ」バッジ (どちらも本人にのみ出る。他人にはカード自体が届かない)。既存 props は非破壊 (optional 追加)。探す/お気に入りの他人視点の見た目はタイトル行以外不変。
- **store/adapter**: 新シェルの listings store は `MockListing` 型 + adapter 経由 (`src/lib/housing/galleryAdapter.ts`、ownerUid は通過済み `galleryAdapter.ts:47`)。adapter に title / visibility / publishUntil の 3 つを追加で通す。
- **一覧のフィルタ**: 表示直前に `isEffectivelyPublic(listing, now) || 自分の物` で絞る (期限切れの遅延評価はここ)。他人の期限切れはデータ上 public のまま届き得るためクライアント判定が正。
- **詳細ページ** (`/housing/listing/:listingId` + モーダルルート): 3 点セットで改修する。
  1. fetch は **auth 状態の確定を待ってから実行** (または permission-denied 時に auth 復元後 1 回リトライ)。直リンク/リロードで auth 復元前に getDoc が走ると**本人の非公開すら**拒否されるため (`HousingDetailPage.tsx:57-61` は現状 [listingId] のみ依存)。
  2. catch で `permission-denied` を「見つかりません」に分類 (エラー画面にしない)。
  3. `canViewListing` (`src/lib/housing/listingVisibility.ts`) に「他人 && !isEffectivelyPublic → 不可」を組み込む — 他人の**期限切れ public** doc はルール上読めてしまうため、詳細直リンクでの露出をここで塞ぐ。
  本人の非公開/期限切れはバッジ付きで閲覧可。
- **お気に入り/ツアートレイ**: 非公開化・期限切れで listings から消えた id は既存の解決ロジックで自然に非表示になる (回帰テストで確認)。
- **編集モーダル** (`HousingRegisterView` mode='edit'): タイトル・公開設定・期限の 3 欄を追加 (公開⇄非公開の切替・期限延長はここから)。編集画面の全面刷新はマイページスパンで。編集時もタイトルは必須 (既存物件の編集時に入力を促す)。

---

## パートB: 登録ページ本体

### B-1. ルートとシェル

- `src/App.tsx:106` の `<ComingSoonPage tab="register" />` を `<RegisterPage />` に差し替え (HousingShell 子ルート・タブ定義 `housingTabs.ts` は変更不要)。
- **シェルの穴を修正**: `HousingLoginModal` / `HousingAccountModal` は旧 `HousingWorkspace.tsx:146-147` にしかマウントされていない。`HousingShell` にマウントし、AppHeader の `openLogin()` / `openAccount()` を機能させる。
- 未ログイン時: 中央カラムに `HousingLoginPrompt context="register"` (既存部品)。ログイン完了後の復帰は **Discord リダイレクトが現在 URL (= /housing/register) に戻ることで自然に成立**する。`withRegisterFlag` は **false で呼ぶ** — その実体は旧モーダル用の `?register=open` 付与 (`useAuthStore.ts:30-35`) で、新シェルには syncFromUrl が無く死にクエリが残るだけ (「fromRegister 導線を流用」ではない)。
- 既存導線は接続済み: FilterPanel の RegisterCTA は `navigate('/housing/register')` (`BrowsePage.tsx:68`)。

### B-2. レイアウト (3カラム・探す/お気に入りと同骨格)

```
div.housing-register
├ section[data-region="left"]   … RegisterStepperNav (縦5ステップ・scroll-spy)
│                                  + RegisterGuide (静かな登録ガイド)
│                                  + 登録枠の残り (canRegister / HousingQuotaIndicator 相当を質感A案で)
├ section[data-region="center"] … 見出し + 1枚フォーム (5セクション縦積み・内部スクロール)
│    ① 画像・SNS URL  ② 住所  ③ 紹介  ④ 公開設定  ⑤ 確認して公開
└ section[data-region="right"]  … RegisterCheckPanel (入力チェック・ライブ)
                                   + RegisterDuplicatePanel (重複チェック結果)
                                   + WardMapPreview (土地プレビュー)
```

- 「**中央=書く / 右=確認する**」の役割分離 ((6).png の右カラム公開設定は中央フォームへ移す)。
- 余白はコンテナ gap で統一リズム。ヒント文はヘアライン+グレー注記 (AI 感の色付き箱禁止)。

### B-3. コンポーネント設計 (小さく・単一責務)

配置: オーケストレータ = `src/components/housing/pages/RegisterPage.tsx`。機能部品は `src/components/housing/register/` に `Register*` 接頭辞で新設 (既存モーダル系 `HousingRegister*` と共存・名前で区別)。

| 部品 | 責務 |
|---|---|
| `RegisterPage` | データ取得 (auth/quota/listings)・フォーム状態の親・3カラム構成・submit オーケストレーション |
| `RegisterStepperNav` | 縦ステッパー。scroll-spy で現在地・クリックでスクロールジャンプ・セクション有効化でチェックへアニメーション (`prefers-reduced-motion` 尊重) |
| `RegisterGuide` | 登録ガイド (教育のみ・FavoritesOnboarding と同じ静かなトーン) + 登録枠残数 |
| `RegisterSectionMedia` | ① SNS URL 入力 + 取得状態 (スケルトン/枚数/失敗理由) + 画像リスト + ローカルアップロード |
| `RegisterSectionAddress` | ② DC/ワールド/エリア/タイプ/区・番地・棟・部屋 (タイプ別の条件表示。数値入力は本体の NumericInput 流用か housing トークン再スタイルかを実装時に判定 — 既存 `HousingRegisterAddressFields.tsx:82-138` は素の select/input) |
| `RegisterSectionIntro` | ③ タイトル (新設・50字・残数表示) / コメント / タグ |
| `RegisterSectionVisibility` | ④ 公開/非公開 2択 + 「公開終了日時を設定する」トグル + datetime 入力 + 遅延評価の注記 |
| `RegisterSectionConfirm` | ⑤ 要約 + 不足アクション列挙 + 「公開する」/「非公開で保存する」(visibility でラベル変化・ハニー) |
| `RegisterCheckPanel` | 右: fieldState から導出した具体的アクション行 (✓/⚠) のライブ表示 |
| `RegisterDuplicatePanel` | 右: 住所確定で自動照会 (debounce)。公開重複=詳細 / 非公開重複=匿名行 / 未照会=静かなプレースホルダー |
| `WardMapPreview` | 右: 土地プレビュー (パートC・共有部品) |

- **フォームのロジックは既存を核に流用**: `HousingRegisterFormValues` + `useHousingFieldState` (`src/lib/housing/housingFieldState.ts:68-82`)、自動入力 = `parseHousingFromText` + タイピング演出 (`HousingRegisterForm.tsx:100,127-148`)、SNS 3 分岐 = `HousingRegisterSnsUrlField.tsx:92-134`、画像優先順位 = `HousingRegisterForm.tsx:220-301`。**既存フィールド部品 (TypeSelector/TagPicker/TweetPreview/ImageField 等) は流用前提だが、見た目は質感A案トークンで再スタイル。流用か再作成かは実装時に各部品を読んで判定 (推測しない)**。
- 自動入力されたフィールドには「自動入力」バッジ (既存 FieldBadge 系)・手修正可能。
- **OGP 住所自動入力 (新規)**: `useOgpFetch` の応答に含まれる title/description に `parseHousingFromText` をかけ、読み取れた分だけ住所へ (ツイート本文と同じ経路・同じ演出)。
- **オートセーブ**: localStorage key `housing-register-draft`。debounce 保存。**テキスト系フィールドのみ** (localImages のバイナリは対象外・復元時にその旨注記)。復元通知 + 破棄ボタン。成功/破棄でクリア。
  **復元と SNS 派生 state の相互作用 (確定方針)**: SNS 画像 (tweetData/ogpResult/sourceImageUrls) は保存対象外の派生 state のため、**復元時は保存済み SNS URL から取得のみ再実行して画像 state を再構築**する (「SNS 画像は再取得します」注記)。ただし**住所への自動入力 (setAutoFilled) は復元後に空のフィールドだけに適用** — 復元済み・手修正済みの値をタイピング演出で上書きしない。URL 欄が埋まっているのに画像 state が空のまま黙って imageMode='none' で登録される事故と、復元値の上書き事故の両方を塞ぐ。
- **submit フロー**: 確認セクションのボタン → checkDuplicate → 重複あれば `HousingDuplicateWarningDialog` (匿名行対応に拡張) → `registerListing` → localImages あれば upload-thumbnail 逐次 → `fetchAndUpsert` → **`/housing/listing/{id}` へ遷移 + 成功トースト** (非公開時は「非公開で保存しました」)。エラー表示は既存 3 分類 (quota/not_authenticated/generic) を踏襲。
- scroll-spy は IntersectionObserver 基準 (scroll ハンドラでの layout 読み取りを避ける [[reference_perf_forced_reflow_resizeobserver]])。

---

## パートC: 地図データ組み込みと区画プレビュー

- **座標データ生成**: `node scripts/parse-ward-svg.mjs docs/housing-maps-src/<入力>.svg <Area> src/data/housing/<出力>.generated.json` — **3 引数を必ず明示** (area 省略は 'Mist' フォールバック + 出力既定が `mistWard.generated.json` で、温存すべき既存ファイルを上書きする。`parse-ward-svg.mjs:2,11`)。ミスト本街のみ命名例外 `mist.svg` (mist-main.svg は無い)。新規分の命名は `{area}Main/{area}Sub` 系で統一し、エリア→json のマニフェスト (動的 import マップ) を 1 箇所に置く。既存 `mistWard.generated.json` は温存 (旧 MapView が参照)。
- **表示素材 (重要・json だけでは地図は描けない)**: 生成 json は区画の**中心点座標**(x/y)・ノード・道 path のみで区画形状を持たない (`mistWard.generated.json` 実測)。地図の見た目は別物の表示用 SVG (`mist.generated.svg` を ?raw inline、`MapView.tsx:9,117`) で実現しており、**これはミスト 1 枚しか存在しない**。→ 今回 10 マップ分の表示用 SVG をアセット化する: まず `mist.generated.svg` の生成元/工程を確認し (推測しない)、同じ工程で `docs/housing-maps-src/` の元 SVG 9 枚から表示用を作る。json とセットで遅延ロードし、1 枚あたりのサイズを実測してバンドル/転送に問題があれば軽量化 (不要要素除去・ラスタ化) を判断する。
- **ハイライト表現 = 中心点の発光マーカー** (+番地ラベル)。区画形状の塗りハイライトはデータに形状が無いため今回はやらない (完了定義 3 の「正しい区画が光る」はマーカー発光を指す)。
- **遅延読み込み**: 該当エリアの json + 表示用 SVG のみ動的 import (バンドル肥大防止・「サクサク」指針)。ロード中はスケルトン。
- **`WardMapPreview` (共有部品・読み取り専用)**: props = `{ area, plot: number|null, apartmentBuilding: 1|2|null, buildingType }` 相当 (実装時に最小化)。該当区画/アパート棟をハイライト。
  - **番地 31〜60 = 拡張街 json + `plot - 30` 読み替え** (パーサは変えない・表示側で読み替え。`docs/.private/2026-07-01-housing-tour-rebuild.md` M5 注意事項)。
  - アパート = `apart_1` (本街) / `apart_2` (拡張)。FC 個室 = 親の家の区画。
  - 住所未確定時 = 「住所を入力すると、ここに区画が表示されます」の静かなプレースホルダー。
  - ハイライト色は 2 アクセント体系の範囲 (青=選択系が原則)。最終判断は実画面ゲート。
  - 地図の下に住所要約テキスト (エリア/区/番地/サイズ/タイプ)。エーテライト表記は載せない (将来自動算出で追加)。
- 今回の配線先は登録ページのみ。詳細ページ/ツアーへの配線は後スパン (部品はそれに耐える API で作る)。

---

## i18n

- 名前空間: 既存 `housing.register.*` (4言語 leaf 122 キー parity 済) を流用し、新規分 (ステッパー/入力チェック/公開設定/土地プレビュー/オートセーブ/匿名重複行) を同空間に追加。ja/en/ko/zh 4言語同時・該当ブロックのみ textual 編集 ([[feedback_locale_json_textual_edit]])。
- 既存 i18n parity テスト (`housing.favorites.*` 方式) の対象に `housing.register.*` を追加。
- 用語: 「ハウジング」統一・「物件」禁止 ([[feedback_terminology_housing]])。

## テスト

- **純関数**: `isEffectivelyPublic` (公開/非公開/期限前後/フィールド欠落) / plot 31-60 読み替え / オートセーブの serialize・restore。
- **部品単体**: ステッパー状態遷移 (未入力→現在地→完了チェック) / RegisterCheckPanel の行表示 / RegisterDuplicatePanel の 3 状態 (未照会/公開重複/匿名重複) / WardMapPreview のハイライト対象解決。
- **ページ統合**: URL 貼付→自動入力がフォームへ反映 / 住所確定→重複照会発火 / 必須不足で公開ボタン disabled + 不足列挙 / 登録成功→遷移。
- **サーバー/バリデーション**: 新 3 項目の validate (title は「送信時のみ検証」の寛容仕様どおりか含む) / checkDuplicate の匿名化 (非公開詳細を返さない・`duplicates` キー後方互換) / update の新項目。
- **Firestore ルール**: `@firebase/rules-unit-testing` (エミュレータ) で「新ルール × 5 つの実クエリが list を通る」「他人の非公開 getDoc が拒否・本人は許可」を検証。**ルール deploy 前の必須ゲート**。万一 list 証明が通らない場合の代替案 (ルール式の単純化・クエリ形の調整) はこの結果を見て決める。
- **回帰**: 探す/お気に入りの既存テスト緑維持 / **既存登録系テスト (87 件) は新バリデーション仕様 (title 寛容・visibility default) に合わせて必要分を更新した上で全緑** (「無修正で緑」ではない) / お気に入り・トレイが非公開化で自然非表示。
- vitest は `pool='vmThreads'` 厳守・出力をパイプしない。push 前 `npm run build` + `npx vitest run` 必須。

## 非目標 (YAGNI・今回やらない)

- 承認制の限定公開 / 公開開始日時の予約 / サーバー保存の下書き / 期限切れの cron 掃除 (遅延評価で足りる・将来任意)。
- 編集画面の全面刷新・登録後の画像差し替え (マイページスパン以降)。
- スマホ対応 (M6)。エーテライト入力欄 (将来自動算出)。
- 旧登録モーダル (系統A) の撤去 (旧 workspace 撤去とセットで別タスク)。
- 詳細ページ/ツアーへの WardMapPreview 配線 (部品だけ再利用可能に作る)。

## 完了の定義

1. 新シェル `/housing/register` で「URL 貼付→自動入力→ミニマップ点灯→公開」が実機で最後まで通る (実データ登録)。
2. 非公開・期限付き登録→一覧で本人バッジ→編集で公開切替/延長、の一巡が動く。他人からは非公開がデータごと見えない。
3. 全 10 マップで正しい区画が光る (拡張街読み替え・アパート棟含む)。
4. `npm run build` + `npx vitest run` 全緑 / ハードコード grep 監査 / 4言語 parity。
5. 実画面 (1489x679 / DPR 2.58) でユーザー目視 OK (実画面ゲート)。
6. 完了後: ブランチ全体の最終レビュー → merge 解禁 → 本番反映は A-3 の順序 (バックフィル済→アプリ→保険の再バックフィル→ルール) に従う。ルール deploy はエミュレータ検証ゲート通過が前提。
