# ハウジング SNS 画像表示 + ツイート連動ライフサイクル 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登録フォームが取得したツイート画像 URL を保存〜表示まで繋ぎ、元ツイートが削除されたら物件を自動 soft delete する（開いた時チェック + ローリングバッチ cron の二段構え）。

**Architecture:** 画像バイナリは保存せず `pbs.twimg.com` の CDN URL を物件 doc に参照保持して `<img>` 直リンク表示。ツイート生存確認は syndication CDN の 404 をサインに使い、共有モジュール `tweetSyndication.ts` を edge(`/api/tweet-meta`) / node(purge ハンドラ) / cron の 3 経路で再利用する。削除の真偽判定は必ずサーバーが 404 を再確認してから実行（家主以外が叩いても安全）。

**Tech Stack:** React + zustand（クライアント）、Vercel Serverless（node, firebase-admin）+ Edge Functions、Firestore、vitest（pool='vmThreads' 厳守）。

**設計書:** [docs/superpowers/specs/2026-05-21-housing-sns-image-lifecycle-design.md](../specs/2026-05-21-housing-sns-image-lifecycle-design.md)

**実機検証ルール:** 各「実機確認」ステップはユーザーと一緒に 1 件ずつ確認してから次へ進む（要ログイン）。memory `feedback_one_fix_one_verify`。

**i18n ルール:** 新規キーは ja.json に正本を追加し、en/ko/zh.json には**同じ ja 値をコピー**で投入（en 翻訳は後追い）。4 ファイルすべてに同一キー構造を入れること（キー欠落は表示崩れの原因）。

---

## ファイル構成（このプランで触るファイル）

**新規作成:**
- `src/lib/housing/tweetSyndication.ts` — syndication URL/token 生成 + `checkTweetStatus()`（edge/node/cron 共有、Web 標準のみ）
- `src/__tests__/housing/tweetSyndication.test.ts` — 上記のユニットテスト
- `api/housing/_purgeIfTweetGoneHandler.ts` — (D) サーバー検証つき削除エンドポイント
- `api/cron/check-sns-tweets/index.ts` — (E) ローリングバッチ cron

**変更:**
- `api/tweet-meta.ts` — token 生成を共有モジュールに差し替え（DRY、挙動不変）
- `src/types/housing.ts` — `HousingListing` に `tweetId?` / `lastTweetCheckAt?` を追加
- `src/utils/housingValidation.ts` — `RegistrationDraft` に画像フィールド追加 + `validateImage` + `buildListingImageFields`
- `src/components/housing/register/HousingRegisterSnsUrlField.tsx` — `onTweetFetched` に取得元 `{ postUrl, tweetId }` を同梱
- `src/components/housing/register/HousingRegisterForm.tsx` — `HousingRegisterFormValues` に画像フィールド追加 + handleSubmit で同梱
- `src/components/housing/register/HousingRegisterFormModal.tsx` — `toRegistrationDraft` を export + 画像詰め替え
- `api/housing/_registerListingHandler.ts` — `imageMode:'none'` 決め打ち廃止、`buildListingImageFields` で保存
- `api/housing/index.ts` — `purge-if-tweet-gone` ルート追加
- `src/lib/housingApiClient.ts` — `purgeIfTweetGone()` クライアント追加
- `src/components/housing/listing/HousingDetailModalRoute.tsx` — (C) 開いた時チェック
- `firestore.indexes.json` — cron 用複合インデックス追加
- `vercel.json` — `check-sns-tweets` cron 追加
- `src/locales/{ja,en,ko,zh}.json` — `housing.detail.postRemoved` キー追加

**変更するテスト:**
- `src/__tests__/housing/housingValidation.test.ts` — `validateImage` / `buildListingImageFields`
- `src/__tests__/housing/HousingRegisterFormModal.test.tsx` — `toRegistrationDraft`
- `src/__tests__/housing/HousingRegisterForm.test.tsx` — image を onSubmit に渡すこと
- `src/__tests__/housing/housingApiClient.test.ts` — `purgeIfTweetGone`

---

## Task 1: 共有 syndication モジュール（token/URL + 生存確認）

ツイート生存確認ロジックを 1 箇所に集約。Web 標準（fetch / AbortSignal / Math）のみで書き、edge・node・cron の 3 経路から使う。

**Files:**
- Create: `src/lib/housing/tweetSyndication.ts`
- Test: `src/__tests__/housing/tweetSyndication.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/tweetSyndication.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syndicationUrl, checkTweetStatus } from '../../lib/housing/tweetSyndication';

const mockFetch = vi.spyOn(globalThis, 'fetch');

describe('syndicationUrl', () => {
  it('id と token を含む cdn.syndication URL を生成する', () => {
    const url = syndicationUrl('1842217368673759498');
    expect(url).toContain('https://cdn.syndication.twimg.com/tweet-result?id=1842217368673759498');
    expect(url).toContain('&token=');
  });
});

describe('checkTweetStatus', () => {
  beforeEach(() => mockFetch.mockReset());

  it('200 → alive', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    expect(await checkTweetStatus('1234567890')).toBe('alive');
  });

  it('404 → gone', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect(await checkTweetStatus('1234567890')).toBe('gone');
  });

  it('500 → error（消さない側に倒す）', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await checkTweetStatus('1234567890')).toBe('error');
  });

  it('fetch 例外 → error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    expect(await checkTweetStatus('1234567890')).toBe('error');
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run src/__tests__/housing/tweetSyndication.test.ts`
Expected: FAIL（モジュール未作成で import エラー）

