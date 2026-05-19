# Housing 登録モーダル + SNS URL 自動推定 設計書

- **作成日**: 2026-05-19
- **作成者**: masaya-men + Claude (Opus 4.7)
- **対象 Phase**: Phase 2A (Housing 登録モーダル本実装)
- **置き換え対象**: `2026-05-18-housing-room-types-design.md` §4.1 (登録モーダル UI) を新版に差し替え、 §6.3 (SNS URL 自動補完) を実装仕様まで詳細化
- **依存**: Phase 1 schema 訂正 (subdivision/ownerType 削除 + plot 1-60) が main にマージ済 (commit 2322382)

---

## 1. 背景と目的

### 1.1 課題

現在のハウジング登録フォームは、 ユーザーが DC・サーバー・エリア・区・番地・サイズを**全て手入力**する必要がある。 多くの FF14 ユーザーは既に X (旧 Twitter) で家を共有しており、 同じ情報を再入力するのは負担。

### 1.2 解決方針

X 投稿の URL を貼るだけでフォームを自動入力できるようにする。 ただし「自動入力 = 信用しすぎて誤データが入る」 リスクを避けるため、 **UI で必ずユーザーの確認を強制**する。

### 1.3 ゴール

- 定番フォーマットの投稿 (FF14 housing 界隈の規格): 抽出精度 100%
- 略称・自由文の投稿: 70-90% (辞書ベストエフォート)
- 抽出できない投稿: 手入力 fallback、 ツイート本文をプレビュー表示して照らし合わせやすく
- ユーザー誤入力防止: 自動入力された値を**全フィールド確認しないと登録できない**仕様
- ユーザー体験の上質さ: ハウジング世界観 (黒ガラス + ハニーゴールド) のトンマナで、 タイピングアニメ等の業界定番演出を漏れなく実装

---

## 2. ユーザー体験フロー

```
[ユーザー操作]                          [システム挙動]
─────────────────────────────────────────────────
1. ハウジングページの「家を登録」 ボタン押下
                                       → 登録モーダル開く
                                       → SNS URL 欄にフォーカス

2. X URL を貼り付け
   (例: https://x.com/.../status/123)
                                       → URL regex で X URL と判定
                                       → 自動 fetch 開始
                                       → モーダル内オーバーレイで操作ブロック
                                       → スピナー + 「ツイートを読み取り中…」
                                       → 「キャンセル」 ボタン表示

3. (取得完了)
                                       → ツイート本文をプレビュー表示
                                         (黒ガラス + ハニーゴールド調)
                                       → 抽出アルゴリズム実行
                                       → 取れたフィールドにタイピングアニメで自動入力
                                         (1 文字ずつ、 フィールド間 100ms ずらし)
                                       → 各フィールドに 🟡 バッジ + ✅ チェックボタン
                                       → 取れなかったフィールドは赤枠 + 「ここを埋めてください」
                                       → 登録ボタンは disabled (薄表示)

4. ユーザーが各欄を確認
   - 自動入力値が正しい → ✅ ボタン押下
   - 値を直したい → 編集 (編集した瞬間バッジ消去 = 確認扱い)
   - 空欄を埋める → 手入力

                                       → ✅ 押下時:
                                         チェックマーク描画 (path draw)
                                         + bounce + ripple + hotaru glow
                                         + フィールド背景 黄色→緑 遷移
                                       → 全フィールド「編集 or ✅」 完了で
                                         登録ボタンが有効化

5. 「登録する」 ボタン押下
                                       → 最終確認モーダル
                                         「以下の内容で登録します。 よろしいですか?」
                                         + ツイート本文を再表示
                                         + 入力値を一覧表示

6. 「確定」 押下
                                       → POST /api/housing/register
                                       → 成功 → モーダル閉じる → トースト
                                       → 失敗 → エラーメッセージ
```

---

## 3. UI 仕様

### 3.1 モーダルレイアウト

ハウジング独自トンマナ準拠 (`docs/.private/housing-tour-mockup/index.html` 参照)。

