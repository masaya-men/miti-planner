# 設計書: ハウジング登録/探す/詳細/ツアー 改善 (本番テスト round2)

- **日付**: 2026-07-13 (セッション6続き)
- **由来**: 本番テスト14件(A〜N)の一括修正デプロイ後、ユーザーが再度本番検証して出た残課題 + 気づき6件。
- **前提調査**: 並列診断4体で根因を証拠付き特定済み(file:line は本書に反映)。
- **合意**: ユーザーと全項目の方針合意済み(本書の各「決定」)。ユーザーはレビューを省略し、実装完了→本番確認する方針。
- **正典**: ハウジングは独立トンマナ(`.claude/rules/housing-design.md`)。色/寸法/影は必ず `--housing-*` トークン経由(ハードコード禁止)。i18n は4言語(ja/en/ko/zh)parity 必須、JSONは該当行のみ textual 編集。

---

## スコープ (9項目・4フェーズ)

| Phase | 項目 | 種別 |
|---|---|---|
| 1 登録フロー | ① アパート自動判定の根治 / ② 確認&公開ボタン上の住所フル化 / ⑨ サイズ表記統一 / D 確認ゲート強調 | バグ+UI |
| 2 探す/ナビ | c 登録後の即反映(コスト0) / d ヘッダー遷移 / f フィルター解除ボタン / a タグクリック絞り込み | 機能+UI |
| 3 詳細/PF | b タイトル最上部 / e PFレイアウト+X共有 | UI+機能 |
| 4 ツアー | ⑧ マップ切替×ズーム衝突 | バグ |

### スコープ外(別タスク)
- e の **専用OGPカード/画像生成(B案)** — 今回は簡易URL共有(A案)。**将来案=Allmarks(マイコラージュ)の「リンク→画像化→SNS投稿」機能と連携**(自作OGPより筋が良い)。→ `docs/TODO.md` アイデア欄に記録。
- **カードにタグを表示**(2026-07-03「カードにタグ出さない」合意は維持)。a は詳細ページのタグのみクリック可能化。
- admin レポート一覧のタグ生ID表示(`AdminHousingReports.tsx:189`・軽微)。
- J マイページ(別途 brainstorming)。

---

## Phase 1: 登録フロー

### ① アパート自動判定の根治 【最重要】

**根因(調査確定)**: 対象ツイート本文 `Mist | 17 | Topmast 1-13 | Apartment` を、パーサは**アパートと正しく認識できている**(`parseHousingFromText.ts:112` アパート名一致 / `:118` サイズ別名)。しかし:
- `WARD_PLOT_DASH_RE`(`:34` = `/(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/`)が「Topmast **1-13**」を家用の「区-番地」として先に食い(`:157`)、**ward=1・plot=13 と誤読**。本来は ward=17・号棟=1・部屋=13。
- パーサは `roomNumber` を**一度も代入しない**(`return :240-248` に無し)。`applyExtractedResult`(`RegisterPage.tsx:471-524`)も `result.roomNumber` を読まない。
- 結果 `validateAddress`(`housingValidation.ts:157-161`)が apartment に roomNumber 必須 → `addressOk=false` → 登録不可。手動でアパート切替時のみ `roomNumber=1` 既定投入(`RegisterSectionAddress.tsx:74`)という非対称が本質。

**ユーザーの指示(決定)**:
- 並び順に依存しない。**「アパート名が含まれていたらアパートとして判別を試みる」名前ベース**で行く(位置決め打ちの書式パースはしない=順序が変わると壊れるため)。
- **家/個室の判別を絶対に壊さない**(アパート処理はアパート名/サイズ語ゲートで別分岐なので安全。回帰テスト必須)。
- **曖昧なものは間違えるより空欄**にして手入力へ(誤データを作らない)。

**決定した方式**:
1. **検出**: アパート名/サイズ語一致で `buildingType='apartment'` を確実にする(既存動作の維持・強化)。
2. **家用「区-番地」誤読の停止**: アパート判定が立っているときは `WARD_PLOT_DASH_RE` による ward-plot 割当を**適用しない**(誤 ward=1/plot=13 を防ぐ)。
3. **保守的抽出**: アパート文脈で確信を持って取れる区(単独の区番号)・号棟・部屋のみ自動入力。取れないものは空欄(可視ステッパーで手入力)。`apartmentBuilding` は既定1(先日の修正済)、`roomNumber` は確信があれば投入・無ければ空欄。
   - ヒューリスティック例(実装で確定): 「アパート名 直後の `N-M`」を号棟N・部屋Mとみなす等。ただし**確信が持てない場合は入れない**。
