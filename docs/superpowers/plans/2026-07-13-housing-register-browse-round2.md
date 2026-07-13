# ハウジング登録/探す/詳細/ツアー 改善 (round2) 実装計画

> **設計書**: `docs/superpowers/specs/2026-07-13-housing-register-browse-round2-design.md` を先に読むこと。本計画はそれを操作可能タスクに落としたもの。

**Goal:** 本番テスト round2 の残課題(①⑧②⑨D)+ 気づき(a/b/c/d/e/f)を実装し、登録フロー/探す/詳細/ツアーを改善する。

**Architecture:** 既存 React+TS+Vite+Zustand。ハウジング独立トンマナ(`--housing-*` トークン)。並列実装エージェント(安価モデル可)を**部品ファイル単位**で分け、共有ファイル(`housing.css`・`src/locales/*.json`)は統合担当が一括で当てる。

**Tech Stack:** React, TypeScript(tsc -b 厳密), Vitest, react-i18next(4言語 parity), react-router(navigate).

## Global Constraints (全タスク共通・逐語)
- **色/寸法/影は必ず `--housing-*` トークン経由。ハードコード(rgb/rgba/#hex/px直書き)禁止**。新規トークンは `housing.css` の `.housing-workspace` 上部ブロックに追加。
- **i18n 4言語(ja/en/ko/zh)parity 必須**。locale JSON は**該当行のみ textual 編集**(全体 parse→stringify 禁止)。
- **housing 独自トンマナ**: 白黒ルール非適用。装飾999pxピル/honeyグラデ/過剰glow/色付きalert箱を避ける(質感A案)。モックアップから外れる見た目変更は最小限。
- **テスト/ビルドは各実装エージェントは実行しない**(統合担当が一括 = vitest ゾンビ回避)。エージェントはテストを**ファイルとして書く**のみ。
- **担当ファイル以外を編集しない**。`housing.css`/`locales` は編集せず「必要な追加(実CSS/実4言語文字列)」を**報告**する。
- push 前に `npm run build`(tsc厳密)+ `rtk vitest run housing` 緑を統合担当が確認。

---

## ファイル構成と担当ストリーム

| Stream | 担当ファイル(部品) | 項目 |
|---|---|---|
| **A 登録/住所コア** | `parseHousingFromText.ts` / `RegisterPage.tsx` / `formatHousingAddress.ts` / `TourShowcasePanel.tsx` + それらのテスト | ①②⑨c |
| **B 詳細** | `HousingDetailContent.tsx` + テスト | a b |
| **C ナビ/フィルタ/PF** | `AppHeader.tsx` / `BrowsePage.tsx` / `FilterPanel.tsx` / `HousingerPage.tsx` + テスト | d f e |
| **D 確認ゲート** | `RegisterSectionConfirm.tsx` + テスト | D(JSX+文言参照) |
| **E ツアー** | `TourNavMap.tsx` + テスト | ⑧ |
| **統合(私)** | `src/styles/housing.css` / `src/locales/{ja,en,ko,zh}.json` | 全 CSS/文言 + build/test/deploy |

各エージェントは新規i18nキー参照(`t('...')`)や新規CSSクラス付与までを実装し、**実CSS/実文字列は報告**。統合担当がトークンで当てる。

---

## Stream A: 登録/住所コア (①②⑨c)

**Files:**
- Modify: `src/lib/housing/parseHousingFromText.ts`(:34 WARD_PLOT_DASH_RE, :100-130 抽出ループ, :150-170 ward-plot 適用, :240-248 return)
- Modify: `src/components/housing/pages/RegisterPage.tsx`(:471-524 applyExtractedResult, :871-929 performRegister, :898-900, :1006-1020 confirmSummary)
- Modify: `src/lib/housing/formatHousingAddress.ts`(:74-81 formatFullHousingAddress + 新ヘルパー)
- Modify: `src/components/housing/tour/TourShowcasePanel.tsx`(:82, :115)
- Test: `src/lib/housing/__tests__/parseHousingFromText.test.ts`, `.../formatFullHousingAddress.test.ts`, `.../formatHousingAddress.test.ts`(size helper), `RegisterPage.test.tsx`

**Interfaces (Produces):**
- `housingSizeDisplayLabel(size: 'S'|'M'|'L' | undefined): string`(→ 'Small'|'Medium'|'Large'|'')— `formatHousingAddress.ts` から export。
- `formatFullHousingAddress` は region null 時に従来 `formatHousingAddress` へフォールバック(シグネチャ不変)。
- `buildLocalListingViewModel(draft, id, ownerUid)` : `MockListing`(ローカル view-model 生成・Firestore 読み取り0)— `RegisterPage.tsx` 内 or 近傍ヘルパー。

### タスク A-1: ⑨ サイズ表示ヘルパー
- [ ] `formatHousingAddress.ts` に追加:
```ts
/** サイズ id を表示ラベルへ。 生 'S' でなくスペルアウト(ユーザー要望・全言語共通英語)。 */
export function housingSizeDisplayLabel(size?: 'S' | 'M' | 'L'): string {
  if (size === 'S') return 'Small';
  if (size === 'M') return 'Medium';
  if (size === 'L') return 'Large';
  return '';
}
```
- [ ] テスト(`formatHousingAddress.test.ts` 追記): `housingSizeDisplayLabel('S')==='Small'` 等、`undefined→''`。
- [ ] `TourShowcasePanel.tsx:82` `` ` ・ ${listing.size}` `` → `` ` ・ ${housingSizeDisplayLabel(listing.size)}` ``(import 追加)。同 `:115`(`next.size`)。
- **受け入れ**: ツアーの size 表示が「・ Small」等。

### タスク A-2: ② formatFullHousingAddress の null ガード
- [ ] `formatHousingAddress.ts:74-81` の `formatFullHousingAddress` を、`region` が falsy(null/未知)なら**従来 `formatHousingAddress(addr, lang)` を返す**ようフォールバック。region 有効時のみ `${regionLabel}/${dc}/${server}/${local}`。size 併記が必要なら A-1 ヘルパーを使う(現行は付けていない=呼び出し側で付与。据え置き)。
- [ ] テスト(`formatFullHousingAddress.test.ts` 追記): region が既存 map に無い DC(例 `dc:'Shadow'`)でクラッシュせず従来住所を返す。既存の JP/OCE テストは回帰。
- **受け入れ**: Shadow 等でクラッシュしない(N も同時に堅牢化)。

### タスク A-3: ② 確認&公開ボタン上の住所をフル化
- [ ] `RegisterPage.tsx:1006-1020` の `confirmSummary` で住所を `formatFullHousingAddress` に変更。`region = regionForDC(address.dc)`(`dcServerMap.ts:33` を import)、`dc=address.dc`, `server=address.server` を渡す(addressOk 時は必ず在り。null は A-2 ガードが処理)。
- [ ] テスト(`RegisterPage.test.tsx`): 住所が揃った状態で confirm セクションの住所行がフル形式(region/dc/server を含む文字列)。
- **受け入れ**: 確認セクション+ゲート住所(`RegisterSectionConfirm.tsx:84,111`)が両方フル。

### タスク A-4: ① アパートのパーサ根治
方針(設計書 ①): **アパート判定時は家用「区-番地」誤読を止め、確信の持てる区/号棟/部屋のみ抽出。誤値を作らず空欄優先。**
- [ ] `parseHousingFromText.ts` を Read し、現在の抽出ループ(:100-130)と ward-plot 適用(:150-170)を把握。
- [ ] **アパートフラグ**(size 候補に 'Apartment' が入った/アパート名一致)が立っているとき、`WARD_PLOT_DASH_RE`(:34)による `ward`/`plot` 割当を**スキップ**する分岐を入れる(家住所の解析は不変)。
- [ ] アパート文脈で `N-M`(号棟-部屋)を検出できるとき `apartmentBuilding=N`, `roomNumber=M` を返す(確信が持てない/複数曖昧なら入れない=空欄)。単独の区番号があれば `ward` に。**取れないものは undefined のまま返す**(誤値禁止)。
- [ ] `return`(:240-248)に `roomNumber`(と必要なら `apartmentBuilding`)を含める。
- [ ] `RegisterPage.tsx:471-524 applyExtractedResult`: `result.roomNumber` があれば `fills.push(['roomNumber', result.roomNumber])`。`result.apartmentBuilding` があれば同様(無ければ既存の既定1が効く)。
- [ ] **テスト(最重要・回帰含む)**:
  - `Mist | 17 | Topmast 1-13 | Apartment` → `area:'Mist', size:'Apartment'`。ward-plot 誤割当が起きない(ward≠1・plot が 13 で家扱いにならない)。号棟/部屋が取れれば 1/13、取れなければ undefined(誤値でない)。
  - **家の回帰**: `ミスト 23-6 Mサイズ` 等 → 従来どおり ward=23, plot=6, size='M'(アパート化しない)。
  - **個室の回帰**: PrivateRoom 経路が従来どおり。
  - 順序違い(アパート名が先頭/末尾)でもアパート判定される。
- **受け入れ**: 対象ツイートで誤った区/番地を作らず、アパートとして認識、不足分は空欄(手入力可)。家/個室は不変。

### タスク A-5: c 登録後の即反映(Firestore 読み取り0)
- [ ] `RegisterPage.tsx` に view-model 生成ヘルパーを追加(近傍):
```ts
// 登録直後、Firestore を読まずに探す一覧へ即反映するためのローカル view-model。
// thumbnailPath はサーバ upload 後に付くため未確定 → SNS/ローカル画像で暫定表示。
function buildLocalListingViewModel(draft, id, ownerUid) { /* draft + id + ownerUid + regionForDC(dc) から MockListing を組む */ }
```
（`MockListing` の必須フィールドは `galleryAdapter.ts:15-24` / `mockListings.ts` を参照して埋める。`region = regionForDC(draft.dc)`、`createdAt` はサーバ値が無ければ現時刻相当の単調値。）
- [ ] `RegisterPage.tsx:898-900 performRegister` の `await fetchAndUpsert(id)` + `loadMine(uid)` を、**`useHousingListingsStore.getState().upsert(buildLocalListingViewModel(draft, id, user.uid))` に置換**(Firestore 読み取り0)。`loadMine` の即時再呼び出しは削除。
- [ ] テスト(`RegisterPage.test.tsx`): 登録成功後 `upsert` がローカル view-model で呼ばれ、`fetchAndUpsert`/`loadMine` が呼ばれない(spy)。
- **受け入れ**: 登録直後に探す一覧へ追加読み取り無しで出る。
- **注意**: `Date.now()` はテスト環境で問題ないが、決定的にしたい場合は引数化。thumbnail 暫定表示は許容。

---

## Stream B: 詳細ページ (a b)

**Files:** Modify `src/components/housing/listing/HousingDetailContent.tsx`(:74-76 title, :223-224 見出し/住所, :228-234 タグ)。Test: `.../listing/__tests__/HousingDetailContent.test.tsx`。
**統合担当への報告**: タグを `<button>` にする際の見た目(既存 chip 維持)CSS、タイトル見出しのトークン(既存 `--housing-detail-title-*` 流用可なら不要)。

### タスク B-1: b タイトルを最上部に(住所は残す)
- [ ] `HousingDetailContent.tsx:74-76` の `const title = fullAddress;`(+ stale コメント)を `const title = listing.title?.trim() || fullAddress;` に変更。
- [ ] 既存の h2(:223)= この `title`、その下の住所 `.housing-detail-address`(:224 = DC/server)は**据え置き**。※現状 h2 が住所だったので、タイトル設定時は「タイトル(h2) + DC/server」になり街区住所が本文から消える懸念 → **街区住所を必ず残す**ため、`.housing-detail-address` 付近に街区住所(`formatHousingAddress`)も表示する行を足すか、h2 とは別にタイトル行を新設。**実装判断**: 「上に見出し(title||address)、その下に必ず街区住所+DC/server」。タイトル未設定なら見出し=住所、下も住所(2回・ユーザー明言OK)。
- [ ] テスト: title 設定 listing → 最上部に title、下に街区住所。title 無し → 最上部に住所。
- **受け入れ**: 設計書 b の受け入れ。

### タスク B-2: a 詳細タグをクリックで絞り込み
- [ ] `HousingDetailContent.tsx:228-234` のタグ `<li>{tag.label}</li>` を `<li><button type="button" className="housing-detail-tag-btn" onClick={() => { toggleTag(tag.id); navigate('/housing'); }}>{tag.label}</button></li>` に。`useHousingFilterStore`(`toggleTag`)と `useNavigate` を import。
- [ ] 個人タグ(`personal_`)も同様に toggle(既存の PersonalTagFilter 連動は BrowsePage 側で処理される)。
- [ ] テスト: タグクリックで `toggleTag(id)` 呼び出し + `navigate('/housing')`。
- **統合報告**: `.housing-detail-tag-btn` の CSS(既存 `.housing-detail-tags li` の chip 見た目を button で再現・カーソル pointer・hover)。

---

## Stream C: ナビ/フィルタ/PF (d f e)

**Files:** `AppHeader.tsx`(:103-110), `BrowsePage.tsx`(:145 付近), `FilterPanel.tsx`(:100-102, :202-206 は文言のみ=locale), `HousingerPage.tsx`(:242-282)。Test: 各 __tests__。
**統合報告**: 中央フィルター解除ボタンの CSS、PF grid 調整 CSS、`filter.clear_all` 文言変更(4言語)。

### タスク C-1: d ヘッダー「ハウジングツアー」→ 探すへ
- [ ] `AppHeader.tsx:105-107` の `<span className="housing-brand-sub …">{t('housing.workspace.topbar.subtitle')}</span>` を `<button type="button" className="housing-brand-sub …" onClick={() => navigate('/housing')} aria-label={...}>` に(`useNavigate` 既存確認)。文言不変。
- [ ] テスト: クリックで `/housing` へ navigate。
- **統合報告**: button のデフォルト装飾を消しテキスト見た目を保つ CSS(必要なら)。

### タスク C-2: f 中央にフィルター解除ボタン + 左文言
- [ ] `BrowsePage.tsx:145` の `BrowseViewToggle` の横に、`hasActiveFilter`(dc/regions/servers/areas/sizes/tags のいずれか有り。`useHousingFilterStore` から算出 or 既存 `FilterPanel.tsx:100-102` の式を BrowsePage で再現)なら「フィルター解除」ボタンを表示、`onClick={() => useHousingFilterStore.getState().clearAll()}`。新規 i18n キー `housing.browse.clear_filter`(=左と同文言)を参照。
- [ ] テスト: 絞り込み有りで解除ボタン表示・クリックで clearAll。無しで非表示。
- **統合報告**:
  - 中央ボタン CSS(`.housing-browse-clear-filter`・トグルと並ぶ見た目)。
  - **左文言変更**: `housing.workspace.filter.clear_all`(ja.json:2481「すべてクリア」)→「フィルターを解除」(1行に収まる短さ)。4言語(en「Clear filters」/ ko / zh)。
  - 中央用キー `housing.browse.clear_filter`(4言語・左と同文言)。

### タスク C-3: e PF レイアウト調整 + X共有(A案)
- [ ] `HousingerPage.tsx` に共有ボタンを追加(`.housinger-page-listings-toolbar` 付近 or ヘッダー):既存 `HousingShareButton`(`src/components/housing/listing/HousingShareButton.tsx`)を流用。`url={`${window.location.origin}/housing/housinger/${uid}`}`, `title=` プロフィール名等。
- [ ] レイアウト: `ListingGrid` 流用のままだと「一覧 N件」見出し+並び替えが冗長。**最小の見やすさ改善**に留める(過度な作り込みはしない)。具体は統合担当と実画面で確認(例: PF文脈で見出し簡素化)。まずは共有ボタン設置を確実に。
- [ ] テスト: PF に共有ボタンが出る/`HousingShareButton` に PF URL が渡る。
- **統合報告**: PF 共有ボタン配置の CSS、grid 調整案(あれば)。

---

## Stream D: 確認ゲート強調 (D)

**Files:** Modify `src/components/housing/register/RegisterSectionConfirm.tsx`(:84-90 ゲート lead + button)。Test: 同 __tests__(あれば)。
**統合報告**: 脈動アニメの CSS、lead 文言(4言語)。

### タスク D-1: 確認ボタンを目立たせる
- [ ] `RegisterSectionConfirm.tsx` の確認ゲート lead(`.housing-register-confirm-gate-lead`「この住所で登録します」)を、**明示誘導文言**の新キー `housing.register.confirm.gate_lead_prompt`(=「住所を確認して、このボタンを押してください」相当)に差し替え。
- [ ] 確認ボタン(`.housing-register-confirm-gate-btn`、`data-confirmed` 属性あり)に**脈動クラス**を付与(未確認時)。`data-confirmed="false"` の間だけ脈動する CSS を統合担当が当てるので、**JSX 側は既存の `data-confirmed` を維持**すればよい(CSS が `[data-confirmed="false"]` セレクタで脈動)。追加クラス不要なら現状維持でCSSのみ。
- [ ] テスト: lead に誘導文言、button に `data-confirmed="false"`(未確認時)。
- **統合報告**:
  - CSS: `.housing-register-confirm-gate-btn[data-confirmed="false"]` に `@keyframes` 脈動(トークン経由・上品・`prefers-reduced-motion` で無効化)。
  - 文言: `housing.register.confirm.gate_lead_prompt` 4言語(ja「住所を確認して、下のボタンを押してください」/ en 等)。

---

## Stream E: ツアーズーム衝突 (⑧)

**Files:** Modify `src/components/housing/tour/TourNavMap.tsx`(:30 OUT_MS, :103-111 endIntro, :120-137 tryDoSwap, :169-232 dip effect, :210-213 firstReady rAF, :337 onTransitionEnd)。Test: `.../tour/__tests__/TourNavMap.test.tsx`。

### タスク E-1: transitionend を zoom-in に限定
- [ ] `TourNavMap.tsx` に `const zoomingIn = useRef(false);` を追加。
- [ ] `endIntro`(:103)冒頭と dip 開始(:219-231 付近、ズームアウト開始時)で `zoomingIn.current = false`。
- [ ] ズームイン開始の瞬間(`tryDoSwap` の rAF 内 :132-136 の `setView(target)` 直前、および firstReady の rAF :210-213)で `zoomingIn.current = true`。
- [ ] `onTransitionEnd`(:337)を `if (e.propertyName === 'transform' && zoomingIn.current) endIntro();` に(out フェーズの transitionend では終了しない)。
- [ ] **保険タイムアウト**: dip 開始時、新地図が来ない場合の out 待ち上限(例 既存 `ZOOM_SETTLE_MS`/新規)で、未 ready のままなら旧地図を可視復帰 or 全景表示(無限ブランク回避)。既存 settle(1000ms)は維持。
- [ ] テスト(happy-dom はtransition非走行のためロジック単体): `zoomingIn` の遷移(dip→false / zoom-in開始→true / endIntro→false)を検証。out フェーズ相当で endIntro が呼ばれないガードのユニット確認。
- **受け入れ**: 別ワード移動でロードを待ってから確実にズームイン(ユーザー本番目視)。crossing/phase 非改変。

---

## 統合担当(私)のタスク
1. 各 Stream の報告を集約し、**`housing.css`**(D脈動 / f中央ボタン / a タグbutton / b タイトル見出し / e PF grid / C-1 header button)を**トークンで**一括追加。
2. **`src/locales/{ja,en,ko,zh}.json`** に新規キーを textual 追加(D lead / f clear_filter×2箇所 / 必要な aria)。4言語 parity。
3. `npm run build`(tsc厳密)+ `rtk vitest run housing` 緑を確認。赤があれば systematic-debugging で修正。
4. コミット → push → 本番デプロイ。
5. 目視チェックリストをユーザーへ(②折返し / D脈動 / f文言長 / ⑧ズーム / e見た目 / ①アパート登録 / c即反映)。

## Self-Review(計画→設計 突合)
- ①=A-4 / ②=A-2,A-3 / ⑨=A-1 / D=D-1 / c=A-5 / d=C-1 / f=C-2 / a=B-2 / b=B-1 / e=C-3 / ⑧=E-1 → **全項目にタスク有り**。
- 型整合: `housingSizeDisplayLabel`/`formatFullHousingAddress`/`buildLocalListingViewModel` は A で定義し A 内で使用。`toggleTag`/`clearAll`(useHousingFilterStore 既存)。
- 未確定の実装判断(A-4 の号棟/部屋抽出ヒューリスティック, A-5 の MockListing 必須フィールド, B-1 の街区住所配置, C-3 の grid 調整)は各タスクに「実装判断」として明記済 → エージェントは spec + 既存コード参照で決定、迷えば空欄/最小で安全側。
