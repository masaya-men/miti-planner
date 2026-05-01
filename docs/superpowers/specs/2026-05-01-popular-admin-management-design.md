# 野良主流 管理画面拡張 設計書

> 作成日: 2026-05-01
> 対象機能: ボトムシート「野良主流」カードの可視性を運営側がコンテンツ別に制御できるようにする

---

## 1. 背景・課題

### 現状の挙動
- ボトムシートの「野良主流」カードは [api/popular GET](../../../api/popular/index.ts) が返す **コンテンツごとの直近7日 copyCount スコア上位 2 件 + featured 1 件** から決まる
- フロント [MitigationSheet.tsx:93-98](../../../src/components/MitigationSheet.tsx) は `featured ?? plans[0] ?? null` で代表エントリを表示
- **最低スコア閾値が無い** → そのコンテンツに他にプランが無ければ、コピー数 0 でも自動で 1 位として表示される
- 結果: M9S・オメガ系のように共有プランが少ないコンテンツでは、運営テスト用に作ったプランが「野良主流」として全ユーザーに見えてしまう

### 既存管理機能の限界（[AdminFeatured.tsx](../../../src/components/admin/AdminFeatured.tsx)）
- URL or shareId 検索 → 該当プランの ★ Featured フラグ ON/OFF はできる
- しかし **「野良主流カードを消す」ことはできない**: featured を OFF にしても、自動ランキング 1 位が代わりに繰り上がるだけ
- どのプランが今ボトムシートに出ているのか、管理画面から確認する手段が無い

---

## 2. ゴール

- 運営が **どのプランが今ボトムシートに出るか** を管理画面で俯瞰できる
- 運営テスト用プランなど **特定プランをボトムシートから非表示** にできる（永続的、後から再表示も可能）
- 既存の URL 検索方式・Featured 機能は **そのまま維持**
- 管理画面 UI は **「赤ん坊でも使える」明快さ**: ボタンに何が起きるかが書かれていて、状態が一目でわかり、誤操作には confirm が出る

---

## 3. 設計判断

### 3.1 hidden フラグ方式を採用

「セッション内一時非表示」ではなく **`shared_plans/{id}.hidden: boolean`** を Firestore に永続保存する方式を採用。

理由:
- ボトムシートは各ユーザー個別にサーバから取得するため、サーバ側に「除外しろ」と指示する必要がある
- 「いつでも管理画面から ON/OFF できるスイッチ」として運用するため、永続保存で問題ない（プランを消すわけではない）

### 3.2 hidden フィルタはサーバ側 in-memory で実施

Firestore で `where('hidden', '!=', true)` を使うと:
- `!=` クエリは null/undefined をマッチしない（既存プランは hidden 未定義なので除外されてしまう）
- 不等号フィールドは1つまでなので将来 score 系の不等号と併用できない

→ **既存の `getPlansForContent()` パターン（全件取得 → in-memory ソート）に倣い、`d.hidden !== true` でフィルタ**。複合インデックス追加不要、既存プランも自然に対応。

### 3.3 管理画面は AdminFeatured.tsx を拡張（サイドナビ位置は変えない）

URL 検索方式は便利な場面もある（特定 shareId をピンポイント操作）ので残す。新しい「野良主流ビュー」を追加して、上部のセグメントコントロールで切替。サイドナビからは引き続き「Featured 設定」1 項目で開ける。

実装上は読みやすさのため AdminFeatured.tsx 内に `PopularSearchView`（既存の URL 検索）を内部関数として保持し、`PopularBrowseView` は分量が多いので別ファイル `src/components/admin/PopularBrowseView.tsx` に切り出す。

```
┌─────────────────────────────────────────────────┐
│ 野良主流の管理                                  │
│ ┌──────────────┬──────────────┐                 │
│ │ 野良主流ビュー │  URL 検索     │  ← セグメント   │
│ └──────────────┴──────────────┘                 │
│                                                 │
│ [タブ: 零式 | 絶 ]                              │
│ [コンテンツ選択: M1S ▼ ]                        │
│                                                 │
│ ┌──────────┬─────────────────────┐              │
│ │ #1 ★     │ プレビュー (OGP)    │              │
│ │ #2       │                      │              │
│ │ #3 🚫    │  選択中: #1          │              │
│ │ #4       │  タイトル / 7d / 生涯 │              │
│ │ #5       │  作成日 / オーナー   │              │
│ │ ...      │  ★ / 🚫 操作ボタン   │              │
│ │ #10      │                      │              │
│ └──────────┴─────────────────────┘              │
└─────────────────────────────────────────────────┘
```