4. **applyExtractedResult**: `result.roomNumber`(あれば)を fills に追加。
5. **誤データ波及の停止**: 誤 ward/plot は住所表示・重複照会にも汚染するため、②のフル住所化・重複照会が正しい値を使えるよう本項を先行させる。

**変更ファイル**: `parseHousingFromText.ts`(:34,:112,:118,:157,:240) / `RegisterPage.tsx`(:471-524 applyExtractedResult)。
**テスト**: アパート表記の複数パターン(順序違い・アパート名のみ・号室表記ゆれ)/ **家・個室の回帰**(誤ってアパートにならない・区/番地が従来どおり)。
**受け入れ**: 対象ツイートを貼ると buildingType=apartment・区/号棟/部屋が正しい or 空欄(誤値なし)・登録可能(不足分は手入力後)。

### ② 確認&公開ボタン上の住所をフル住所化 (+ null ガード)

**根因/現状**: 確認セクションの住所行(`RegisterSectionConfirm.tsx:111`)と確認ゲートの住所(`:84-86`「この住所で登録します」直下=公開ボタン上)は**単一値 `confirmSummary.address`**(`RegisterPage.tsx:1006-1020`)から来る。組み立ては `formatHousingAddress`(DC/ワールド/リージョンを含まない)。**1箇所直せば両方フルになる**。

**⚠ 潜在クラッシュ(同時修正)**: `formatFullHousingAddress`(`formatHousingAddress.ts:74-81`)は `regionLabel(region,…)` を呼ぶが、`DC_SERVER_MAP`(`dcServerMap.ts:8-20`)が古く **Shadow(EU)等の新DCが欠落** → `regionForDC('Shadow')` が null → `regionLabel(null)` で**実行時クラッシュ**。**これは先日デプロイ済の N(ツアー完全住所)も同じ穴**。

**決定した方式**:
1. `formatFullHousingAddress` に **region が null/未知なら `formatHousingAddress`(従来)にフォールバック**する null ガードを追加。→ ②と N を同時に堅牢化。
2. `confirmSummary`(`RegisterPage.tsx:1006-1020`)の `formatHousingAddress` を `formatFullHousingAddress` に置換。`region=regionForDC(address.dc)`・`dc`/`server` を渡す(addressOk=true 時は dc/server 必ず在り)。

**変更ファイル**: `formatHousingAddress.ts`(:74-81) / `RegisterPage.tsx`(:1006-1020)。
**テスト**: confirmSummary がフル住所を返す / region null(Shadow等)でクラッシュせず従来住所にフォールバック / 既存 formatFullHousingAddress テスト回帰。
**受け入れ**: 確認セクション・公開ボタン上の両方が「日本 / Mana / Pandaemonium / ミスト・ヴィレッジ …」形式。表示が長いので確認ゲートの折返しは実画面(DPR2.58)で目視(ユーザー確認項目)。

### ⑨ サイズ表記の統一 (「Small」形式)

**現状(調査確定)**: `HousingSize`='S'|'M'|'L'(`types/housing.ts:27`)。ツアー(`TourShowcasePanel.tsx:82,115`)は生 `listing.size`=**「・ S」**と略記表示。`housingSizeMasterData`(`masterData.ts:240-243`)は `{id:'S', label:'Sハウス', aliases:['S','Sサイズ','Small']}` を持つ(label は日本語「Sハウス」)。ユーザーは **「Small」のように書きたい**(スペルアウト英語)。

