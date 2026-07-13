# タグ体系刷新 実装計画 (公式23 + 季節12 + テーマ12 + 個人タグ)

> 2026-07-10 全体相談で設計確定済み。Phase A (棚卸し・静的) と Phase B (個人タグ・サーバー込み) に分割。
> A は安価モデルで完結可能。B は API/Firestore/管理画面を含む中規模。
> 共通ルール: i18n 4 言語 parity / ロケール JSON はブロック単位 textual 編集 /
> ハウジング配下の新規 UI 文言は「ハウジング」統一 (「物件」禁止)。

## 確定済み設計判断 (変更不可)

1. 3+1 カテゴリ構成: **公式 (ゲーム内ハウスアピール 23種)** / **季節 12種** / **テーマ 12種** / **個人タグ**。
   現行 `src/data/housingTags.ts` の 6 カテゴリ約 147 タグは引退。
2. 公式タグの表記は**ゲーム内の正式名そのまま** (意訳・「◯◯系」化の禁止)。
   **ja/ko/zh の正式名は必ず公式ソースから照合。確認できない言語は勝手に訳を作らず、
   未確認として残して報告する** (住所 alias 誤爆と同じ轍を踏まない)。
3. 季節タブは**現実世界の文言** (FF14 イベント名にしない)。
4. **個人タグはリリース初期から必須**。1 ユーザー 1 個。将来「タグを増やしたい」要望に備え、
   **タグ種別 (kind) を増設できるレジストリ構造**にする。種別のハードコード分岐禁止・
   1 人 1 個制約も設定値 (定数) 化。
5. 既存 listing の旧タグ: 全て本人テストデータのため、読み時フィルタ + 一括クリーンアップで良い。

## 確定タグリスト