```
┌─────────────────────────────────────────────────────┐
│ [×]            家を登録                              │   ← ヘッダー
│ ─────────────────────────────────────────────────── │
│ SNS URL (任意)                                      │
│ [https://x.com/.../status/...]  ⏳取得中... [取消]    │   ← SNS URL 欄 (最上部)
│ ─────────────────────────────────────────────────── │
│ 📄 取得したツイート                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 完成しました！見にきてください！！！               │ │   ← ツイートプレビュー
│ │                                              │ │   (取得後のみ表示)
│ │ Materia                                      │ │
│ │ Bismarck                                     │ │
│ │ Lavender Beds | 23-6 | Large                 │ │
│ │ #FF14housing #FFXIVHousing ...               │ │
│ └─────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────── │
│ 住居タイプ *                                         │
│ [ S ]  [ M ]  [ 🟡 L ✅ ]  [ 個室 ]  [ アパート ]    │   ← タイプチップ (5 種)
│ ─────────────────────────────────────────────────── │
│ DC / サーバー *                                      │
│ DC      [🟡 Materia       ▼] ✅                     │   ← フィールド (バッジ + 確認)
│ サーバー [🟡 Bismarck     ▼] ✅                     │
│ ─────────────────────────────────────────────────── │
│ 住所 *                                              │
│ エリア   [🟡 ラベンダーベッド ▼] ✅                  │
│ 区      [🟡 23 ] 番地 [🟡 6  ]  (本街)             │
│ ─────────────────────────────────────────────────── │
│ (個室 or アパートのときのみ追加表示)                  │
│ 個室番号 / 部屋番号  (タイプ依存で出現)               │
│ 親家サイズ (個室時のみ)                              │
│ ─────────────────────────────────────────────────── │
│ コメント (任意)                                      │
│ [____________________________________________]      │
│ ─────────────────────────────────────────────────── │
│ タグ (任意)                                          │
│ [モダン] [和風] [カフェ] ...                         │
│ ─────────────────────────────────────────────────── │
│             [キャンセル]   [登録する] (disabled)       │   ← フッター
└─────────────────────────────────────────────────────┘
```

### 3.2 フィールド状態モデル

各入力フィールドは以下のステートを持つ:

| ステート | 視覚 | 登録ボタン制御 |
|---|---|---|
| `empty` | 通常 (任意欄なら問題なし、 必須欄なら disabled 寄与) | 必須なら登録不可 |
| `auto-filled` | 🟡 バッジ + 黄色背景 | **登録不可** (確認が必要) |
| `confirmed` | ✅ アイコン + 緑背景 | 登録可 |
| `edited` | 通常背景 (バッジなし) | 登録可 (編集 = 確認扱い) |
| `error` | 赤枠 + エラーメッセージ | 登録不可 |

登録ボタンは「全必須フィールドが `confirmed` / `edited`」 かつ「`error` フィールドゼロ」 のときだけ有効化。

### 3.3 アニメーション要件 (業界定番を漏らさず)

#### 3.3.1 ✅ チェックボタンのアニメ

押下時:
1. **チェックマーク描画**: SVG `stroke-dasharray` でシュッと描かれる (200ms ease-out)
2. **bounce**: ボタン全体が `1.0 → 1.3 → 0.95 → 1.0` のオーバーシュート (400ms cubic-bezier)
3. **ripple**: 押下点からリング型に広がる波紋 (600ms ease-out fade)
4. **hotaru glow**: ハニーゴールド色で一瞬光る (300ms ease-in-out)
5. **フィールド背景遷移**: 黄色 → 緑 (300ms ease-out)

Hover 時:
- ジワっとした予兆 glow (120ms ease-in)
- カーソル `pointer`

#### 3.3.2 タイピングアニメ (自動入力時)

- 1 文字ずつ表示、 50ms/char (調整可)
- カーソル `|` 点滅 (530ms 周期、 macOS 風)
- フィールド間 100ms ずらし (上から下に視線誘導)
- 完了時にフィールド枠が一瞬フラッシュ (subtle、 100ms)
- `prefers-reduced-motion: reduce` でアニメ無効化 → 一括表示

#### 3.3.3 タイプチップ選択時の連動アニメ

- 個室 / アパート選択時、 追加フィールド (個室番号等) が**下からスライドイン** (300ms cubic-bezier ease-out)
- 不要になった追加フィールドは**フェード + 上にスライドアウト** (200ms ease-in)
- スライド中はモーダル全体の高さがスムーズに変動

#### 3.3.4 取得中のローディング