**決定した方式**:
1. **表示ヘルパー** `housingSizeDisplayLabel(size)` を新設 → `'S'→'Small' / 'M'→'Medium' / 'L'→'Large'`(スペルアウト英語・全言語共通。ユーザー明示要望)。定義場所は `src/lib/housing/formatHousingAddress.ts` か近傍(size 表示を扱う場所)。
2. **適用箇所**: ②のフル住所(`formatFullHousingAddress` の size 併記)と、`TourShowcasePanel.tsx:82,115` の `・ ${listing.size}` → `・ ${housingSizeDisplayLabel(listing.size)}`。生 `S` 表示を全て「Small」形式に統一。
3. **登録のサイズ選択UI(`RegisterSectionAddress.tsx:236` 「Sハウス」)は今回触らない**(日本語「ハウス」表記は別文脈・ユーザー指摘は生 S 表示に対して)。ズレが気になる場合はユーザー確認項目。
**変更ファイル**: `formatHousingAddress.ts`(ヘルパー+フル住所) / `TourShowcasePanel.tsx`(:82,:115)。
**受け入れ**: フル住所・ツアーのサイズ表記が「Small/Medium/Large」で一貫(生 S/M/L が消える)。

### D: 住所確認ゲートを目立たせる

**現状**: 確認ゲートには**既に**「この住所で間違いありません」ボタン(`housing-register-confirm-address-btn`)+リード「この住所で登録します」がある(`RegisterSectionConfirm.tsx:84 付近`)。ユーザーの不満は「**ボタンが目立たず、なぜ登録できないのか分からない**」。

**決定した方式(UI強調のみ・機能は既存)**:
1. リード文を **「住所を確認して、このボタンを押してください」** 等の明示的な誘導に(4言語)。
2. ボタンに**脈動(pulse)アニメーション**を付与(未確認=`data-confirmed="false"` の間だけ)。確認後は停止。トークン経由・過剰glow回避(housing-design 質感A案の範囲で上品に)。
3. `prefers-reduced-motion` で脈動を無効化。
**変更ファイル**: `RegisterSectionConfirm.tsx` / `src/styles/housing.css`(pulse) / locale(リード文言)。
**受け入れ**: 未確認時にボタンが脈動し誘導文が出る/確認後は静止/reduced-motion で脈動なし。

---

## Phase 2: 探す/ナビ

### c: 登録後に探すへ即反映 (Firestore 読み取り0)

**現状(調査)**: listing ストアは一度きり `getDocs`(`useHousingListingsStore.ts:52-73` / `housingListingsService.ts:126`)、`load()` は冪等(1セッション1回)。登録処理は既に `fetchAndUpsert(id)`(getDoc 1件)+`loadMine(uid)`(最大200件読み取り)で反映を試みている(`RegisterPage.tsx:898-900`)。**コスト=登録毎に最大201件読み取り**。ユーザーはコストを強く懸念。

**決定した方式**:
1. **draft からローカルに view-model を組んで `upsert()`**(Firestore 読み取り0)。`registerListing` の戻り(`{id,addressKey}`)+ 手元の `draft` + `ownerUid`(=user.uid)+ `createdAt`(実装時: サーバ値が無ければ暫定)+ `region=regionForDC(dc)` で `MockListing` view-model を生成し `upsert`。
2. `fetchAndUpsert`/`loadMine` の即時再呼び出しは**やめる**(-201 読み取り/登録)。
3. **本番で反映しない件の再現確認**: adapter が新規 doc を落としていないか(`galleryAdapter.ts:15-24` 必須フィールド判定)。ローカル upsert 方式にすればこの経路自体を回避できる。
**トレードオフ(許容)**: `thumbnailPath` はサーバ upload 後に付くためローカル生成時は未確定 → SNS/ローカル画像で暫定表示。次回シェルマウントで正規化。
**変更ファイル**: `RegisterPage.tsx`(:898-900 performRegister)+ view-model 生成ヘルパー1つ。
**受け入れ**: 登録直後に探す一覧へ**追加の Firestore 読み取り無し**で出る。

### d: ヘッダー「ハウジングツアー」→ 探すへ遷移

**現状(調査)**: 「ハウジングツアー」(`housing.workspace.topbar.subtitle`)は `AppHeader.tsx:105-107` の **`<span>`(クリックハンドラ無し=飾り)**。探すは `/housing`。
**決定した方式**: `<span>` を `<button>`(または NavLink)化し `onClick={() => navigate('/housing')}`。文言は「ハウジングツアー」のまま維持。aria-label 付与。隣の LoPo ロゴ(`/` へ)は現状維持。
**変更ファイル**: `AppHeader.tsx`(:103-110)+ 必要なら housing.css(ボタン見た目をテキストのまま保つ)。
**受け入れ**: どのページでもヘッダーの「ハウジングツアー」で `/housing`(探す)へ。