- **公式 23** (EN 正: https://ffxiv.consolegameswiki.com/wiki/Estate_Tags):
  Emporium / Boutique / Designer Home / Message Book / Tavern / Eatery / Visitors Welcome /
  Under Renovation / Immersive Experience / Aquarium / Sanctum / Café / Florist / Library /
  Atelier / Bathhouse / Garden / Bakery / Concert Hall / Venue / Photo Studio / Haunted House /
  Far Eastern
- **季節 12** (既存 id を再利用 = 4 言語訳が既に存在):
  spring / summer / autumn / winter / new_year / valentine / hinamatsuri / easter / tanabata /
  summer_festival / halloween / christmas
  (削除: cherry_blossom, autumn_leaves, snow, beach, starlight, guardian_day, matsuri, illumination)
- **テーマ 12** (botanical のみ新規、他は既存 id 再利用):
  wafu / wamodern / modern / natural / antique / gothic / marchen / cyberpunk / fantasy /
  gimmick / ruins / botanical
  ※ gimmick の ja 表示は「ギミックハウス」へ変更 (4 言語とも意味を揃える)。botanical は 4 言語新規。

---

## Phase A: 静的タグの棚卸し (安価モデル可)

### A-1. レジストリ構造化
- `src/data/housingTags.ts` を改修:
  - `HousingTagCategory` → `HousingTagKind` (`'official' | 'season' | 'theme' | 'personal'`)。
    **kind の一覧・表示順・タブ構成はレジストリ (データ) から導出**し、コンポーネント側で
    kind 名の switch 分岐を書かない。
  - `PERSONAL_TAG_LIMIT_PER_USER = 1` を定数としてここ (または constants/housing.ts) に置く。
  - 公式タグ id は `official_` prefix (例 `official_cafe`)。既存 id 再利用分 (季節/テーマ) は
    id そのまま (Firestore 上のテストデータとの互換確認が不要になるが、どのみち一掃するので
    prefix 統一したければ `season_` / `theme_` を付けても良い。**決め: prefix 統一する**。
    旧 id はすべて無効化されるため混在リスクなし)。
- 参照元の追従 (grep 済みの全箇所):
  - `src/utils/housingValidation.ts` (validateTags)
  - `src/components/housing/register/HousingRegisterTagPicker.tsx` (タブをレジストリ駆動に)
  - `src/components/housing/workspace/FilterPanel.tsx` (探すのタグフィルタ)
  - `src/components/housing/register/RegisterDuplicatePanel.tsx`
  - `src/components/housing/HousingDuplicateWarningDialog.tsx`
  - `src/__tests__/housing/housingTags.test.ts`
- 未知の旧タグ id を表示側で踏んでもクラッシュしない (getTagById undefined フォールバック確認)。

### A-2. 公式 23 種の 4 言語照合 (捏造禁止)
- EN: 上記 wiki 一覧で確定済み。
- JA: Lodestone パッチノート (「ハウスアピール」で patch notes 検索) またはゲーム内 UI。
  ユーザーがゲーム内で目視確認できるので、**一覧表を作って提示 → ユーザー確認**を必ず挟む。
- KO/ZH: 各リージョン公式サイトのパッチノート/告知から。中韓公式 URL の当たりは
  memory `reference_ff14_jobguide_urls` の公式サイトドメインを起点に探す。
- **どうしても確認できない言語はその言語だけ空けて報告** (英語表記のまま仮置き + TODO 記録)。
- ロケール追加は `housing.tag.official_*` キーで 4 ファイルに同ブロックを追加。

### A-3. ロケールの整理
- 削除対象: 引退する約 115 タグ分の `housing.tag.*` キー (4 言語)。
  ブロック単位の textual 編集で、残すキー (季節 12 + テーマ 11) を誤って消さないこと。
- 追加: `official_*` 23 × 4 言語 / `botanical` × 4 言語 / gimmick の ja 改訳。
- タブ見出しキー (公式/季節/テーマ/個人) を新設。

### A-4. 旧タグの一掃
- サーバー側 validation (`api/housing/_registerListingHandler.ts` / `_updateListingHandler.ts` が
  タグ検証をしているか grep で確認 → していればレジストリと同じ許可リストに追従) 。
- 既存 listing のタグ: 管理画面またはワンショットスクリプトで旧 id を除去
  (テストデータのみなので破壊 OK。ただし対象は housing コレクションだけ。軽減表には絶対触れない)。

### A-5. テスト・検証
- housingTags.test.ts: 総数 (23+12+12) / prefix 規約 / 重複なし / i18n キー存在 (4 言語 parity)。
- `npm run build` + `vitest run`。TagPicker/FilterPanel を en 表示で崩れ確認 (長い英語名: Immersive Experience 等)。

---

## Phase B: 個人タグ (サーバー + moderation 込み・中規模)

> 設計原本: `docs/.private/2026-05-27-tag-system-redesign.md` (スキーマ案・モデ方針は合意済み)。

### B-1. データ
- 新コレクション `personal_tags/{tagId}`:
  `{ id: 'personal_<slug>', displayName, ownerUid(hash 化 ID 方針に追従), createdAt, reportCount, isHidden }`
- 複合クエリを張る場合は `firestore.indexes.json` 登録を忘れない (漏れると本番 onSnapshot 沈黙)。

### B-2. API (`api/housing/` 配下・既存ハンドラ分割パターンに従う)
- 作成: ログイン必須・**1 ユーザー 1 個** (PERSONAL_TAG_LIMIT_PER_USER をサーバー側で強制)。
- listing への付与: 自分のタグのみ自分のハウジングに付けられる。
- 検証: タグ配列に personal_ id が来たら `personal_tags` 存在 + `isHidden=false` を確認。
- クライアントは `buildHousingHeaders` 必須 (生 fetch は本番 403)。

### B-3. UI
- TagPicker に「個人」タブ: 自分のタグ作成 (未作成時) / 検索オートコンプリート (他人のタグでフィルタ用途)。
- 探す側: 個人タグでフィルタ/検索できる (「@名前 の家だけのツアー」の入口)。
- 4 言語。装飾ピル/色付き箱の禁止 (housing-design.md)。

### B-4. モデレーション
- `/admin` に personal_tags の通報一覧・非表示/復帰 (housing-reports の案 B パターン流用)。
  運営作業は必ず /admin 完結 (Firestore 直叩き禁止)。
- NG ワード自動チェックは MVP に入れない (合意済み)。

### B-5. テスト・検証
- 1 人 1 個の境界 (2 個目作成 → 拒否) / isHidden タグ付与拒否 / 他人のタグは付与不可・検索は可。
- エンドユーザー視点で実機 1 周 (作成 → 付与 → 探すでフィルタ → 通報 → /admin 非表示 → 表示から消える)。

## 受け入れ基準

- タグ総数 47 + 個人。旧 147 の残骸がピッカー/フィルタ/既存カードのどこにも出ない。
- 公式 23 の 4 言語が公式ソース照合済み (未確認言語はゼロ、またはユーザー了承の仮置きリスト付き)。
- kind 増設が「レジストリに 1 エントリ足す + ロケール追加」だけでタブに現れる構造になっている。

## やらないこと

- 自由テキストタグ (将来要望が来たら kind 追加で対応できる骨格だけ用意)
- NG ワード自動チェック / Reporter scoring (通報モデロードマップ側)
