# Housing 登録モーダル + SNS URL 自動推定 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング登録モーダルを新設し、 X (旧 Twitter) URL を貼ると本文から DC/サーバー/エリア/区-番地/サイズを自動推定してフォームに入力する機能を実装する。

**Architecture:** 抽出ロジックは純関数として `src/lib/housing/parseHousingFromText.ts` に独立。 Vercel Edge Function `/api/tweet-meta` で syndication CDN をプロキシ。 UI は `HousingRegisterModal` + 子コンポ群、 ハウジング独自トンマナ (黒ガラス + ハニーゴールド + 動画背景) に準拠。 フィールドごとに自動入力バッジ + ✅ チェックボタンを置き、 全フィールド「編集 or 確認済み」 にならないと登録ボタンが押せない安全設計。

**Tech Stack:** TypeScript / Next.js 15 (App Router) / React 19 / vitest / Testing Library / Tailwind v4 / Firestore / Vercel Edge Functions

**前提:**
- Phase 1 schema 訂正 (subdivision/ownerType 削除 + plot 1-60) が main にマージ済 (commit 2322382)
- 設計書: `docs/superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md`
- masterData は `src/data/masterData.ts` 既存

**実装規約:**
- ハウジング独自トンマナ (`.claude/rules/housing-design.md`) 厳守: token 経由・ハードコード禁止・`docs/.private/housing-tour-mockup/index.html` 準拠
- i18n キー経由 (`.claude/rules/i18n.md`)
- backdrop-filter は `--tw-backdrop-blur` 変数パターン
- Vercel 厳密モード: 未使用変数・型不足を必ずチェック (push 前に `npm run build && npx vitest run`)
- public repo: シークレット / Firebase UID / メアド絶対書かない

---

## Task 1: tweetUrlParse.ts (X URL → Tweet ID 抽出)