### f: 絞り込み中のフィルター解除ボタン + 文言

**現状(調査)**: 絞り込み state=`useHousingFilterStore`(`clearAll()`:55)。「すべてクリア」は左パネル `FilterPanel.tsx:202-206`(文言 `housing.workspace.filter.clear_all`=`ja.json:2481`「すべてクリア」)。中央の「一覧・マップ」=`BrowseViewToggle`(`BrowsePage.tsx:145`)。**中央に解除ボタンは無い**。
**決定した方式**:
1. 中央: `BrowseViewToggle` の横に「フィルター解除」ボタン追加。表示条件=`hasActiveFilter`(dc/regions/servers/areas/sizes/tags のいずれか)、`onClick={clearAll}`。CSS はトークン新規追加。
2. 左: `filter.clear_all` の文言を **「フィルターを解除」等・1行に収まる表現**に4言語で変更(実画面 DPR2.58 で折返し確認=ユーザー項目)。
**変更ファイル**: `BrowsePage.tsx` / `FilterPanel.tsx`(必要なら) / `housing.css` / locale4。
**論点**: keyword を hasActiveFilter に含めるか(現状は非対象=据え置き)。中央ボタンの見た目(トグルとバランス)。
**受け入れ**: 絞り込み中は中央にも解除ボタン/文言が「解除」と分かる/1行。

### a: 詳細ページのタグをクリックで絞り込み

**現状(調査)**: filter store は **tag 次元完備**(`tags`/`toggleTag`/`applyFilters.ts:22` は種別非依存で絞り込める)。前例=`AppHeader.tsx:136-143` が `toggleTag` 実施。詳細タグは非インタラクティブ `<li>`(`HousingDetailContent.tsx:228-234`、`resolvedTags` は id+label 保持済)。
**決定した方式(詳細ページのみ)**: `<li>` を `<button onClick={() => { toggleTag(tag.id); navigate('/housing'); }}>` に。個人タグ(`personal_`)も対象で良い(既存の PersonalTagFilter 連動を確認)。カードは触らない。
**変更ファイル**: `HousingDetailContent.tsx`(:228-234)/ housing.css(タグをボタン見た目に・既存 chip の見た目維持) / navigate 配線。
**受け入れ**: 詳細のタグをクリックで探すへ遷移し、そのタグで絞り込み表示。

---

## Phase 3: 詳細/PF

### b: 詳細ページのタイトルを最上部に

**現状(調査)**: `listing.title?`(`types/housing.ts:192`)は**存在し登録で収集**(50字必須・`RegisterPage.tsx:316,572`)。しかし詳細は `HousingDetailContent.tsx:74-76` で `const title = fullAddress;` と**タイトルを握り潰し**、h2 に住所を入れている(コメント「任意タイトル欄は設けない」は stale)。フォールバック前例=`ListingCard.tsx:79`/`TourShowcasePanel.tsx:69` の `listing.title?.trim() || formatHousingAddress(...)`。
**決定した方式(ユーザー指示=タイトル最上部・住所は残す)**:
- 最上部の見出し = **`listing.title?.trim() || fullAddress`**(タイトルあればタイトル、無ければ住所)。
- その下に**既存の住所詳細(街区住所 + DC/ワールド)を残す**。→ タイトル設定時は「タイトル + 住所」、未設定時は「住所 + 住所」(ユーザーが「住所が2回でよい」と明言)。
- 実装は「上に見出し(title||address)を置き、既存の住所 h2/address 行は据え置き」。stale コメント修正込み。
**変更ファイル**: `HousingDetailContent.tsx`(:74-76, :223-224)。
**受け入れ**: タイトル設定物件は最上部にタイトル+下に住所。未設定は住所が上下に。

### e: ハウジンガーPF レイアウト + X共有(A案)

