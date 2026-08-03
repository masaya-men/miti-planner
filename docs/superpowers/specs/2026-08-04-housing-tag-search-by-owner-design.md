# ハウジング タグ検索: 個人タグ廃止 → 登録者(ownerUid)ベースの名前検索へ 設計書

2026-08-04 ブレスト確定。関連: `docs/.private/2026-07-24-tag-and-search-and-traditional-chinese-scoping.md`、`docs/superpowers/specs/2026-07-27-housing-tag-and-search-design.md`(初出のタグ検索UI設計・本設計はその一部を置き換える)。

## 1. 背景・問題

探すページの「ハウジンガー」タグ検索は、選んだ人の物件が実際にはヒットしないことが多い。

調査の結果、実態は以下の通り:

- `housing_profiles/{uid}`(マイページ公開情報)を公開すると、`api/housing/_upsertHousingerProfileHandler.ts` が同一トランザクションで `personal_tags/{tagId}` を自動的に作成・同期している(タグ刷新 Phase B 統合契約1、2026-07-10 以降)。そのため「ハウジンガー」チップ一覧(`HousingerTagSection.tsx` が `listAllPersonalTags()` で取得)には、利用者が能動的にタグを作らなくても、マイページを公開している人はほぼ全員名前が並ぶ。
- 一方、**検索のヒット判定 (`applyFilters.ts`) は `listing.tags` 配列にそのタグ ID が含まれているかだけを見ている**。この配列への追加は、物件の登録・編集画面で「個人」タブを開いて手動でチェックを入れる操作(`HousingRegisterTagPicker.tsx`)でしか行われない。
- 結果: 一覧には名前が出るのに、その人を選んでも「タグを付け忘れた/付けていない物件」はヒットしない、という体感になっていた。
- なお物件詳細ページの「投稿者: ○○ のハウジング」表示(`HousingerByline.tsx`)は `listing.ownerUid → housing_profiles` の解決のみで動いており、個人タグの有無に一切関係なく常に表示される。**「誰の物件か」という情報自体は、タグの有無と関係なくもとから常時公開されている**。

## 2. 決定した方針

タグに頼るのをやめ、「本人が登録した物件かどうか (`listing.ownerUid`)」だけで判定する。これにより:

- マイページを公開している人を選べば、その人が登録した物件が(タグの有無に関係なく)**もれなく**ヒットする。
- 物件登録・編集画面の「個人タグを付ける」操作自体が不要になるため撤去する。
- 物件詳細ページのタグ欄に出ていた名前チップも撤去する(投稿者欄 = `HousingerByline` に一本化。同じ人の名前が2箇所に並ぶ重複を避ける)。
- 「個人タグ (`personal_tags`)」という裏側の概念そのものを廃止する。表示に使っていた情報は、既存の `housing_profiles`(マイページ公開情報)だけで完結させる。
- 既存の `personal_tags` ドキュメント、および過去に物件へ手動で付けられた `personal_` prefix のタグ ID(`listing.tags` 内)は、移行作業で削除する。

### 非ゴール

- 物件ごとに「投稿者名を出す/出さない」を選べるようにする機能は作らない(現状もそのような機能はなく、要望も無い)。
- 完全非公開 (`visibility==='private'`) の物件を検索結果に出すことは一切しない。この防御は本設計より手前の層(`mergeListingsForViewer`/`isEffectivelyPublic`。他人の `private`/期限切れ物件は探すページ用の一覧に読み込まれる前に除外される)で完結しており、本設計は一切変更しない。

## 3. 新しいデータフロー

### 3.1 ハウジンガー一覧(探すページ「ハウジンガー」チップ)

- 取得元を `personal_tags` コレクションから `housing_profiles` コレクションへ変更する。
- クエリ: `where('isPublished','==',true).where('isModerationHidden','==',false).orderBy('displayNameLower')`
  - `housing_profiles` に `displayNameLower` フィールドが現状無いため、`_upsertHousingerProfileHandler.ts` の書き込み時に追加する(`normalizeDisplayNameForSearch(displayName)`、`personal_tags` で既にやっていたのと同じ正規化関数を再利用)。
  - Firestore 複合インデックスを追加: `housing_profiles` = `isPublished ASC, isModerationHidden ASC, displayNameLower ASC`(`firestore.indexes.json`)。
  - firestore.rules の `housing_profiles` は既に `allow get, list: if (isPublished==true && isModerationHidden==false) || isOwner(uid)` になっており、変更不要(このクエリ形はルールを満たす)。
- 各ドキュメントの ID (= uid) から、フィルター用の擬似タグ ID `personal_<uidの hashed: を除いた値>` を組み立てる(既存の `personalTagIdForUid()` をそのまま流用。関数名・prefix 文字列は変更しない = URL 共有やフィルター状態の互換性を保つ)。
- チップの並び替え(記号除去ソート)は現行の `stripLeadingSymbolsForSort` をそのまま流用。

### 3.2 検索のヒット判定 (`applyFilters.ts`)

