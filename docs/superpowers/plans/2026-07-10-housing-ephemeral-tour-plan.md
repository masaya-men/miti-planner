# 住所登録なし「一時ツアー」 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development または superpowers:executing-plans でタスク単位に実行。
>
> spec = `docs/superpowers/specs/2026-07-10-housing-ephemeral-tour-design.md` (承認済み・本計画の正)。
> コード断片は 2026-07-10 時点の main を採取済み。行番号は目安。

**Goal:** SNS URL 貼付 / 住所テキストから保存しない一時の家を作り、登録済みの家と混在ツアーができる。

**Architecture:** 一時の家 = `MockListing` 完全互換オブジェクト (`id` が `ephemeral-` prefix)。専用 zustand store (persist なし = リロードで消える) に保持し、**ツアー解決の pool にだけ**合流させる (探す一覧は非汚染)。経路・地図・ショーケースは既存のまま動く (経路マスタは全住宅街×全番地で静的完備・確認済み)。

**Tech Stack:** React + zustand。新 API なし (og-fetch / tweet 系の既存ログイン不要エンドポイントを流用)。

## Global Constraints (全タスク共通)

- 会話・コメント・ドキュメントは日本語。**push 禁止**。`docs/TODO.md` 編集禁止。
- ブランチ: `feat/housing-ephemeral-tour`。タスク単位でコミット (`feat(housing): …` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`)。
- `.claude/rules/housing-design.md` を編集前に読む。装飾999pxピル/色付きalert箱禁止。既存 `--housing-*` トークン。
- 新規 UI 文言は「ハウジング」統一。ロケール JSON はブロック単位 textual 編集・**4言語 parity** (新キーは `housing.ephemeral.*`)。
- **推測で住所を埋めない** (曖昧なら空欄+手入力誘導)。新しい API エンドポイントを作らない。
- 検証: `npm run build` + `npx vitest run` (パイプしない) + `npx tsc -b --noEmit`。

## ⚠ 実行前提

- **3 ブランチ (登録改善/タグ刷新/小物UI) の main マージ後に着手** (RegisterPage が登録改善で全面改修されているため)。着手時に RegisterPage / TourTray の現状を読み直す。

## 主要な既存部品 (採取済み)

- `useHousingTourStore` (`src/store/useHousingTourStore.ts:1-42`): `listingIds` のみ保持・persist なし。`setListings`/`start`。
- pool 計算: `src/components/housing/pages/TourNavPage.tsx:50-59` — `mergeListingsForViewer(listings, myListings, uid, Date.now())` → `resolveTourSteps(listingIds, pool)`。空状態分岐 = `:140-148` (`listingIds.length === 0` → `TourEmptyState`)。
- `TourTray` (`src/components/housing/browse/TourTray.tsx:1-72`): 行解決は `useHousingListingsStore((s) => s.listings)` の `find` のみ (`:19-23`)。props = `{ listingIds, onChange, onStart }`。
- `MockListing` (`src/data/housing/mockListings.ts:13-71`): 必須 = `id/ownerUid/dc/server/region/area/ward/imageMode/tags/createdAt/lastConfirmedAt/addressKey`。
- `orderTourStopIds(ids, pool)` (`src/lib/housing/orderTourStops.ts:32-38`): **pool に無い id は末尾に元順で温存** (一時 id を pool 込みで渡せば正しく並ぶ)。
- `parseHousingFromText(text): HousingExtractResult` (`src/lib/housing/parseHousingFromText.ts`): `{dc?,server?,area?,ward?,plot?,size?,ambiguity[]}`。**現実装は roomNumber を返さない** → アパート部屋番号は常に手入力補完。
- `extractHousingAddressFromPage(page)` (`extractHousingAddressFromPage.ts:93-119`): OGP の title/description/text から最良候補を採点選択。
- `useOgpFetch()` (`src/lib/housing/useOgpFetch.ts`): `{ status, data: OgpData, errorCode, fetchOgp(url), cancel, reset }`。`OgpData = { image, images[], title, description, siteName, text }`。ログイン不要 (`/api/og-fetch` は認証なし・allowlist のみ)。
- ツイート/YouTube の URL 判別と取得は登録フォームの SnsUrlField 周辺に実装済み — **着手時に `src/components/housing/register/` の SnsUrlField (または相当) を読み、URL 種別ルーティングの関数を流用する** (fork しない。抽出できない構造ならヘルパーに切り出してから両者で使う)。
- ショーケース描画: `TourShowcasePanel.tsx:32-51` (title フォールバック = `formatHousingAddress` / description 空 = `'──'`)。
- FavoritesPage のツアー開始: `FavoritesPage.tsx:111-129` (`orderTourStopIds(trayIds, allListings)`)。
- RegisterPage の外部初期値: **props `mode`/`initialValues` のみ** (URL クエリ/router state 機構なし)。autosave 復元 = `RegisterPage.tsx:1011-1086` (`AUTOSAVE_KEY='housing-register-draft'`、空フィールドのみ適用方式)。
- 経路: `getPlotDirections(area, plot)` (`wardDirections.ts:1-17`) — 静的マスタ・変更不要。

---

## Task 1: 一時 listing の型・factory・検証 + 専用 store

**Files:**
- Create: `src/lib/housing/ephemeralListing.ts`
- Create: `src/store/useEphemeralListingsStore.ts`
- Test: `src/lib/housing/__tests__/ephemeralListing.test.ts`

**Interfaces (Produces):**

```ts
// ephemeralListing.ts
export const EPHEMERAL_ID_PREFIX = 'ephemeral-';
export const EPHEMERAL_POOL_LIMIT = 30;
export function isEphemeralListingId(id: string): boolean; // prefix 判定 (「一時」判定の唯一の根拠 = spec §3.1)

export interface EphemeralInput {
  area: HousingArea;
  ward: number;                       // 1-30
  buildingType: 'house' | 'apartment';
  plot?: number;                      // house: 1-60
  size?: HousingSize;                 // house 任意
  apartmentBuilding?: 1 | 2;          // apartment (未指定は 1)
  roomNumber?: number;                // apartment: 1-90
  title?: string;
  postUrl?: string;                   // SNS 経由のとき (登録リンク引き継ぎ用)
  ogImageUrl?: string;                // SNS 経由の代表画像
  sourceImageUrls?: string[];
  dc?: string; server?: string;       // パーサが取れたときだけ (並べ替えの安定用・表示には未使用)
}
export type EphemeralValidation = { ok: true } | { ok: false; error: 'invalid_area' | 'invalid_ward' | 'invalid_plot' | 'invalid_room' };
export function validateEphemeralInput(input: EphemeralInput): EphemeralValidation;
export function createEphemeralListing(input: EphemeralInput): MockListing;
```

**createEphemeralListing の実装要点:**
- `id = EPHEMERAL_ID_PREFIX + 連番` (モジュール内カウンタ + `Date.now()` で一意化)。
- `MockListing` 必須フィールドの中立値: `ownerUid: '__ephemeral__'` / `dc: input.dc ?? ''` / `server: input.server ?? ''` /
  `region`: `dcServerMap` から dc で解決できれば解決、できなければ既存 `Region` 型の値を 1 つ既定に (型を読んで決める) /
  `imageMode`: `ogImageUrl` があれば `'sns'`、なければ `'none'` / `tags: []` / `visibility: 'public'` /
  `createdAt = lastConfirmedAt = Date.now()` / `addressKey`: 既存 `buildAddressKey` を grep して流用 (export されていなければ同等文字列をローカル生成し出典コメント)。
- apartment のとき `roomKind` 相当は MockListing に無い (`buildingType`+`apartmentBuilding`+`roomNumber` で足りる — TourShowcasePanel/resolveWardMapRef の読み方に一致)。

**store:**

```ts
// useEphemeralListingsStore.ts — persist なし (リロードで消える = spec §2-4)
interface EphemeralListingsState {
  ephemeralListings: MockListing[];
  add: (l: MockListing) => boolean;   // EPHEMERAL_POOL_LIMIT 超過時は false
  remove: (id: string) => void;
  clear: () => void;
}
```

- [ ] **Step 1: テスト** — ①validate 境界 (ward 0/31, plot 0/61, room 0/91, area 不正) ②factory が MockListing 必須フィールドを全て埋める (TS 型で担保 + ownerUid/id prefix の値検査) ③store: add 30 件目 OK・31 件目 false ④id 一意性 → FAIL → 実装 → PASS
- [ ] **Step 2: コミット** `feat(housing): 一時listingのfactory/検証/専用store`

---

## Task 2: ツアー解決 pool への合流 (探す一覧は非汚染)

**Files:**
- Create: `src/lib/housing/buildTourPool.ts` (+ Test: `src/lib/housing/__tests__/buildTourPool.test.ts`)
- Modify: `src/components/housing/pages/TourNavPage.tsx:50-59` (pool 計算を buildTourPool へ)
- Modify: `src/components/housing/browse/TourTray.tsx:19-23` (行解決に一時プールを追加)
- Modify: `src/components/housing/pages/BrowsePage.tsx:66-73` (`orderTourStopIds(trayIds, merged)` → pool 込み)
- Modify: `src/components/housing/pages/FavoritesPage.tsx:111-129` (同上)

**Interfaces (Produces):**

```ts
// buildTourPool.ts — mergeListingsForViewer の結果 + 一時プール。id 重複は既存優先。
export function buildTourPool(
  publicListings: MockListing[], myListings: MockListing[],
  viewerUid: string | null, ephemeral: MockListing[], nowMs: number,
): MockListing[];
```

**要点:**
- TourNavPage: `const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);` を購読し `buildTourPool(...)` に差し替え (依存配列に ephemeral 追加)。
- TourTray: `items = listingIds.map((id) => listings.find(...) ?? ephemeral.find(...)).filter(Boolean)` に変更。**それ以外の既存挙動 (myListings 非考慮など) は変えない** (スコープ厳守)。
- BrowsePage / FavoritesPage: `orderTourStopIds(trayIds, [...merged, ...ephemeral])` 形 (`allListings` 側も同様)。
- **探す一覧の `merged` (BrowsePage:41-49) には触らない** — 一時プールが一覧グリッドに出ないことがこのタスクの受け入れ条件。

- [ ] **Step 1: buildTourPool のテスト** (①混在 pool で ephemeral id が解決される ②同 id は既存優先 ③resolveTourSteps に通すと登録済み+一時の両方が step になる) → FAIL → 実装 → PASS
- [ ] **Step 2: 各画面の配線 + 既存テスト全緑確認**
- [ ] **Step 3: コミット** `feat(housing): 一時listingをツアー解決poolに合流 (一覧は非汚染)`

---

## Task 3: 追加パネル (「+ 住所から追加」)

**Files:**
- Create: `src/components/housing/browse/EphemeralAddPanel.tsx`
- Modify: `src/components/housing/browse/TourTray.tsx` (ヘッダ付近に「+ 住所から追加」ボタン → パネル開閉。browse/favorites の両トレイに自動で効く)
- Modify: `src/components/housing/tour/TourEmptyState.tsx` + `pages/TourNavPage.tsx:140-148` (空状態にも同じ入口: パネル + パネル内で積んだ一時の家の簡易リスト + [この内容でツアーを開始] — 開始は `orderTourStopIds` → `setListings` → `start` の既存形)
- Modify: ロケール 4言語 / `src/styles/housing.css`
- Test: `src/__tests__/housing/EphemeralAddPanel.test.tsx`

**Props:** `{ open: boolean; onClose: () => void; onAdd: (id: string) => void }` (トレイでは `onAdd` = trayIds へ push。ツアー空状態では呼び出し側ローカル state に積む)

**パネル仕様 (spec §4.1):**
1. 上段 URL 欄: 入力確定で URL 種別ルーティング (登録フォームの既存判別を流用) → OGP は `useOgpFetch` → `extractHousingAddressFromPage({ title, description, bodyText: text })`、ツイートは既存ツイート取得 → 本文を `parseHousingFromText`。画像は `OgpData.image`/`images[0]` またはツイート画像を `ogImageUrl` に。
2. 下段 テキスト欄: 入力のたび `parseHousingFromText` (debounce 300ms 程度)。
3. 解釈結果チップ: 住宅街 / 区 / 番地 or アパート (`size==='Apartment'` でアパート判定)。**欠けている項目だけ**選択肢 (住宅街5択 / 区1-30 / 番地1-60 / アパート切替+号棟+部屋1-90) を表示。
4. `ambiguity.length > 0` または何も取れない → `housing.ephemeral.parse_error` を表示して手入力へ誘導 (推測で埋めない)。
5. 全項目充足で [ツアーに追加] 活性 → `validateEphemeralInput` → `createEphemeralListing` → `store.add` (false = 上限 → `limit_note` 表示) → `onAdd(id)` → 入力だけクリアしてパネルは開いたまま (連続追加)。
6. 常時注記 1 行: `housing.ephemeral.note_volatile` (ja: 「一時の家は保存されません (ページを離れると消えます)」)。

**i18n (ja 実値。en/ko/zh は同構造で自然な訳):**

```json
"ephemeral": {
    "add_button": "住所から追加",
    "panel_title": "住所からツアーに追加",
    "url_label": "SNSのURLから",
    "url_placeholder": "X / housingsnap などのURLを貼り付け",
    "text_label": "住所を入力",
    "text_placeholder": "例: ミスト 3区 15番地",
    "parse_error": "住所を読み取れませんでした。下の欄で選択してください",
    "fetch_error": "URLから情報を取得できませんでした",
    "add": "ツアーに追加",
    "added": "追加しました",
    "note_volatile": "一時の家は保存されません (ページを離れると消えます)",
    "limit_note": "一時の家は最大 {{max}} 件までです",
    "badge": "一時",
    "register_link": "この家を登録する",
    "empty_start": "この内容でツアーを開始"
}
```

- [ ] **Step 1: テスト** — ①テキスト「ミスト 3区 15番地」→ チップ3つ+追加活性 ②「3区 15番地」(住宅街欠け) → 住宅街セレクトが出る・追加不活性 ③ambiguity テキスト → parse_error ④追加で onAdd が ephemeral- id で呼ばれ store に入る ⑤上限で limit_note → FAIL → 実装 → PASS
- [ ] **Step 2: トレイ/空状態への配線 (空状態は簡易リスト+開始ボタン込み) + 4言語 + CSS**
- [ ] **Step 3: `npm run build` + `npx vitest run` → コミット** `feat(housing): 住所から一時の家を追加するパネル (トレイ/ツアー空状態)`

---

## Task 4: 「一時」バッジ・詳細遷移の抑止・画像なし表示

**Files:**
- Modify: `src/components/housing/browse/TourTray.tsx` (行に `isEphemeralListingId(l.id)` で `housing.ephemeral.badge` の小さな `span`)
- Modify: `src/components/housing/tour/TourShowcasePanel.tsx:32-51` (タイトル横に同バッジ)
- Modify: ツアー系コンポーネントで listing 詳細 (`/housing/listing/:id`) へ遷移するリンク/ボタンを grep し、一時 id では**出さない** (`isEphemeralListingId` ガード。該当が無ければ「無かった」ことをコミットメッセージに記録)
- Modify: `src/styles/housing.css` (バッジ = `badge_private` 系の既存質感に合わせる)
- Test: `src/__tests__/housing/ephemeralTourDisplay.test.tsx`

- 画像なし (`imageMode:'none'`) は `representativeImage` が PLACEHOLDER を返す既存挙動で足りる — 変更しない。確認のみ。

- [ ] **Step 1: テスト** (トレイ行とショーケースにバッジ / 登録済みには出ない) → FAIL → 実装 → PASS
- [ ] **Step 2: コミット** `feat(housing): 一時の家のバッジ表示と詳細遷移の抑止`

---

## Task 5: 「この家を登録する」 (登録フォームへの一回限り受け渡し)

**Files:**
- Create: `src/lib/housing/registerPrefill.ts` (+ Test: `src/lib/housing/__tests__/registerPrefill.test.ts`)
- Modify: `src/components/housing/tour/TourShowcasePanel.tsx` (一時の家にのみ `housing.ephemeral.register_link` の控えめなテキストリンク → `saveRegisterPrefill(...)` → `navigate('/housing/register')`)
- Modify: `src/components/housing/pages/RegisterPage.tsx` (create モードのマウント時に prefill を消費)

**Interfaces (Produces):**

```ts
// registerPrefill.ts — sessionStorage の一回限り受け渡し (spec §4.3)
const KEY = 'housing-register-prefill';
export interface RegisterPrefill {
  area?: HousingArea; ward?: number; buildingType?: 'house' | 'apartment';
  plot?: number; size?: HousingSize; apartmentBuilding?: 1 | 2; roomNumber?: number;
  postUrl?: string;
}
export function saveRegisterPrefill(p: RegisterPrefill): void;
export function consumeRegisterPrefill(): RegisterPrefill | null; // 読んだら即削除。parse 失敗は null
```

**RegisterPage 側の適用規則:**
- `mode === 'create'` のみ。autosave 復元 effect (`RegisterPage.tsx:1011-1086`) の**後**に適用し、
  **空フィールドのみ**埋める (既存の「ユーザー入力を上書きしない」方針と同一。`fieldState.setAutoFilled` を通す)。
- `postUrl` は復元と同じ `setRestoredSnsUrl` 経路で SNS 再取得に乗せる (画像がフォームに入る)。
- 適用したら通知行 (既存 `setRestoredNoticeVisible` 相当) は出さなくてよい (ユーザーが直前に自分で押した遷移のため)。

- [ ] **Step 1: registerPrefill のテスト** (save→consume で取れる・2回目は null・壊れた JSON は null) → FAIL → 実装 → PASS
- [ ] **Step 2: ショーケースのリンク + RegisterPage 消費 (既存 `RegisterPage.test.tsx` の形に倣ってテスト1本追加: prefill があると住所が入っている)**
- [ ] **Step 3: コミット** `feat(housing): 一時の家→登録フォームへの一回限りプリフィル`

---

## Task 6: 全体検証

- [ ] `npm run build` / `npx vitest run` 全緑 / `npx tsc -b --noEmit`
- [ ] 4言語 `housing.ephemeral` ブロックのキー集合一致 (機械比較)
- [ ] `git diff --stat main -- src/lib/housing/wardDirections.ts src/lib/housing/buildTourMapPlacements.ts` が空 (経路側無変更の確認)
- [ ] 変更ファイル・コミット一覧 + 実機チェックリストを最終報告に列挙

**実機確認チェックリスト (ユーザー向け):**
1. 探すトレイ「+ 住所から追加」→「ミスト 3区 15番地」→ チップ確認 → 追加 → 登録済みの家と混ぜてツアー開始
2. ツアーで一時の家に道案内・地図が出る (登録済みと同品質)
3. SNS URL 貼付 → 画像つきの一時の家になる
4. 「一時」バッジ表示・詳細に飛ばない・リロードで消える
5. ショーケース「この家を登録する」→ 登録フォームに住所と URL が入っている
6. ツアータブ空状態からも追加→開始できる

## 受け入れ基準

- 一時の家が探すの一覧グリッドに**一度も現れない** (pool 分離)
- 混在ツアーで並べ替え (`orderTourStopIds`)・進行・完了が登録済みのみと同じに動く
- 曖昧住所で推測して追加されるケースがない (必ず手入力補完を経る)

## やらないこと (spec §8)

一時ツアーの保存・共有URL化 / 一時の家のお気に入り / 一時の家の編集 / OCR / 新規 API