- リキッドグラス調の円形スピナー (回転 1.2s linear infinite)
- 「ツイートを読み取り中…」 のテキストはフェードイン + 軽い left-right 揺らぎ
- オーバーレイ: backdrop-blur(8px) + 黒 30% 透過
- 「キャンセル」 ボタンは静止、 アクセシブル

### 3.4 タイプ依存表示切替

```
タイプ = S/M/L:
  → 個室番号 欄: 非表示
  → 部屋番号 欄: 非表示
  → 親家サイズ 欄: 非表示

タイプ = 個室 (FC個室):
  → 個室番号 欄: 表示 (1-512 range)
  → 親家サイズ 欄: 表示 (S/M/L 必須)
  → 部屋番号 欄: 非表示

タイプ = アパート:
  → 部屋番号 欄: 表示 (1-90 range)
  → 個室番号 欄: 非表示
  → 親家サイズ 欄: 非表示
```

「チップを押した瞬間に追加欄が出る」 ので、 ユーザーが「個室なのに個室番号欄がない」 と困ることはない。 自動入力で個室と判定された場合は、 出現アニメも自動再生。

---

## 4. 抽出アルゴリズム (`parseHousingFromText`)

### 4.1 シグネチャ

```typescript
type HousingExtractResult = {
  dc?: string;            // 例: "Mana"
  server?: string;        // 例: "Anima"
  area?: HousingAreaId;   // 例: "Shirogane"
  ward?: number;          // 1-30 (本街は 1-30、 拡張街は 31-60)
  plot?: number;          // 1-60
  size?: 'S' | 'M' | 'L' | 'Apartment' | 'PrivateRoom';
  roomNumber?: number;    // アパート 1-90 / 個室 1-512
  parentHouseSize?: 'S' | 'M' | 'L';  // size=PrivateRoom 時の親家
  ambiguity?: string[];   // 曖昧で抽出を棄却したフィールド名
};

function parseHousingFromText(text: string): HousingExtractResult;
```

純関数 (副作用なし)、 入力同じなら出力も同じ。 vitest でテスト可能。

### 4.2 アルゴリズムの流れ

#### Step 1: 前処理

```typescript
// URL 除去
text = text.replace(/https?:\/\/\S+/g, ' ');
// メンション除去
text = text.replace(/@\w+/g, ' ');
// ハッシュタグ除去 (#FF14housing 等のメタタグはノイズ)
text = text.replace(/#\S+/g, ' ');
// 飾り記号除去 (⚐ ⌂ 🏠 等)
text = text.replace(/[⚐-⚑⌀-⏿\u{1F3E0}-\u{1F3FF}]/gu, ' ');
```

#### Step 2: 定番フォーマット regex 試行

FF14 housing 界隈の定番テンプレ:

```
パターン A (改行 + パイプ区切り):
  DC\n
  Server\n
  Area | W-P | Size

パターン B (Unicode 縦線 + スペース):
  DC ┆ Server ┆ Area W-P Size

パターン C (ハイフン区切り 1 行):
  DC - Server - Area - W - P + Size

パターン D (パイプ区切り 1 行):
  DC | Server | Area | W-P | Size
```

これらに優先順位を付けて regex マッチ試行。 ヒットしたら結果を確定値として使用、 Step 3 をスキップ。

#### Step 3: トークナイザー + 辞書照合 (fallback / 補完)

定番フォーマットで取れなかった場合、 または補完が必要な場合:

```typescript
// 区切り文字 + サーバー一般語 を区切り扱いで分割
// 注: [文字クラス] には単一文字のみ、 多文字語は別途 OR で並べる
const SEPARATORS = /[\|┆\-/\s\n、。（）「」『』"',，]|鯖|サバ|さば|サーバー|サーバ|Server|server|Serv|Srv/g;
const tokens = text.split(SEPARATORS).filter(Boolean);
```

各 token を masterData の aliases と照合:

```typescript
for (const token of tokens) {
  // DC 候補
  for (const [dcId, dcData] of Object.entries(serverMasterData)) {
    if (dcData.aliases.some(a => a.toLowerCase() === token.toLowerCase())) {
      candidates.dc.push(dcId);
    }
    // サーバー候補
    for (const [serverId, aliases] of Object.entries(dcData.servers)) {
      if (aliases.some(a => a.toLowerCase() === token.toLowerCase())) {
        candidates.server.push({ serverId, dcId });
      }
    }
  }
  // エリア候補
  for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
    if (areaData.aliases.some(a => a.toLowerCase() === token.toLowerCase())) {
      candidates.area.push(areaId);
    }
    // アパート名 → エリア + サイズ=アパート
    if (token === areaData.apartment_name) {
      candidates.area.push(areaId);
      candidates.size.push('Apartment');
    }
  }
  // サイズ候補
  for (const sizeData of housingSizeMasterData) {
    if (sizeData.aliases.some(a => a.toLowerCase() === token.toLowerCase())) {
      candidates.size.push(sizeData.id);
    }
  }
}
```

#### Step 4: 数字パターン抽出 (区-番地)

```typescript
// 区-番地候補: \d{1,2} ハイフン類 \d{1,2}
const wardPlotMatch = text.match(/(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/);
if (wardPlotMatch) {
  candidates.wardPlot = { ward: +wardPlotMatch[1], plot: +wardPlotMatch[2] };
}

// 番地末尾サイズ連結 (例: "4-2M"): 番地直後に S/M/L/A
const wardPlotSizeMatch = text.match(/(\d{1,2})\s*[-－‐ー]\s*(\d{1,2})\s*([SMLA])\b/i);
if (wardPlotSizeMatch && !candidates.size.length) {
  candidates.size.push(normalizeSize(wardPlotSizeMatch[3]));
}
```

範囲 check: `1 <= ward <= 30`、 `1 <= plot <= 60`。 範囲外は候補から除外。

#### Step 5: 逆引き補完

- サーバー検出 → DC を自動補完 (例: Ixion → DC=Mana)
- アパート名検出 (`apartment_name` 一致) → エリア + サイズ=Apartment
- 「FC個室」「個室」「Private Room」「Chamber」「FC部屋」 → サイズ=PrivateRoom

```typescript
// 個室キーワード検出 (regex)
const PRIVATE_ROOM_KEYWORDS = /FC個室|個室|Private\s*Room|FC\s*Chamber|FC部屋/i;
if (PRIVATE_ROOM_KEYWORDS.test(text)) {
  candidates.size.unshift('PrivateRoom');
}
```

#### Step 6: 整合性チェック

- サーバー → DC 逆引きと、 明示的 DC 検出が**矛盾**する場合 → 警告フラグ + 抽出から除外
  - 例: テキストに「Mana」 と「Bismarck (Materia DC)」 が両方ある → 矛盾、 ambiguity に記録
- 1 カテゴリで複数候補がある場合 → 「最初に出現した方」 を採用 (テキスト上の優先順)
  - ただし複数候補が「明らかに別物」 なら ambiguity に記録して抽出棄却

#### Step 7: 結果整形

```typescript
return {
  dc: candidates.dc[0],
  server: candidates.server[0]?.serverId,
  area: candidates.area[0],
  ward: candidates.wardPlot?.ward,
  plot: candidates.wardPlot?.plot,
  size: candidates.size[0],
  roomNumber: undefined,  // テキストから個室/部屋番号を取るのは難しいので空欄
  parentHouseSize: undefined,
  ambiguity: ambiguousFields,
};
```

### 4.3 辞書 (masterData.ts) の追加要件

本実装で **masterData.ts に追加する alias**:

- **LavenderBeds.aliases に「葉脈」 を追加** (FF14 コミュニティで頻出の俗称)
- **個室キーワードは正規表現で別管理** (`PRIVATE_ROOM_KEYWORDS`、 lib 内 const)
- **サーバー一般語は別管理** (`SERVER_GENERIC_SEPARATORS`、 lib 内 const、 単独の語として `鯖` `サバ` `さば` `サーバー` `サーバ` `Server` `server` `Serv` `Srv` を区切り扱い)

masterData.ts は「FF14 公式マスターデータ」 として「実体ある名前」 のみを持ち、 助詞・俗称セパレータは抽出ロジック側で持つ方針。 これで責務分離。

### 4.4 曖昧時の挙動 (重要)

ユーザーから「ハウジング登録の文脈なので、 文中の `タイタン` は積極的に Titan として拾って OK」 と確定。 ただし以下のケースは抽出を**棄却**:

- 同カテゴリで明らかに別物の候補が複数 (例: 「Mana」 と「Materia」 が両方検出 → 棄却して手入力)
- 区-番地が複数候補 (例: 「6-6 と 12-3 が両方検出」 → 最初の方を採用、 ambiguity に警告)
- 範囲外の数字 (例: 番地 = 70 → 棄却、 範囲外と判定)

棄却した場合は ambiguity 配列に「dc / server / area / wardPlot / size」 のどれが曖昧だったかを記録し、 UI 側で「自動取得できなかった」 メッセージを出す。

### 4.5 写真の扱い

ツイートに添付された写真 (`json.photos`) は **本 spec では使わない**。 理由:

- 写真を物件画像として勝手にコピーする = UGC 著作権の問題
- 「自分のハウジングを登録」 する場合は問題ないが、 「他人の家を推薦登録」 する場合は問題
- 別の Phase で「写真は手動アップロード」 する仕様を検討する

ツイートプレビュー (§3.1) でツイート画像のサムネは表示してよい (= 埋め込みと同じ扱い、 X 公式 widget も同様)。

---

## 5. API ルート

### 5.1 エンドポイント

`src/app/api/tweet-meta/route.ts` (Next.js App Router の API route)

### 5.2 仕様

```
GET /api/tweet-meta?id=<tweetId>

Request:
  - Query: id (Tweet ID、 数字のみ、 max 20 桁)

Response 200:
{
  "text": "Mana\nAnima\nShirogane | 6-6 | Small ...",
  "author": { "name": "...", "screen_name": "..." },
  "photos": ["https://pbs.twimg.com/...", ...],
  "video": true
}

Response 4xx:
  - 400 Bad Request: id が数字でない / 桁数不正
  - 404 Not Found: ツイート削除済 / 非公開
  - 429 Too Many Requests: レート制限

Response 5xx:
  - 502 Bad Gateway: syndication CDN がエラー
  - 504 Gateway Timeout: syndication CDN がタイムアウト (10s)
```

### 5.3 実装

```typescript
// src/app/api/tweet-meta/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Vercel Edge Function (関数枠の Edge カウント、 帯域も軽い)

const TWEET_ID_REGEX = /^\d{1,20}$/;
const TIMEOUT_MS = 10_000;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !TWEET_ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid tweet ID' }, { status: 400 });
  }

  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'LoPo Housing Tour' },
      next: { revalidate: 3600 }, // Edge cache 1 時間
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Tweet not found or private' }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({
      text: json.text ?? '',
      author: {
        name: json.user?.name ?? '',
        screen_name: json.user?.screen_name ?? '',
      },
      photos: (json.photos ?? []).map((p: any) => p.url),
      video: Boolean(json.video),
    }, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (e: any) {
    if (e.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 5.4 セキュリティ / レート制限

- Tweet ID は数字のみ valid → 任意 URL fetch 防止
- Edge cache (s-maxage=3600) で同一ツイート再 fetch を防ぐ
- 追加のレート制限 (per IP) は当面なし。 Vercel 標準の DDoS 防御に任せる
- 必要になったら Vercel KV や Upstash Redis でレート制限追加

### 5.5 将来の Cloudflare 移行

`functions/api/tweet-meta.ts` (Cloudflare Pages Function) に**ほぼそのまま移植可能**。 Allmarks の `tweet-meta.ts` と同じ命名・同じ仕様で書く。

---

## 6. ファイル構成

### 6.1 新規ファイル

```
src/components/housing/register/
├ HousingRegisterModal.tsx              [NEW] モーダル枠、 リキッドガラス、 動画背景に oversit
├ HousingRegisterForm.tsx               [NEW] state 管理 + 子コンポ統合
├ HousingRegisterSnsUrlField.tsx        [NEW] SNS URL 入力 + 取得トリガー
├ HousingRegisterTweetPreview.tsx       [NEW] 取得した本文 + 著者表示
├ HousingRegisterTypeSelector.tsx       [NEW] 5 種チップ
├ HousingRegisterAddressFields.tsx      [既存] 番地 1-60 + 拡張街注記を追加
├ HousingRegisterRoomNumberField.tsx    [NEW] タイプ依存 (個室 1-512 / アパート 1-90)
├ HousingRegisterParentHouseSizeField.tsx [NEW] 個室時のみ表示
├ HousingRegisterTagPicker.tsx          [既存]
├ HousingRegisterDescriptionField.tsx   [既存]
└ HousingRegisterFieldBadge.tsx         [NEW] 🟡 + ✅ + アニメ、 全フィールド共通