- [ ] **Step 3: 最小実装を書く**

`src/lib/housing/tweetSyndication.ts`:

```ts
/**
 * X (旧 Twitter) syndication CDN の共有ユーティリティ。
 *
 * Web 標準 (fetch / AbortSignal / URL / Math) のみで書く。
 * edge (/api/tweet-meta) / node (purge ハンドラ) / cron の 3 経路から再利用するため。
 */

const TIMEOUT_MS = 10_000;

/** syndication CDN の暗黙トークン (公開リバースエンジニアリング済みの既知アルゴリズム) */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export function syndicationUrl(id: string): string {
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}`;
}

export type TweetStatus = 'alive' | 'gone' | 'error';

/**
 * ツイートの生存を確認する。
 * - 200 → 'alive'、404 → 'gone'（削除/非公開）、それ以外/例外 → 'error'。
 * - 'error' は「消さない・lastTweetCheckAt も更新しない」側に倒すための値（fail-safe）。
 */
export async function checkTweetStatus(id: string): Promise<TweetStatus> {
  try {
    const res = await fetch(syndicationUrl(id), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'LoPo Housing Tour' },
    });
    if (res.status === 404) return 'gone';
    if (!res.ok) return 'error';
    return 'alive';
  } catch {
    return 'error';
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/tweetSyndication.test.ts`
Expected: PASS

- [ ] **Step 5: tweet-meta.ts を共有 URL に差し替え（DRY、挙動不変）**

`api/tweet-meta.ts` の token/URL 生成を共有モジュールに置き換える。冒頭の import 追加と、22-23 行のローカル token 生成を削除して `syndicationUrl(id)` を使う。

import 追加（先頭付近、`export const config` の直後あたり）:
```ts
import { syndicationUrl } from '../src/lib/housing/tweetSyndication';
```

22-23 行を置換:
```ts
// before
    const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
    const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`;
// after（ローカル変数名と関数名の衝突を避け url に改名）
    const url = syndicationUrl(id);
```

そして `const res = await fetch(syndicationUrl, {` を `const res = await fetch(url, {` に変更（同ファイル 26 行目）。

- [ ] **Step 6: 既存 edge テストで挙動不変を確認**

Run: `rtk vitest run src/__tests__/housing/api-tweet-meta.test.ts`
Expected: PASS（400/200/404/502/504 すべて従来どおり）

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/housing/tweetSyndication.ts src/__tests__/housing/tweetSyndication.test.ts api/tweet-meta.ts
rtk git commit -m "feat(housing): ツイート生存確認の共有モジュール tweetSyndication を追加 + tweet-meta を DRY 化"
```

---

## Task 2: データモデル拡張（HousingListing に SNS 連動フィールド）

**Files:**
- Modify: `src/types/housing.ts:116-120`

- [ ] **Step 1: 画像フィールドのコメント直後に追加**

`src/types/housing.ts` の `imageMode` / `postUrl` / `ogImageUrl` / `thumbnailPath` のブロック（116-120 行）の直後に追記:

```ts
  // 画像（3 択のいずれか）
  imageMode: ImageMode;
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;

  // SNS 連動 (imageMode==='sns' のみ持つ)
  /** syndication 問い合わせキー。postUrl から再パースでも可だが明示保持で query/index を単純化。 */
  tweetId?: string;
  /** 最後にツイート生存を確認した時刻(ms)。cron の「古い順」並びと開いた時チェックに使う。 */
  lastTweetCheckAt?: number;
```

- [ ] **Step 2: 型チェックが通ることを確認**

Run: `rtk tsc`
Expected: 新規エラーなし（フィールド追加は任意なので既存箇所に影響しない）

- [ ] **Step 3: コミット**

```bash
rtk git add src/types/housing.ts
rtk git commit -m "feat(housing): HousingListing に tweetId/lastTweetCheckAt を追加"
```

---

## Task 3: バリデーション + listing 画像フィールド生成（純粋関数）

ハンドラに埋まると firebase 依存でテストできないため、画像の検証と listing フィールド生成を `housingValidation.ts` の純粋関数に切り出す。

**Files:**
- Modify: `src/utils/housingValidation.ts:42-45`（`RegistrationDraft` 型）, `:126-132`（`validateRegistrationDraft`）
- Test: `src/__tests__/housing/housingValidation.test.ts`（describe 追加）

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/housingValidation.test.ts` の末尾に追記:

```ts
import { validateImage, buildListingImageFields } from '../../utils/housingValidation';

describe('validateImage', () => {
  const base = { imageMode: 'sns' as const, postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/abc.jpg', tweetId: '123' };

  it('imageMode が sns 以外なら常に ok', () => {
    expect(validateImage({ imageMode: 'none' } as any).ok).toBe(true);
    expect(validateImage({} as any).ok).toBe(true);
  });

  it('正常な sns 入力は ok', () => {
    expect(validateImage(base as any).ok).toBe(true);
  });

  it('postUrl が https でないと invalid', () => {
    expect(validateImage({ ...base, postUrl: 'http://x.com/u/status/123' } as any).ok).toBe(false);
  });

  it('ogImageUrl が pbs.twimg.com 以外のホストだと invalid', () => {
    expect(validateImage({ ...base, ogImageUrl: 'https://evil.example.com/a.jpg' } as any).ok).toBe(false);
  });

  it('tweetId が数字でないと invalid', () => {
    expect(validateImage({ ...base, tweetId: 'abc' } as any).ok).toBe(false);
  });

  it('sns なのにフィールド欠落は invalid', () => {
    expect(validateImage({ imageMode: 'sns' } as any).ok).toBe(false);
  });
});

describe('buildListingImageFields', () => {
  it('sns + 全フィールド揃いで sns モードのフィールドを返す', () => {
    const out = buildListingImageFields(
      { imageMode: 'sns', postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/a.jpg', tweetId: '123' } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://x.com/u/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
      tweetId: '123',
      lastTweetCheckAt: 1000,
    });
  });

  it('sns 以外は none を返す', () => {
    expect(buildListingImageFields({} as any, 1000)).toEqual({ imageMode: 'none' });
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: FAIL（`validateImage` / `buildListingImageFields` 未定義）

- [ ] **Step 3: 実装を書く**

`src/utils/housingValidation.ts` の `RegistrationDraft`（42-45 行）を拡張:

```ts
export interface RegistrationDraft extends AddressInput {
  tags: string[];
  description?: string;

  // SNS 画像 (任意。未指定なら imageMode='none' 扱い)
  imageMode?: 'sns' | 'none';
  postUrl?: string;
  ogImageUrl?: string;
  tweetId?: string;
}
```

同ファイル末尾（`validateRegistrationDraft` の直前）に追加:

```ts
function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isPbsTwimgHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).hostname === 'pbs.twimg.com';
  } catch {
    return false;
  }
}