**Files:**
- Create: `src/lib/housing/tweetUrlParse.ts`
- Test: `src/__tests__/housing/tweetUrlParse.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/tweetUrlParse.test.ts
import { describe, it, expect } from 'vitest';
import { parseTweetUrl } from '../../lib/housing/tweetUrlParse';

describe('parseTweetUrl', () => {
  it('extracts tweet id from x.com URL', () => {
    expect(parseTweetUrl('https://x.com/user/status/1842217368673759498')).toBe('1842217368673759498');
  });

  it('extracts tweet id from twitter.com URL', () => {
    expect(parseTweetUrl('https://twitter.com/user/status/1842217368673759498')).toBe('1842217368673759498');
  });

  it('handles query parameters (?s=20)', () => {
    expect(parseTweetUrl('https://x.com/user/status/1842217368673759498?s=20')).toBe('1842217368673759498');
  });

  it('handles long ref_url chains', () => {
    expect(
      parseTweetUrl(
        'https://x.com/men_masaya/status/1842217368673759498?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed&ref_url=https%3A%2F%2Fff14eden.work%2F',
      ),
    ).toBe('1842217368673759498');
  });

  it('returns null for non-tweet URL', () => {
    expect(parseTweetUrl('https://x.com/men_masaya')).toBeNull();
    expect(parseTweetUrl('https://example.com/status/123')).toBeNull();
    expect(parseTweetUrl('not a url')).toBeNull();
    expect(parseTweetUrl('')).toBeNull();
  });

  it('rejects malformed tweet id (non-numeric)', () => {
    expect(parseTweetUrl('https://x.com/user/status/abc')).toBeNull();
  });

  it('rejects tweet id longer than 20 digits', () => {
    expect(parseTweetUrl('https://x.com/user/status/123456789012345678901')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/tweetUrlParse.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: 最小実装**

```typescript
// src/lib/housing/tweetUrlParse.ts
const TWEET_URL_REGEX = /^https?:\/\/(?:x|twitter)\.com\/[\w-]+\/status\/(\d{1,20})(?:[/?#]|$)/i;

export function parseTweetUrl(input: string): string | null {
  if (!input) return null;
  const m = input.trim().match(TWEET_URL_REGEX);
  return m ? m[1] : null;
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/tweetUrlParse.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/tweetUrlParse.ts src/__tests__/housing/tweetUrlParse.test.ts
rtk git commit -m "feat(housing): X URL から tweet ID を抽出する純関数を追加"
```

---

## Task 2: parseHousingFromText.ts 骨格 (前処理 + 結果型 + 定番フォーマット)

**Files:**
- Create: `src/lib/housing/parseHousingFromText.ts`
- Test: `src/__tests__/housing/parseHousingFromText.test.ts`

- [ ] **Step 1: 失敗するテストを書く (定番フォーマット 2 サンプル)**

```typescript
// src/__tests__/housing/parseHousingFromText.test.ts
import { describe, it, expect } from 'vitest';
import { parseHousingFromText } from '../../lib/housing/parseHousingFromText';

describe('parseHousingFromText - 定番フォーマット', () => {
  it('sample 1: Mana/Anima/Shirogane 6-6 Small', () => {
    const text = `Mana
Anima
Shirogane | 6-6 | Small | Commission

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
    const result = parseHousingFromText(text);
    expect(result.dc).toBe('Mana');
    expect(result.server).toBe('Anima');
    expect(result.area).toBe('Shirogane');
    expect(result.ward).toBe(6);
    expect(result.plot).toBe(6);
    expect(result.size).toBe('S');
  });

  it('sample 2: Materia/Bismarck/LavenderBeds 23-6 Large with prefix message', () => {
    const text = `完成しました！見にきてください！！！
ありがとうございます！

Materia
Bismarck
Lavender Beds | 23-6 | Large

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
    const result = parseHousingFromText(text);
    expect(result.dc).toBe('Materia');
    expect(result.server).toBe('Bismarck');
    expect(result.area).toBe('LavenderBeds');
    expect(result.ward).toBe(23);
    expect(result.plot).toBe(6);
    expect(result.size).toBe('L');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: FAIL.

- [ ] **Step 3: 骨格実装 (前処理 + 辞書照合の最小形)**

```typescript
// src/lib/housing/parseHousingFromText.ts
import { serverMasterData, housingAreaMasterData, housingSizeMasterData } from '../../data/masterData';

export type HousingExtractSize = 'S' | 'M' | 'L' | 'Apartment' | 'PrivateRoom';

export type HousingExtractResult = {
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  plot?: number;
  size?: HousingExtractSize;
  roomNumber?: number;
  parentHouseSize?: 'S' | 'M' | 'L';
  ambiguity: string[];
};

const PRIVATE_ROOM_KEYWORDS = /FC個室|個室|Private\s*Room|FC\s*Chamber|FC部屋/i;

const SEPARATORS = /[\|┆\-/\s\n、。（）「」『』"',，]|鯖|サバ|さば|サーバー|サーバ|Server|server|Serv|Srv/g;

function preprocess(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/[⚐-⚑⌀-⏿]/gu, ' ');
}

function normalizeSizeAlias(token: string): HousingExtractSize | null {
  const lower = token.toLowerCase();
  for (const sizeData of housingSizeMasterData) {
    if (sizeData.aliases.some((a) => a.toLowerCase() === lower)) {
      return sizeData.id as HousingExtractSize;
    }
  }
  return null;
}

export function parseHousingFromText(text: string): HousingExtractResult {
  const cleaned = preprocess(text);
  const ambiguity: string[] = [];

  const candidates = {
    dc: [] as string[],
    server: [] as Array<{ serverId: string; dcId: string }>,
    area: [] as string[],
    size: [] as HousingExtractSize[],
  };

  const tokens = cleaned.split(SEPARATORS).map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // DC 候補
    for (const [dcId, dcData] of Object.entries(serverMasterData)) {
      if (dcData.aliases.some((a) => a.toLowerCase() === lower)) {
        if (!candidates.dc.includes(dcId)) candidates.dc.push(dcId);
      }
      // サーバー候補 (兼 DC 推論)
      for (const [serverId, aliases] of Object.entries(dcData.servers)) {
        if (aliases.some((a) => a.toLowerCase() === lower)) {
          if (!candidates.server.some((s) => s.serverId === serverId)) {
            candidates.server.push({ serverId, dcId });
          }
        }
      }
    }

    // エリア候補
    for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
      if (areaData.aliases.some((a) => a.toLowerCase() === lower)) {
        if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
      }
      // アパート名検出 → エリア + サイズ=Apartment
      if (token === areaData.apartment_name) {
        if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
        if (!candidates.size.includes('Apartment')) candidates.size.push('Apartment');
      }
    }

    // サイズ候補
    const size = normalizeSizeAlias(token);
    if (size && !candidates.size.includes(size)) {
      candidates.size.push(size);
    }
  }

  // 数字パターン: 区-番地
  const wardPlotMatch = cleaned.match(/(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/);
  let ward: number | undefined;
  let plot: number | undefined;
  if (wardPlotMatch) {
    const w = +wardPlotMatch[1];
    const p = +wardPlotMatch[2];
    if (w >= 1 && w <= 30 && p >= 1 && p <= 60) {
      ward = w;
      plot = p;
    }
  }

  // 番地末尾サイズ連結 (例: "4-2M")
  const wardPlotSizeMatch = cleaned.match(/(\d{1,2})\s*[-－‐ー]\s*(\d{1,2})\s*([SMLA])\b/i);
  if (wardPlotSizeMatch && candidates.size.length === 0) {
    const sizeChar = wardPlotSizeMatch[3].toUpperCase();
    if (sizeChar === 'A') candidates.size.push('Apartment');
    else if (sizeChar === 'S') candidates.size.push('S');
    else if (sizeChar === 'M') candidates.size.push('M');
    else if (sizeChar === 'L') candidates.size.push('L');
  }

  // 個室キーワード
  if (PRIVATE_ROOM_KEYWORDS.test(text)) {
    candidates.size.unshift('PrivateRoom');
  }

  // サーバー → DC 逆引き
  let dc = candidates.dc[0];
  let server = candidates.server[0];
  if (!dc && server) {
    dc = server.dcId;
  }
  // DC とサーバーの矛盾チェック
  if (dc && server && server.dcId !== dc) {
    ambiguity.push('dcServerMismatch');
    dc = undefined;
    server = undefined;
  }
  // 複数 DC が検出された場合は曖昧で棄却
  if (candidates.dc.length > 1) {
    ambiguity.push('multipleDc');
    dc = undefined;
    server = undefined;
  }

  return {
    dc,
    server: server?.serverId,
    area: candidates.area[0],
    ward,
    plot,
    size: candidates.size[0],
    ambiguity,
  };
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/parseHousingFromText.ts src/__tests__/housing/parseHousingFromText.test.ts
rtk git commit -m "feat(housing): 定番フォーマットのツイートから住所情報を抽出する純関数を追加"
```

---

## Task 3: parseHousingFromText - 略称・俗語・自由文の追加テスト

**Files:**
- Modify: `src/__tests__/housing/parseHousingFromText.test.ts`
- (修正の必要があれば) Modify: `src/lib/housing/parseHousingFromText.ts`

- [ ] **Step 1: 残り 2 サンプル + エッジケースのテストを追加**

`src/__tests__/housing/parseHousingFromText.test.ts` の末尾に追加:

```typescript
describe('parseHousingFromText - 略称・俗語', () => {
  it('sample 3: Mana┆Hades┆⚐Gob 2-23 S (Unicode 縦線 + 飾り + 略称)', () => {
    const result = parseHousingFromText('Mana┆Hades┆⚐Gob 2-23 S');
    expect(result.dc).toBe('Mana');
    expect(result.server).toBe('Hades');
    expect(result.area).toBe('Goblet');
    expect(result.ward).toBe(2);
    expect(result.plot).toBe(23);
    expect(result.size).toBe('S');
  });

  it('sample 4: Mana-Ixionエンピ-4-2M (ハイフン連結 + 略称)', () => {
    const text = `【住所】
Mana-Ixionエンピ-4-2M

※見学の際はFCハウスのためご迷惑にならないように配慮をお願いいたします。`;
    const result = parseHousingFromText(text);
    expect(result.dc).toBe('Mana');
    expect(result.server).toBe('Ixion');
    expect(result.area).toBe('Empyreum');
    expect(result.ward).toBe(4);
    expect(result.plot).toBe(2);
    expect(result.size).toBe('M');
  });

  it('区切り文字なしの自由文', () => {
    const result = parseHousingFromText('シロガネ6番地6番に来てねManaのAnimaサーバーです');
    expect(result.area).toBe('Shirogane');
    expect(result.dc).toBe('Mana');
    expect(result.server).toBe('Anima');
    expect(result.ward).toBe(6);
    expect(result.plot).toBe(6);
  });

  it('鯖俗語 (Anima鯖)', () => {
    const result = parseHousingFromText('アニマ鯖のシロガネ6-6');
    expect(result.server).toBe('Anima');
    expect(result.dc).toBe('Mana');
    expect(result.area).toBe('Shirogane');
    expect(result.ward).toBe(6);
    expect(result.plot).toBe(6);
  });

  it('FC個室キーワード検出', () => {
    const result = parseHousingFromText('Lavender Beds 12-3 FC個室');
    expect(result.size).toBe('PrivateRoom');
    expect(result.area).toBe('LavenderBeds');
    expect(result.ward).toBe(12);
    expect(result.plot).toBe(3);
  });

  it('アパート名検出 (トップマスト)', () => {
    const result = parseHousingFromText('Mana / Anima / トップマスト');
    expect(result.area).toBe('Mist');
    expect(result.size).toBe('Apartment');
  });
});

describe('parseHousingFromText - 棄却ケース', () => {
  it('完全自由文 (語句なし) は抽出ゼロ', () => {
    const result = parseHousingFromText('家完成しました〜！ 来てね');
    expect(result.dc).toBeUndefined();
    expect(result.server).toBeUndefined();
    expect(result.area).toBeUndefined();
    expect(result.ward).toBeUndefined();
    expect(result.size).toBeUndefined();
  });

  it('範囲外番地は棄却 (99-99)', () => {
    const result = parseHousingFromText('シロガネ 99-99 L');
    expect(result.ward).toBeUndefined();
    expect(result.plot).toBeUndefined();
    expect(result.area).toBe('Shirogane');
    expect(result.size).toBe('L');
  });

  it('DC とサーバーの矛盾 (Mana + Bismarck) で棄却', () => {
    const result = parseHousingFromText('Mana Bismarck シロガネ 6-6 S');
    expect(result.ambiguity).toContain('dcServerMismatch');
    expect(result.dc).toBeUndefined();
    expect(result.server).toBeUndefined();
    expect(result.area).toBe('Shirogane');
  });
});
```

- [ ] **Step 2: テスト実行 (失敗を確認)**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: いくつか PASS、 いくつか FAIL。 自由文・FC個室・棄却ケースが落ちる可能性大。

- [ ] **Step 3: 自由文対応 (substring search を追加)**

「区切り文字なしの自由文」 でテストが失敗する場合、 token split だけでは「シロガネ6番地6番に来てねManaのAnimaサーバーです」 を拾えない。 substring search を追加:

`src/lib/housing/parseHousingFromText.ts` の `parseHousingFromText` 関数内、 トークンループの後、 数字パターン抽出の前に以下を挿入:

```typescript
// substring search (区切り文字なしの自由文対応)
const lowerCleaned = cleaned.toLowerCase();
for (const [dcId, dcData] of Object.entries(serverMasterData)) {
  for (const alias of dcData.aliases) {
    if (lowerCleaned.includes(alias.toLowerCase())) {
      if (!candidates.dc.includes(dcId)) candidates.dc.push(dcId);
    }
  }
  for (const [serverId, aliases] of Object.entries(dcData.servers)) {
    for (const alias of aliases) {
      if (alias.length < 3) continue; // 短すぎる alias は誤一致リスク高
      if (lowerCleaned.includes(alias.toLowerCase())) {
        if (!candidates.server.some((s) => s.serverId === serverId)) {
          candidates.server.push({ serverId, dcId });
        }
      }
    }
  }
}
for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
  for (const alias of areaData.aliases) {
    if (alias.length < 2) continue;
    if (lowerCleaned.includes(alias.toLowerCase())) {
      if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
    }
  }
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: PASS (全 11 tests).

落ちるテストがあれば、 該当ケースを 1 つずつデバッグして対応。 例えば「鯖俗語」 が落ちるなら SEPARATORS の正規表現順序 / token split 順を確認。

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/parseHousingFromText.ts src/__tests__/housing/parseHousingFromText.test.ts
rtk git commit -m "feat(housing): 略称・俗語・自由文・棄却ケースに対応"
```

---

## Task 4: masterData.ts に「葉脈」 alias 追加

**Files:**
- Modify: `src/data/masterData.ts`
- Test: `src/__tests__/housing/parseHousingFromText.test.ts` (テスト追加)

- [ ] **Step 1: 葉脈 alias のテスト追加**

`src/__tests__/housing/parseHousingFromText.test.ts` 末尾に追加:

```typescript
describe('parseHousingFromText - 俗称 alias', () => {
  it('葉脈 → LavenderBeds', () => {
    const result = parseHousingFromText('葉脈 12-3 M');
    expect(result.area).toBe('LavenderBeds');
    expect(result.ward).toBe(12);
    expect(result.plot).toBe(3);
    expect(result.size).toBe('M');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: 新規追加テスト FAIL (area が undefined になる).

- [ ] **Step 3: masterData.ts の LavenderBeds.aliases に追加**

`src/data/masterData.ts` の LavenderBeds エントリ:

```typescript
  "LavenderBeds": {
    "name_jp": "ラベンダーベッド",
    "apartment_name": "リリーヒルズ",
    "aliases": ["ラベ", "ラベンダー", "森", "葉脈", "Lavender", "Lavender Beds", "Lav", "LB", "Lily Hills", "リリーヒルズ"]
  },
```

(変更点: 配列に `"葉脈"` を追加)

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/parseHousingFromText.test.ts`
Expected: PASS (全 12 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/data/masterData.ts src/__tests__/housing/parseHousingFromText.test.ts
rtk git commit -m "feat(housing): LavenderBeds の alias に「葉脈」 を追加"
```

---

## Task 5: /api/tweet-meta route.ts (Vercel Edge Function)

**Files:**
- Create: `src/app/api/tweet-meta/route.ts`
- Test: `src/__tests__/housing/api-tweet-meta.test.ts`

- [ ] **Step 1: 失敗するテストを書く (route handler ユニット)**

```typescript
// src/__tests__/housing/api-tweet-meta.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from '../../app/api/tweet-meta/route';

function makeReq(id: string | null): Request {
  const u = new URL('http://localhost/api/tweet-meta');
  if (id !== null) u.searchParams.set('id', id);
  return new Request(u);
}

describe('GET /api/tweet-meta', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns 400 for missing id', async () => {
    const res = await GET(makeReq(null) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await GET(makeReq('abc') as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for id longer than 20 digits', async () => {
    const res = await GET(makeReq('123456789012345678901') as never);
    expect(res.status).toBe(400);
  });

  it('returns syndication data on success', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          text: 'Mana\nAnima\nShirogane | 6-6 | Small',
          user: { name: 'Test User', screen_name: 'testuser' },
          photos: [{ url: 'https://pbs.twimg.com/a.jpg' }],
          video: { id: 'v1' },
        }),
        { status: 200 },
      ),
    );
    const res = await GET(makeReq('1842217368673759498') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain('Shirogane');
    expect(body.author.name).toBe('Test User');
    expect(body.author.screen_name).toBe('testuser');
    expect(body.photos).toEqual(['https://pbs.twimg.com/a.jpg']);
    expect(body.video).toBe(true);
  });

  it('returns 404 when syndication returns 404', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    const res = await GET(makeReq('1234567890') as never);
    expect(res.status).toBe(404);
  });

  it('returns 502 when syndication returns 500', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
    const res = await GET(makeReq('1234567890') as never);
    expect(res.status).toBe(502);
  });

  it('returns 504 on AbortError (timeout)', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
    );
    const res = await GET(makeReq('1234567890') as never);
    expect(res.status).toBe(504);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/api-tweet-meta.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: route handler 実装**

```typescript
// src/app/api/tweet-meta/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

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
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Tweet not found or private' }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json(
      {
        text: json.text ?? '',
        author: {
          name: json.user?.name ?? '',
          screen_name: json.user?.screen_name ?? '',
        },
        photos: Array.isArray(json.photos) ? json.photos.map((p: { url: string }) => p.url) : [],
        video: Boolean(json.video),
      },
      {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Upstream timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/api-tweet-meta.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/app/api/tweet-meta/route.ts src/__tests__/housing/api-tweet-meta.test.ts
rtk git commit -m "feat(housing): syndication CDN プロキシ Edge Function を追加"
```

---

## Task 6: housingFieldState.ts (フィールド状態管理 hook)

**Files:**
- Create: `src/lib/housing/housingFieldState.ts`
- Test: `src/__tests__/housing/housingFieldState.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/housingFieldState.test.ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHousingFieldState } from '../../lib/housing/housingFieldState';

describe('useHousingFieldState', () => {
  it('initial state is empty for all fields', () => {
    const { result } = renderHook(() => useHousingFieldState());
    expect(result.current.getState('dc')).toBe('empty');
  });

  it('setAutoFilled marks field as auto-filled', () => {
    const { result } = renderHook(() => useHousingFieldState());
    act(() => result.current.setAutoFilled('dc', 'Mana'));
    expect(result.current.getState('dc')).toBe('auto-filled');
    expect(result.current.getValue('dc')).toBe('Mana');
  });

  it('confirm transitions auto-filled → confirmed', () => {
    const { result } = renderHook(() => useHousingFieldState());
    act(() => result.current.setAutoFilled('dc', 'Mana'));
    act(() => result.current.confirm('dc'));
    expect(result.current.getState('dc')).toBe('confirmed');
  });

  it('userEdit transitions auto-filled → edited', () => {
    const { result } = renderHook(() => useHousingFieldState());
    act(() => result.current.setAutoFilled('dc', 'Mana'));
    act(() => result.current.userEdit('dc', 'Materia'));
    expect(result.current.getState('dc')).toBe('edited');
    expect(result.current.getValue('dc')).toBe('Materia');
  });

  it('isReadyToSubmit returns false when required field is empty', () => {
    const { result } = renderHook(() => useHousingFieldState(['dc', 'server']));
    expect(result.current.isReadyToSubmit()).toBe(false);
  });

  it('isReadyToSubmit returns true when all required fields are confirmed or edited', () => {
    const { result } = renderHook(() => useHousingFieldState(['dc']));
    act(() => result.current.setAutoFilled('dc', 'Mana'));
    expect(result.current.isReadyToSubmit()).toBe(false);
    act(() => result.current.confirm('dc'));
    expect(result.current.isReadyToSubmit()).toBe(true);
  });

  it('isReadyToSubmit returns false when any field is in error state', () => {
    const { result } = renderHook(() => useHousingFieldState(['dc']));
    act(() => result.current.userEdit('dc', 'Mana'));
    act(() => result.current.setError('dc', 'required'));
    expect(result.current.isReadyToSubmit()).toBe(false);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/housingFieldState.test.ts`
Expected: FAIL.

- [ ] **Step 3: hook 実装**

```typescript
// src/lib/housing/housingFieldState.ts
import { useCallback, useState } from 'react';

export type FieldState = 'empty' | 'auto-filled' | 'confirmed' | 'edited' | 'error';

type FieldEntry = {
  state: FieldState;
  value: unknown;
  errorMessage?: string;
};

type FieldMap = Record<string, FieldEntry>;

export function useHousingFieldState(requiredFields: string[] = []) {
  const [fields, setFields] = useState<FieldMap>({});

  const getState = useCallback(
    (name: string): FieldState => fields[name]?.state ?? 'empty',
    [fields],
  );

  const getValue = useCallback((name: string) => fields[name]?.value, [fields]);

  const getError = useCallback(
    (name: string) => fields[name]?.errorMessage,
    [fields],
  );

  const setAutoFilled = useCallback((name: string, value: unknown) => {
    setFields((prev) => ({
      ...prev,
      [name]: { state: 'auto-filled', value },
    }));
  }, []);

  const confirm = useCallback((name: string) => {
    setFields((prev) => {
      const cur = prev[name];
      if (!cur) return prev;
      return { ...prev, [name]: { ...cur, state: 'confirmed' } };
    });
  }, []);

  const userEdit = useCallback((name: string, value: unknown) => {
    setFields((prev) => ({
      ...prev,
      [name]: { state: 'edited', value },
    }));
  }, []);

  const setError = useCallback((name: string, errorMessage: string) => {
    setFields((prev) => ({
      ...prev,
      [name]: {
        state: 'error',
        value: prev[name]?.value,
        errorMessage,
      },
    }));
  }, []);

  const clearField = useCallback((name: string) => {
    setFields((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const isReadyToSubmit = useCallback(() => {
    for (const name of requiredFields) {
      const s = fields[name]?.state ?? 'empty';
      if (s === 'empty' || s === 'auto-filled' || s === 'error') {
        return false;
      }
    }
    for (const entry of Object.values(fields)) {
      if (entry.state === 'error') return false;
    }
    return true;
  }, [fields, requiredFields]);

  return {
    getState,
    getValue,
    getError,
    setAutoFilled,
    confirm,
    userEdit,
    setError,
    clearField,
    isReadyToSubmit,
  };
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/housingFieldState.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/housingFieldState.ts src/__tests__/housing/housingFieldState.test.ts
rtk git commit -m "feat(housing): フィールド状態管理 hook を追加"
```

---

## Task 7: housing.css にバッジ + ✅ チェックアニメ + スピナー の class 追加

**Files:**
- Modify: `src/styles/housing.css`

- [ ] **Step 1: 既存 housing.css のトークン定義箇所を確認**

Run: `grep -n "housing-workspace" src/styles/housing.css | head -5`
Expected: token 定義の冒頭ブロックを発見。

- [ ] **Step 2: トークンと class を追加**

`src/styles/housing.css` の `.housing-workspace` トークンブロック末尾に追加:

```css
/* === register modal field tokens === */
--housing-field-bg-auto: rgba(255, 201, 135, 0.16);    /* 黄色背景: ハニーゴールド薄め */
--housing-field-bg-confirmed: rgba(120, 200, 130, 0.18); /* 緑背景: 確認済み */
--housing-field-bg-error: rgba(255, 90, 90, 0.16);
--housing-field-border-auto: rgba(255, 201, 135, 0.6);
--housing-field-border-confirmed: rgba(120, 200, 130, 0.6);
--housing-field-border-error: rgba(255, 90, 90, 0.7);
--housing-badge-glow: 0 0 12px rgba(255, 201, 135, 0.7);

/* === badge + check button animation === */
.housing-field-badge {
  position: absolute;
  top: var(--housing-spacing-xs);
  right: calc(var(--housing-spacing-xs) + 32px);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--housing-honey);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  pointer-events: none;
}

.housing-confirm-button {
  position: absolute;
  top: var(--housing-spacing-xs);
  right: var(--housing-spacing-xs);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 201, 135, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease-in, transform 120ms ease-in, box-shadow 120ms ease-in;
}

.housing-confirm-button:hover {
  background: rgba(255, 201, 135, 0.18);
  box-shadow: var(--housing-badge-glow);
}

.housing-confirm-button:active {
  transform: scale(0.92);
}

.housing-confirm-button svg path {
  stroke: var(--housing-honey);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

/* チェック描画アニメ (bounce + path draw + ripple + glow) */
@keyframes housing-check-bounce {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.3); }
  60%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

@keyframes housing-check-draw {
  from { stroke-dashoffset: 24; }
  to   { stroke-dashoffset: 0; }
}

@keyframes housing-check-ripple {
  0%   { transform: scale(0.6); opacity: 0.55; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes housing-check-glow {
  0%   { box-shadow: 0 0 0 rgba(255, 201, 135, 0); }
  40%  { box-shadow: 0 0 24px rgba(255, 201, 135, 0.85); }
  100% { box-shadow: 0 0 0 rgba(255, 201, 135, 0); }
}

.housing-confirm-button[data-animating="true"] {
  animation: housing-check-bounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1), housing-check-glow 300ms ease-in-out;
}

.housing-confirm-button[data-animating="true"] svg path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: housing-check-draw 200ms ease-out 60ms forwards;
}

.housing-confirm-button[data-animating="true"]::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--housing-honey);
  animation: housing-check-ripple 600ms ease-out;
  pointer-events: none;
}

/* フィールド state class (背景遷移) */
.housing-field {
  position: relative;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: background 300ms ease-out, border-color 300ms ease-out;
}

.housing-field[data-state="auto-filled"] {
  background: var(--housing-field-bg-auto);
  border-color: var(--housing-field-border-auto);
}

.housing-field[data-state="confirmed"] {
  background: var(--housing-field-bg-confirmed);
  border-color: var(--housing-field-border-confirmed);
}

.housing-field[data-state="error"] {
  background: var(--housing-field-bg-error);
  border-color: var(--housing-field-border-error);
}

/* タイピングアニメのカーソル */
@keyframes housing-typing-cursor {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.housing-typing-cursor {
  display: inline-block;
  width: 1px;
  background: var(--housing-honey);
  animation: housing-typing-cursor 530ms steps(2) infinite;
}

/* ローディングスピナー (リキッドグラス調円形) */
@keyframes housing-spinner-rotate {
  to { transform: rotate(360deg); }
}

.housing-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 201, 135, 0.18);
  border-top-color: var(--housing-honey);
  animation: housing-spinner-rotate 1.2s linear infinite;
}

.housing-fetch-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

/* タイプチップ連動アニメ (下からスライドイン / 上にスライドアウト) */
@keyframes housing-field-slide-in {
  from { opacity: 0; transform: translateY(8px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0); max-height: 400px; }
}

@keyframes housing-field-slide-out {
  from { opacity: 1; transform: translateY(0); max-height: 400px; }
  to   { opacity: 0; transform: translateY(-8px); max-height: 0; }
}

.housing-conditional-field {
  overflow: hidden;
  animation: housing-field-slide-in 300ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}

.housing-conditional-field[data-exiting="true"] {
  animation: housing-field-slide-out 200ms ease-in forwards;
}

/* prefers-reduced-motion 対応 */
@media (prefers-reduced-motion: reduce) {
  .housing-confirm-button,
  .housing-confirm-button[data-animating="true"],
  .housing-confirm-button[data-animating="true"] svg path,
  .housing-confirm-button[data-animating="true"]::after,
  .housing-field,
  .housing-typing-cursor {
    animation: none !important;
    transition: none !important;
  }
}
```

注意: 上記の token 名 (`--housing-honey`, `--housing-spacing-xs` 等) は既存 housing.css にあるはずなので grep で確認。 ない場合は適切な既存 token に書き換える。

- [ ] **Step 3: token 名の確認と修正**

Run: `grep -n "housing-honey\|housing-spacing-xs\|housing-glass" src/styles/housing.css | head -20`
Expected: 既存 token が見つかる。 見つからないトークンは housing.css の冒頭で定義されている近い token (例: `--housing-color-accent`) に置き換え。

- [ ] **Step 4: ビルド + Lint 確認**

Run: `npx tsc --noEmit && npm run lint 2>&1 | head -30`
Expected: エラーなし (CSS は型チェック対象外だが、 周辺ファイルへの影響がないか確認).

- [ ] **Step 5: コミット**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "feat(housing): 登録モーダルのフィールドバッジ + チェックアニメ用 CSS を追加"
```

---

## Task 8: HousingRegisterFieldBadge コンポーネント

**Files:**
- Create: `src/components/housing/register/HousingRegisterFieldBadge.tsx`
- Test: `src/__tests__/housing/HousingRegisterFieldBadge.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/HousingRegisterFieldBadge.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingRegisterFieldBadge } from '../../components/housing/register/HousingRegisterFieldBadge';

describe('HousingRegisterFieldBadge', () => {
  it('renders auto-filled badge when state is auto-filled', () => {
    render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={() => {}} />);
    expect(screen.getByTestId('housing-auto-badge')).toBeInTheDocument();
    expect(screen.getByTestId('housing-confirm-button')).toBeInTheDocument();
  });

  it('does NOT render badge when state is empty', () => {
    render(<HousingRegisterFieldBadge state="empty" onConfirm={() => {}} />);
    expect(screen.queryByTestId('housing-auto-badge')).not.toBeInTheDocument();
  });

  it('does NOT render badge when state is confirmed', () => {
    render(<HousingRegisterFieldBadge state="confirmed" onConfirm={() => {}} />);
    expect(screen.queryByTestId('housing-auto-badge')).not.toBeInTheDocument();
  });

  it('calls onConfirm when ✅ button clicked', () => {
    const onConfirm = vi.fn();
    render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('housing-confirm-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('sets data-animating=true when clicked', async () => {
    render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={() => {}} />);
    const button = screen.getByTestId('housing-confirm-button');
    fireEvent.click(button);
    expect(button.getAttribute('data-animating')).toBe('true');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterFieldBadge.test.tsx`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: コンポーネント実装**

```typescript
// src/components/housing/register/HousingRegisterFieldBadge.tsx
'use client';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldState } from '../../../lib/housing/housingFieldState';

type Props = {
  state: FieldState;
  onConfirm: () => void;
};

export function HousingRegisterFieldBadge({ state, onConfirm }: Props) {
  const t = useTranslations('housing.register.fieldBadge');
  const [animating, setAnimating] = useState(false);

  const handleClick = useCallback(() => {
    setAnimating(true);
    onConfirm();
    window.setTimeout(() => setAnimating(false), 700);
  }, [onConfirm]);

  if (state !== 'auto-filled') return null;

  return (
    <>
      <span
        data-testid="housing-auto-badge"
        className="housing-field-badge"
        aria-label={t('autoFilled')}
      >
        🟡
      </span>
      <button
        type="button"
        data-testid="housing-confirm-button"
        className="housing-confirm-button"
        data-animating={animating ? 'true' : 'false'}
        onClick={handleClick}
        aria-label={t('confirmAriaLabel')}
        title={t('confirmTooltip')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2.5 7 L6 10.5 L11.5 4" />
        </svg>
      </button>
    </>
  );
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterFieldBadge.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterFieldBadge.tsx src/__tests__/housing/HousingRegisterFieldBadge.test.tsx
rtk git commit -m "feat(housing): 自動入力バッジ + ✅ チェックボタンコンポーネントを追加"
```

---

## Task 9: i18n キー追加 (4 言語 30 キー)

**Files:**
- Modify: `messages/ja.json`, `messages/en.json`, `messages/ko.json`, `messages/zh.json`

- [ ] **Step 1: messages/ja.json の構造を確認**

Run: `grep -n '"register"' messages/ja.json | head -5`
Expected: 既存 `housing.register` セクションを発見 (Phase 1 で既に一部キーあり)。

- [ ] **Step 2: 4 言語に新規キーを追加**

各ファイルの `housing.register` セクションに以下を追加 (既存キーは維持):

**messages/ja.json**:
```json
"register": {
  "title": "家を登録",
  "snsUrl": {
    "label": "SNS URL（任意）",
    "placeholder": "https://x.com/.../status/...",
    "fetching": "ツイートを読み取り中…",
    "cancel": "取消",
    "retry": "再取得",
    "error": {
      "invalid": "X (旧 Twitter) のツイート URL を貼ってください",
      "notFound": "このツイートは取得できません。 URL を確認するか、 手入力してください",
      "rateLimit": "アクセスが集中しています。 30 秒ほど待って再試行してください",
      "upstream": "ツイートの取得に失敗しました。 再試行してください",
      "extractFailed": "自動取り込みできませんでした。 ツイート本文を見ながら手入力してください"
    }
  },
  "tweetPreview": {
    "title": "取得したツイート"
  },
  "fieldBadge": {
    "autoFilled": "自動入力済み",
    "confirmTooltip": "確認したらここを押してください",
    "confirmAriaLabel": "この値を確認する"
  },
  "fieldError": {
    "required": "必須項目です",
    "wardOutOfRange": "区は 1-30 で入力してください",
    "plotOutOfRange": "番地は 1-60 で入力してください (31 以上は拡張街)",
    "roomNumberApartmentOutOfRange": "部屋番号は 1-90 で入力してください",
    "roomNumberPrivateOutOfRange": "個室番号は 1-512 で入力してください"
  },
  "address": {
    "expansionWardNote": "31 以上は拡張街です"
  },
  "type": {
    "S": "Sハウス",
    "M": "Mハウス",
    "L": "Lハウス",
    "private": "FC個室",
    "apartment": "アパート"
  },
  "confirm": {
    "title": "登録内容の最終確認",
    "message": "以下の内容で登録します。 よろしいですか？",
    "submit": "確定して登録",
    "cancel": "戻る"
  },
  "submit": "登録する",
  "cancel": "キャンセル",
  "success": "ハウジング登録が完了しました"
}
```

**messages/en.json**:
```json
"register": {
  "title": "Register house",
  "snsUrl": {
    "label": "SNS URL (optional)",
    "placeholder": "https://x.com/.../status/...",
    "fetching": "Reading tweet…",
    "cancel": "Cancel",
    "retry": "Retry",
    "error": {
      "invalid": "Please paste an X (Twitter) tweet URL",
      "notFound": "This tweet cannot be fetched. Check the URL or enter manually",
      "rateLimit": "Too many requests. Please wait 30 seconds and try again",
      "upstream": "Failed to fetch tweet. Please retry",
      "extractFailed": "Could not auto-fill. Please enter the values manually while viewing the tweet"
    }
  },
  "tweetPreview": {
    "title": "Fetched tweet"
  },
  "fieldBadge": {
    "autoFilled": "Auto-filled",
    "confirmTooltip": "Click to confirm this value",
    "confirmAriaLabel": "Confirm this value"
  },
  "fieldError": {
    "required": "Required field",
    "wardOutOfRange": "Ward must be between 1 and 30",
    "plotOutOfRange": "Plot must be between 1 and 60 (31+ is the expansion district)",
    "roomNumberApartmentOutOfRange": "Apartment number must be between 1 and 90",
    "roomNumberPrivateOutOfRange": "Private room number must be between 1 and 512"
  },
  "address": {
    "expansionWardNote": "31 and above is the expansion district"
  },
  "type": {
    "S": "Small house",
    "M": "Medium house",
    "L": "Large house",
    "private": "FC private room",
    "apartment": "Apartment"
  },
  "confirm": {
    "title": "Final confirmation",
    "message": "Register with the following values?",
    "submit": "Register",
    "cancel": "Back"
  },
  "submit": "Register",
  "cancel": "Cancel",
  "success": "Housing registered successfully"
}
```

**messages/ko.json** の `housing.register` セクション (既存 ja.json の同キーを元訳に、 既存 ko.json の他セクションと敬語レベル・口調を揃える。 自動機械翻訳は禁止、 ハングル自然文を選ぶ):

```json
"register": {
  "title": "집 등록",
  "snsUrl": {
    "label": "SNS URL (선택)",
    "placeholder": "https://x.com/.../status/...",
    "fetching": "트윗을 읽는 중…",
    "cancel": "취소",
    "retry": "다시 가져오기",
    "error": {
      "invalid": "X (구 Twitter) 의 트윗 URL 을 붙여 넣어 주세요",
      "notFound": "이 트윗은 가져올 수 없습니다. URL 을 확인하거나 직접 입력해 주세요",
      "rateLimit": "요청이 많아 잠시 후 다시 시도해 주세요",
      "upstream": "트윗 가져오기에 실패했습니다. 다시 시도해 주세요",
      "extractFailed": "자동 입력에 실패했습니다. 트윗 본문을 보면서 직접 입력해 주세요"
    }
  },
  "tweetPreview": { "title": "가져온 트윗" },
  "fieldBadge": {
    "autoFilled": "자동 입력됨",
    "confirmTooltip": "확인했다면 눌러 주세요",
    "confirmAriaLabel": "이 값을 확인"
  },
  "fieldError": {
    "required": "필수 항목입니다",
    "wardOutOfRange": "구역은 1-30 사이로 입력해 주세요",
    "plotOutOfRange": "번지는 1-60 사이로 입력해 주세요 (31 이상은 확장 구역)",
    "roomNumberApartmentOutOfRange": "방 번호는 1-90 사이로 입력해 주세요",
    "roomNumberPrivateOutOfRange": "개인실 번호는 1-512 사이로 입력해 주세요"
  },
  "address": { "expansionWardNote": "31 이상은 확장 구역입니다" },
  "type": { "S": "소형 하우스", "M": "중형 하우스", "L": "대형 하우스", "private": "FC 개인실", "apartment": "아파트" },
  "confirm": { "title": "등록 내용 최종 확인", "message": "다음 내용으로 등록합니다. 괜찮으신가요?", "submit": "확정하여 등록", "cancel": "뒤로" },
  "submit": "등록하기",
  "cancel": "취소",
  "success": "하우징 등록이 완료되었습니다"
}
```

**messages/zh.json** の `housing.register` セクション (簡体字、 既存 zh.json の他セクションと口調を揃える、 機械翻訳禁止):

```json
"register": {
  "title": "登记房屋",
  "snsUrl": {
    "label": "社交账号链接 (可选)",
    "placeholder": "https://x.com/.../status/...",
    "fetching": "正在读取推文…",
    "cancel": "取消",
    "retry": "重新获取",
    "error": {
      "invalid": "请粘贴 X (原 Twitter) 的推文链接",
      "notFound": "无法获取此推文，请检查链接或手动输入",
      "rateLimit": "请求过多，请 30 秒后再试",
      "upstream": "获取推文失败，请重试",
      "extractFailed": "无法自动填入，请参照推文内容手动输入"
    }
  },
  "tweetPreview": { "title": "已获取的推文" },
  "fieldBadge": {
    "autoFilled": "已自动填入",
    "confirmTooltip": "确认后请点击此处",
    "confirmAriaLabel": "确认此值"
  },
  "fieldError": {
    "required": "必填项",
    "wardOutOfRange": "区号需在 1-30 之间",
    "plotOutOfRange": "门牌号需在 1-60 之间 (31 以上为扩展区)",
    "roomNumberApartmentOutOfRange": "公寓房号需在 1-90 之间",
    "roomNumberPrivateOutOfRange": "FC 个人房号需在 1-512 之间"
  },
  "address": { "expansionWardNote": "31 以上为扩展区" },
  "type": { "S": "小型房屋", "M": "中型房屋", "L": "大型房屋", "private": "FC 个人房", "apartment": "公寓" },
  "confirm": { "title": "登记内容最终确认", "message": "确认以下内容并登记吗？", "submit": "确认登记", "cancel": "返回" },
  "submit": "登记",
  "cancel": "取消",
  "success": "房屋登记完成"
}
```

- [ ] **Step 3: i18n 適用テスト (型と JSON 妥当性のみ)**

Run: `npx tsc --noEmit && npm run lint 2>&1 | head -20`
Expected: エラーなし。

- [ ] **Step 4: 既存 housing 機能で英語崩れ簡易チェック**

Run: `npx vitest run src/__tests__/housing/`
Expected: 既存テストすべて PASS (i18n キー追加で既存 fallback が壊れていないこと).

- [ ] **Step 5: コミット**

```bash
rtk git add messages/ja.json messages/en.json messages/ko.json messages/zh.json
rtk git commit -m "i18n(housing): 登録モーダル + 自動推定 UI の 4 言語訳を追加"
```

---

## Task 10: HousingRegisterSnsUrlField + Tweet 取得 hook

**Files:**
- Create: `src/components/housing/register/HousingRegisterSnsUrlField.tsx`
- Create: `src/lib/housing/useTweetFetch.ts`
- Test: `src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
- Test: `src/__tests__/housing/useTweetFetch.test.ts`

- [ ] **Step 1: useTweetFetch hook の失敗テスト**

```typescript
// src/__tests__/housing/useTweetFetch.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useTweetFetch } from '../../lib/housing/useTweetFetch';

describe('useTweetFetch', () => {
  beforeEach(() => mockFetch.mockReset());

  it('initial state is idle', () => {
    const { result } = renderHook(() => useTweetFetch());
    expect(result.current.status).toBe('idle');
  });

  it('fetch sets status to loading then success', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ text: 'hello', author: { name: 'A', screen_name: 'a' }, photos: [], video: false }),
        { status: 200 },
      ),
    );
    const { result } = renderHook(() => useTweetFetch());
    act(() => { result.current.fetchTweet('123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.text).toBe('hello');
  });

  it('handles 404 error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    const { result } = renderHook(() => useTweetFetch());
    act(() => { result.current.fetchTweet('123'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorCode).toBe('notFound');
  });

  it('cancel aborts in-flight request', async () => {
    let resolveFn: (r: Response) => void = () => {};
    mockFetch.mockImplementationOnce(
      () => new Promise<Response>((r) => { resolveFn = r; }),
    );
    const { result } = renderHook(() => useTweetFetch());
    act(() => { result.current.fetchTweet('123'); });
    act(() => { result.current.cancel(); });
    expect(result.current.status).toBe('idle');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/useTweetFetch.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: useTweetFetch hook 実装**

```typescript
// src/lib/housing/useTweetFetch.ts
import { useState, useCallback, useRef } from 'react';

export type TweetData = {
  text: string;
  author: { name: string; screen_name: string };
  photos: string[];
  video: boolean;
};

export type TweetFetchStatus = 'idle' | 'loading' | 'success' | 'error';
export type TweetFetchErrorCode =
  | 'invalid'
  | 'notFound'
  | 'rateLimit'
  | 'upstream'
  | 'network';

export function useTweetFetch() {
  const [status, setStatus] = useState<TweetFetchStatus>('idle');
  const [data, setData] = useState<TweetData | null>(null);
  const [errorCode, setErrorCode] = useState<TweetFetchErrorCode | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus('idle');
  }, []);

  const fetchTweet = useCallback(async (tweetId: string) => {
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setStatus('loading');
    setData(null);
    setErrorCode(null);
    try {
      const res = await fetch(`/api/tweet-meta?id=${encodeURIComponent(tweetId)}`, {
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (res.status === 404) {
        setErrorCode('notFound');
        setStatus('error');
        return;
      }
      if (res.status === 429) {
        setErrorCode('rateLimit');
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setErrorCode('upstream');
        setStatus('error');
        return;
      }
      const json = (await res.json()) as TweetData;
      setData(json);
      setStatus('success');
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return;
      setErrorCode('network');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setData(null);
    setErrorCode(null);
    setStatus('idle');
  }, [cancel]);

  return { status, data, errorCode, fetchTweet, cancel, reset };
}
```

- [ ] **Step 4: hook テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/useTweetFetch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: HousingRegisterSnsUrlField コンポーネントのテスト追加**

```typescript
// src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockFetchTweet = vi.fn();
vi.mock('../../lib/housing/useTweetFetch', () => ({
  useTweetFetch: () => ({
    status: 'idle',
    data: null,
    errorCode: null,
    fetchTweet: mockFetchTweet,
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { HousingRegisterSnsUrlField } from '../../components/housing/register/HousingRegisterSnsUrlField';

describe('HousingRegisterSnsUrlField', () => {
  it('renders input field with label', () => {
    render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
    expect(screen.getByLabelText(/SNS URL/i)).toBeInTheDocument();
  });

  it('triggers fetchTweet on valid X URL paste', () => {
    render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
    const input = screen.getByLabelText(/SNS URL/i);
    fireEvent.change(input, { target: { value: 'https://x.com/user/status/1842217368673759498' } });
    expect(mockFetchTweet).toHaveBeenCalledWith('1842217368673759498');
  });

  it('shows error for invalid URL', () => {
    render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
    const input = screen.getByLabelText(/SNS URL/i);
    fireEvent.change(input, { target: { value: 'https://example.com/foo' } });
    expect(screen.getByText(/ツイート URL/i)).toBeInTheDocument();
    expect(mockFetchTweet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
Expected: FAIL.

- [ ] **Step 7: HousingRegisterSnsUrlField 実装**

```typescript
// src/components/housing/register/HousingRegisterSnsUrlField.tsx
'use client';
import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { parseTweetUrl } from '../../../lib/housing/tweetUrlParse';
import { useTweetFetch, type TweetData } from '../../../lib/housing/useTweetFetch';

type Props = {
  onTweetFetched: (data: TweetData) => void;
};

export function HousingRegisterSnsUrlField({ onTweetFetched }: Props) {
  const t = useTranslations('housing.register.snsUrl');
  const [url, setUrl] = useState('');
  const [invalidUrl, setInvalidUrl] = useState(false);
  const { status, data, errorCode, fetchTweet, cancel, reset } = useTweetFetch();

  useEffect(() => {
    if (status === 'success' && data) {
      onTweetFetched(data);
    }
  }, [status, data, onTweetFetched]);

  const handleChange = useCallback((value: string) => {
    setUrl(value);
    if (!value.trim()) {
      setInvalidUrl(false);
      reset();
      return;
    }
    const id = parseTweetUrl(value);
    if (!id) {
      setInvalidUrl(true);
      return;
    }
    setInvalidUrl(false);
    fetchTweet(id);
  }, [fetchTweet, reset]);

  return (
    <div className="housing-register-sns-url-field">
      <label htmlFor="housing-sns-url" className="housing-label">{t('label')}</label>
      <input
        id="housing-sns-url"
        type="url"
        className="housing-input"
        placeholder={t('placeholder')}
        value={url}
        onChange={(e) => handleChange(e.target.value)}
      />
      {invalidUrl && <p className="housing-error-text">{t('error.invalid')}</p>}
      {status === 'loading' && (
        <div className="housing-fetch-indicator">
          <span className="housing-spinner" aria-hidden />
          <span>{t('fetching')}</span>
          <button type="button" onClick={cancel}>{t('cancel')}</button>
        </div>
      )}
      {status === 'error' && errorCode && (
        <div className="housing-error-block">
          <p className="housing-error-text">{t(`error.${errorCode}`)}</p>
          <button type="button" onClick={() => {
            const id = parseTweetUrl(url);
            if (id) fetchTweet(id);
          }}>{t('retry')}</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx src/__tests__/housing/useTweetFetch.test.ts`
Expected: PASS (全 7 tests).

- [ ] **Step 9: コミット**

```bash
rtk git add src/lib/housing/useTweetFetch.ts src/components/housing/register/HousingRegisterSnsUrlField.tsx src/__tests__/housing/useTweetFetch.test.ts src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx
rtk git commit -m "feat(housing): SNS URL 入力欄 + ツイート取得 hook を追加"
```

---

## Task 11: HousingRegisterTweetPreview コンポーネント

**Files:**
- Create: `src/components/housing/register/HousingRegisterTweetPreview.tsx`
- Test: `src/__tests__/housing/HousingRegisterTweetPreview.test.tsx`

- [ ] **Step 1: 失敗するテスト**

```typescript
// src/__tests__/housing/HousingRegisterTweetPreview.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HousingRegisterTweetPreview } from '../../components/housing/register/HousingRegisterTweetPreview';

const sample = {
  text: 'Mana\nAnima\nShirogane | 6-6 | Small',
  author: { name: 'Test User', screen_name: 'testuser' },
  photos: [],
  video: false,
};

describe('HousingRegisterTweetPreview', () => {
  it('renders tweet text', () => {
    render(<HousingRegisterTweetPreview data={sample} />);
    expect(screen.getByText(/Shirogane \| 6-6 \| Small/)).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(<HousingRegisterTweetPreview data={sample} />);
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
    expect(screen.getByText(/@testuser/)).toBeInTheDocument();
  });

  it('renders photos when present', () => {
    const withPhotos = { ...sample, photos: ['https://pbs.twimg.com/a.jpg'] };
    render(<HousingRegisterTweetPreview data={withPhotos} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://pbs.twimg.com/a.jpg');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTweetPreview.test.tsx`
Expected: FAIL.

- [ ] **Step 3: コンポーネント実装**

```typescript
// src/components/housing/register/HousingRegisterTweetPreview.tsx
'use client';
import { useTranslations } from 'next-intl';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

type Props = { data: TweetData };

export function HousingRegisterTweetPreview({ data }: Props) {
  const t = useTranslations('housing.register.tweetPreview');
  return (
    <section className="housing-tweet-preview" aria-label={t('title')}>
      <header className="housing-tweet-preview-header">
        <span className="housing-tweet-preview-title">{t('title')}</span>
        <span className="housing-tweet-preview-author">
          {data.author.name} <span className="housing-tweet-preview-handle">@{data.author.screen_name}</span>
        </span>
      </header>
      <p className="housing-tweet-preview-text">{data.text}</p>
      {data.photos.length > 0 && (
        <div className="housing-tweet-preview-photos">
          {data.photos.map((url) => (
            <img key={url} src={url} alt="" className="housing-tweet-preview-photo" />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTweetPreview.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterTweetPreview.tsx src/__tests__/housing/HousingRegisterTweetPreview.test.tsx
rtk git commit -m "feat(housing): ツイート本文プレビューコンポーネントを追加"
```

---

## Task 12: HousingRegisterTypeSelector + 動的フィールド (RoomNumber / ParentHouseSize)

**Files:**
- Create: `src/components/housing/register/HousingRegisterTypeSelector.tsx`
- Create: `src/components/housing/register/HousingRegisterRoomNumberField.tsx`
- Create: `src/components/housing/register/HousingRegisterParentHouseSizeField.tsx`
- Test: `src/__tests__/housing/HousingRegisterTypeSelector.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/HousingRegisterTypeSelector.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingRegisterTypeSelector } from '../../components/housing/register/HousingRegisterTypeSelector';

describe('HousingRegisterTypeSelector', () => {
  it('renders 5 chips', () => {
    render(<HousingRegisterTypeSelector value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Sハウス/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mハウス/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lハウス/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FC個室/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /アパート/ })).toBeInTheDocument();
  });

  it('calls onChange with size id when chip clicked', () => {
    const onChange = vi.fn();
    render(<HousingRegisterTypeSelector value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Mハウス/ }));
    expect(onChange).toHaveBeenCalledWith('M');
  });

  it('marks selected chip with data-selected', () => {
    render(<HousingRegisterTypeSelector value="L" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Lハウス/ })).toHaveAttribute('data-selected', 'true');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTypeSelector.test.tsx`
Expected: FAIL.

- [ ] **Step 3: HousingRegisterTypeSelector 実装**

```typescript
// src/components/housing/register/HousingRegisterTypeSelector.tsx
'use client';
import { useTranslations } from 'next-intl';
import type { HousingExtractSize } from '../../../lib/housing/parseHousingFromText';

type Props = {
  value: HousingExtractSize | null;
  onChange: (size: HousingExtractSize) => void;
};

const TYPES: Array<{ id: HousingExtractSize; key: string }> = [
  { id: 'S', key: 'S' },
  { id: 'M', key: 'M' },
  { id: 'L', key: 'L' },
  { id: 'PrivateRoom', key: 'private' },
  { id: 'Apartment', key: 'apartment' },
];

export function HousingRegisterTypeSelector({ value, onChange }: Props) {
  const t = useTranslations('housing.register.type');
  return (
    <div className="housing-type-selector" role="radiogroup">
      {TYPES.map(({ id, key }) => (
        <button
          key={id}
          type="button"
          className="housing-type-chip"
          data-selected={value === id ? 'true' : 'false'}
          onClick={() => onChange(id)}
          role="radio"
          aria-checked={value === id}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: HousingRegisterRoomNumberField 実装**

```typescript
// src/components/housing/register/HousingRegisterRoomNumberField.tsx
'use client';
import { useTranslations } from 'next-intl';

type Props = {
  mode: 'Apartment' | 'PrivateRoom';
  value: number | null;
  onChange: (n: number | null) => void;
};

export function HousingRegisterRoomNumberField({ mode, value, onChange }: Props) {
  const t = useTranslations('housing.register');
  const tField = useTranslations('housing.register.fieldError');
  const max = mode === 'Apartment' ? 90 : 512;
  const labelKey = mode === 'Apartment' ? 'roomNumberApartmentOutOfRange' : 'roomNumberPrivateOutOfRange';

  const handleChange = (raw: string) => {
    if (raw === '') {
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      onChange(null);
      return;
    }
    onChange(n);
  };

  return (
    <div className="housing-room-number-field">
      <label className="housing-label">{mode === 'Apartment' ? t('type.apartment') : t('type.private')} #</label>
      <input
        type="number"
        className="housing-input"
        min={1}
        max={max}
        value={value ?? ''}
        onChange={(e) => handleChange(e.target.value)}
      />
      {value !== null && (value < 1 || value > max) && (
        <p className="housing-error-text">{tField(labelKey)}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: HousingRegisterParentHouseSizeField 実装**

```typescript
// src/components/housing/register/HousingRegisterParentHouseSizeField.tsx
'use client';
import { useTranslations } from 'next-intl';

type Props = {
  value: 'S' | 'M' | 'L' | null;
  onChange: (size: 'S' | 'M' | 'L') => void;
};

export function HousingRegisterParentHouseSizeField({ value, onChange }: Props) {
  const t = useTranslations('housing.register.type');
  return (
    <div className="housing-parent-size-field" role="radiogroup">
      {(['S', 'M', 'L'] as const).map((size) => (
        <button
          key={size}
          type="button"
          className="housing-type-chip"
          data-selected={value === size ? 'true' : 'false'}
          onClick={() => onChange(size)}
          role="radio"
          aria-checked={value === size}
        >
          {t(size)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTypeSelector.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterTypeSelector.tsx src/components/housing/register/HousingRegisterRoomNumberField.tsx src/components/housing/register/HousingRegisterParentHouseSizeField.tsx src/__tests__/housing/HousingRegisterTypeSelector.test.tsx
rtk git commit -m "feat(housing): タイプチップ + 動的フィールド (個室/アパート番号 + 親家サイズ) を追加"
```

---

## Task 13: HousingRegisterAddressFields 修正 (1-60 + 拡張街注記 + it.skip 復活)

**Files:**
- Modify: `src/components/housing/register/HousingRegisterAddressFields.tsx`
- Modify: `src/__tests__/housing/HousingRegisterAddressFields.test.tsx`

- [ ] **Step 1: 既存ファイル確認**

Run: `cat src/components/housing/register/HousingRegisterAddressFields.tsx | head -80`
既存の plot 制約 (Phase 1 で 1-60 に修正済) と subdivision 除去状態を確認。

Run: `grep -n "it.skip" src/__tests__/housing/HousingRegisterAddressFields.test.tsx`
2 件の skip テストを特定。

- [ ] **Step 2: it.skip を it に戻して動作確認**

`src/__tests__/housing/HousingRegisterAddressFields.test.tsx` の 2 箇所、 `it.skip(` を `it(` に置換。

Run: `npx vitest run src/__tests__/housing/HousingRegisterAddressFields.test.tsx`
Expected: 何らかが失敗する可能性あり。 失敗内容を踏まえて Step 3 で対応。

- [ ] **Step 3: 拡張街注記の追加 (テスト先行)**

`HousingRegisterAddressFields.test.tsx` の末尾に追加:

```typescript
it('shows expansion ward note when plot >= 31', async () => {
  render(<HousingRegisterAddressFields value={{ area: 'Mist', ward: 5, plot: 35 }} onChange={() => {}} />);
  expect(await screen.findByText(/拡張街/)).toBeInTheDocument();
});

it('does not show expansion note when plot <= 30', () => {
  render(<HousingRegisterAddressFields value={{ area: 'Mist', ward: 5, plot: 12 }} onChange={() => {}} />);
  expect(screen.queryByText(/拡張街/)).not.toBeInTheDocument();
});
```

- [ ] **Step 4: テスト失敗確認 + 実装追加**

Run: `npx vitest run src/__tests__/housing/HousingRegisterAddressFields.test.tsx`
Expected: 新規 2 テスト FAIL。

`HousingRegisterAddressFields.tsx` の plot 入力欄の下に注記追加:

```tsx
{value.plot != null && value.plot >= 31 && value.plot <= 60 && (
  <p className="housing-address-note">{t('expansionWardNote')}</p>
)}
```

`useTranslations('housing.register.address')` の追加が必要。 既存 import を確認して追記。

- [ ] **Step 5: テスト PASS 確認 + コミット**

Run: `npx vitest run src/__tests__/housing/HousingRegisterAddressFields.test.tsx`
Expected: PASS (全 tests、 復活した skip 含む).

```bash
rtk git add src/components/housing/register/HousingRegisterAddressFields.tsx src/__tests__/housing/HousingRegisterAddressFields.test.tsx
rtk git commit -m "feat(housing): 番地 31 以上で拡張街注記を表示 + 既存 skip テスト復活"
```

---

## Task 14: HousingRegisterForm (state 管理 + 子コンポ統合 + 自動入力配線)

**Files:**
- Create: `src/components/housing/register/HousingRegisterForm.tsx`
- Test: `src/__tests__/housing/HousingRegisterForm.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/HousingRegisterForm.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../lib/housingApiClient', () => ({
  registerListing: vi.fn(),
  canRegister: vi.fn(() => Promise.resolve(true)),
}));

import { HousingRegisterForm } from '../../components/housing/register/HousingRegisterForm';

describe('HousingRegisterForm', () => {
  it('renders all required field sections', () => {
    render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/SNS URL/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sハウス/ })).toBeInTheDocument();
  });

  it('submit button is disabled when required fields are empty', () => {
    render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /登録する/ })).toBeDisabled();
  });

  it('fills form fields when tweet is fetched (auto-filled state)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          text: 'Mana\nAnima\nShirogane | 6-6 | Small',
          author: { name: 'T', screen_name: 't' },
          photos: [],
          video: false,
        }),
        { status: 200 },
      ),
    );
    render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
    const urlInput = screen.getByLabelText(/SNS URL/);
    await userEvent.type(urlInput, 'https://x.com/u/status/1842217368673759498');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sハウス/ })).toHaveAttribute('data-selected', 'true');
    });
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: HousingRegisterForm 実装**

```typescript
// src/components/housing/register/HousingRegisterForm.tsx
'use client';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { HousingRegisterSnsUrlField } from './HousingRegisterSnsUrlField';
import { HousingRegisterTweetPreview } from './HousingRegisterTweetPreview';
import { HousingRegisterTypeSelector } from './HousingRegisterTypeSelector';
import { HousingRegisterAddressFields } from './HousingRegisterAddressFields';
import { HousingRegisterRoomNumberField } from './HousingRegisterRoomNumberField';
import { HousingRegisterParentHouseSizeField } from './HousingRegisterParentHouseSizeField';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingRegisterFieldBadge } from './HousingRegisterFieldBadge';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { parseHousingFromText, type HousingExtractSize } from '../../../lib/housing/parseHousingFromText';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

export type HousingRegisterFormValues = {
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  plot?: number;
  size?: HousingExtractSize;
  roomNumber?: number;
  parentHouseSize?: 'S' | 'M' | 'L';
  description?: string;
  tags?: string[];
};

type Props = {
  onSubmit: (values: HousingRegisterFormValues) => void;
  onCancel: () => void;
};

const REQUIRED_FIELDS = ['dc', 'server', 'area', 'ward', 'plot', 'size'];

export function HousingRegisterForm({ onSubmit, onCancel }: Props) {
  const t = useTranslations('housing.register');
  const fieldState = useHousingFieldState(REQUIRED_FIELDS);
  const [tweetData, setTweetData] = useState<TweetData | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleTweetFetched = useCallback((data: TweetData) => {
    setTweetData(data);
    const result = parseHousingFromText(data.text);
    const fills: Array<[string, unknown]> = [];
    if (result.dc) fills.push(['dc', result.dc]);
    if (result.server) fills.push(['server', result.server]);
    if (result.area) fills.push(['area', result.area]);
    if (result.ward != null) fills.push(['ward', result.ward]);
    if (result.plot != null) fills.push(['plot', result.plot]);
    if (result.size) fills.push(['size', result.size]);

    // タイピング演出: フィールド間 150ms ずらしで順次セット (視線誘導)
    // prefers-reduced-motion=reduce のときは即時セット
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fills.forEach(([name, value]) => fieldState.setAutoFilled(name, value));
    } else {
      fills.forEach(([name, value], i) => {
        window.setTimeout(() => fieldState.setAutoFilled(name, value), i * 150);
      });
    }
  }, [fieldState]);

  const size = fieldState.getValue('size') as HousingExtractSize | undefined;
  const showRoomNumber = size === 'Apartment' || size === 'PrivateRoom';
  const showParentSize = size === 'PrivateRoom';

  const handleSubmit = () => {
    onSubmit({
      dc: fieldState.getValue('dc') as string | undefined,
      server: fieldState.getValue('server') as string | undefined,
      area: fieldState.getValue('area') as string | undefined,
      ward: fieldState.getValue('ward') as number | undefined,
      plot: fieldState.getValue('plot') as number | undefined,
      size,
      roomNumber: fieldState.getValue('roomNumber') as number | undefined,
      parentHouseSize: fieldState.getValue('parentHouseSize') as 'S' | 'M' | 'L' | undefined,
      description,
      tags,
    });
  };

  return (
    <div className="housing-register-form">
      <HousingRegisterSnsUrlField onTweetFetched={handleTweetFetched} />
      {tweetData && <HousingRegisterTweetPreview data={tweetData} />}

      <div className="housing-field" data-state={fieldState.getState('size')}>
        <HousingRegisterTypeSelector
          value={(size ?? null) as HousingExtractSize | null}
          onChange={(s) => fieldState.userEdit('size', s)}
        />
        <HousingRegisterFieldBadge
          state={fieldState.getState('size')}
          onConfirm={() => fieldState.confirm('size')}
        />
      </div>

      {/* DC / サーバー / エリア / 番地 は HousingRegisterAddressFields に集約 */}
      <HousingRegisterAddressFields
        value={{
          dc: fieldState.getValue('dc') as string | undefined,
          server: fieldState.getValue('server') as string | undefined,
          area: fieldState.getValue('area') as string | undefined,
          ward: fieldState.getValue('ward') as number | undefined,
          plot: fieldState.getValue('plot') as number | undefined,
        }}
        onChange={(patch) => {
          Object.entries(patch).forEach(([k, v]) => fieldState.userEdit(k, v));
        }}
        renderBadge={(name) => (
          <HousingRegisterFieldBadge
            state={fieldState.getState(name)}
            onConfirm={() => fieldState.confirm(name)}
          />
        )}
      />

      {showRoomNumber && (
        <div className="housing-field" data-state={fieldState.getState('roomNumber')}>
          <HousingRegisterRoomNumberField
            mode={size === 'Apartment' ? 'Apartment' : 'PrivateRoom'}
            value={(fieldState.getValue('roomNumber') as number | null) ?? null}
            onChange={(n) => {
              if (n == null) fieldState.clearField('roomNumber');
              else fieldState.userEdit('roomNumber', n);
            }}
          />
        </div>
      )}

      {showParentSize && (
        <div className="housing-field" data-state={fieldState.getState('parentHouseSize')}>
          <HousingRegisterParentHouseSizeField
            value={(fieldState.getValue('parentHouseSize') as 'S' | 'M' | 'L' | null) ?? null}
            onChange={(s) => fieldState.userEdit('parentHouseSize', s)}
          />
        </div>
      )}

      <HousingRegisterDescriptionField value={description} onChange={setDescription} />
      <HousingRegisterTagPicker value={tags} onChange={setTags} />

      <footer className="housing-register-form-footer">
        <button type="button" onClick={onCancel}>{t('cancel')}</button>
        <button
          type="button"
          disabled={!fieldState.isReadyToSubmit()}
          onClick={handleSubmit}
        >
          {t('submit')}
        </button>
      </footer>
    </div>
  );
}
```

注意: `HousingRegisterAddressFields` の既存 props 形式に合わせて `renderBadge` prop を追加する必要があれば、 同コンポーネントを併せて修正。 既存実装で props 型が違う場合は Task 13 の延長で調整。

- [ ] **Step 4: テスト PASS 確認 (失敗を修正しながら)**

Run: `npx vitest run src/__tests__/housing/HousingRegisterForm.test.tsx`
Expected: PASS (3 tests). 失敗があれば AddressFields の props 互換性を調整。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterForm.tsx src/__tests__/housing/HousingRegisterForm.test.tsx src/components/housing/register/HousingRegisterAddressFields.tsx
rtk git commit -m "feat(housing): 登録フォーム本体 (state + 自動入力配線 + 動的フィールド) を追加"
```

---

## Task 15: HousingRegisterModal (モーダル枠 + 動画背景上 glass + 最終確認モーダル)

**Files:**
- Create: `src/components/housing/register/HousingRegisterModal.tsx`
- Test: `src/__tests__/housing/HousingRegisterModal.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/housing/HousingRegisterModal.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../lib/housingApiClient', () => ({
  registerListing: vi.fn(() => Promise.resolve({ id: 'listing-1' })),
  canRegister: vi.fn(() => Promise.resolve(true)),
}));

import { HousingRegisterModal } from '../../components/housing/register/HousingRegisterModal';

describe('HousingRegisterModal', () => {
  it('renders dialog with title when open', () => {
    render(<HousingRegisterModal open onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/家を登録/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<HousingRegisterModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<HousingRegisterModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /キャンセル/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('locks body scroll when open', () => {
    render(<HousingRegisterModal open onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: モーダル実装**

```typescript
// src/components/housing/register/HousingRegisterModal.tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { HousingRegisterForm, type HousingRegisterFormValues } from './HousingRegisterForm';
import { registerListing } from '../../../lib/housingApiClient';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HousingRegisterModal({ open, onClose }: Props) {
  const t = useTranslations('housing.register');
  const [confirmValues, setConfirmValues] = useState<HousingRegisterFormValues | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSubmit = useCallback((values: HousingRegisterFormValues) => {
    setConfirmValues(values);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmValues) return;
    await registerListing(confirmValues as never);
    setConfirmValues(null);
    onClose();
  }, [confirmValues, onClose]);

  if (!open || !mounted) return null;

  const content = (
    <div className="housing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="housing-register-title">
      <div className="housing-modal-content housing-glass-panel">
        <header className="housing-modal-header">
          <h2 id="housing-register-title">{t('title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cancel')}>×</button>
        </header>
        <HousingRegisterForm onSubmit={handleSubmit} onCancel={onClose} />
      </div>

      {confirmValues && (
        <div className="housing-modal-overlay housing-confirm-overlay" role="dialog" aria-modal="true">
          <div className="housing-modal-content housing-glass-panel housing-confirm-content">
            <h3>{t('confirm.title')}</h3>
            <p>{t('confirm.message')}</p>
            <pre className="housing-confirm-summary">
{JSON.stringify(confirmValues, null, 2)}
            </pre>
            <footer>
              <button type="button" onClick={() => setConfirmValues(null)}>{t('confirm.cancel')}</button>
              <button type="button" onClick={handleConfirm}>{t('confirm.submit')}</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterModal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterModal.tsx src/__tests__/housing/HousingRegisterModal.test.tsx
rtk git commit -m "feat(housing): 登録モーダル + 最終確認モーダルを追加"
```

---

## Task 16: ハウジングページへの統合 (既存 HousingRegisterView 置き換え)

**Files:**
- Modify: `src/components/housing/HousingPage.tsx` (or 登録ボタンの呼び出し元)
- Delete: `src/components/housing/register/HousingRegisterView.tsx` (新モーダルに置き換え)
- Delete: `src/__tests__/housing/HousingRegisterView.test.tsx` (新 Modal テストで代替済み)

- [ ] **Step 1: 既存呼び出し箇所の特定**

Run: `grep -rn "HousingRegisterView" src/`
Expected: 数箇所ヒット (HousingPage.tsx 等).

- [ ] **Step 2: HousingPage 修正**

`src/components/housing/HousingPage.tsx` で、 `HousingRegisterView` import を `HousingRegisterModal` に変更。 登録ボタンクリックで `<HousingRegisterModal open={isOpen} onClose={() => setOpen(false)} />` を表示する形に。

具体修正:
- import 文を `import { HousingRegisterModal } from './register/HousingRegisterModal';` に
- state `[isRegisterOpen, setIsRegisterOpen] = useState(false)` を追加
- 登録ボタンの onClick で `setIsRegisterOpen(true)`
- JSX 末尾に `<HousingRegisterModal open={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />`
- 既存 `HousingRegisterView` の参照を全て削除

- [ ] **Step 3: 旧 View を削除**

```bash
rm src/components/housing/register/HousingRegisterView.tsx
rm src/__tests__/housing/HousingRegisterView.test.tsx
```

- [ ] **Step 4: 全テスト実行 + ビルド確認**

Run: `npx vitest run && npm run build`
Expected: 全 PASS、 ビルド成功。 失敗があれば既存 import / props の不整合を修正。

- [ ] **Step 5: コミット**

```bash
rtk git add -A
rtk git commit -m "feat(housing): 登録モーダル統合 + 旧 HousingRegisterView 削除"
```

---

## Task 17: docs/TODO.md 更新 + 最終ビルド + push + デプロイ確認

**Files:**
- Modify: `docs/TODO.md`
- Modify: `docs/TODO_COMPLETED.md`

- [ ] **Step 1: ビルド + 全テスト + lint 確認**

Run: `npm run build && npx vitest run && npm run lint`
Expected: 全 PASS / クリーン。 警告があれば対応。

- [ ] **Step 2: docs/TODO.md 更新**

「現在の状態」 セクションを以下に書き換え:

```markdown
## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #36 で **Phase 2A (登録モーダル + SNS URL 自動推定) 完了**
- **直近セッション (2026-05-19 #36)**: 17 task の TDD 実装、 全テスト PASS、 ビルド green
  - 抽出ロジック (純関数): 定番フォーマット + 略称 + 自由文 + 鯖俗語、 4 実サンプル全て 100% 抽出
  - API: Vercel Edge Function `/api/tweet-meta` (11/12 関数枠)
  - UI: モーダル + フィールドバッジ + ✅ チェック + タイピングアニメ + 動的フィールド
  - i18n: 4 言語 30 キー追加
  - 既存 `HousingRegisterView` を削除、 新 `HousingRegisterModal` に統一
  - **訂正版 spec**: [`docs/superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md`](./superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md)
  - **plan (完了)**: [`docs/superpowers/plans/2026-05-19-housing-sns-auto-extraction.md`](./superpowers/plans/2026-05-19-housing-sns-auto-extraction.md)
- **次セッション最優先**: **Cloudflare 前段化** (DNS 切替のみ、 30 分作業、 動画 2K 化への布石)
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド
- **既知の残**: 写真自動取り込み (UGC 規約整備が前提)、 マップ確認モーダル統合 (Phase 3)
```

「次セッション最優先」 セクションを Cloudflare 前段化に置き換え。

- [ ] **Step 3: TODO_COMPLETED.md に Phase 2A エントリ追加**

完了タスクを移動。 簡潔に。

- [ ] **Step 4: 行数チェック**

Run: `wc -l docs/TODO.md`
Expected: 100 行以内。 超過してたら不要部分を整理。

- [ ] **Step 5: push + デプロイ**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(housing): Phase 2A 完了 + 次セッション = Cloudflare 前段化"
rtk git push
```

push 後、 Vercel デプロイが自動で走る (Hobby plan、 月 100 ビルド枠を 1 消費)。 デプロイ完了を確認:

Run: `rtk gh run list --limit 3`
Expected: 最新の workflow が success.

実機 (= 本人の環境) でハウジング登録ボタンを押し、 X URL を貼って自動入力が動くことを確認。

---

## 実装完了時の受入チェックリスト (spec §13)

- [ ] 4 件の実サンプル全てで 100% 抽出成功 (parseHousingFromText.test.ts)
- [ ] 区切り文字なしツイート (`シロガネ6番地6番に来てねManaのAnimaサーバーです`) で抽出成功
- [ ] 取得失敗時に「再取得」 ボタンが表示・機能
- [ ] 全フィールドが「編集 or ✅」 になるまで登録ボタンが disabled
- [ ] `prefers-reduced-motion` でアニメ無効化
- [ ] 4 言語すべてで UI 表示が崩れない
- [ ] vitest 全 PASS
- [ ] `npm run build` PASS (Vercel 厳密モード)
- [ ] 実機で X URL を貼って登録できる
- [ ] HousingRegisterAddressFields.test.tsx の旧 `it.skip` 2 件が PASS

---

## 関連ドキュメント

- 設計書: [`docs/superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md`](../specs/2026-05-19-housing-sns-auto-extraction-design.md)
- 元 spec (オーバーライド対象): [`docs/superpowers/specs/2026-05-18-housing-room-types-design.md`](../specs/2026-05-18-housing-room-types-design.md)
- TODO: [`docs/TODO.md`](../../TODO.md)

---

## 改訂履歴

- 2026-05-19: 初版作成 (Claude + masaya-men ブレストセッション #36)