src/lib/housing/
├ parseHousingFromText.ts               [NEW] 抽出ロジック (純関数)
├ housingFieldState.ts                  [NEW] フィールド状態管理 hooks
└ tweetUrlParse.ts                      [NEW] X URL → Tweet ID 抽出 + validate

src/app/api/tweet-meta/
└ route.ts                              [NEW] syndication プロキシ Edge Function

src/__tests__/housing/
├ parseHousingFromText.test.ts          [NEW] 4 実サンプル + エッジケース 多数
├ tweetUrlParse.test.ts                 [NEW] URL バリデーション
├ HousingRegisterModal.test.tsx         [既存拡張] 全フロー E2E 風
├ HousingRegisterSnsUrlField.test.tsx   [NEW]
├ HousingRegisterTweetPreview.test.tsx  [NEW]
├ HousingRegisterTypeSelector.test.tsx  [NEW]
├ HousingRegisterFieldBadge.test.tsx    [NEW] アニメ + state 遷移
└ api-tweet-meta.test.ts                [NEW] route handler ユニット
```

### 6.2 修正ファイル

- `src/data/masterData.ts`: LavenderBeds.aliases に「葉脈」 追加 (他、 必要に応じて)
- `src/styles/housing.css`: フィールドバッジ・チェックアニメの CSS class 追加
- `docs/TODO.md`: 現状更新、 完了タスク移動

### 6.3 既存テストの復活

- [`src/__tests__/housing/HousingRegisterAddressFields.test.tsx`] の `it.skip` 2 件を本 Phase で復活

---

## 7. エラーハンドリング

### 7.1 取得失敗時の UI

| エラー | UI 挙動 |
|---|---|
| 不正 URL (X URL でない) | URL 欄の下に赤テキスト「X (旧 Twitter) のツイート URL を貼ってください」、 fetch しない |
| 404 (削除済 / 非公開) | スナックバー「このツイートは取得できません。 URL を確認するか、 手入力してください」 |
| 429 (レート制限) | スナックバー「アクセスが集中しています。 30 秒ほど待って再試行してください」 |
| 502/504 (上流エラー / タイムアウト) | スナックバー「ツイートの取得に失敗しました。 再試行してください」 + URL 欄に「再取得」 ボタン |
| 抽出ゼロ (取得は成功、 抽出失敗) | ツイートプレビューは表示。 「自動取り込みできませんでした。 ツイート本文を見ながら手入力してください」 |

### 7.2 ネットワーク失敗

`fetch` 自体が失敗 (ブラウザがオフライン等) した場合は「ネットワークエラー」 メッセージ + 再取得ボタン。

### 7.3 取得中の操作競合

取得中にユーザーが URL を変えた / モーダルを閉じた / 別の項目を入力した:
- `AbortController` で fetch を cancel
- モーダル閉じる時は state クリーンアップ

---

## 8. テスト戦略

### 8.1 ユニット (vitest)

#### `parseHousingFromText.test.ts`

実サンプル 4 件:

1. `Mana\nAnima\nShirogane | 6-6 | Small | Commission` → DC=Mana, server=Anima, area=Shirogane, ward=6, plot=6, size=S
2. `完成しました！...\nMateria\nBismarck\nLavender Beds | 23-6 | Large` → DC=Materia, server=Bismarck, area=LavenderBeds, ward=23, plot=6, size=L
3. `Mana┆Hades┆⚐Gob 2-23 S` → DC=Mana, server=Hades, area=Goblet, ward=2, plot=23, size=S
4. `【住所】\nMana-Ixionエンピ-4-2M ※見学の際は...` → DC=Mana, server=Ixion, area=Empyreum, ward=4, plot=2, size=M

エッジケース:

- 区切り文字なし: `シロガネ6番地6番に来てねManaのAnimaサーバーです` → area=Shirogane, dc=Mana, server=Anima, ward=6, plot=6
- 鯖俗語: `アニマ鯖のシロガネ6-6` → server=Anima, dc=Mana, area=Shirogane, ward=6, plot=6
- DC のみ書いてサーバー無し: `MetaシロガネSimple` → 部分抽出、 サーバー欄は空
- 矛盾入力: `Mana ... Bismarck` (Bismarck は Materia DC) → ambiguity 記録、 抽出棄却
- 範囲外番地: `シロガネ 99-99 L` → 範囲外、 wardPlot 抽出せず
- 個室キーワード: `Lavender 12-3 FC個室 (12号室)` → size=PrivateRoom, area=LavenderBeds, ward=12, plot=3
- アパート名: `トップマスト 1号室` → area=Mist, size=Apartment
- ハッシュタグ完全自由文: `家完成しました〜！ #FF14ハウジング` → 抽出ゼロ
- 数字混入飾り: `Mana / Anima / Shirogane | 6 - 6 | M` (スペース広め) → 正常抽出