/**
 * SNS 画像フィールドの検証。imageMode!=='sns' のときは常に ok。
 * sns のときは postUrl/ogImageUrl が https、ogImageUrl は pbs.twimg.com 限定
 * (任意 URL の注入・画像差し込み防止)、tweetId は数字 1-20 桁。
 */
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') return ok();
  const errors: ValidationErrors = {};
  if (!isHttpsUrl(draft.postUrl)) errors.postUrl = 'invalid';
  if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) errors.ogImageUrl = 'invalid';
  if (!draft.tweetId || !/^\d{1,20}$/.test(draft.tweetId)) errors.tweetId = 'invalid';
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

/**
 * 検証済み draft から listing に保存する画像フィールドを生成する。
 * sns + 全フィールド揃いのときのみ sns 保存、それ以外は 'none'。
 * (この関数を呼ぶ前に validateImage が ok であることを前提とする)
 */
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; tweetId: string; lastTweetCheckAt: number }
  | { imageMode: 'none' } {
  if (draft.imageMode === 'sns' && draft.postUrl && draft.ogImageUrl && draft.tweetId) {
    return {
      imageMode: 'sns',
      postUrl: draft.postUrl,
      ogImageUrl: draft.ogImageUrl,
      tweetId: draft.tweetId,
      lastTweetCheckAt: now,
    };
  }
  return { imageMode: 'none' };
}
```

`validateRegistrationDraft`（126-132 行）に `validateImage` を組み込む:

```ts
export function validateRegistrationDraft(draft: RegistrationDraft): ValidationResult {
  const errors: ValidationErrors = {};
  Object.assign(errors, validateAddress(draft).errors);
  Object.assign(errors, validateTags(draft.tags).errors);
  Object.assign(errors, validateDescription(draft.description).errors);
  Object.assign(errors, validateImage(draft).errors);
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/housingValidation.ts src/__tests__/housing/housingValidation.test.ts
rtk git commit -m "feat(housing): SNS 画像のバリデーションと listing フィールド生成を純粋関数化"
```

---

## Task 4: フォーム → onSubmit のデータ経路に画像を通す (A 前半)

`HousingRegisterSnsUrlField` が取得元 URL/tweetId を親へ渡し、`HousingRegisterForm` が画像 1 枚目を onSubmit に同梱する。

**Files:**
- Modify: `src/components/housing/register/HousingRegisterSnsUrlField.tsx:6-8,16-20`
- Modify: `src/components/housing/register/HousingRegisterForm.tsx:20-31,46,50-77,109-122`
- Test: `src/__tests__/housing/HousingRegisterForm.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingRegisterForm.test.tsx` の `describe` 内に追加:

```ts
it('ツイート画像つきで登録すると onSubmit に postUrl/ogImageUrl/tweetId を渡す', async () => {
    mockFetch.mockResolvedValueOnce(
        new Response(
            JSON.stringify({
                text: 'Mana\nAnima\nShirogane | 6-6 | Small',
                author: { name: 'T', screen_name: 't' },
                photos: ['https://pbs.twimg.com/media/abc.jpg'],
                video: false,
            }),
            { status: 200 },
        ),
    );
    const onSubmit = vi.fn();
    render(<HousingRegisterForm onSubmit={onSubmit} onCancel={() => {}} />);
    const urlInput = screen.getByLabelText('housing.register.snsUrl.label');
    fireEvent.change(urlInput, { target: { value: 'https://x.com/u/status/1842217368673759498' } });

    // 自動入力完了（size が選択される）まで待つ
    await waitFor(
        () => {
            expect(screen.getByRole('radio', { name: 'housing.register.type.S' })).toHaveAttribute('data-selected', 'true');
        },
        { timeout: 3000 },
    );

    // 全必須を確定 → submit 押下 → onSubmit 引数に画像が乗る
    const submitBtn = screen.getByRole('button', { name: 'housing.register.submit' });
    await waitFor(() => expect(submitBtn).not.toBeDisabled(), { timeout: 3000 });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
            postUrl: 'https://x.com/u/status/1842217368673759498',
            ogImageUrl: 'https://pbs.twimg.com/media/abc.jpg',
            tweetId: '1842217368673759498',
        }),
    );
});
```

> 注: 自動入力された値は `auto-filled` 状態で submit 不可。テストでは必須バッジ確認が要る場合がある。`waitFor` で submit が enable になるのを待ち、ならなければ各必須フィールドの確認ボタン（`housing.register.fieldBadge.confirmAriaLabel`）を click してから submit する。実装後に実挙動を見て、enable 待ちで足りなければ確認 click を足すこと。

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run src/__tests__/housing/HousingRegisterForm.test.tsx`
Expected: FAIL（onSubmit に画像フィールドが乗らない）