**現状(調査)**: `HousingerPage.tsx` は探すの `ListingGrid` を丸ごと流用(「一覧 N件」見出し+並び替えが PF 文脈で冗長)。共有ボタン**無し**(詳細には `HousingShareButton`=Web Share/コピー/X-intent が既存)。X共有は (a)専用OGP=大規模/(b)OG画像=大規模/**(c)intent でページURL共有=既存 `HousingShareButton` を置くだけ**。
**決定した方式**:
1. **レイアウト調整**: PF一覧を見やすく(「一覧 N件」見出しの冗長さ除去 or PF専用トナリ・カード並び)。**モックアップから外れる見た目変更なので、実装案を実画面で確認しつつ最小限に**(過度な作り込みはしない)。スクショの意図=ハウジングを大きく見やすく。
2. **X共有(A案)**: `HousingerPage` に共有ボタン設置。`url=${origin}/housing/housinger/:uid`、既存 `HousingShareButton` の X-intent/コピー/Web Share を流用。公開分のみ表示のプライバシーと整合。
3. **将来案**: Allmarks 連携(リンク→画像化→SNS)を TODO/spec に記録。
**変更ファイル**: `HousingerPage.tsx` / housing.css(PF専用 grid 調整) / 既存 `HousingShareButton` 流用。
**受け入れ**: PF が見やすく、共有ボタンで自分のまとめページURLをXへ。

---

## Phase 4: ツアー

### ⑧: マップ切替×ズーム衝突の根治

**根因(調査確定・確信度高)**: ズーム演出は CSS transition(`.housing-map-zoom.is-intro`、`housing.css:6559-6567`)。目的地変更 dip 開始時に旧地図の**ズームアウト transition(750ms)**が走るが、`OUT_MS=550`(`TourNavMap.tsx:30`)より長い。新地図の非同期ロードが≳750ms かかると、**ズームアウト完了の `transitionend` が `endIntro()` を無条件に呼び**(`TourNavMap.tsx:337` のハンドラは transform かどうかしか見ない)、ズームイン待ちの状態機械(`pendingKey/outDone/introActive`)を破棄 → 新地図がアニメ無し(全景scale1)でパッと現れる=「ズームが起きない」。同一マップ/高速ロードでは retarget→transitioncancel で再現しない(=「たまに」の正体)。跨ぎ(別ワード=非同期ロード)で顕在化しやすい。

**決定した方式(最小・外科的)**:
1. `zoomingIn` ref を追加。dip 開始時と `endIntro` で `false`(=out フェーズ)、ズームイン開始 rAF(`tryDoSwap` 内 `:132-136` と firstReady `:210-213`)で `true`。
2. `onTransitionEnd` を `if (e.propertyName==='transform' && zoomingIn.current) endIntro()` に(=**out フェーズの transitionend では終了させない**)→ 新地図到着時に Effect A の `tryDoSwap()` が発火しズームインが確実に走る。
3. **保険**: ロードが極端に遅い/来ない場合の out 待ち最大タイムアウト(未 ready なら旧地図復帰 or 全景可視化)を追加(無限ブランク回避)。settle タイマー(1000ms)は維持。
**非改変**: `TourNavPage`(crossing overlay/phase 連動)は触らない。reduced-motion 経路(スナップ)は無影響。
**変更ファイル**: `TourNavMap.tsx`(:30,:103,:120-137,:169-232,:337)。
**テスト**: happy-dom は transition を走らせないため、状態機械のガード分岐は**ロジック単体で**検証(zoomingIn の遷移)。実挙動はユーザーが本番目視。
**受け入れ**: 別ワードへ移動してもロードを待ってから確実にズームインする(ユーザー本番確認)。

---

## 実装の進め方(指揮官方式)

- **ファイル競合を避ける並列化**: 独立ファイルは並列実装エージェント(安価モデル可・計画書が詳細なので)、**共有ファイル(housing.css・locale4・RegisterPage.tsx)は私が統合時に一括**。
- 各エージェントはコード+テストを書き、**テスト/ビルドは実行しない**(私が統合時に一括=vitest ゾンビ回避)。
- 統合後 **build(tsc厳密)+ housing 全テスト緑**を確認 → コミット → push → 本番デプロイ。
- 目視が要る項目(②折返し/D脈動/f文言長/M既済/⑧ズーム/e見た目)は**チェックリストでユーザーへ引き継ぎ**。

## リスク・注意
- ① パーサ変更は**家/個室の回帰テスト必須**(アパート分岐に閉じる)。誤データを作らない(空欄優先)。
- ② null ガードは N の潜在クラッシュも直す(Shadow等)。
- ハードコード禁止・トークン経由・4言語 parity・locale は textual 編集。
- housing 見た目変更(D/f/a/b/e)は独自トンマナ・過剰装飾回避(質感A案)。
