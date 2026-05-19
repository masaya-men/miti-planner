# ハウジング 個室・アパート 対応 (Phase 1 拡張) 設計書

> 作成日: 2026-05-18
> ステータス: ドラフト (ユーザー承認待ち)
> 親仕様: [`docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md`](./2026-05-07-housing-tour-phase1-design.md)
> 議論メモ (gitignore): `docs/.private/2026-05-17-housing-room-types-design.md`

---

## 1. 目的

Phase 1 設計書 §4.2 の `HousingListing` スキーマには、 FF14 の **個室 (FC ハウス内のプライベートチャンバー)** および **アパルトメント (1 棟複数部屋)** を正しく扱う構造が欠落していた。 本 spec で対応案を確定する。

加えて、 通報フローの UI 分離 (「ちがった」 / 「報告」) と、 家主からの異議申し立て導線も本 spec で確定する。

---

## 2. 公式仕様調査結果 (2026-05-18 確定)

### 2.1 エリア構造

5 つのハウジングエリア:

- ミスト・ヴィレッジ
- ラベンダーベッド
- ゴブレットビュート
- シロガネ
- エンピレアム

すべて **第 1〜30 区** (30 ワード) の同一構造。 旧議論メモで仮定していた「Empyreum wing 構造」 は **誤り**、 wing 概念は公式仕様に存在しない。

### 2.2 ワード構造

- 各ワード = **本街 30 区画 + 拡張街 (サブディビ) 30 区画 = 60 区画**
- 区画属性 (FC 専用 / 個人専用 / 両方) は区画単位で決定

### 2.3 住居タイプ (公式仕様)

| 種別 | サイズ | 個室機能 | 数 |
|---|---|---|---|
| **個人宅** | S / M / L | **不可** | ワードに複数 |
| **FC ハウス** | S / M / L | **可 (1-512 部屋)** | ワードに複数 |
| **アパルトメント** | 固定 (1 部屋単位) | 個室と同等機能 | 各ワードに 1 棟 (最大 90 部屋/棟、 50,000 ギル) |

### 2.4 個室・アパ部屋の所有

- **1 アカウント 1 部屋** (FC 個室 / アパート部屋ともに)
- 個室は **個人名義** (= 親 FC ハウスは FC 名義だが、 個室そのものは所属メンバー個人名義)
- 個人宅は個室を持てない (= **FC ハウスのみ個室可**)

---

## 3. スキーマ改訂

### 3.1 確定版 HousingListing

```ts
interface HousingListing {
  id: string;
  ownerUid: string;

  // 物理ワールド
  dc: string;
  server: string;

  // エリア + ワード
  area: 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
  ward: number;                          // 1-30 (全エリア共通)
  subdivision: 'main' | 'sub';           // 本街 / 拡張街

  // 建物タイプ (NEW)
  buildingType: 'house' | 'apartment';

  // === house の場合 ===
  ownerType?: 'personal' | 'fc';         // 個人宅 / FC ハウス (house 必須)
  plot?: number;                          // 1-30 (house 必須)
  size?: 'S' | 'M' | 'L';                 // (house 必須)

  // === 部屋区分 (NEW) ===
  // - undefined: 家全体 (個人宅 or FC ハウス本体)
  // - 'private_chamber': FC ハウスの個室 (親 plot 必須、 roomNumber 1-512)
  // - 'apartment_room': アパート部屋 (apartment 必須、 roomNumber 1-90)
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
}
```

**親子関係の表現**: 個室・アパート部屋と親 plot の関係は **外部キーを持たず**、 `dc/server/area/ward/subdivision/plot (または apartment)` の一致で **動的判定** する。 親 listing (家全体登録) が存在しなくても、 子 listing (個室・アパート部屋) は単独で登録可。

各 listing の `ownerUid` はその listing の所有者 (= 家主 / 個室借主 / アパ部屋住人) を指す。 個室の `ownerUid` と親 plot の `ownerUid` は通常異なる。

### 3.2 整合性制約 (Firestore Rules + zod validation)

以下の組合せのみ許可:

| # | パターン | buildingType | ownerType | roomKind | roomNumber |
|---|---|---|---|---|---|
| 1 | 個人宅 | `house` | `personal` | `undefined` | — |
| 2 | FC ハウス本体 | `house` | `fc` | `undefined` | — |
| 3 | FC 個室 | `house` | `fc` | `private_chamber` | 1-512 |
| 4 | アパート部屋 | `apartment` | — (未使用) | `apartment_room` | 1-90 |

→ 「個人宅に個室」 「アパートに plot」 などの不正な組合せは validation 段階で reject。