- [ ] **Step 3: SnsUrlField が取得元を親に渡すよう変更**

`src/components/housing/register/HousingRegisterSnsUrlField.tsx`:

6-8 行の Props を変更:
```ts
type Props = {
    onTweetFetched: (
        data: TweetData,
        source: { postUrl: string; tweetId: string } | null,
    ) => void;
};
```

16-20 行の success effect を変更（`url` から tweetId を再パースして同梱）:
```ts
    useEffect(() => {
        if (status === 'success' && data) {
            const tweetId = parseTweetUrl(url);
            onTweetFetched(
                data,
                tweetId ? { postUrl: url.trim(), tweetId } : null,
            );
        }
    }, [status, data, onTweetFetched, url]);
```

- [ ] **Step 4: Form が画像を state 保持して onSubmit に同梱**

`src/components/housing/register/HousingRegisterForm.tsx`:

20-31 行の `HousingRegisterFormValues` に画像フィールド追加:
```ts
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
    postUrl?: string;
    ogImageUrl?: string;
    tweetId?: string;
};
```

46 行の `tweetData` state の直後に取得元 state を追加:
```ts
    const [tweetData, setTweetData] = useState<TweetData | null>(null);
    const [tweetSource, setTweetSource] = useState<{ postUrl: string; tweetId: string } | null>(null);
```

50 行の `handleTweetFetched` シグネチャを変更し source を保持（先頭で `setTweetSource(source)` を追加）:
```ts
    const handleTweetFetched = useCallback(
        (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
            setTweetData(data);
            setTweetSource(source);
            const result = parseHousingFromText(data.text);
            // ...（以降は既存のまま）
```

109-122 行の `handleSubmit` を変更（画像 1 枚目があれば同梱）:
```ts
    const handleSubmit = () => {
        const photo = tweetData?.photos?.[0];
        const image =
            tweetSource && photo
                ? { postUrl: tweetSource.postUrl, ogImageUrl: photo, tweetId: tweetSource.tweetId }
                : {};
        onSubmit({
            dc,
            server,
            area,
            ward,
            plot,
            size,
            roomNumber,
            parentHouseSize,
            description,
            tags,
            ...image,
        });
    };
```

- [ ] **Step 5: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/HousingRegisterForm.test.tsx src/__tests__/housing/HousingRegisterSnsUrlField.test.tsx`
Expected: PASS（SnsUrlField 既存テストは `onTweetFetched={() => {}}` で 2 引数でも壊れない）

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterSnsUrlField.tsx src/components/housing/register/HousingRegisterForm.tsx src/__tests__/housing/HousingRegisterForm.test.tsx
rtk git commit -m "feat(housing): 登録フォームがツイート画像 URL を onSubmit に同梱"
```

---

## Task 5: toRegistrationDraft で画像を draft に詰め替え (A 後半)

**Files:**
- Modify: `src/components/housing/register/HousingRegisterFormModal.tsx:18-52`
- Test: `src/__tests__/housing/HousingRegisterFormModal.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingRegisterFormModal.test.tsx` に追加（`toRegistrationDraft` を named export して直接テスト）:

```ts
import { toRegistrationDraft } from '../../components/housing/register/HousingRegisterFormModal';

describe('toRegistrationDraft 画像詰め替え', () => {
  it('画像 3 フィールドが揃うと imageMode=sns で draft に乗る', () => {
    const draft = toRegistrationDraft({
      dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3, plot: 12, size: 'M',
      tags: ['wafu'],
      postUrl: 'https://x.com/u/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
      tweetId: '123',
    });
    expect(draft.imageMode).toBe('sns');
    expect(draft.postUrl).toBe('https://x.com/u/status/123');
    expect(draft.ogImageUrl).toBe('https://pbs.twimg.com/media/a.jpg');
    expect(draft.tweetId).toBe('123');
  });

  it('画像なしなら imageMode は undefined（=none 扱い）', () => {
    const draft = toRegistrationDraft({
      dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3, plot: 12, size: 'M', tags: ['wafu'],
    });
    expect(draft.imageMode).toBeUndefined();
  });
});
```