- 選択されたタグのうち `personal_` prefix のもの(＝ハウジンガー選択)は、`listing.tags.includes(id)` ではなく、**id から逆算した uid と `listing.ownerUid` が一致するか**で判定する。
  - 逆算: `'hashed:' + id.replace(/^personal_/, '')`(`personalTagIdForUid` の逆変換。新しいヘルパー `ownerUidFromPersonalFilterId()` を追加し、`applyFilters.ts` と `PersonalTagFilterLink.tsx` の両方から使う)。
  - 複数人選択時は OR(誰か1人の物件であればよい)。既存の「非ハウジンガー側タグ AND ハウジンガー側」の組み合わせロジックは変更しない。

### 3.3 「1人だけ選択中」のハウジンガーページ導線 (`PersonalTagFilterLink.tsx`)

- `getPersonalTagById(tagId)` の呼び出しをやめ、`ownerUidFromPersonalFilterId(tagId)` → 既存の `getHousingerProfile(uid)`(`housingerProfileService.ts`、公開プロフィールのみ返す・セッションキャッシュ済み)で displayName を取得する形に変更する。表示文言・リンク先は変更なし。

### 3.4 物件登録・編集画面 (`HousingRegisterTagPicker.tsx`)

- 「個人」タブを撤去する。タブ列は `HOUSING_TAG_KINDS`(`official/season/theme/beginner/personal`)から `personal` を除いた配列(`STATIC_HOUSING_TAG_KINDS` を利用)に切り替える。
- `usePersonalTag` フックの呼び出し、`selectedPersonalTag`/`myPersonalTag` 関連の分岐をすべて削除。`selectedCount` は静的タグの件数のみになる。
- `RegisterHousingerCta.tsx`(マイページ未公開時に公開を促す導線)は**維持**する。これは個人タグとは別の、マイページ公開自体を促す機能。

### 3.5 物件詳細ページ (`HousingDetailContent.tsx`)

- `resolvedTags` の計算から `isPersonalTagIdFormat` 分岐を削除し、静的タグ (`official/season/theme/beginner`) のみを解決する。
- 使われなくなる `useHousingerProfile(listing.ownerUid)` の呼び出し(`ownerProfile` 変数)をあわせて削除(`HousingerByline` は自前で同フックを呼んでいるため機能に影響なし)。

## 4. 廃止するもの(裏側の「個人タグ」概念そのもの)

### コンポーネント/フック
- `src/components/housing/register/usePersonalTag.ts` — 削除
- `src/components/housing/workspace/PersonalTagFilter.tsx` — 削除(どの画面にもマウントされていない孤児コンポーネント。設計書 2026-07-27 でも既知)
- `src/components/admin/AdminPersonalTags.tsx` — 削除
  - `AdminLayout.tsx` のナビ項目 `/admin/personal-tags` を削除
  - ルーティング定義(admin ルーター側、該当 route を検索して削除)

### API
- `api/housing/_myPersonalTagHandler.ts` / `_searchPersonalTagsHandler.ts` / `_reportPersonalTagHandler.ts` — 削除
- `api/housing/index.ts` の `my-personal-tag` / `search-personal-tags` / `report-personal-tag` ルーティングとエラーメッセージ内の一覧文言 — 削除
- `api/housing/_personalTagAttachGuard.ts` — 削除(personal_ タグを物件に付ける経路自体が無くなるため)
- `api/housing/_upsertHousingerProfileHandler.ts` — `personal_tags` への upsert ブロック(tx 内、`resolvePersonalTagId`/`tagsCol` 関連)を削除し、代わりに `displayNameLower` を `housing_profiles` 側に書き込むよう変更
- `api/admin/_personalTagsHandler.ts` — 削除
- `api/admin/index.ts` の `personal_tags` resource ルーティング — 削除
- `api/admin/_housingerReportsHandler.ts` — **削除ではなく修正**。`hide`/`restore` アクション内で `personal_tags` の `isHidden` を同期している処理(`tagsCol`/`resolvePersonalTagId` 呼び出し、tx 内 2箇所)を削除する。この API 自体(housing_profiles の強制非公開・復帰・個別通報却下)は現役の運営導線なので存続する。

### クライアントライブラリ
- `src/lib/personalTagApiClient.ts` — 削除(`getMyPersonalTag`/`searchPersonalTags`/`reportPersonalTag`)
- `src/lib/housing/personalTagLookup.ts` — 削除し、代わりに `housing_profiles` 向けの一覧取得関数(`listPublishedHousingers()`)を新規追加(§3.1)。`stripLeadingSymbolsForSort` はそちらへ移設。
- `src/data/personalTags.ts` — `buildPersonalTagId`(旧ランダムslug作成、現在使用箇所無し)、`canCreatePersonalTag`、`evaluatePersonalTagAttach`、関連 `PersonalTagAttachRejection`/`computePersonalTagReportOutcome` を削除。`normalizeDisplayNameForSearch` のみ `housing_profiles` 用に存続(置き場所は据え置きでよい)。