### 3.4 「野良主流ビュー」をデフォルト表示に

開いた瞬間「いま何が出ているか」が見える方が記憶喪失耐性が高い。URL 検索は補助的なタブに格下げ。

### 3.5 上位 10 件まで取得

ユーザー要望は「1〜5位」だったが、繰り上がり挙動を読みやすくするため **10 位まで** 表示する。スクロールリストなので情報過多にはならない。

---

## 4. データモデル

### 4.1 Firestore スキーマ変更

```ts
// shared_plans/{shareId}
interface SharedPlan {
  // ... 既存フィールド
  featured?: boolean;
  hidden?: boolean;  // ← 追加（undefined は false 扱い）
  hiddenAt?: number;  // ← 追加（toggle した unix ms、監査用）
  hiddenBy?: string;  // ← 追加（toggle した admin uid、監査用）
}
```

- `hidden=true` → ボトムシート GET /api/popular の上位リストから除外
- `hidden=false` or undefined → 通常通り
- 既存プランは undefined のまま → 影響ゼロ

### 4.2 hidden と featured の組み合わせ

| featured | hidden | 挙動 |
|---|---|---|
| true | false/undef | ★ 表示優先（既存） |
| false | true | 完全非表示（新規） |
| true | true | **不整合**: hidden 優先で非表示。UI で警告表示。実際にこの状態にはならないようガード（hidden=true 時に featured を強制 OFF） |
| false | false | 通常（自動ランキング判定対象） |

---

## 5. API 仕様

### 5.1 GET /api/popular（既存改修）

[api/popular/index.ts:170-194](../../../api/popular/index.ts) の `scored` 配列ソート前 or slice 前に hidden フィルタを追加:

```ts
const scored = allSnap.docs
  .filter(doc => doc.data().hidden !== true)  // ← 追加
  .map(doc => { /* 既存スコア計算 */ });
```

featured 取得側にも追加:

```ts
const featuredSnap = await db
  .collection(COLLECTION)
  .where('contentId', '==', id)
  .where('featured', '==', true)
  .limit(1)
  .get();

// hidden が true のものは弾く（不整合ガード）
const validFeatured = featuredSnap.docs.find(d => d.data().hidden !== true) ?? null;
```

### 5.2 GET /api/admin?resource=popular&contentId=X&limit=10（新規）

管理画面用エンドポイント。**hidden=true 含む全件**を返し、フロントで Featured / Hidden バッジを描画する。

```ts
// Request
GET /api/admin?resource=popular&contentId=m9s&limit=10

// Response
{
  contentId: "m9s",
  plans: [
    {
      shareId: "abc123",
      title: "...",
      contentId: "m9s",
      copyCount: 12,           // 生涯
      score7d: 5,              // 直近7日
      featured: false,
      hidden: false,
      hiddenAt: null,
      createdAt: 1730000000000,
      ownerUidSuffix: "a3f1",  // UID 末尾4文字（プライバシー配慮で全UIDは返さない）
      partyMembers: [{ jobId: "PLD" }, ...],
      imageHash: "...",
    },
    // ... up to limit
  ],
}
```

ロジック:
- `where('contentId', '==', X)` で全件取得
- メモリ上で `score7d` 計算 + 降順ソート（既存 popular GET と同じ）
- `slice(0, limit)` ※ hidden は弾かない（管理者が見たいから）

verifyAdmin ガード必須。

### 5.3 PATCH /api/popular（既存拡張）

既存:
```ts
PATCH /api/popular  body: { shareId, featured: boolean }
```

拡張:
```ts
PATCH /api/popular  body: { shareId, featured?: boolean, hidden?: boolean }
```

- どちらか一方、または両方を指定可能（後者は通常使わないが API として柔軟性確保）
- `featured: true` 指定時は既存通り「同コンテンツ内の他 featured を OFF にする」処理
- `hidden: true` 指定時は **同時に featured を強制 false に**（不整合ガード）
- `hidden` 切替時は `hiddenAt` と `hiddenBy` も自動セット
- og_image_meta の `keepForever` は featured 連動のみ（hidden は影響なし）

---

## 6. UI 仕様

### 6.1 AdminFeatured.tsx の構造

```
┌─ AdminFeatured.tsx ────────────────────────────┐
│ const [view, setView] = useState<              │
│   'browse' | 'search'                          │
│ >('browse')                                    │
│                                                │
│ - <SegmentControl> で view 切替                │
│ - view='browse' → <PopularBrowseView />        │
│ - view='search' → <PopularSearchView />（既存）│
└────────────────────────────────────────────────┘
```