> 既存テストファイル冒頭の vi.mock 群（registerListing 等）はそのまま流用される。`toRegistrationDraft` は純粋関数なのでモック不要。

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run src/__tests__/housing/HousingRegisterFormModal.test.tsx`
Expected: FAIL（`toRegistrationDraft` が export されていない）

- [ ] **Step 3: 実装を変更**

`src/components/housing/register/HousingRegisterFormModal.tsx` 18 行を `export function` に変更し、return に画像を詰め替え:

```ts
export function toRegistrationDraft(v: HousingRegisterFormValues): RegistrationDraft {
    const size = v.size;
    let buildingType: 'house' | 'apartment' = 'house';
    let apiSize: string | undefined;
    let roomKind: string | undefined;
    let plot: number | undefined = v.plot;

    if (size === 'Apartment') {
        buildingType = 'apartment';
        apiSize = undefined;
        plot = undefined;
        roomKind = 'apartment_room';
    } else if (size === 'PrivateRoom') {
        buildingType = 'house';
        apiSize = v.parentHouseSize;
        roomKind = 'private_chamber';
    } else if (size === 'S' || size === 'M' || size === 'L') {
        buildingType = 'house';
        apiSize = size;
    }

    return {
        dc: v.dc ?? '',
        server: v.server ?? '',
        area: v.area ?? '',
        ward: v.ward ?? 0,
        buildingType,
        plot,
        size: apiSize,
        roomKind,
        roomNumber: v.roomNumber,
        tags: v.tags ?? [],
        description: v.description,
        ...(v.postUrl && v.ogImageUrl && v.tweetId
            ? {
                  imageMode: 'sns' as const,
                  postUrl: v.postUrl,
                  ogImageUrl: v.ogImageUrl,
                  tweetId: v.tweetId,
              }
            : {}),
    };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/HousingRegisterFormModal.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/HousingRegisterFormModal.tsx src/__tests__/housing/HousingRegisterFormModal.test.tsx
rtk git commit -m "feat(housing): toRegistrationDraft が画像を imageMode=sns で draft に詰め替え"
```

---

## Task 6: 登録ハンドラの保存 — 'none' 決め打ち廃止 (B)

**Files:**
- Modify: `api/housing/_registerListingHandler.ts:17,93`

- [ ] **Step 1: import に buildListingImageFields を追加**

`api/housing/_registerListingHandler.ts` 17 行:
```ts
import { validateRegistrationDraft, buildListingImageFields, type RegistrationDraft } from '../../src/utils/housingValidation.js';
```

- [ ] **Step 2: listing 生成で imageMode 決め打ちを置換**

93 行 `imageMode: 'none' as const,` を削除し、`addressKey,` の直後に画像フィールドを spread:

```ts
        addressKey,
        ...buildListingImageFields(draft, now),
        tags: draft.tags,
```

（`now` は同関数内 61 行で既に定義済み）

- [ ] **Step 3: 型チェック + 全体ユニットを確認**

Run: `rtk tsc`
Expected: 新規エラーなし

Run: `rtk vitest run`
Expected: 既存テスト全 PASS（ハンドラはユニット対象外、型と既存テストの非破壊を確認）

- [ ] **Step 4: コミット**

```bash
rtk git add api/housing/_registerListingHandler.ts
rtk git commit -m "feat(housing): 登録ハンドラが SNS 画像を保存（'none' 決め打ち廃止）"
```

- [ ] **Step 5: 🔍 実機確認 (A)+(B) — ユーザーと一緒に**

ローカル `npm run dev`（または本番デプロイ後 lopoly.app）でログインし:
1. ツイート URL を貼って自動入力 → プレビューに画像が出る
2. 必須を確定して登録
3. 登録した物件を中央一覧から開く → **詳細ギャラリーにツイート画像が表示される**（No image が解消）

> 画像が出ない場合の切り分け: Firestore の該当 doc に `imageMode:'sns'` / `ogImageUrl`（pbs.twimg.com）が保存されているか確認 → 保存はあるが表示されないなら `HousingPhotoGallery` / CSP を見る。memory `feedback_one_fix_one_verify`。

---

## Task 7: サーバー検証つき削除エンドポイント (D)

**Files:**
- Create: `api/housing/_purgeIfTweetGoneHandler.ts`
- Modify: `api/housing/index.ts:24,49-50`
- Modify: `src/lib/housingApiClient.ts`（末尾に `purgeIfTweetGone`）
- Test: `src/__tests__/housing/housingApiClient.test.ts`

- [ ] **Step 1: クライアントの失敗するテストを書く**

`src/__tests__/housing/housingApiClient.test.ts` に追加:

```ts
describe('purgeIfTweetGone', () => {
  it('POST purge-if-tweet-gone で deleted フラグを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { purgeIfTweetGone } = await import('../../lib/housingApiClient');
    const res = await purgeIfTweetGone('l1');
    expect(res.deleted).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/housing?action=purge-if-tweet-gone'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('対象外 (400) は deleted=false を返す（投げない）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'not_sns' }), { status: 400 }),
    );
    const { purgeIfTweetGone } = await import('../../lib/housingApiClient');
    const res = await purgeIfTweetGone('l1');
    expect(res.deleted).toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `rtk vitest run src/__tests__/housing/housingApiClient.test.ts`
Expected: FAIL（`purgeIfTweetGone` 未定義）

- [ ] **Step 3: クライアントを実装**

`src/lib/housingApiClient.ts` の末尾に追加:

```ts
export interface PurgeResponse {
  deleted: boolean;
}

/**
 * ツイートが削除済みなら物件を soft delete するようサーバーに依頼する。
 * 削除の真偽はサーバーが syndication 404 を再確認してから判定する（家主以外でも安全）。
 * 失敗・対象外は { deleted: false } を返す（呼び出し側で握りつぶせるよう投げない）。
 */
export async function purgeIfTweetGone(listingId: string): Promise<PurgeResponse> {
  try {
    const headers = await buildHeaders(true);
    const res = await fetch(`${API_BASE}?action=purge-if-tweet-gone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ listingId }),
    });
    if (!res.ok) return { deleted: false };
    const body = (await res.json().catch(() => ({}))) as Partial<PurgeResponse>;
    return { deleted: body.deleted === true };
  } catch {
    return { deleted: false };
  }
}
```

- [ ] **Step 4: クライアントテストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/housingApiClient.test.ts`
Expected: PASS

- [ ] **Step 5: サーバーハンドラを作成**

`api/housing/_purgeIfTweetGoneHandler.ts`（`_deleteListingHandler.ts` を踏襲、家主チェックなし・syndication 再確認あり）:

```ts
/**
 * POST /api/housing?action=purge-if-tweet-gone
 *
 * SNS 連動物件のツイートが削除済みかをサーバーが再確認し、404 のときだけ soft delete する。
 * 認可: App Check + Firebase 認証 + rate limit。家主チェックはしない
 *   （削除権限の根拠は「ツイートが実際に 404 か」をサーバーが確認する点。
 *    生きているツイートの物件は第三者が叩いても消せない = いたずら削除不可）。
 * Body: { listingId }
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { checkTweetStatus } from '../../src/lib/housing/tweetSyndication.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    await getAuth().verifyIdToken(token);

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);
    const snap = await listingRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const data = snap.data()!;

    if (data.imageMode !== 'sns' || !data.tweetId) {
      return res.status(400).json({ error: 'not_sns' });
    }
    if (data.deletedAt) {
      return res.status(200).json({ deleted: true }); // 既に削除済み = idempotent
    }

    const status = await checkTweetStatus(String(data.tweetId));
    const now = Date.now();

    if (status === 'gone') {
      await listingRef.update({ deletedAt: now, updatedAt: now });
      return res.status(200).json({ deleted: true });
    }
    if (status === 'alive') {
      await listingRef.update({ lastTweetCheckAt: now });
      return res.status(200).json({ deleted: false });
    }
    // status === 'error': fail-safe。何も触らず deleted:false（lastTweetCheckAt も据え置き）
    return res.status(200).json({ deleted: false });
  } catch (error: any) {
    console.error('[housing/purge-if-tweet-gone] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 6: ルートを登録**

`api/housing/index.ts` の import 群に追加（24 行の直後）:
```ts
import purgeIfTweetGoneHandler from './_purgeIfTweetGoneHandler.js';
```

switch に case 追加（`resolve-report` case の直後、49-50 行付近）:
```ts
    case 'resolve-report':
      return resolveReportHandler(req, res);
    case 'purge-if-tweet-gone':
      return purgeIfTweetGoneHandler(req, res);
```

冒頭コメント（13 行付近）にも 1 行追記:
```ts
 * ?action=purge-if-tweet-gone       → POST SNS 物件のツイート削除を再確認し 404 なら soft delete
```

- [ ] **Step 7: 型チェック + 全体ユニット**

Run: `rtk tsc`
Expected: 新規エラーなし

Run: `rtk vitest run`
Expected: 全 PASS

- [ ] **Step 8: コミット**

```bash
rtk git add api/housing/_purgeIfTweetGoneHandler.ts api/housing/index.ts src/lib/housingApiClient.ts src/__tests__/housing/housingApiClient.test.ts
rtk git commit -m "feat(housing): サーバー検証つき削除エンドポイント purge-if-tweet-gone を追加"
```

- [ ] **Step 9: 🔍 実機確認 (D) 単体 — ユーザーと一緒に**

デプロイ後、SNS 物件 1 件で:
1. **ツイートを消さずに** purge を叩く（DevTools console: `fetch('/api/housing?action=purge-if-tweet-gone', {...})` か、後続 Task 8 の開いた時チェックで確認）→ `{deleted:false}`、物件は消えない（いたずら削除不可の確認）
2. 元ツイートを削除してから叩く → `{deleted:true}`、Firestore で `deletedAt` が入る

> この単体確認は手動 fetch が手間なら Task 8 の実機確認と統合してよい。

---

## Task 8: 開いた時チェック (C)

**Files:**
- Modify: `src/components/housing/listing/HousingDetailModalRoute.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`（`housing.detail.postRemoved`）

> **設計判断（要ユーザー合意）:** 設計書 §4-3 は「モーダル内で案内表示に差し替え」だが、本ファイルには既に `notFound` → `showToast('housing.detail.unavailable')` + `close()` という確立済みパターンがあり、#50 で出した「削除済みカード → toast 案内」とも一貫する。よって本 Task では **toast + 自動クローズ + 一覧除去** で実装する（新規プロップを 3 コンポーネントに通さず、既存 UX に揃える）。実機確認時にユーザーに提示して承認を得る。

- [ ] **Step 1: i18n キーを 4 ファイルに追加**

`src/locales/ja.json` の `housing.detail`（`unavailable` の直後、2197 行）に追加:
```json
            "unavailable": "この物件は削除されたか、 表示できません",
            "postRemoved": "元の投稿が削除されたため、 この物件の掲載も終了しました"