#### `tweetUrlParse.test.ts`

- `https://x.com/user/status/123` → id=123
- `https://twitter.com/user/status/123` → id=123
- `https://x.com/user/status/123?s=20` → id=123
- `https://x.com/user/status/123?ref_src=...&ref_url=...` → id=123
- `https://x.com/user` → invalid
- `https://example.com/123` → invalid

#### `api-tweet-meta.test.ts`

- 正常な id → 200 + { text, author, photos, video }
- 数字でない id → 400
- 21 桁 id → 400
- syndication が 404 → 404
- syndication が 500 → 502
- syndication タイムアウト → 504

### 8.2 コンポーネント (vitest + Testing Library)

- `HousingRegisterModal.test.tsx`: 全フロー
  - URL ペースト → 取得中スピナー → 完了 → タイピングアニメ (即時完了モードで) → 各フィールドに値入る → ✅ ボタン押下 → 登録ボタン有効化 → 登録 → 閉じる
  - キャンセル時の state cleanup
  - エラー時のメッセージ表示
- `HousingRegisterFieldBadge.test.tsx`: state 遷移とアニメ class 付与
- `HousingRegisterTypeSelector.test.tsx`: チップクリック → 追加欄表示切替

### 8.3 E2E (Playwright)

本 Phase 範囲では**先送り**。 vitest コンポーネントテストで実用上十分。

### 8.4 既存テストの拡張 / 復活

- `HousingRegisterAddressFields.test.tsx` の `it.skip` 2 件を復活

---

## 9. インフラ計画 (将来 Cloudflare 移行への布石)

### 9.1 現状

- Vercel + Next.js (Hobby plan)
- 関数枠 10/12 → 本 spec 実装で **11/12** (Edge Function 1 つ追加)
- 動画背景の帯域消費が増えると Vercel 帯域制限 (100GB/月) に当たる懸念

### 9.2 段階移行プラン

| 段階 | 時期 | 内容 | コスト |
|---|---|---|---|
| 1 | 今 | LoPo は Vercel 維持、 自動推定実装 (`/api/tweet-meta`) | $0 |
| 2 | Phase 2 完了後 | Cloudflare 前段化 (DNS 切替のみ、 30 分作業) | $0 |
| 3 | Phase 3 着手前 | LoPo を Cloudflare Pages 全面移行、 Functions 移植 | $0 (Free 枠) |
| 4 | ツアー本実装時 | Durable Objects でリアルタイム同期、 Workers Paid plan | $5/月 |

### 9.3 `/api/tweet-meta` の互換性

Vercel Edge Function と Cloudflare Pages Function はほぼ同じ Web 標準 API (Fetch, Request, Response)。 移行時は import / config 変更のみで本体ロジックは変えない。 Allmarks の `tweet-meta.ts` と命名・仕様を揃えておくことで、 後で統合する選択肢も残す。

---

## 10. 既存 spec / TODO との関係

### 10.1 オーバーライド対象

- `2026-05-18-housing-room-types-design.md` §4.1 (登録モーダル UI) → **本 spec が新版**
- 同 §6.3 (SNS URL 自動補完の概要記述) → **本 spec が実装仕様**

### 10.2 前提

- Phase 1 schema (subdivision/ownerType 削除 + plot 1-60) が main にマージ済 (commit 2322382)
- masterData.ts は本 spec 実装中に LavenderBeds.aliases に「葉脈」 を追加

### 10.3 後続フェーズで対応