### 3.3 重複判定 key

```ts
function makeDuplicateKey(listing: HousingListing): string {
  const base = `${listing.dc}/${listing.server}/${listing.area}/${listing.ward}/${listing.subdivision}`;

  if (listing.buildingType === 'house') {
    if (listing.roomKind === 'private_chamber') {
      return `${base}/house/${listing.plot}/chamber/${listing.roomNumber}`;
    }
    return `${base}/house/${listing.plot}`;
  }

  if (listing.buildingType === 'apartment') {
    return `${base}/apartment/${listing.roomNumber}`;
  }

  throw new Error('Invalid buildingType');
}
```

判定:

- **ハード重複** (key 完全一致): Phase 1 §6.5 通り。 警告 → 訂正 or 別件として登録
- **ソフト重複** (同 plot に別種登録あり、 例: 家全体 + 個室、 同アパートの別部屋): 警告**しない**。 登録完了時に in-app 通知のみ

---

## 4. UI 改訂

### 4.1 登録モーダル

最初に **住居タイプ** を 4 択で選択:

```
┌──────────────────────────────────────┐
│ 登録する住居のタイプ                  │
├──────────────────────────────────────┤
│ ⚪ 個人宅 (家全体)                    │
│ ⚪ FC ハウス (家全体)                 │
│ ⚪ FC 個室 (Private Chamber)          │
│ ⚪ アパルトメント (1 部屋)             │
└──────────────────────────────────────┘
```

選択に応じて入力欄が動的変化:

| タイプ | DC | サーバー | エリア | ワード | サブディビ | 区画 | サイズ | 部屋番号 |
|---|---|---|---|---|---|---|---|---|
| 個人宅 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| FC ハウス | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| FC 個室 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — (親から) | ✓ (1-512) |
| アパート | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ (1-90) |

### 4.2 物件詳細ページ

#### 家全体 (個人 / FC) を見たとき

個人宅は関連登録なし (個室不可)。 FC ハウスの場合、 同 plot の個室登録を表示:

```
┌───────────────────────────────────────┐
│ シロガネ ワード3 区画12番地 (M / FC)    │
│ オーナー: ボブ (家主)                   │
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
│ シロガネ ワード3 区画12番地 個室 #2     │
│ オーナー: アリス                        │
│ ─────────────────                   │
│ 🏠 この個室の親の家:                   │
│  └ ボブの FC ハウス (家全体)           │
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

- **家全体ページ**: 同 `dc/server/area/ward/subdivision/plot` で `roomKind='private_chamber'` の listing を検索
- **個室ページ**: 同 plot で `roomKind=undefined`, `ownerType='fc'` の listing を検索 (= 親家全体登録)。 **存在しなければ「親の家はまだ登録されていません」 と表示**
- **アパ部屋ページ**: 同 `dc/server/area/ward/subdivision` で `buildingType='apartment'`, `roomKind='apartment_room'` かつ `roomNumber` 違いの listing を検索

### 4.3 ギャラリーカードのバッジ

- 家全体カード: 親 plot に個室 N 件あれば 「個室 +N」 バッジ
- 個室カード: 「○○ハウス内」 と親 plot 名表示
- アパート部屋カード: 「アパート部屋 #N」 表示

### 4.4 ギャラリーフィルタ

左パネル「サイズ」 セクションのチップを **5 種に統合** (2026-05-19 ユーザー確定):

- **サイズ + 部屋タイプ**: `[S]` `[M]` `[L]` `[個室]` `[アパート]`
  - `S` / `M` / `L`: `buildingType='house'` かつ `size='X'` (= 個人宅・FC ハウスを **内包**、 見る側に区別不要)
  - `個室`: `roomKind='private_chamber'` (親 plot のサイズに関係なく一覧)
  - `アパート`: `buildingType='apartment'`
- (既存): タグ / DC / サーバー / エリア

**設計判断**:
- 個人宅 vs FC ハウスは schema 上は `ownerType` で distinguishable だが、 **フィルタ UI 上は区別しない** (見る側にとってどちらも「家全体」 で機能差なし)
- ただし、 物件詳細ページ §4.2 では「個室 +N」 や「FC ハウス」 ラベルで FC 区別が見える (情報密度を保ちつつ、 検索ノイズは減らす)

---

## 5. 通報・異議申し立て

### 5.1 共有名義人 (シェアハウス)

**扱わない**。 理由 — LoPo は厳密な所有権管理サービスではなく、 家主の登録すら強制しない方針。 シェアメイトが自分の名前を出したい場合は、 家主登録の紹介文に書いてもらう運用とする。

→ schema に「共有名義」 のフィールド追加なし。

### 5.2 訪問者起点の通報 — 「ちがった」 / 「報告」 ボタン UI 分離 (NEW)

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

文言・配置・ビジュアルは **モックアップ `docs/.private/housing-tour-mockup/index.html`** で最終確認後に確定。 ハウジングは独自トンマナ (CLAUDE.md `.claude/rules/housing-design.md`)。

### 5.3 家主起点の異議申し立て (NEW)

「自分の家を勝手に登録された」 場合の導線:

- 物件詳細ページに **「これは私の家です」 ボタン** を配置
- クリックすると **LoPo の運営連絡先** (Discord 招待 or 問合せフォーム) に誘導
- 運営 (= masaya) が手動確認し、 確認できたら admin 権限で強制非表示

実装メモ:

- schema 追加不要 (静的リンクのみ)
- 運営連絡先の具体 URL は実装時に確定 (Discord 招待リンク / `mailto:` / LoPo 問合せフォームのいずれか)
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

### 6.2 既存コード影響 (実装着手前なので少)

- [`src/components/housing/HousingDuplicateWarningDialog.tsx`](../../../src/components/housing/HousingDuplicateWarningDialog.tsx): 改訂後仕様 (§3.3) で実装
- 登録モーダル本体: 未実装
- Firestore スキーマ: 未実装
- ギャラリー詳細ページ: 未実装

### 6.3 i18n 追加 (4 言語: ja/en/ko/zh)

- 住居タイプ選択 (4 件)
- 部屋番号入力ラベル
- 関連登録セクション (家全体側 / 個室側 / アパ側)
- 「ちがった」 / 「報告」 ボタン文言
- 「これは私の家です」 異議申し立てボタン + 確認モーダル
- バッジ (「個室 +N」 「○○ハウス内」 「アパート部屋 #N」 等)

合計約 20 キー × 4 言語 = 約 80 訳。

---

## 7. 確定論点まとめ

| 論点 | 結論 |
|---|---|
| 1. Empyreum wing 表現 | **不要** (公式調査で wing 概念なし) |
| 2. FC 個室 room 番号上限 | **1-512** (公式上限) |
| 3. アパート wing 1/2 表現 | **不要** (subdivision で表現済み) |
| 4. 共有名義人 | **扱わない** (LoPo は厳密な所有権管理ではない) |
| 5. 詐称検知 | **通報のみ** + 「ちがった」 / 「報告」 UI 分離 + 家主異議申し立て導線 |
| 追加. ownerType | **追加** (個人宅 / FC ハウスを data 上区別) |

---

## 8. 次のステップ

1. 本 spec のユーザーレビュー (今ここ)
2. レビュー通過後、 writing-plans skill で実装計画 `docs/superpowers/plans/2026-05-18-housing-room-types.md` を作成
3. Phase 1 設計書 (2026-05-07) を §6.1 の指示通り改訂
4. Sub-spec 2B (Gallery & Search) の登録モーダル実装着手 (本 spec のスキーマで進める)

---

## 付録: 公式情報源

- [ハウジング: 土地と住居 (公式ガイド)](https://jp.finalfantasyxiv.com/lodestone/playguide/contentsguide/housing_land/)
- [土地の追加と購入区分の変更について (2023年1月) | FF14 News](https://news.ff14wiki.info/archives/4392)
- [【FF14】ハウジング区画の個人用とFC用の見分け方 | Amemiya Memo](https://www.amemiya-reifen.com/ff14-housing-section/)
- [【FF14ハウジング】個室の増築＆カスタマイズ完全ガイド](https://pnc-housing.com/private-room-expansion-and-customization/)
- [FF14 ハウジング「エンピレアム」 詳細区画地図・価格一覧 | うさねこ散歩](https://next-innovation-fuk.com/2021/12/19/ff14-%E3%83%8F%E3%82%A6%E3%82%B8%E3%83%B3%E3%82%B0%E3%80%8C%E3%82%A8%E3%83%B3%E3%83%94%E3%83%AC%E3%82%A2%E3%83%A0%E3%80%8D%E8%A9%B3%E7%B4%B0%E5%8C%BA%E7%94%BB%E5%9C%B0%E5%9B%B3%E3%83%BB%E4%BE%A1/)
- [ハウスの「個室」 の増築について (Lodestone トピック)](https://na.finalfantasyxiv.com/lodestone/topics/detail/ef7c3c64a81ed5e0fcbf6e663f1b8c54c38e80eb)