```

`src/locales/en.json` / `ko.json` / `zh.json` の同じ `housing.detail` ブロックにも同一キーを追加（値は当面 ja コピーで可、en だけ任意で英訳: "This listing was removed because its original post was deleted."）。**4 ファイルすべてに `postRemoved` が無いと該当言語で表示崩れ**になるため必ず入れる。

- [ ] **Step 2: ルートに開いた時チェックを実装**

`src/components/housing/listing/HousingDetailModalRoute.tsx`:

import に追加（21-22 行付近）:
```ts
import { purgeIfTweetGone } from '../../../lib/housingApiClient';
```

`viewerUid` 定義の直後あたりに ref を追加（43 行付近）:
```ts
  const viewerUid = auth.currentUser?.uid ?? null;
  // SNS 物件のツイート生存チェックは listingId ごとに 1 回だけ走らせる
  const tweetCheckedRef = useRef<string | null>(null);
```

`notFound` の useEffect（111-117 行）の直後に、開いた時チェックの useEffect を追加:
```ts
  // SNS 連動物件を開いたら、その瞬間にツイート生存を確認する (UX = 即フィードバック)。
  // 実削除の真偽判定はサーバー (purge-if-tweet-gone) が syndication 404 を再確認してから行う。
  useEffect(() => {
    if (!listing) return;
    if (listing.imageMode !== 'sns' || !listing.tweetId) return;
    if (tweetCheckedRef.current === listing.id) return;
    tweetCheckedRef.current = listing.id;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tweet-meta?id=${encodeURIComponent(listing.tweetId!)}`);
        if (cancelled || res.status !== 404) return; // 生存 or エラー → fail-safe、何もしない
        const result = await purgeIfTweetGone(listing.id); // サーバーが 404 を再確認
        if (cancelled || !result.deleted) return;
        useHousingListingsStore.getState().remove(listing.id); // ②で追加した remove を再利用
        showToast(t('housing.detail.postRemoved'), 'info');
        close();
      } catch {
        /* ネットワーク失敗時は削除しない (fail-safe。生きている物件を誤って消さない) */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing]);
```

> `close` は `navigate(-1)`。既存の notFound effect 同様 eslint-disable で deps を listing のみにする。`useRef` は既に import 済み（13 行）。

- [ ] **Step 3: 型チェック + 全体ユニット**

Run: `rtk tsc`
Expected: 新規エラーなし

Run: `rtk vitest run`
Expected: 全 PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/housing/listing/HousingDetailModalRoute.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(housing): SNS 物件を開いた時にツイート生存を確認し削除済みなら自動撤去 (C)"
```

- [ ] **Step 5: 🔍 実機確認 (C) — ユーザーと一緒に**

デプロイ後:
1. SNS 物件を登録（画像表示を確認）
2. 元ツイートを X で削除
3. その物件を中央一覧から開く → toast「元の投稿が削除されたため…」が出てモーダルが閉じ、**一覧からも消える**（リロード不要）
4. 生きているツイートの物件を開いても何も起きない（誤削除しない）

> ユーザーに「toast + 自動クローズ」方式で問題ないか提示し承認を得る（設計書のモーダル内案内からの簡略化）。

---

## Task 9: ローリングバッチ cron (E)

**Files:**
- Create: `api/cron/check-sns-tweets/index.ts`
- Modify: `firestore.indexes.json`
- Modify: `vercel.json:12-14`

- [ ] **Step 1: 複合インデックスを追加**

`firestore.indexes.json` の `indexes` 配列に追加:
```json
    {
      "collectionGroup": "housing_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "imageMode", "order": "ASCENDING" },
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "lastTweetCheckAt", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 2: インデックスをデプロイ**

Run: `rtk npx firebase deploy --only firestore:indexes`
Expected: インデックス作成が投入される（数分でビルド完了）。

> CLI 認証が無い / `.env.local` の鍵が壊れている場合は、cron 初回実行時に Firestore が返すエラーに含まれるコンソール URL からも作成できる。その場合はユーザーに URL を渡してブラウザで「インデックスを作成」を押してもらう（memory `feedback_shell_commands`: shell は Claude が叩くが、外部コンソール操作はユーザー依頼）。

- [ ] **Step 3: cron を作成**

`api/cron/check-sns-tweets/index.ts`（auth は `cleanup-og-images` と同方式、firestore-admin は `adminAuth` を再利用）:

```ts
/**
 * Vercel Cron — SNS 連動物件のツイート生存ローリングチェック
 *
 * 1 日 1 回、最も長く未確認の SNS 物件を古い順に N 件確認し、
 * 元ツイートが 404 (削除/非公開) なら物件を soft delete する。
 *
 * スケール根拠 (設計書 §4-5):
 *   人気物件は「開いた時チェック (C)」が即捕まえ lastTweetCheckAt を更新するため、
 *   cron は誰も開かない長い裾野を少しずつ掃除する安全網。固定バッチで 10 万件でも破綻しない。
 *
 * 認証: Vercel Cron が付与する `Authorization: Bearer <CRON_SECRET>`。
 *   CRON_SECRET は Vercel ダッシュボードで設定済みであること（未設定なら 401）。
 */
import { initAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { checkTweetStatus } from '../../../src/lib/housing/tweetSyndication.js';

const DEFAULT_BATCH = 150;

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || '';
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!expected || authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    initAdmin();
    const db = getAdminFirestore();
    const batch = Number(process.env.HOUSING_TWEET_CHECK_BATCH) || DEFAULT_BATCH;

    const snap = await db
      .collection('housing_listings')
      .where('imageMode', '==', 'sns')
      .where('deletedAt', '==', null)
      .orderBy('lastTweetCheckAt', 'asc')
      .limit(batch)
      .get();

    let deleted = 0;
    let alive = 0;
    let errored = 0;
    const now = Date.now();

    // 並列度は小さめ (Twitter を叩きすぎない)。逐次で十分軽量。
    for (const doc of snap.docs) {
      const data = doc.data();
      const tweetId = data.tweetId ? String(data.tweetId) : null;
      if (!tweetId) {
        errored++;
        continue;
      }
      const status = await checkTweetStatus(tweetId);
      if (status === 'gone') {
        await doc.ref.update({ deletedAt: now, updatedAt: now });
        deleted++;
      } else if (status === 'alive') {
        await doc.ref.update({ lastTweetCheckAt: now });
        alive++;
      } else {
        errored++; // fail-safe: 何も触らない (lastTweetCheckAt 据え置き = 次回再試行)
      }
    }

    return res.status(200).json({ checked: snap.size, deleted, alive, errored });
  } catch (err: any) {
    console.error('[cron/check-sns-tweets] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 4: vercel.json に cron を登録**

`vercel.json` の `crons`（12-14 行）に追加（`cleanup-og-images` の日曜 3:00 とずらして毎日 4:00 UTC）:
```json
  "crons": [
    { "path": "/api/cron/cleanup-og-images", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/check-sns-tweets", "schedule": "0 4 * * *" }
  ],
```

> Hobby プランは cron 1 日 1 回・最大 2 本まで。これで 2 本（weekly + daily）= 上限内。memory `feedback_vercel_builds`。

- [ ] **Step 5: 型チェック + 全体ユニット + ビルド**

Run: `rtk tsc`
Expected: 新規エラーなし

Run: `rtk vitest run`
Expected: 全 PASS

Run: `rtk npm run build`
Expected: ビルド成功（push 前必須、memory `feedback_build_check`）

- [ ] **Step 6: コミット**

```bash
rtk git add api/cron/check-sns-tweets/index.ts firestore.indexes.json vercel.json
rtk git commit -m "feat(housing): SNS ツイート生存ローリングチェック cron を追加 (E)"
```

- [ ] **Step 7: 🔍 実機確認 (E) — ユーザーと一緒に**

デプロイ後、手動トリガで確認:
```bash
rtk curl -H "Authorization: Bearer <CRON_SECRET>" https://lopoly.app/api/cron/check-sns-tweets
```
（CRON_SECRET は `.env.local` / Vercel ダッシュボード参照。Claude が叩く）
Expected: `{ checked, deleted, alive, errored }` が返る。削除済みツイートの物件が `deletedAt` 入り・一覧から消える。インデックス未作成なら 500 + コンソール URL がログに出る → URL からインデックス作成。

問題なければ cron スケジュールはそのまま稼働。

---

## 完了後

- `docs/TODO.md` の「現在の状態」と Phase 3 ③ を完了に更新、完了分は `TODO_COMPLETED.md` へ移動。
- 残課題として TODO に残すもの（設計書 §2「含まない」）: 編集モーダルでの画像差し替え UI、複数枚ギャラリー、tweet 連動削除時の家主通知（YAGNI で不要）。
- TODO.md 行数チェック（`wc -l docs/TODO.md` で 100 行以内）。

---

## セルフレビュー結果（プラン作成者による spec 突合）

**1. spec カバレッジ:**
- §1-1/§4-1/§4-2 (A)(B) 登録経路 → Task 4/5/6 ✅
- §3 データモデル (`tweetId`/`lastTweetCheckAt`) → Task 2 ✅
- §1-3/§4-3 (C) 開いた時チェック → Task 8 ✅
- §4-4 (D) サーバー検証つき削除 → Task 7 ✅
- §4-5 (E) cron + 複合インデックス → Task 9 ✅
- §4-4/§4-5 syndication 共有モジュール → Task 1 ✅
- §5 エラーハンドリング（fail-safe = error は消さない / 404 のみ削除 / idempotent）→ Task 1 の `checkTweetStatus` + Task 7/8/9 で反映 ✅
- §6 テスト方針（validateImage / buildListingImageFields / toRegistrationDraft / フォーム / クライアント / 共有モジュール）→ Task 1/3/4/5/7 ✅。ハンドラ・cron 本体のユニットは repo に firebase-admin モック基盤が無いため実機確認に委ねる（純粋ロジックは関数抽出済み）。

**2. プレースホルダー:** なし（全ステップに実コード）。

**3. 型整合:** `checkTweetStatus`/`syndicationUrl`（Task 1）、`buildListingImageFields(draft, now)`/`validateImage`（Task 3）、`purgeIfTweetGone(listingId): {deleted}`（Task 7）、`HousingRegisterFormValues.{postUrl,ogImageUrl,tweetId}`（Task 4）、`RegistrationDraft.{imageMode,postUrl,ogImageUrl,tweetId}`（Task 3）— 後続 Task の参照と一致を確認済み。

**設計書からの逸脱（要ユーザー承認）1 点:** Task 8 の (C) を「モーダル内案内表示への差し替え」ではなく「toast + 自動クローズ + 一覧除去」で実装（既存 `unavailable` パターン・#50 の挙動と一貫させるため）。実機確認ステップでユーザーに提示する。