- マップクリック登録 (Phase 2B): マップ Figma 書き起こし + 30 軒位置データが揃ったら本モーダルに**入口を追加** (登録モーダル本体は再利用)
- マップ確認モーダル (Phase 3): 最終確認モーダル §3 step 5 を「マップ上で地点表示」 に置き換え
- 写真アップロード (Phase 後続): 物件画像を手動アップロード、 ツイート添付画像は使わない (UGC 著作権)
- ツアーリアルタイム同期 (Phase 3): Cloudflare Durable Objects 必須、 別 spec

---

## 11. 段階リリースとマイルストーン

### 11.1 本 spec の実装スコープ (Phase 2A)

- 登録モーダル UI 全部 (動画背景上の glass panel、 タイプチップ、 アニメ全部入れ)
- SNS URL 自動推定 (定番フォーマット + 辞書ベストエフォート)
- フィールドバッジ + ✅ チェック + 登録ボタン制御
- ツイートプレビュー
- エラーハンドリング
- vitest テスト (ユニット + コンポーネント)
- masterData.ts に「葉脈」 alias 追加

### 11.2 本 spec の対象外 (= Phase 2B 以降)

- マップクリックでの登録 (マップ本実装が前提、 Phase 2B)
- マップ上での最終確認モーダル (Phase 3)
- 写真の自動取り込み (UGC 規約整備が前提)
- リアルタイムツアー同期 (Cloudflare 移行が前提、 Phase 3)
- 鯖以外の俗語拡充 (発見次第追加、 継続改善)

---

## 12. リスク / 既知の未確定

### 12.1 syndication CDN の非公式性

- `cdn.syndication.twimg.com` は非公式 API、 react-tweet (Vercel 公式) が使っているため壊れる確率は低いが**ゼロではない**
- 壊れた場合: 自動推定機能だけ無効化、 手入力は引き続き可能
- 監視: 取得失敗率が継続的に高くなったら気付けるよう、 Sentry 等のエラートラッキングを将来検討

### 12.2 抽出精度の継続改善

- 実運用後にユーザーが投稿するツイートを蓄積し、 抽出失敗ケースを分析
- 必要に応じて masterData.ts に alias 追加 (例: 別の俗称、 タイポ許容など)
- 抽出ロジックの分岐追加 (例: 新しいフォーマットパターンが流行ったら regex 追加)

### 12.3 Vercel 関数枠

- 11/12 → 残 1 枠
- ハウジング Phase 2-3 で関数追加見込み: 少ない (マップは静的データ、 ツアー同期は Cloudflare 移行で吸収)
- それでも逼迫したら Cloudflare 前段化 → 移行を前倒し

### 12.4 アクセシビリティ

- `prefers-reduced-motion: reduce` でアニメ全停止 (タイピング含む)
- スクリーンリーダー: フィールドバッジは `aria-label` で「自動入力済み、 確認必要」 等を明示
- キーボード操作: ✅ ボタンは Tab + Enter で押せる、 タイプチップは矢印キーで切替

### 12.5 国際化 (i18n)

- UI テキスト約 25 キー × 4 言語 (ja/en/ko/zh) = 100 訳追加
- 例: `housing.register.snsUrl.label`、 `housing.register.fieldBadge.confirmTooltip`、 等
- 翻訳ファイル: `messages/ja.json` 他 (既存パターンに従う)
- 英語表示崩れチェックは実装中に随時確認 (`.claude/rules/i18n.md` に従う)

---

## 13. 受入基準 (実装完了の判定)

- [ ] 4 件の実サンプル全てで 100% 抽出成功 (parseHousingFromText.test.ts)
- [ ] 区切り文字なしツイート (`シロガネ6番地6番に来てねManaのAnimaサーバーです`) で 70% 以上抽出
- [ ] 取得失敗時に「再取得」 ボタンが表示され、 機能する
- [ ] 全フィールドが「編集 or ✅」 になるまで登録ボタンが disabled
- [ ] `prefers-reduced-motion` でアニメが無効化される
- [ ] 4 言語すべてで UI 表示が崩れない
- [ ] vitest 全 PASS、 既存 850 テスト + 新規追加分
- [ ] `npm run build` PASS (Vercel 厳密モード)
- [ ] 実機 (本人) で X URL を貼って登録できる
- [ ] HousingRegisterAddressFields.test.tsx の `it.skip` 2 件が復活して PASS

---

## 14. 改訂履歴

- 2026-05-19: 初版作成 (Claude + masaya-men ブレストセッション #36)