### 型・定数
- `src/types/housing.ts` — `PersonalTag`、`PersonalTagReport` インターフェースを削除
- `src/constants/housing.ts` — `PERSONAL_TAG_LIMIT_PER_USER` を削除。`PERSONAL_TAG_ID_PREFIX`(`'personal_'`)は `BrowsePage.tsx` の擬似フィルターID抽出で引き続き使うため**削除せず存続**、コメントを「タグ実体の prefix」→「ハウジンガー選択の擬似ID prefix」に更新する。
- `src/data/housingTags.ts` — `isPersonalTagIdFormat`/`PERSONAL_TAG_ID_PATTERN`/`isValidTagId` 内の personal 分岐は「ハウジンガー選択の擬似ID」判定として**そのまま存続**(名称は現状維持、意味だけ「タグ実体の判定」→「フィルター擬似IDの形式判定」に変わる。混乱を避けるためコメントを更新する)
- `src/lib/housing/housingerProfile.ts` — `personalTagIdForUid`/`resolvePersonalTagId` のうち `resolvePersonalTagId` は削除(personal_tags upsert が無くなるため不要)。`personalTagIdForUid` は擬似ID生成として存続、新規に逆変換 `ownerUidFromPersonalFilterId` を追加。

### firestore.rules / firestore.indexes.json
- `firestore.rules` の `match /personal_tags/{tagId}` ブロック(サブコレクション `reports` 含む)を削除
- `firestore.indexes.json` の `personal_tags` 用複合インデックスを削除、`housing_profiles` 用複合インデックスを追加(§3.1)

### i18n(ja/en/ko/zh/zh-Hant 全ロケール)
- `housing.register.personal_tag.*`(loading/not_published_hint/open_account_settings 等)
- `housing.register.tag_kind.personal`
- `admin.personal_tags.*` 一式
- (残す) `housing.tagpicker.housinger_*`、`housing.housinger.viewPage`、`housing.housinger.byline` 等は変更なし

### テスト
- 削除: `personalTagLookup.test.ts`、`__tests__/housing/personalTags.test.ts`、`PersonalTagFilter.test.tsx`、admin 側 personal_tags ハンドラのテスト
- 更新: `PersonalTagFilterLink.test.tsx`(データ取得元の差し替えに追従)、`applyFilters` のテスト(ownerUid ベース判定に追従)、`HousingRegisterTagPicker` 関連テスト(個人タブ撤去に追従)、`HousingDetailContent.test.tsx`(タグ欄から名前が消えることの確認)、`housingerProfileTypes.test.ts`/`housingerProfileService.test.ts` の `PersonalTag` 型参照除去、`housingerProfile.test.ts` の `resolvePersonalTagId` テスト削除、`api/admin/__tests__/housingerReportsHandler.test.ts` の hide/restore 時の personal_tags 同期アサーション削除
- 新規: `listPublishedHousingers()` のテスト、`ownerUidFromPersonalFilterId()` の往復変換テスト、`applyFilters` の「タグを付けていない物件でも ownerUid が一致すればヒットする」回帰テスト(今回の core fix)

## 5. データ移行(既存データのクリーンアップ)

ユーザー承認済み: 過去に作られたデータは削除する。ワンショットのスクリプト(`scripts/` 配下、`seed-*.ts` と同様の実行方式)で以下を行う:

1. `personal_tags` コレクションの全ドキュメントを削除(サブコレクション `reports` も含む)
2. `housing_listings` の `tags` 配列から `personal_` prefix の要素を取り除く(該当が無い物件は無変更)
3. 実行前に対象件数をログ出力し、本番実行は改めてユーザーに確認してから

## 6. 実装順序の目安(plan 化の材料)

1. `applyFilters.ts` の判定変更 + ownerUid 逆算ヘルパー + テスト(検索が直る core fix。ここだけ先に本番投入も理論上可能)
2. `housing_profiles` に `displayNameLower` 追加(サーバー側書き込み) + Firestore index 追加
3. `HousingerTagSection.tsx` のデータ取得元切り替え(`listPublishedHousingers()`)
4. `PersonalTagFilterLink.tsx` の解決ロジック切り替え
5. `HousingRegisterTagPicker.tsx` / `HousingDetailContent.tsx` の UI 撤去
6. API・admin・型・i18n の削除一式
7. データ移行スクリプト作成・実行
8. firestore.rules / firestore.indexes.json 反映・デプロイ

## 7. 検証方法

- vitest: 上記の新規/更新テストがすべて green
- 実機: マイページを公開しているが物件にタグを付けていないテストアカウントで、探すページ「ハウジンガー」から自分の名前を選び、登録した物件(住所非公開のものも含む)がすべて出ること/完全非公開の物件は出ないことを確認
- 実機: 物件詳細ページでタグ欄の名前チップが消え、投稿者欄のみになっていることを確認
- 実機: `/admin/personal-tags` への直リンクが 404 になる(ルート削除確認)
