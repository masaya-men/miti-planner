# ハウジング 個室・アパート 対応 (Phase 1 拡張) 設計書

> 作成日: 2026-05-18 / 重要訂正: 2026-05-19
> ステータス: 訂正版 (前版の誤りを修正、 ユーザー承認済み 2026-05-19)
> 親仕様: [`docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md`](./2026-05-07-housing-tour-phase1-design.md)
> 議論メモ (gitignore): `docs/.private/2026-05-17-housing-room-types-design.md`

---

## 1. 目的

Phase 1 設計書 §4.2 の `HousingListing` スキーマには、 FF14 の **個室 (FC ハウス内のプライベートチャンバー)** および **アパルトメント (1 棟複数部屋)** を正しく扱う構造が欠落していた。 本 spec で対応案を確定する。

加えて、 通報フローの UI 分離 (「ちがった」 / 「報告」) と、 家主からの異議申し立て導線も本 spec で確定する。

---

## ⚠ 2026-05-19 重要訂正 (前版からの差分)

前版 (2026-05-18 確定) には **公式仕様調査の誤り** が含まれていた。 web 再調査の結果、 以下を訂正:

| 項目 | 前版 (誤) | 訂正版 (正) | エビデンス |
|---|---|---|---|
| **plot 番号体系** | 本街/拡張街 別々に 1-30 (subdivision で区別) | **通し番号 1-60** (1-30 本街、 31-60 拡張街) | [FFXIV Wiki](https://ffxiv.consolegameswiki.com/wiki/Player_Housing) "plots one through 30 and plots 31 through 60" / [Lodestone 拡張街](https://na.finalfantasyxiv.com/lodestone/topics/detail/ffe05674f919dad5f4f13d443f2fd7067a3dc2b0) |
| **subdivision フィールド** | `subdivision: 'main' \| 'sub'` 必須 | **不要** (plot 番号で判別可能) | 同上 |
| **ownerType フィールド** | `ownerType: 'personal' \| 'fc'` (個人宅/FC 区別) | **不要** (ユーザー目線で区別の意味なし、 schema からも削除) | 2026-05-19 ユーザー判断 (個室は FC ハウス由来なのは公式仕様で自明、 schema 不要) |

前版 schema は実装済み (13 commit push 済み) だが、 本番データなし (placeholder 段階) のためマイグレーション不要。 **forward fix で全面置換**する。

---

## 2. 公式仕様調査結果 (2026-05-19 再調査確定)

### 2.1 エリア構造

5 つのハウジングエリア:

- ミスト・ヴィレッジ
- ラベンダーベッド
- ゴブレットビュート
- シロガネ
- エンピレアム

すべて **第 1〜30 区** (30 ワード) の同一構造。 旧議論メモで仮定していた「Empyreum wing 構造」 は **誤り**、 wing 概念は公式仕様に存在しない (エンピレアムは ward 数自体が他エリアと異なる別構造があるが、 本 spec の対象外)。

### 2.2 ワード構造 (訂正)

- 各ワード = **plot 1-60 の通し番号** で合計 60 区画
  - **plot 1-30**: 本街
  - **plot 31-60**: 拡張街 (サブディビジョン)
- 区画属性 (FC 専用 / 個人専用 / 両方) は区画単位で決定
- **本街/拡張街の判別は plot 番号のみで可能** (別フィールドは不要)

### 2.3 住居タイプ (公式仕様)

| 種別 | サイズ | 個室機能 | 数 |
|---|---|---|---|
| **個人宅** | S / M / L | **不可** | ワードに複数 |
| **FC ハウス** | S / M / L | **可 (1-512 部屋)** | ワードに複数 |
| **アパルトメント** | 固定 (1 部屋単位) | 個室と同等機能 | 各ワードに 1 棟 (最大 90 部屋/棟、 50,000 ギル) |

### 2.4 個室・アパ部屋の所有

- **1 アカウント 1 部屋** (FC 個室 / アパート部屋ともに)
- 個室は **個人名義** (= 親 FC ハウスは FC 名義だが、 個室そのものは所属メンバー個人名義)
- 個人宅は個室を持てない (= **FC ハウスのみ個室可** / 公式仕様、 schema には記録しないが「個室登録あり = 親家は FC ハウス」 と推定可能)

---

## 3. スキーマ改訂 (訂正版)

### 3.1 確定版 HousingListing (訂正)

```ts
interface HousingListing {
  id: string;
  ownerUid: string;

  // 物理ワールド
  dc: string;
  server: string;

  // エリア + ワード
  area: 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
  ward: number;                          // 1-30

  // 建物タイプ
  buildingType: 'house' | 'apartment';

  // === house の場合 ===
  plot?: number;                          // 1-60 (通し番号、 31以上は拡張街、 house 必須)
  size?: 'S' | 'M' | 'L';                 // (house 必須)

  // === 部屋区分 ===
  // - undefined: 家全体 (個人宅 or FC ハウス、 schema 上区別なし)
  // - 'private_chamber': FC 個室 (親 plot 必須、 roomNumber 1-512、 size は親 plot のサイズを継承入力)
  // - 'apartment_room': アパート部屋 (roomNumber 1-90)
  roomKind?: 'private_chamber' | 'apartment_room';
  roomNumber?: number;

  // === 画像 / メタ (既存通り) ===
  imageMode: 'sns' | 'thumbnail' | 'none';
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;
  tags: string[];
  description?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  isHidden: boolean;
  reportCount: number;

  // 同住所検索用 denormalized key (server 生成)
  addressKey: string;
}
```

**前版からの削除フィールド**: `subdivision` / `ownerType`

**親子関係の表現**: 個室・アパート部屋と親 plot の関係は **外部キーを持たず**、 `dc/server/area/ward/plot (または apartment)` の一致で **動的判定** する。 親 listing (家全体登録) が存在しなくても、 子 listing (個室・アパート部屋) は単独で登録可。

各 listing の `ownerUid` はその listing の所有者 (= 家主 / 個室借主 / アパ部屋住人) を指す。 個室の `ownerUid` と親 plot の `ownerUid` は通常異なる。

### 3.2 整合性制約 (Firestore Rules + validation) — 3 パターンに簡素化

以下の組合せのみ許可:

| # | パターン | buildingType | roomKind | plot | size | roomNumber |
|---|---|---|---|---|---|---|
| 1 | 家全体 | `house` | `undefined` | 1-60 必須 | S/M/L 必須 | — |
| 2 | FC 個室 | `house` | `private_chamber` | 1-60 必須 (親 plot) | S/M/L 必須 (親 plot 由来) | 1-512 |
| 3 | アパート部屋 | `apartment` | `apartment_room` | (使用不可) | (使用不可) | 1-90 |

→ 「個人宅に個室」 等の不正組合せは UI 側で個室選択時に「親 plot サイズを入力」 を強制することで自然に排除 (個人宅判定は schema 持たないが、 個室 = FC ハウス前提という公式仕様で実態と一致)。

### 3.3 重複判定 key (訂正)

```ts
function buildAddressKey(listing: AddressInput): string {
  const base = `${listing.dc}|${listing.server}|${listing.area}|W${listing.ward}`;

  if (listing.buildingType === 'house') {
    if (listing.roomKind === 'private_chamber') {
      return `${base}|H${listing.plot}|C${listing.roomNumber}`;
    }
    return `${base}|H${listing.plot}`;
  }

  if (listing.buildingType === 'apartment') {
    return `${base}|A${listing.roomNumber}`;
  }

  throw new Error('Invalid buildingType');
}
```

判定:

- **ハード重複** (key 完全一致): Phase 1 §6.5 通り。 警告 → 訂正 or 別件として登録
- **ソフト重複** (同 plot に別種登録あり、 例: 家全体 + 個室、 同アパートの別部屋): 警告**しない**。 登録完了時に in-app 通知のみ

---

## 4. UI 改訂

### 4.1 登録モーダル (5 種チップ統一)

**ハウジング独自トンマナ** (`docs/.private/housing-tour-mockup/index.html` 準拠、 ガラスパネル + ハニーゴールド) でモーダル化。

**最上部** に **SNS URL 入力欄** を配置 (任意、 将来的に OG 解析で住所自動推定する想定の準備)。

その下に **住居タイプ** を 5 種チップで選択 (フィルタ UI と完全統一):

```
┌──────────────────────────────────────────┐
│ SNS 投稿 URL (任意・自動入力に使えるかも)    │
│ [_________________________________]       │
├──────────────────────────────────────────┤
│ 住居タイプ                                 │
│ [ S ] [ M ] [ L ] [ 個室 ] [ アパート ]    │
└──────────────────────────────────────────┘
```

選択に応じて入力欄が動的変化:

| タイプ | DC | サーバー | エリア | ワード | 番地 | サイズ | 部屋番号 |
|---|---|---|---|---|---|---|---|
| **S / M / L** (家全体) | ✓ | ✓ | ✓ | ✓ | ✓ (1-60) | (チップで確定) | — |
| **個室** | ✓ | ✓ | ✓ | ✓ | ✓ (親 plot 1-60) | ✓ (親 plot のサイズ) | ✓ (1-512) |
| **アパート** | ✓ | ✓ | ✓ | ✓ | — | — | ✓ (1-90) |

**番地番号 1-60 の表示補助**: 入力欄の横に小さく「31 以上は拡張街」 と注記 (ユーザーが混乱しないように)。

**個室選択時の「親 plot のサイズ」 入力**: 「個室」 チップを選んだ後、 内部的に「親家全体のサイズ (S/M/L)」 を別 select で聞く。 表示は「サイズ (親家)」 のラベル。

### 4.2 物件詳細ページ

#### 家全体を見たとき

同 plot に紐づく FC 個室登録があれば一覧表示 (個室があれば親家は FC ハウスと推定可能、 ただし表示は「同じ家の他の登録」):

```
┌───────────────────────────────────────┐
│ シロガネ ワード3 番地12 (M)             │
│ オーナー: ボブ                          │
│ ─────────────────                   │
│ 🏠 この家の他の登録:                   │
│  └ 個室 #2  アリス (1 週前登録)        │
│  └ 個室 #5  キャロル (3 日前登録)       │
└───────────────────────────────────────┘
```

#### 個室を見たとき

親の家を表示:

```
┌───────────────────────────────────────┐
│ シロガネ ワード3 番地12 個室 #2 (M)     │
│ オーナー: アリス                        │
│ ─────────────────                   │
│ 🏠 この個室の親の家:                   │
│  └ ボブの家 (家全体)                   │
└───────────────────────────────────────┘
```

#### アパート部屋を見たとき

同アパートの他の部屋登録を表示:

```
┌───────────────────────────────────────┐
│ シロガネ ワード5 アパルトメント 部屋#42 │
│ オーナー: デイブ                        │
│ ─────────────────                   │
│ 🏢 同じアパートの他の部屋:              │
│  └ 部屋 #7  エマ (2 週前登録)          │
│  └ 部屋 #50 フランク (5 日前登録)       │
└───────────────────────────────────────┘
```

#### 関連登録の特定ロジック

外部キーを持たないため、 動的クエリで関連登録を取得する:

- **家全体ページ**: 同 `dc/server/area/ward/plot` で `roomKind='private_chamber'` の listing を検索
- **個室ページ**: 同 plot で `roomKind=undefined` の listing を検索 (= 親家全体登録)。 **存在しなければ「親の家はまだ登録されていません」 と表示**
- **アパ部屋ページ**: 同 `dc/server/area/ward` で `buildingType='apartment'`, `roomKind='apartment_room'` かつ `roomNumber` 違いの listing を検索

### 4.3 ギャラリーカードのバッジ

- 家全体カード: 親 plot に個室 N 件あれば 「個室 +N」 バッジ
- 個室カード: 「○○ハウス内」 と親 plot 名表示
- アパート部屋カード: 「アパート部屋 #N」 表示

### 4.4 ギャラリーフィルタ (登録 UI と完全統一)

左パネル「住居タイプ」 セクションのチップを **5 種統合** (2026-05-19 ユーザー確定):

- **サイズ + 部屋タイプ**: `[S]` `[M]` `[L]` `[個室]` `[アパート]`
  - `S` / `M` / `L`: `buildingType='house'` かつ `size='X'` かつ `roomKind=undefined` (= 家全体)
  - `個室`: `roomKind='private_chamber'` (親 plot のサイズに関係なく一覧)
  - `アパート`: `buildingType='apartment'`
- (既存): タグ / DC / サーバー / エリア

**設計判断**:
- 個人宅 vs FC ハウスは **schema から削除** (見る側にとってどちらも「家全体」 で機能差なし、 個室がある = FC は公式仕様で自明)
- 登録 UI / フィルタ UI を **完全同じ 5 種** で統一 (チップが一致 = ユーザー学習コスト最小)

---

## 5. 通報・異議申し立て

### 5.1 共有名義人 (シェアハウス)

**扱わない**。 理由 — LoPo は厳密な所有権管理サービスではなく、 家主の登録すら強制しない方針。 シェアメイトが自分の名前を出したい場合は、 家主登録の紹介文に書いてもらう運用とする。

→ schema に「共有名義」 のフィールド追加なし。

### 5.2 訪問者起点の通報 — 「ちがった」 / 「報告」 ボタン UI 分離

self-declaration なし、 通報フローのみ。 Phase 1 §9.3 既存の通報 (`reason: 'wrong_info' | 'griefing' | 'nsfw' | 'sold' | 'other'`) を UI 上で **2 ボタンに分離**:

| ボタン | 重さ | 動作 | reason |
|---|---|---|---|
| **「ちがった」** | 軽い (1 タップ) | コメント入力なし、 即 record | `'wrong_info'` |
| **「報告」** | 重い (理由選択モーダル) | 理由選択、 コメント入力なし | `'griefing'` / `'nsfw'` / `'sold'` / `'other'` |

両方とも:

- 通報 3 件で自動非表示 (`isHidden=true`)
- オーナーは 1 クリックで復活可
- 虚偽通報対策 = 信用スコアロジックは Phase 3 (非公開ロジック)

**コメント入力は不要** (`Report.comment?: string` は schema 上残すが UI で入力させない、 将来必要になったら使う)。

文言・配置・ビジュアルは **モックアップ `docs/.private/housing-tour-mockup/index.html`** で最終確認後に確定。

### 5.3 家主起点の異議申し立て

「自分の家を勝手に登録された」 場合の導線:

- 物件詳細ページに **「これは私の家です」 ボタン** を配置
- クリックすると **LoPo の運営連絡先** (Discord 招待 or 問合せフォーム) に誘導
- 運営 (= masaya) が手動確認し、 確認できたら admin 権限で強制非表示

実装メモ:

- schema 追加不要 (静的リンクのみ)
- 運営連絡先の具体 URL は実装時に確定
- **プライバシー注意**: 異議申し立て時に運営が Twitter / Discord 連絡先と FF14 キャラ情報を見ることになる。 利用規約・プライバシーポリシーに明記する必要

---

## 6. 影響箇所

### 6.1 Phase 1 設計書 (2026-05-07) の改訂指示

- §4.2 HousingListing スキーマ → 本 spec §3.1 で置換
- §4.3 Report interface → 既存 `reason` enum はそのまま、 UI 分離 (§5.2) を反映
- §6.1 登録フォーム → 本 spec §4.1 で置換
- §6.5 重複登録ハンドリング → 本 spec §3.3 + §5 で更新
- §7 ギャラリー → 本 spec §4.3/§4.4 で更新
- §9.3 通報フロー → 本 spec §5.2 (UI 分離) + §5.3 (家主異議申し立て) で拡張

### 6.2 既存コード影響 (2026-05-19 訂正の影響)

前版 (2026-05-18) で実装済みの schema に **subdivision / ownerType の 2 フィールドが入っており、 plot 範囲も 1-30 で誤っている**。 forward fix で訂正:

- [`src/types/housing.ts`](../../../src/types/housing.ts): `SUBDIVISIONS`, `OWNER_TYPES` enum 削除、 `HousingListing` から `subdivision`, `ownerType` 削除
- [`src/constants/housing.ts`](../../../src/constants/housing.ts): `PLOT_RANGE` を `{ min: 1, max: 60 }` に変更
- [`src/utils/housingValidation.ts`](../../../src/utils/housingValidation.ts): subdivision / ownerType 検証削除、 plot 範囲訂正
- [`src/utils/housingDuplicate.ts`](../../../src/utils/housingDuplicate.ts): addressKey から `S${subdivision}` 削除
- [`src/utils/housingDuplicate.test.ts`](../../../src/utils/housingDuplicate.test.ts): テストケース書き直し
- [`src/utils/housingValidation.test.ts`](../../../src/utils/housingValidation.test.ts): テストケース書き直し
- [`firestore.rules`](../../../firestore.rules): `isValidSubdivision`, `isValidOwnerType` 削除、 plot 範囲訂正、 整合性制約を 3 パターンに簡素化
- [`src/lib/housingListingsService.ts`](../../../src/lib/housingListingsService.ts): subdivision クエリ削除
- [`src/lib/housingListingsService.test.ts`](../../../src/lib/housingListingsService.test.ts): テスト修正
- [`api/housing/_registerListingHandler.ts`](../../../api/housing/_registerListingHandler.ts): subdivision / ownerType 保存削除
- [`src/components/housing/register/HousingRegisterView.tsx`](../../../src/components/housing/register/HousingRegisterView.tsx): `EMPTY_DRAFT` から subdivision / ownerType 削除

### 6.3 i18n 追加 (4 言語: ja/en/ko/zh)

- 住居タイプ選択 (5 件: S / M / L / 個室 / アパート)
- 個室番号入力ラベル (1-512)
- アパ部屋番号入力ラベル (1-90)
- 「親家のサイズ (個室の親 plot)」 ラベル
- SNS 投稿 URL 欄 ラベル + プレースホルダ
- 関連登録セクション (家全体側 / 個室側 / アパ側)
- 「ちがった」 / 「報告」 ボタン文言
- 「これは私の家です」 異議申し立てボタン + 確認モーダル
- バッジ (「個室 +N」 「○○ハウス内」 「アパート部屋 #N」 等)
- 「31 以上は拡張街」 番地補助テキスト

合計約 25 キー × 4 言語 = 約 100 訳。

---

## 7. 確定論点まとめ (訂正版)

| 論点 | 結論 |
|---|---|
| 1. Empyreum wing 表現 | **不要** (公式調査で wing 概念なし) |
| 2. FC 個室 room 番号上限 | **1-512** (公式上限) |
| 3. アパート wing 1/2 表現 | **不要** (各 ward に 1 棟、 plot 番号体系外) |
| 4. 共有名義人 | **扱わない** (LoPo は厳密な所有権管理ではない) |
| 5. 詐称検知 | **通報のみ** + 「ちがった」 / 「報告」 UI 分離 + 家主異議申し立て導線 |
| 6. **subdivision (本街/拡張街)** | **schema 不要** (plot 番号 ≥31 で判別、 2026-05-19 公式再調査) |
| 7. **ownerType (個人/FC)** | **schema 不要** (ユーザー目線で区別の意味なし、 2026-05-19 確定) |
| 8. 登録 UI / フィルタ UI | **5 種チップ完全統一** (S / M / L / 個室 / アパート) |
| 9. SNS URL 欄 | **モーダル最上部に配置** (自動入力の準備) |

---

## 8. 実装フェーズ分割

### Phase 1: schema 訂正 (forward fix)

前版 schema (subdivision/ownerType/PLOT_RANGE 1-30) を全面置換。 plan: `docs/superpowers/plans/2026-05-19-housing-schema-correction.md`

### Phase 2: 登録モーダル UI (5 種チップ + SNS URL + ハウジング独自トンマナ)

Phase 1 完了後。 plan: `docs/superpowers/plans/2026-05-19-housing-register-modal.md` (Phase 1 完了時に作成)

### Phase 3: 物件詳細ページ + 通報 UI 分離 + 家主異議申し立て

Phase 2 完了後。 別 plan 作成。

---

## 付録: 公式情報源 (2026-05-19 確認)

- [Player Housing - FFXIV Wiki (consolegameswiki)](https://ffxiv.consolegameswiki.com/wiki/Player_Housing) — "plots one through 30 and plots 31 through 60"
- [How do Wards work in Final Fantasy XIV? - dotesports](https://dotesports.com/mmo/news/how-do-wards-work-in-final-fantasy-xiv)
- [Additional Plots and Purchasing Guide - Lodestone 公式](https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/housing_land/)
- [FF14 ハウジング「エンピレアム」詳細区画地図・価格一覧 - うさねこ散歩](https://next-innovation-fuk.com/2021/12/19/) — 「31〜60 が拡張街」
- [ハウジング入門！通常街と拡張街でそんなに差があるの！？ - エオキナ.com](https://www.mandra-queen.com/entry/housing-subdivision-difference-ff14)
- [ハウジングエリアって何？ - ぽん子のアトリエ](https://pnc-housing.com/housingarea/)
- [「エンピレアム」の土地販売／新システム「抽選販売」について - Lodestone トピック](https://na.finalfantasyxiv.com/lodestone/topics/detail/ffe05674f919dad5f4f13d443f2fd7067a3dc2b0)
- [ハウジング: 土地と住居 (公式ガイド)](https://jp.finalfantasyxiv.com/lodestone/playguide/contentsguide/housing_land/)
- [ハウスの「個室」 の増築について (Lodestone トピック)](https://na.finalfantasyxiv.com/lodestone/topics/detail/ef7c3c64a81ed5e0fcbf6e663f1b8c54c38e80eb)