### 6.2 PopularBrowseView コンポーネント

```
┌──────────────────────────────────────────────┐
│ [ 零式 ] [ 絶 ]   ← 既存 MitigationSheet と同じ │
│                                              │
│ コンテンツ選択: ┌─────────┐                  │
│                 │ M9S    ▼ │                  │
│                 └─────────┘                  │
│                                              │
│ ┌──────────────┬───────────────────┐         │
│ │ ┌─ #1 ─────┐ │  ┌───────────┐    │         │
│ │ │ ★ TITLE  │ │  │   OGP     │    │         │
│ │ │ 7d:5 ⊞12│ │  │  preview  │    │         │
│ │ │ 5/1     │ │  └───────────┘    │         │
│ │ └─────────┘ │  タイトル: ...    │         │
│ │ ┌─ #2 ─────┐ │  生涯コピー: 12   │         │
│ │ │   TITLE  │ │  直近7日: 5       │         │
│ │ │ 7d:3 ⊞8 │ │  作成: 5/1        │         │
│ │ └─────────┘ │  オーナー: ...a3f1│         │
│ │ ┌─ #3 ─────┐ │                   │         │
│ │ │🚫 TITLE  │ │  ┌───────────┐    │         │
│ │ │ ...      │ │  │ ★ Featured │   │         │
│ │ └─────────┘ │  └───────────┘    │         │
│ │ ...         │  ┌───────────┐    │         │
│ └─────────────┘  │ 🚫 Hidden │    │         │
│                  └───────────┘    │         │
│                                              │
└──────────────────────────────────────────────┘
```

#### カードの見た目
- 状態バッジ: ★（黄、Featured）/ 🚫（赤、Hidden）/ なし（通常）
- hidden=true のカードは **opacity-50** で半透明表示 + 「非表示中」バッジ
- 順位番号（#1〜#10）を左肩に表示
- 順位は **直近7日 copyCount スコア降順**（GET /api/popular と同じロジック）
- クリックで右ペインに詳細表示
- ★ がついたカードは「★ Featured」バッジ、それ以外で #1 のカードには「⭐ 表示中（自動）」バッジ（実際にボトムシートに出ているのが一目でわかる）

#### 右ペイン（詳細プレビュー）
- OGP 画像（imageHash があれば `/og/{hash}.png`、なければ `/api/og?id=...`）
- タイトル / 生涯コピー / 直近7日 / 作成日 / オーナー UID 末尾4文字
- アクションボタン:
  - **★ Featured 設定 / 解除**（既存 PATCH 利用）
  - **🚫 ボトムシートから非表示 / 再表示**（新規 PATCH 利用）
- どちらも confirm ダイアログで「○○すると全ユーザーから……」と影響範囲を明記
- 操作後は toast で結果通知 + ランキング再取得

### 6.3 ボタン文言（i18n キー、4 言語）

主要キー（admin.popular.* 名前空間）:

| キー | 日本語 | 英語 |
|---|---|---|
| `admin.popular_view_tab` | 野良主流ビュー | Featured Browser |
| `admin.popular_search_tab` | URL 検索 | URL Search |
| `admin.popular_select_content` | コンテンツを選んでください | Select content |
| `admin.popular_loading` | 読み込み中… | Loading… |
| `admin.popular_no_plans` | このコンテンツには共有プランがありません | No shared plans for this content |
| `admin.popular_rank` | 順位 | Rank |
| `admin.popular_score_7d` | 直近7日コピー数 | Last 7d copies |
| `admin.popular_total_copies` | 生涯コピー数 | Total copies |
| `admin.popular_owner` | オーナー (UID 末尾) | Owner (UID suffix) |
| `admin.popular_visible_now` | ⭐ 表示中（自動） | ⭐ Live (auto) |
| `admin.popular_featured_badge` | ★ Featured | ★ Featured |
| `admin.popular_hidden_badge` | 🚫 非表示中 | 🚫 Hidden |
| `admin.popular_hide_button` | ボトムシートから非表示にする | Hide from bottom sheet |
| `admin.popular_unhide_button` | 再表示する | Show again |
| `admin.popular_hide_confirm` | このプランを全ユーザーのボトムシートから非表示にします。よろしいですか？（後から再表示できます） | This plan will be hidden from all users' bottom sheet. OK? (You can re-show later) |
| `admin.popular_unhide_confirm` | このプランをボトムシートに再表示します。よろしいですか？ | Show this plan in bottom sheet again? |
| `admin.popular_hide_success` | 非表示にしました | Hidden successfully |
| `admin.popular_unhide_success` | 再表示しました | Shown again |

### 6.4 「記憶喪失でも操作できる」ための工夫

1. **デフォルトビューが「野良主流ビュー」**: 開いた瞬間「いま何が出ているか」が見える
2. **#1 カードに「⭐ 表示中（自動）」バッジ**: featured が無くても自動で 1 位が出ていることが視覚的にわかる
3. **confirm ダイアログに影響範囲を明記**: 「全ユーザーのボトムシートから……」
4. **再表示も同じ画面でできる**: 不可逆操作ではないことが明示される
5. **hidden カードは半透明 + 「非表示中」バッジ**: 状態が一目でわかる
6. **toast で操作結果を即時フィードバック**

---

## 7. テスト戦略

### 7.1 vitest（ユニット/コンポーネント）

新規:
- `api/popular` の hidden フィルタロジックをテスト（in-memory フィルタ関数を切り出し）
- `_popularHandler.ts` の管理 API レスポンス整形ロジックをテスト
- `PopularBrowseView` の表示・操作テスト（API モック）

既存:
- `AdminFeatured` の URL 検索ビューに影響無いこと

### 7.2 手動 E2E（実機）

- /admin/featured → 野良主流ビューがデフォルトで開く
- 零式タブ・絶タブ切替
- コンテンツ選択 → 上位 10 件カード一覧
- カードクリック → 右ペインに詳細表示
- ★ Featured ON/OFF → ボトムシートで反映確認
- 🚫 Hidden ON → 該当プランがボトムシートから消える + 自動 1 位繰り上がり確認
- 🚫 Hidden OFF → 復活確認
- URL 検索ビュー切替 → 既存挙動維持

---

## 8. 影響範囲

### 変更ファイル
- `src/components/admin/AdminFeatured.tsx`（拡張）
- `api/popular/index.ts`（hidden フィルタ + PATCH 拡張）
- `api/admin/index.ts`（resource=popular ルート追加）
- 新規: `api/admin/_popularHandler.ts`
- `src/locales/{ja,en,zh,ko}.json`（i18n キー追加）
- `src/__tests__/`（新規テスト）

### 影響なし
- ボトムシート [MitigationSheet.tsx](../../../src/components/MitigationSheet.tsx) のフロント側ロジック（API 側でフィルタ済みなので無改修）
- 既存 plans 取得ロジック・featured 機能・OGP 生成
- 他の管理画面ページ

### Firestore 複合インデックス
**追加不要**。`where('contentId', '==', X)` の単一インデックスは Firestore 自動作成済み。`hidden` は in-memory フィルタ。

---

## 9. リスク・対策

| リスク | 対策 |
|---|---|
| hidden フラグ追加時に既存プランが影響を受ける | undefined を false 扱いするロジックで担保（`!== true`） |
| 管理者の誤操作で重要プランを非表示にする | confirm ダイアログ + 再表示も同画面で可能（不可逆ではない）|
| Firestore 読み取り課金増 | 管理 API は管理者のみアクセス、頻度低い。ボトムシート側は既存と同じ全件取得（変化なし） |
| featured と hidden の不整合 | PATCH で `hidden=true` 時に featured 強制 OFF |
| OGP `keepForever` の整合性 | hidden では `keepForever` を触らない（featured 連動のまま）|

---

## 10. ロールアウト

1. Firestore に `hidden` フィールド追加 → 既存ドキュメントには手動付与不要（undefined で OK）
2. API 側を先行デプロイ（`hidden !== true` フィルタ追加でも既存挙動と同じ）
3. 管理画面 UI を後続デプロイ（管理者のみがアクセス）
4. 管理者が運営テストプランを順次 hidden=true に
5. ボトムシートで自動的に正しいプランが顔を出すようになる

ロールアウト中もユーザー体験は壊れない（既存 hidden 未定義プランはすべて従来通り）。

---

## 11. やらないこと（YAGNI）

- 一括非表示 / 一括 featured 設定（運用上必要になるまで実装しない）
- hidden の理由メモ機能（必要になったら hiddenReason フィールド追加）
- 監査ログ画面（hiddenBy/hiddenAt は保存するが UI は作らない）
- コンテンツ単位の「野良主流機能 OFF」フラグ（個別 hidden で運用十分）
- スコア閾値の自動非表示（人間判断の方が事故少ない）
