# 複数投稿URL登録機能(Batch 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング物件の登録・編集ページで、投稿URLを1つでなく最大5個まで貼れるようにし、複数投稿(Twitterスレッド等)から画像を集約・住所を自動入力できるようにする。

**Architecture:** 既存の「1URL→SnsCapture→buildDraftImageFields」という排他的パイプラインを、複数URLの結果を**インクリメンタルに集約**する形に変える。各URL入力欄(`HousingRegisterSnsUrlField`)自体は変更せず、新設の薄いラッパー(`HousingRegisterMultiUrlField`)が最大5枚の入力欄を並べて同じコールバックへ流し込む。重複URL検出・動画1本制限は小さな純関数(`multiSourceGuards.ts`)に切り出し、登録ページ・編集ページ両方から使う。

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest, Firebase Admin (API Functions), react-i18next。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-21-housing-multi-source-url-design.md`(この計画の正典、矛盾したら設計書を優先して確認する)。
- 最大URL数 = 5、画像上限 = 10枚(`MAX_SOURCE_IMAGE_URLS`、既存)、動画上限 = 1本(既存、変更なし)。画像と動画は**別枠**(合計ではない)。
- 画像/動画は保存時のvalidationでのみ上限チェックする。取得時に先読みで切り捨てない(ユーザーが手動で減らす前提)。
- 動画が2本目以降来たら、動画部分だけ拒否(トースト表示)、画像は通常通り追加する。
- 住所自動入力は「貼った順に最初に見つかったもの」を採用し、以降のURLでは上書きしない。
- 直接アップロード(`localImages`/`thumbnailPaths`)のフローは今回変更しない(Batch2の対象外)。
- i18nは4言語(ja/en/ko/zh)全てにキーを追加する(パリティ必須)。
- 既存の単一URL物件(`sourcePostUrls`未設定)は`sourcePostUrls ?? (postUrl ? [postUrl] : [])`で必ずフォールバックし、表示・編集とも壊れないこと。
- push前ゲート: `npm run build && npx vitest run`(最終タスクで実行)。

---

### Task 1: データ型に `sourcePostUrls` を追加

**Files:**
- Modify: `src/types/housing.ts:126`(`postUrl?: string;` の直後)
- Modify: `src/utils/housingValidation.ts:63`(`RegistrationDraft` の `postUrl?: string;` の直後)

**Interfaces:**
- Produces: `HousingListing.sourcePostUrls?: string[]`、`RegistrationDraft.sourcePostUrls?: string[]`(以降の全タスクがこの型を前提にする)

- [ ] **Step 1: `HousingListing` に `sourcePostUrls` を追加**

`src/types/housing.ts` の126行目 `postUrl?: string;` の直後に追記:

```ts
  /**
   * 2026-07-21 追加 (Batch2・複数投稿URL登録): 貼った投稿URLの一覧(貼った順、最大5件)。
   * postUrl (単数、後方互換) は sourcePostUrls[0] と同値で維持する。
   * 未設定 (旧データ) の場合は表示側で `sourcePostUrls ?? (postUrl ? [postUrl] : [])` にフォールバックする。
   */
  sourcePostUrls?: string[];
```

- [ ] **Step 2: `RegistrationDraft` に `sourcePostUrls` を追加**

`src/utils/housingValidation.ts` の63行目 `postUrl?: string;` の直後に追記:

```ts
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧(貼った順、最大5件、MAX_SOURCE_POST_URLS同期)。 */
  sourcePostUrls?: string[];
```

- [ ] **Step 3: 型チェックのみ確認 (この時点ではロジック未実装なので既存テストは変化しない)**

Run: `npx tsc -b --noEmit`
Expected: エラーなし(新規 optional フィールド追加のみなので既存コードは全て互換)

- [ ] **Step 4: Commit**

```bash
git add src/types/housing.ts src/utils/housingValidation.ts
git commit -m "feat(housing): HousingListing/RegistrationDraftにsourcePostUrls型を追加"
```

---

### Task 2: `validateImage` の複数URL対応 + `buildListingImageFields` への組み込み

**Files:**
- Modify: `src/utils/housingValidation.ts:288`(`MAX_SOURCE_IMAGE_URLS` の直後に定数追加)
- Modify: `src/utils/housingValidation.ts`(`validateImage` 関数、324-417行目)
- Modify: `src/utils/housingValidation.ts`(`buildListingImageFields` 関数、432-514行目)
- Test: `src/__tests__/housing/housingValidation.test.ts`

**Interfaces:**
- Consumes: Task1の `RegistrationDraft.sourcePostUrls`
- Produces: `buildListingImageFields()` の戻り値に `sourcePostUrls?: string[]` を追加。`postUrl` は `sourcePostUrls?.[0] ?? draft.postUrl` で後方互換を維持。

- [ ] **Step 1: 失敗するテストを書く(validateImage: sourcePostUrls検証)**

`src/__tests__/housing/housingValidation.test.ts` に追記:

```ts
import { validateImage, buildListingImageFields, type RegistrationDraft } from '../../utils/housingValidation';

const baseSnsDraft: RegistrationDraft = {
  dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane', ward: 3,
  buildingType: 'house', plot: 12, size: 'S',
  tags: [],
  imageMode: 'sns',
  postUrl: 'https://x.com/foo/status/111',
  ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
  tweetId: '111',
  sourceImageUrls: ['https://pbs.twimg.com/media/a.jpg'],
};

describe('validateImage: sourcePostUrls (Batch2)', () => {
  it('5件以内なら ok', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: [
        'https://x.com/foo/status/111',
        'https://x.com/foo/status/222',
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('6件以上は too_many エラー', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: Array.from({ length: 6 }, (_, i) => `https://x.com/foo/status/${i}`),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.sourcePostUrls).toBe('too_many');
  });

  it('不正な host が混ざっていたら invalid_url エラー', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: ['https://x.com/foo/status/111', 'https://evil.example.com/x'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.sourcePostUrls).toBe('invalid_url');
  });

  it('sourcePostUrls 未指定でも既存の単一 postUrl 検証は影響を受けない', () => {
    const r = validateImage(baseSnsDraft);
    expect(r.ok).toBe(true);
  });
});

describe('buildListingImageFields: sourcePostUrls (Batch2)', () => {
  it('sourcePostUrls があれば結果に含まれ、postUrl は先頭と一致する', () => {
    const fields = buildListingImageFields(
      {
        ...baseSnsDraft,
        sourcePostUrls: ['https://x.com/foo/status/111', 'https://x.com/foo/status/222'],
      },
      1_700_000_000_000,
    );
    expect(fields).toMatchObject({
      postUrl: 'https://x.com/foo/status/111',
      sourcePostUrls: ['https://x.com/foo/status/111', 'https://x.com/foo/status/222'],
    });
  });

  it('sourcePostUrls 未指定なら sourcePostUrls キー自体を持たない(後方互換)', () => {
    const fields = buildListingImageFields(baseSnsDraft, 1_700_000_000_000);
    expect('sourcePostUrls' in fields).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: FAIL (`errors.sourcePostUrls` が undefined、`sourcePostUrls` が結果に無い)

- [ ] **Step 3: `MAX_SOURCE_POST_URLS` 定数を追加**

`src/utils/housingValidation.ts` の288行目 `const MAX_SOURCE_IMAGE_URLS = 10;` の直後に追記:

```ts

/** 2026-07-21 追加 (Batch2): 1物件に貼れる投稿URLの最大数。 */
const MAX_SOURCE_POST_URLS = 5;
```

- [ ] **Step 4: `validateImage` に sourcePostUrls 検証を追加**

`src/utils/housingValidation.ts` の`validateImage`関数内、`return Object.keys(errors).length > 0 ? fail(errors) : ok();`(417行目)の直前に追記:

```ts

  // 2026-07-21 追加 (Batch2): 複数投稿URL。未指定なら従来通り postUrl 単数のみで判定 (後方互換)。
  if (draft.sourcePostUrls !== undefined) {
    const urls = draft.sourcePostUrls;
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_SOURCE_POST_URLS) {
      errors.sourcePostUrls = 'too_many';
    } else if (urls.some((u) => typeof u !== 'string' || !isKnownPostUrlHost(u))) {
      errors.sourcePostUrls = 'invalid_url';
    } else if (new Set(urls).size !== urls.length) {
      errors.sourcePostUrls = 'duplicate';
    }
  }
```

- [ ] **Step 5: `buildListingImageFields` の戻り値型と実装に `sourcePostUrls` を追加**

`src/utils/housingValidation.ts` の432-450行目の関数シグネチャ(戻り値の Union 型)を以下に置き換え:

```ts
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | {
      imageMode: 'sns';
      postUrl: string;
      ogImageUrl: string;
      tweetId: string;
      lastTweetCheckAt: number;
      sourcePostUrls?: string[];
      sourceImageUrls?: string[];
      sourceImageAspectRatios?: number[];
      videoUrl?: string;
      videoPosterUrl?: string;
      videoAspectRatio?: number;
    }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; youtubeVideoId: string; sourcePostUrls?: string[] }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; sourceImageUrls: string[]; sourceImageAspectRatios?: number[]; sourcePostUrls?: string[] }
  | { imageMode: 'none'; postUrl?: string } {
  // 2026-07-21 追加 (Batch2): sourcePostUrls[0] を postUrl として使う (後方互換・cron監視対象は先頭のみ)。
  const effectivePostUrl =
    Array.isArray(draft.sourcePostUrls) && draft.sourcePostUrls.length > 0
      ? draft.sourcePostUrls[0]
      : draft.postUrl;
  const sourcePostUrlsField =
    Array.isArray(draft.sourcePostUrls) && draft.sourcePostUrls.length > 0
      ? { sourcePostUrls: draft.sourcePostUrls.slice(0, MAX_SOURCE_POST_URLS) }
      : {};

  if (draft.imageMode === 'sns' && effectivePostUrl && draft.ogImageUrl) {
    if (draft.tweetId) {
      const base = {
        imageMode: 'sns' as const,
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        tweetId: draft.tweetId,
        lastTweetCheckAt: now,
        ...sourcePostUrlsField,
      };
      const hasImages =
        Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;
      return {
        ...base,
        ...(draft.videoUrl
          ? {
              videoUrl: draft.videoUrl,
              ...(draft.videoPosterUrl ? { videoPosterUrl: draft.videoPosterUrl } : {}),
              ...(draft.videoAspectRatio !== undefined
                ? { videoAspectRatio: draft.videoAspectRatio }
                : {}),
            }
          : {}),
        ...(hasImages
          ? { sourceImageUrls: draft.sourceImageUrls!.slice(0, MAX_SOURCE_IMAGE_URLS) }
          : {}),
        ...(hasImages && Array.isArray(draft.sourceImageAspectRatios)
          ? {
              sourceImageAspectRatios: draft.sourceImageAspectRatios
                .slice(0, MAX_SOURCE_IMAGE_URLS)
                .map((r) => (typeof r === 'number' && isFinite(r) && r > 0 ? r : 0)),
            }
          : {}),
      };
    }
    if (draft.youtubeVideoId) {
      return {
        imageMode: 'sns',
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        youtubeVideoId: draft.youtubeVideoId,
        ...sourcePostUrlsField,
      };
    }
    if (Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0) {
      return {
        imageMode: 'sns',
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        sourceImageUrls: draft.sourceImageUrls.slice(0, MAX_SOURCE_IMAGE_URLS),
        ...sourcePostUrlsField,
        ...(Array.isArray(draft.sourceImageAspectRatios)
          ? {
              sourceImageAspectRatios: draft.sourceImageAspectRatios
                .slice(0, MAX_SOURCE_IMAGE_URLS)
                .map((r) => (typeof r === 'number' && isFinite(r) && r > 0 ? r : 0)),
            }
          : {}),
      };
    }
  }
  return effectivePostUrl ? { imageMode: 'none', postUrl: effectivePostUrl } : { imageMode: 'none' };
}
```

- [ ] **Step 6: テストを再実行して成功を確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: PASS(全件)

- [ ] **Step 7: Commit**

```bash
git add src/utils/housingValidation.ts src/__tests__/housing/housingValidation.test.ts
git commit -m "feat(housing): sourcePostUrlsのvalidation+buildListingImageFields組み込み(Batch2)"
```

---

### Task 3: `_updateListingHandler.ts` に sourcePostUrls を通す

**Files:**
- Modify: `api/housing/_updateListingHandler.ts:90`(draftForValidation構築)
- Modify: `api/housing/_updateListingHandler.ts:198-207`(SNS_SUBFIELDSクリーンアップ配列)

**Interfaces:**
- Consumes: Task2の `buildListingImageFields` (既に `sourcePostUrls` を返すようになっている)
- Produces: 更新APIが `sourcePostUrls` を受け取り保存できる。`_registerListingHandler.ts` は `buildListingImageFields` の出力をそのまま `tx.set` するので**変更不要**(自動的に反映される)。

- [ ] **Step 1: draftForValidation に sourcePostUrls を追加**

`api/housing/_updateListingHandler.ts` の90行目 `sourceImageUrls: updates.sourceImageUrls,` の直前に追記:

```ts
      sourcePostUrls: updates.sourcePostUrls,
```

- [ ] **Step 2: SNS_SUBFIELDS クリーンアップ配列に sourcePostUrls を追加**

`api/housing/_updateListingHandler.ts` の198-207行目の配列に `'sourcePostUrls'` を追加:

```ts
          const SNS_SUBFIELDS = [
            'tweetId',
            'youtubeVideoId',
            'sourceImageUrls',
            'sourceImageAspectRatios',
            'videoUrl',
            'videoPosterUrl',
            'videoAspectRatio',
            'lastTweetCheckAt',
            'sourcePostUrls',
          ] as const;
```

- [ ] **Step 3: 既存の update ハンドラテストがあれば実行して回帰がないか確認**

Run: `npx vitest run api/housing`
Expected: 既存テストは全てPASS(このハンドラに対する直接のテストファイルが無ければスキップしてよい。`Glob api/housing/__tests__/*updateListing*` で存在確認すること)

- [ ] **Step 4: Commit**

```bash
git add api/housing/_updateListingHandler.ts
git commit -m "feat(housing): update-listing APIでsourcePostUrlsを受け渡す(Batch2)"
```

---

### Task 4: 重複URL検出・動画競合の共有ガード関数

**Files:**
- Create: `src/lib/housing/multiSourceGuards.ts`
- Test: `src/lib/housing/__tests__/multiSourceGuards.test.ts`

**Interfaces:**
- Produces: `isDuplicatePostUrl(existingUrls: readonly string[], candidate: string): boolean`、`shouldRejectIncomingVideo(hasExistingVideo: boolean, incomingHasVideo: boolean): boolean`
- 登録ページ(Task6)・編集ページ(Task8)の両方から import して使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/multiSourceGuards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../multiSourceGuards';

describe('isDuplicatePostUrl', () => {
  it('既存リストに同じURLがあれば true', () => {
    expect(isDuplicatePostUrl(['https://x.com/a/status/1'], 'https://x.com/a/status/1')).toBe(true);
  });
  it('既存リストに無ければ false', () => {
    expect(isDuplicatePostUrl(['https://x.com/a/status/1'], 'https://x.com/a/status/2')).toBe(false);
  });
  it('空リストなら常に false', () => {
    expect(isDuplicatePostUrl([], 'https://x.com/a/status/1')).toBe(false);
  });
});

describe('shouldRejectIncomingVideo', () => {
  it('既存動画が無ければ拒否しない', () => {
    expect(shouldRejectIncomingVideo(false, true)).toBe(false);
  });
  it('既存動画があり今回も動画付きなら拒否する', () => {
    expect(shouldRejectIncomingVideo(true, true)).toBe(true);
  });
  it('既存動画があっても今回動画が無ければ拒否しない', () => {
    expect(shouldRejectIncomingVideo(true, false)).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/multiSourceGuards.test.ts`
Expected: FAIL (`multiSourceGuards` モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/lib/housing/multiSourceGuards.ts`:

```ts
/**
 * 複数投稿URL登録 (Batch2・2026-07-21) の共通ガード。
 * 登録ページ (RegisterPage) と編集ページ (HousingEditSourcePanel) の両方から使う、
 * 「重複URLの拒否」「動画1本制限」の判定だけを持つ純関数。副作用 (トースト表示等) は
 * 呼び出し側の責務とする。
 */

/** 既に使われている投稿URL一覧の中に candidate と完全一致するものがあるか。 */
export function isDuplicatePostUrl(existingUrls: readonly string[], candidate: string): boolean {
  return existingUrls.includes(candidate);
}

/**
 * 動画は1物件1本まで。既に動画を保持している状態で、今回のURLにも動画が含まれる場合は
 * その動画部分を拒否する (画像は呼び出し側で別途マージしてよい)。
 */
export function shouldRejectIncomingVideo(hasExistingVideo: boolean, incomingHasVideo: boolean): boolean {
  return hasExistingVideo && incomingHasVideo;
}
```

- [ ] **Step 4: テストを再実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/multiSourceGuards.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/multiSourceGuards.ts src/lib/housing/__tests__/multiSourceGuards.test.ts
git commit -m "feat(housing): 重複URL/動画1本制限の共有ガード関数を追加(Batch2)"
```

---

### Task 5: `HousingRegisterMultiUrlField` ラッパーコンポーネント

**Files:**
- Create: `src/components/housing/register/HousingRegisterMultiUrlField.tsx`
- Test: `src/components/housing/register/__tests__/HousingRegisterMultiUrlField.test.tsx`

**Interfaces:**
- Consumes: 既存 `HousingRegisterSnsUrlField`(`onTweetFetched`/`onYoutubeFetched`/`onOgpFetched`/`suppressInlineFetchStatus` props、変更なし)
- Produces: `HousingRegisterMultiUrlField` コンポーネント。`slotCount`/`onAddSlot`/`onRemoveSlot`/`maxSlots`/`onTweetFetched`/`onYoutubeFetched`/`onOgpFetched` props。全スロットが同じ3つのコールバックへ結果を流す(スロット番号を親に伝える必要はない。親側は集約状態だけ管理する設計、Task6/Task8参照)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/register/__tests__/HousingRegisterMultiUrlField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { HousingRegisterMultiUrlField } from '../HousingRegisterMultiUrlField';

function renderField(props: Partial<React.ComponentProps<typeof HousingRegisterMultiUrlField>> = {}) {
  const onAddSlot = vi.fn();
  const onRemoveSlot = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <HousingRegisterMultiUrlField
        slotCount={1}
        onAddSlot={onAddSlot}
        onRemoveSlot={onRemoveSlot}
        onTweetFetched={vi.fn()}
        onYoutubeFetched={vi.fn()}
        onOgpFetched={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onAddSlot, onRemoveSlot };
}

describe('HousingRegisterMultiUrlField', () => {
  it('slotCount=1 のとき URL入力欄が1個だけ表示される', () => {
    renderField({ slotCount: 1 });
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('slotCount=3 のとき URL入力欄が3個表示される', () => {
    renderField({ slotCount: 3 });
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('「URLを追加」ボタン押下で onAddSlot が呼ばれる', () => {
    const { onAddSlot } = renderField({ slotCount: 1 });
    fireEvent.click(screen.getByTestId('housing-multi-url-add'));
    expect(onAddSlot).toHaveBeenCalledTimes(1);
  });

  it('slotCount が maxSlots (既定5) のとき「URLを追加」ボタンが出ない', () => {
    renderField({ slotCount: 5 });
    expect(screen.queryByTestId('housing-multi-url-add')).toBeNull();
  });

  it('slotCount=1 のときは削除ボタンが出ない(最低1欄は残す)', () => {
    renderField({ slotCount: 1 });
    expect(screen.queryByTestId('housing-multi-url-remove-0')).toBeNull();
  });

  it('slotCount=2 のとき各欄に削除ボタンが出て押すと onRemoveSlot(index) が呼ばれる', () => {
    const { onRemoveSlot } = renderField({ slotCount: 2 });
    fireEvent.click(screen.getByTestId('housing-multi-url-remove-1'));
    expect(onRemoveSlot).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/register/__tests__/HousingRegisterMultiUrlField.test.tsx`
Expected: FAIL (モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/components/housing/register/HousingRegisterMultiUrlField.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from './HousingRegisterSnsUrlField';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

export interface HousingRegisterMultiUrlFieldProps {
  /** 現在表示する URL 入力欄の数 (1..maxSlots)。 */
  slotCount: number;
  /** 「+ URLを追加」押下時 (親が slotCount を +1 する)。 */
  onAddSlot: () => void;
  /** 各欄の「✕」押下時、その index の欄を取り除く (親が slotCount を -1 する)。 */
  onRemoveSlot: (index: number) => void;
  /** 最大欄数。既定 5 (Batch2 設計書準拠)。 */
  maxSlots?: number;
  onTweetFetched: (
    data: TweetData,
    source: { postUrl: string; tweetId: string } | null,
  ) => void;
  onYoutubeFetched: (data: YoutubeFetchedData | null) => void;
  onOgpFetched: (data: OgpFetchedData | null) => void;
}

/**
 * 複数投稿URL登録 (Batch2・2026-07-21) の入力欄ラッパー。
 *
 * `HousingRegisterSnsUrlField` 自体は1URL分の取得ロジックしか持たないため変更しない。
 * このコンポーネントは単に slotCount 個のインスタンスを並べて「+ URLを追加」「✕ 削除」の
 * UI だけを足す。各インスタンスの取得結果 (onTweetFetched 等) は**全スロット共通の同じ
 * コールバックにそのまま流す** (スロット番号は親に渡さない)。重複URL検出・動画1本制限・
 * 住所の「最初に見つかった方を採用」は親 (RegisterPage / HousingEditSourcePanel) 側が
 * 集約済み state を見て判定する設計 (multiSourceGuards.ts 参照) — 個々のスロットが
 * 「自分が何番目か」を意識する必要がない、単純な構造にするため。
 */
export function HousingRegisterMultiUrlField({
  slotCount,
  onAddSlot,
  onRemoveSlot,
  maxSlots = 5,
  onTweetFetched,
  onYoutubeFetched,
  onOgpFetched,
}: HousingRegisterMultiUrlFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="housing-register-multi-url-field">
      {Array.from({ length: slotCount }).map((_, index) => (
        <div className="housing-register-multi-url-row" key={index}>
          <HousingRegisterSnsUrlField
            onTweetFetched={onTweetFetched}
            onYoutubeFetched={onYoutubeFetched}
            onOgpFetched={onOgpFetched}
            suppressInlineFetchStatus={false}
          />
          {slotCount > 1 && (
            <button
              type="button"
              className="housing-register-multi-url-remove"
              data-testid={`housing-multi-url-remove-${index}`}
              aria-label={t('housing.register.media.remove_url')}
              onClick={() => onRemoveSlot(index)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {slotCount < maxSlots && (
        <button
          type="button"
          className="housing-register-multi-url-add"
          data-testid="housing-multi-url-add"
          onClick={onAddSlot}
        >
          {t('housing.register.media.add_url')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: i18nキーが無いとテストが読めないので最小限のキーだけ先に追加**

`src/locales/ja.json` の `housing.register.media` ブロック内に追記(既存の `video_badge` キー等と同じ階層):

```json
                "add_url": "＋ URLを追加",
                "remove_url": "この投稿URLを取り除く",
```

`src/locales/en.json` の同じ階層に追記:

```json
                "add_url": "+ Add URL",
                "remove_url": "Remove this post URL",
```

`src/locales/ko.json`:

```json
                "add_url": "+ URL 추가",
                "remove_url": "이 게시물 URL 제거",
```

`src/locales/zh.json`:

```json
                "add_url": "+ 添加URL",
                "remove_url": "移除此帖子URL",
```

- [ ] **Step 5: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/register/__tests__/HousingRegisterMultiUrlField.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/register/HousingRegisterMultiUrlField.tsx src/components/housing/register/__tests__/HousingRegisterMultiUrlField.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 複数URL入力欄のラッパーコンポーネントを追加(Batch2)"
```

---

### Task 6: `RegisterPage.tsx` に複数URL集約ロジックを統合(登録フロー)

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`(state追加・3ハンドラ変更・buildDraft変更・オートセーブ)
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`(既存ファイルに追記)

**Interfaces:**
- Consumes: Task4の `isDuplicatePostUrl`/`shouldRejectIncomingVideo`、Task5の `HousingRegisterMultiUrlField`
- Produces: `buildDraft()` が `sourcePostUrls` を含むようになる。既存の `SnsCapture`/`sourceImageUrls`/`postUrl` state はそのまま残しつつ、複数スロット分をインクリメンタルに集約する。

- [ ] **Step 1: state追加 (541行目 `const [postUrl, setPostUrl] = useState<string>('');` の直後)**

```ts
  /**
   * 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (postUrl は従来通り「先頭/代表」を保持、
   * これは配列版)。重複URL検出 (multiSourceGuards.isDuplicatePostUrl) にも使う。
   */
  const [sourcePostUrls, setSourcePostUrls] = useState<string[]>(() =>
    mode === 'edit' && initialValues
      ? (initialValues.sourcePostUrls ?? (initialValues.postUrl ? [initialValues.postUrl] : []))
      : [],
  );
  /** 表示する URL 入力欄の数 (1..5)。 */
  const [urlSlotCount, setUrlSlotCount] = useState(1);
  /** 既に動画を1本捕捉済みか (2本目以降の動画を拒否する判定に使う、multiSourceGuards 参照)。 */
  const capturedVideoRef = useRef(false);
  /** 住所を既に (どれかのURLから) 自動入力済みか。true の間は以降のURLの住所は適用しない。 */
  const addressAppliedRef = useRef(false);
```

- [ ] **Step 2: `applyExtractedResult` の先頭に「最初に見つかった方だけ採用」ガードを追加**

`src/components/housing/pages/RegisterPage.tsx` の `applyExtractedResult` (575-634行目) の `useCallback` 本体、`const fills: Array<[string, unknown]> = [];` の直前に追記:

```ts
      // 2026-07-21 追加 (Batch2): 複数URL対応。一度どれかのURLから住所を適用したら、
      // 以降のURL (2本目以降) から抽出された住所は無視する (「最初に見つかった方を採用」)。
      if (addressAppliedRef.current) return;
```

同じ `useCallback` 内、`if (fills.length === 0) return;` の直後に追記:

```ts
      addressAppliedRef.current = true;
```

- [ ] **Step 3: `handleTweetFetched` を重複/動画競合対応・画像は追記(replaceでなくappend)に変更**

645-655行目の `handleTweetFetched` 全体を置き換え:

```ts
  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (source && isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedAddress(data.text);
      const photos = data.photos ?? [];
      if (photos.length > 0) setSourceImageUrls((prev) => [...prev, ...photos]);

      const incomingHasVideo = !!data.video?.url;
      const rejectVideo = shouldRejectIncomingVideo(capturedVideoRef.current, incomingHasVideo);
      if (rejectVideo) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
      } else if (incomingHasVideo) {
        capturedVideoRef.current = true;
      }
      const effectiveData = rejectVideo ? { ...data, video: null } : data;

      // SNS メタデータ捕捉: まだ何も捕捉していなければこの結果を「代表」として保持する
      // (tweetId/ogImageUrl 等は今も単数フィールドのため、最初の1件を正とする)。
      setSnsCapture((prev) =>
        prev.tweetData || prev.youtube || prev.ogp
          ? prev
          : { tweetData: effectiveData, tweetSource: source, youtube: null, ogp: null },
      );
      if (source?.postUrl) {
        setSourcePostUrls((prev) => [...prev, source.postUrl]);
        setPostUrl((prev) => prev || source.postUrl);
      }
    },
    [applyExtractedAddress, sourcePostUrls, t],
  );
```

- [ ] **Step 4: `handleYoutubeFetched`/`handleOgpFetched` に同様の重複/追記対応を反映**

657-667行目の `handleYoutubeFetched` を置き換え:

```ts
  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) {
        setSnsCapture((prev) => (prev.youtube ? { ...prev, youtube: null } : prev));
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      // YouTube は静止画リストと排他 (既存 validateImage の conflict_sources 制約は不変)。
      // 既に画像/動画を何か捕捉済みなら、この YouTube URL は追加不可として拒否する。
      if (capturedVideoRef.current || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      setSnsCapture({ tweetData: null, tweetSource: null, youtube: data, ogp: null });
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [sourcePostUrls, sourceImageUrls.length, t],
  );
```

669-698行目の `handleOgpFetched` を置き換え:

```ts
  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) {
        setSnsCapture((prev) => (prev.ogp ? { ...prev, ogp: null } : prev));
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedResult(
        extractHousingAddressFromPage({
          title: data.data.title,
          description: data.data.description,
          bodyText: data.data.text,
        }),
      );
      const images = data.data.images ?? [];
      if (images.length > 0) {
        setSourceImageUrls((prev) => [...prev, ...images]);
      } else if (data.data.image) {
        setSourceImageUrls((prev) => [...prev, data.data.image!]);
      }
      setSnsCapture((prev) =>
        prev.tweetData || prev.youtube || prev.ogp ? prev : { tweetData: null, tweetSource: null, youtube: null, ogp: data },
      );
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [applyExtractedResult, sourcePostUrls, t],
  );
```

- [ ] **Step 5: `buildDraft` に `sourcePostUrls` を追加**

`buildDraft` (961-985行目) の戻り値オブジェクトに `...imageFields` の直前で追加(スプレッドの並びに合わせ、直接キーとして追加):

```ts
      ...imageFields,
      ...(sourcePostUrls.length > 0 ? { sourcePostUrls } : {}),
```

(既存の `...imageFields,` の行の直後にこの1行を追加する形。`imageFields` にも `postUrl` は入っているため、`sourcePostUrls` はそれとは独立して常に足す。)

依存配列 `[address, tags, description, title, visibility, publishUntil, snsCapture, localImages, sourceImageUrls]` に `sourcePostUrls` を追加する。

- [ ] **Step 6: `urlSlotCount` の増減ハンドラを追加**

`handleOgpFetched` の定義直後に追記:

```ts
  const handleAddUrlSlot = useCallback(() => {
    setUrlSlotCount((prev) => Math.min(5, prev + 1));
  }, []);
  const handleRemoveUrlSlot = useCallback((_index: number) => {
    // 欄を1つ減らす。既に取得済みの画像/住所/動画は取り消さない (個別画像削除は既存グリッドUIで行う、
    // ブレスト2026-07-21で「個別削除で十分」と確定済み)。
    setUrlSlotCount((prev) => Math.max(1, prev - 1));
  }, []);
```

- [ ] **Step 7: import 追加**

ファイル先頭の import 群に追記:

```ts
import { HousingRegisterMultiUrlField } from '../register/HousingRegisterMultiUrlField';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../lib/housing/multiSourceGuards';
```

- [ ] **Step 8: `RegisterSectionMedia` への配線を `HousingRegisterMultiUrlField` に差し替える設計についてはTask7で行う(このタスクではRegisterPage側のロジックのみ)。ユニットテストを追加する**

`src/components/housing/pages/__tests__/RegisterPage.test.tsx` に追記(既存のテストファイルの末尾、`describe` を追加):

```tsx
describe('RegisterPage: 複数URL集約 (Batch2)', () => {
  it('同じURLを2回貼っても重複エラーになりsourcePostUrlsが増えない', async () => {
    // 既存テストファイルの render ヘルパー・useTweetFetch のモック方法をそのまま流用する。
    // ここでは 1本目のURL fetch 成功 → 同じURLで2本目を fetch した場合に
    // showToast('housing.register.snsUrl.error.duplicate_url', 'error') が呼ばれ、
    // 2回目の setSourcePostUrls が起きないことを検証する。
    // 具体的なモック配線は既存テスト内の `mockUseTweetFetch` 相当のヘルパーに合わせて実装する。
  });
});
```

> 実装者への注記: このファイルは既存のモック機構(`vi.mock('../../../../lib/housing/useTweetFetch', ...)` 等)に依存するため、既存テストの先頭にあるモック定義を確認し、それに合わせてテストケースの中身を実装すること(このタスクの実装者は既存ファイルを`Read`してから書く)。

- [ ] **Step 9: 既存テストスイートを実行し回帰がないことを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 既存テストは全てPASS、新規テストもPASS

- [ ] **Step 10: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 11: Commit**

```bash
git add src/components/housing/pages/RegisterPage.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx
git commit -m "feat(housing): RegisterPageに複数URL集約ロジックを統合(Batch2)"
```

---

### Task 7: `RegisterSectionMedia.tsx` — URL優先UI + 上限明記

**Files:**
- Modify: `src/components/housing/register/RegisterSectionMedia.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx`(`RegisterSectionMedia` 呼び出し箇所の props 差し替え、JSX内)
- Test: `src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx`

**Interfaces:**
- Consumes: Task5の `HousingRegisterMultiUrlField`、Task6の `urlSlotCount`/`handleAddUrlSlot`/`handleRemoveUrlSlot`
- Produces: 直接アップロードは「画像をアップロードして登録する」リンクの先に折りたたむ。既定は閉じた状態(URL優先)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx` に追記(既存ファイル。無ければ新規作成しヘルパーは`HousingRegisterMultiUrlField.test.tsx`のI18nextProviderパターンに合わせる):

```tsx
describe('RegisterSectionMedia: アップロード折りたたみ (Batch2)', () => {
  it('初期表示ではアップロード欄が隠れており、リンクを押すと表示される', () => {
    render(/* 既存のrenderヘルパーで RegisterSectionMedia をマウント */);
    expect(screen.queryByTestId('housing-register-image-field')).toBeNull();
    fireEvent.click(screen.getByTestId('housing-register-toggle-upload'));
    expect(screen.getByTestId('housing-register-image-field')).toBeInTheDocument();
  });

  it('上限の説明文(画像10枚・動画1本)が常に表示される', () => {
    render(/* 同上 */);
    expect(screen.getByText(/10枚/)).toBeInTheDocument();
    expect(screen.getByText(/1本/)).toBeInTheDocument();
  });
});
```

> 実装者への注記: 既存の `RegisterSectionMedia.test.tsx` の render ヘルパー・props モック方法をまず `Read` で確認し、それに沿わせて書くこと(このファイルには既に類似テストがあるはず)。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx`
Expected: FAIL

- [ ] **Step 3: `RegisterSectionMedia.tsx` を書き換え**

Props に `urlSlotCount`/`onAddUrlSlot`/`onRemoveUrlSlot` を追加し、`HousingRegisterSnsUrlField` 直呼びを `HousingRegisterMultiUrlField` に差し替え、アップロード欄をトグル式に:

```tsx
interface Props {
  onTweetFetched: (
    data: TweetData,
    source: { postUrl: string; tweetId: string } | null,
  ) => void;
  onYoutubeFetched?: (data: YoutubeFetchedData | null) => void;
  onOgpFetched: (data: OgpFetchedData | null) => void;
  localImages: CompressedImage[];
  onLocalImagesChange: (value: CompressedImage[]) => void;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  initialSnsUrl?: string;
  onUrlUserEdit?: () => void;
  tweetVideo?: TweetData['video'];
  /** 2026-07-21 追加 (Batch2): 複数URL欄の制御。 */
  urlSlotCount: number;
  onAddUrlSlot: () => void;
  onRemoveUrlSlot: (index: number) => void;
}
```

`RegisterSectionMedia` 本体の JSX を、既存の `<HousingRegisterSnsUrlField .../>` を丸ごと `<HousingRegisterMultiUrlField .../>` に差し替え、その下に折りたたみ式アップロードを追加する形に変更:

```tsx
export const RegisterSectionMedia: React.FC<Props> = ({
  onTweetFetched,
  onYoutubeFetched,
  onOgpFetched,
  localImages,
  onLocalImagesChange,
  sourceImageUrls,
  onSourceImageUrlsChange,
  tweetVideo,
  urlSlotCount,
  onAddUrlSlot,
  onRemoveUrlSlot,
}) => {
  const { t } = useTranslation();
  const [uploadExpanded, setUploadExpanded] = useState(false);
  // ...(fetchStatus 等の既存 state はそのまま維持)

  return (
    <section className="housing-register-section" data-testid="housing-register-section-media">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>
      <p className="housing-register-image-limit-note">
        {t('housing.register.media.limit_note')}
      </p>

      <HousingRegisterMultiUrlField
        slotCount={urlSlotCount}
        onAddSlot={onAddUrlSlot}
        onRemoveSlot={onRemoveUrlSlot}
        onTweetFetched={onTweetFetched}
        onYoutubeFetched={onYoutubeFetched ?? (() => {})}
        onOgpFetched={onOgpFetched}
      />

      {/* ...isLoading/showSuccess/tweetVideo/isError の既存ブロックはそのまま維持... */}

      <HousingRegisterSourceImageUrlsField
        value={sourceImageUrls}
        onChange={onSourceImageUrlsChange}
        maxImages={10}
      />

      {!uploadExpanded ? (
        <button
          type="button"
          data-testid="housing-register-toggle-upload"
          className="housing-register-toggle-upload"
          onClick={() => setUploadExpanded(true)}
        >
          {t('housing.register.media.expand_upload')}
        </button>
      ) : (
        <div data-testid="housing-register-image-field">
          <p className="housing-register-upload-warning">
            {t('housing.register.media.upload_warning')}
          </p>
          <HousingRegisterImageField
            value={localImages}
            onChange={onLocalImagesChange}
            hasSnsUrl={sourceImageUrls.length > 0}
            maxImages={SAVED_IMAGES_LIMIT}
          />
        </div>
      )}
    </section>
  );
};
```

(既存の `isLoading`/`showSuccess`/`fetchedImageCount`/`isError` ロジックは変更せずそのまま残す。`HousingRegisterSnsUrlField` の直import は不要になるため削除し、`HousingRegisterMultiUrlField` の import に差し替える。`onFetchStatusChange`/`suppressInlineFetchStatus` によるセクションレベル集約表示は、複数欄になったことで「どの欄の状態か」が曖昧になるため、このタスクでは各欄がインラインで自分の状態を出す形に単純化する = `HousingRegisterMultiUrlField` 内で `suppressInlineFetchStatus={false}` を渡している(Task5ですでにそう実装済み)。既存の `isLoading`/`isError` 表示ブロックはセクション全体のフォールバック注記として残してよいが、無くしてもテストが壊れなければ削除して構わない。)

- [ ] **Step 4: i18nキー追加(4言語)**

`src/locales/ja.json` の `housing.register.media` ブロックに追記:

```json
                "limit_note": "画像は最大10枚まで、動画は最大1本まで登録できます。",
                "expand_upload": "画像をアップロードして登録する",
                "upload_warning": "アップロードすると画質が圧縮されて劣化します。動画は使用できません。URLでの登録をおすすめします。"
```

`src/locales/en.json`:

```json
                "limit_note": "You can add up to 10 images and 1 video.",
                "expand_upload": "Upload images instead",
                "upload_warning": "Uploaded images are compressed and lose quality, and video isn't supported this way. We recommend registering via URL instead."
```

`src/locales/ko.json`:

```json
                "limit_note": "이미지는 최대 10장, 동영상은 최대 1개까지 등록할 수 있습니다.",
                "expand_upload": "이미지를 업로드해서 등록하기",
                "upload_warning": "업로드하면 화질이 압축되어 저하되며 동영상은 사용할 수 없습니다. URL 등록을 추천합니다."
```

`src/locales/zh.json`:

```json
                "limit_note": "最多可添加10张图片和1个视频。",
                "expand_upload": "改用上传图片注册",
                "upload_warning": "上传的图片会被压缩、画质下降,且无法使用视频。建议改用URL方式注册。"
```

- [ ] **Step 5: `RegisterPage.tsx` の `RegisterSectionMedia` 呼び出しに新propsを渡す**

JSX内の `<RegisterSectionMedia ... />` 呼び出し箇所に以下を追加:

```tsx
              urlSlotCount={urlSlotCount}
              onAddUrlSlot={handleAddUrlSlot}
              onRemoveUrlSlot={handleRemoveUrlSlot}
```

- [ ] **Step 6: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: PASS(全件)

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/register/RegisterSectionMedia.tsx src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx src/components/housing/pages/RegisterPage.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 登録ページをURL優先UI(アップロード折りたたみ)に変更(Batch2)"
```

---

### Task 8: 編集ページの統一(貼り替え→追加方式・折りたたみUI)

**Files:**
- Modify: `src/components/housing/edit/HousingEditSourcePanel.tsx`
- Modify: `src/components/housing/edit/HousingEditMediaSection.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx`(`commitEditSnsFetch`・`HousingEditMediaSection` 呼び出し)
- Test: `src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`

**Interfaces:**
- Consumes: Task4の `isDuplicatePostUrl`/`shouldRejectIncomingVideo`、Task5の `HousingRegisterMultiUrlField`
- Produces: 編集ページも「URLを追加」で画像が積み増しされる(貼り直すと全部差し替え、は廃止)。初期表示パネルは `imageMode` に従う(既存 `HousingEditMediaModeTabs` の代わりに折りたたみ式へ統一)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx` に追記(既存ファイルの構造・モックに合わせる。実装者は先に`Read`すること):

```tsx
describe('HousingEditSourcePanel: 追加方式への統一 (Batch2)', () => {
  it('新しいURLを貼ると既存のsourceImageUrlsは消えず、新しい画像が追加される', async () => {
    // onCommitSnsFetch に渡される freshSourceImageUrls が
    // 「既存 sourceImageUrls + 新規取得分」になっていることを検証する。
    // (既存テストの「貼り直すと全部差し替え」を検証していたケースは、この仕様変更に伴い
    //  「既存+新規の結合」を検証するケースへ書き換える。)
  });

  it('同じURLを再度貼ると重複エラーになり onCommitSnsFetch は呼ばれない', async () => {
    // isDuplicatePostUrl による拒否 + showToast 呼び出しを検証。
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`
Expected: FAIL (現状は「全部差し替え」実装のため)

- [ ] **Step 3: `HousingEditSourcePanel.tsx` を書き換え**

Props に `sourcePostUrls: string[]` と `hasVideo: boolean` を追加し、`onTweetFetched`/`onYoutubeFetched`/`onOgpFetched` の中身を「既存 + 新規」の追記に変更、`HousingRegisterSnsUrlField` 単体呼び出しを `HousingRegisterMultiUrlField` に差し替える:

```tsx
export interface HousingEditSourcePanelProps {
  listingId: string;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (重複検出に使う)。 */
  sourcePostUrls: string[];
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
    nextPostUrl: string,
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

export function HousingEditSourcePanel({
  listingId,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  sourcePostUrls,
  onCommitSnsFetch,
}: HousingEditSourcePanelProps) {
  const { t } = useTranslation();
  const [committing, setCommitting] = useState(false);
  const [urlSlotCount, setUrlSlotCount] = useState(1);

  const commit = useCallback(
    async (capture: SnsCapture, freshUrls: string[], nextPostUrl: string) => {
      setCommitting(true);
      try {
        const result = await onCommitSnsFetch(capture, freshUrls, nextPostUrl);
        if (!result.ok) {
          showToast(t('housing.register.editMedia.save_failed'), 'error');
        }
      } catch {
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setCommitting(false);
      }
    },
    [onCommitSnsFetch, t],
  );

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (source && isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const incomingHasVideo = !!data.video?.url;
      if (shouldRejectIncomingVideo(!!videoPreview, incomingHasVideo)) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        const photos = data.photos ?? [];
        if (photos.length > 0 && source) {
          commit({ tweetData: { ...data, video: null }, tweetSource: source, youtube: null, ogp: null }, [...sourceImageUrls, ...photos], source.postUrl);
        }
        return;
      }
      const photos = data.photos ?? [];
      if (source) {
        commit({ tweetData: data, tweetSource: source, youtube: null, ogp: null }, [...sourceImageUrls, ...photos], source.postUrl);
      }
    },
    [commit, sourceImageUrls, sourcePostUrls, videoPreview, t],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      if (videoPreview || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      commit({ tweetData: null, tweetSource: null, youtube: data, ogp: null }, [], data.postUrl);
    },
    [commit, sourceImageUrls.length, sourcePostUrls, videoPreview, t],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images
          : data.data.image
            ? [data.data.image]
            : [];
      commit({ tweetData: null, tweetSource: null, youtube: null, ogp: data }, [...sourceImageUrls, ...images], data.postUrl);
    },
    [commit, sourceImageUrls, sourcePostUrls, t],
  );

  const handleDelete = useCallback(
    (index: number) => deleteListingSourceImage({ listingId, index }).then((r) => r.sourceImageUrls),
    [listingId],
  );
  const handleReorder = useCallback(
    (newOrder: string[]) => reorderListingSourceImages({ listingId, newOrder }).then((r) => r.sourceImageUrls),
    [listingId],
  );

  return (
    <div className="housing-register-image-field">
      <p className="housing-register-image-limit-note">{t('housing.register.media.limit_note')}</p>
      <HousingRegisterMultiUrlField
        slotCount={urlSlotCount}
        onAddSlot={() => setUrlSlotCount((prev) => Math.min(5, prev + 1))}
        onRemoveSlot={() => setUrlSlotCount((prev) => Math.max(1, prev - 1))}
        onTweetFetched={handleTweetFetched}
        onYoutubeFetched={handleYoutubeFetched}
        onOgpFetched={handleOgpFetched}
      />
      {committing && (
        <p className="housing-register-image-status">{t('housing.register.editMedia.saving')}</p>
      )}
      {videoPreview && (
        <div className="housing-register-media-video" data-testid="housing-register-media-video">
          <img
            src={videoPreview.posterUrl}
            alt=""
            className="housing-register-media-video-poster"
            loading="lazy"
          />
          <span className="housing-register-media-video-badge">
            {t('housing.register.media.video_badge')}
          </span>
        </div>
      )}
      <HousingEditImageGrid
        images={sourceImageUrls}
        onImagesChange={onSourceImageUrlsChange}
        onDelete={handleDelete}
        onReorder={handleReorder}
        minImages={1}
      />
    </div>
  );
}
```

必要な import 追加(ファイル先頭):

```ts
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../lib/housing/multiSourceGuards';
import { HousingRegisterMultiUrlField } from '../register/HousingRegisterMultiUrlField';
```

(`HousingRegisterSnsUrlField` の直接importは不要になるため削除)

- [ ] **Step 4: `HousingEditMediaSection.tsx` に `sourcePostUrls` を通す**

`HousingEditMediaSectionProps` に `sourcePostUrls: string[];` を追加し、`<HousingEditSourcePanel .../>` 呼び出しに `sourcePostUrls={sourcePostUrls}` を追加する。既存の `HousingEditMediaModeTabs` の初期モード決定ロジック(`initialMode` prop)はそのまま維持する(このタスクではタブ自体の見た目は変更しない範囲に留め、Task7で導入した「折りたたみ」パターンとの統一は別チケット扱いにせず、時間が許せば同様のトグルに変更してよいが、**最低限このタスクで必須なのは「追加方式への変更」のみ**とする)。

- [ ] **Step 5: `RegisterPage.tsx` の `commitEditSnsFetch` を「追加」対応に変更**

`commitEditSnsFetch` (1101-1159行目) のシグネチャと本体を以下に置き換え:

```ts
  const commitEditSnsFetch = useCallback(
    async (
      capture: SnsCapture,
      freshSourceImageUrls: string[],
      nextPostUrl: string,
    ): Promise<{ ok: boolean; skipped?: boolean }> => {
      if (!initialValues) return { ok: false };
      const freshImageFields = buildDraftImageFields(capture, [], freshSourceImageUrls);
      if (freshImageFields.imageMode !== 'sns') {
        return { ok: true, skipped: true };
      }
      const {
        imageMode: _imageMode,
        postUrl: _postUrl,
        ogImageUrl: _ogImageUrl,
        youtubeVideoId: _youtubeVideoId,
        tweetId: _tweetId,
        sourceImageUrls: _sourceImageUrls,
        sourceImageAspectRatios: _sourceImageAspectRatios,
        videoUrl: _videoUrl,
        videoPosterUrl: _videoPosterUrl,
        videoAspectRatio: _videoAspectRatio,
        ...nonImageDraft
      } = buildDraft();
      void [
        _imageMode, _postUrl, _ogImageUrl, _youtubeVideoId, _tweetId,
        _sourceImageUrls, _sourceImageAspectRatios, _videoUrl, _videoPosterUrl, _videoAspectRatio,
      ];
      // 2026-07-21 追加 (Batch2): sourcePostUrls に今回のURLを追記して送る (重複は呼び出し元の
      // HousingEditSourcePanel が isDuplicatePostUrl で既に弾いている前提)。
      const nextSourcePostUrls = [...sourcePostUrls, nextPostUrl];
      const payload = { ...nonImageDraft, ...freshImageFields, sourcePostUrls: nextSourcePostUrls };
      const result = await updateListing(initialValues.id, payload);
      if (!result.ok) return { ok: false };
      setSnsCapture((prev) => (prev.tweetData || prev.youtube || prev.ogp ? prev : capture));
      setSourceImageUrls(freshSourceImageUrls);
      setSourcePostUrls(nextSourcePostUrls);
      setEditThumbnailPaths([]);
      setEditVideoPreview(
        capture.tweetData?.video
          ? {
              url: capture.tweetData.video.url,
              posterUrl: capture.tweetData.video.posterUrl,
              aspectRatio: capture.tweetData.video.aspectRatio ?? undefined,
            }
          : editVideoPreview,
      );
      if (!postUrl) setPostUrl(nextPostUrl);
      await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
      return { ok: true };
    },
    [initialValues, buildDraft, updateListing, sourcePostUrls, editVideoPreview, postUrl],
  );
```

`HousingEditMediaSection` 呼び出し箇所(JSX)に `sourcePostUrls={sourcePostUrls}` を追加する。

- [ ] **Step 6: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: PASS(全件。既存の「貼り直すと全部差し替え」を検証していたテストケースはStep1で書き換え済みの前提)

- [ ] **Step 7: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 8: Commit**

```bash
git add src/components/housing/edit/HousingEditSourcePanel.tsx src/components/housing/edit/HousingEditMediaSection.tsx src/components/housing/pages/RegisterPage.tsx src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx
git commit -m "feat(housing): 編集ページを追加方式に統一(貼り替え全差し替えを廃止・Batch2)"
```

---

### Task 9: 詳細ページ「元の投稿を見る」のドロップダウン化

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx:245-254`
- Test: `src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`

**Interfaces:**
- Consumes: `listing.sourcePostUrls` (Task1)、フォールバックは `listing.postUrl`
- Produces: 「元の投稿を見る」ボタン押下でURL一覧のドロップダウンを表示する。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/listing/__tests__/HousingDetailContent.test.tsx` に追記(既存の render ヘルパーに合わせる):

```tsx
describe('HousingDetailContent: 元の投稿を見るドロップダウン (Batch2)', () => {
  it('sourcePostUrls が複数あれば、ボタン押下で全URL分のリンクが表示される', () => {
    const listing = { ...baseListing, postUrl: 'https://x.com/a/status/1', sourcePostUrls: ['https://x.com/a/status/1', 'https://x.com/a/status/2'] };
    render(/* 既存ヘルパーで listing を渡す */);
    fireEvent.click(screen.getByTestId('housing-view-original-toggle'));
    const links = screen.getAllByTestId('housing-view-original-link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://x.com/a/status/1');
    expect(links[1]).toHaveAttribute('href', 'https://x.com/a/status/2');
  });

  it('sourcePostUrls が無い旧データは postUrl 1件だけのリストにフォールバックする', () => {
    const listing = { ...baseListing, postUrl: 'https://x.com/a/status/1', sourcePostUrls: undefined };
    render(/* 同上 */);
    fireEvent.click(screen.getByTestId('housing-view-original-toggle'));
    expect(screen.getAllByTestId('housing-view-original-link')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/components/housing/listing/HousingDetailContent.tsx` の245-254行目(既存の単一 `<a>` タグ)を置き換え:

```tsx
{!addressHidden && (listing.sourcePostUrls?.length ? listing.sourcePostUrls : listing.postUrl ? [listing.postUrl] : []).length > 0 && (
  <div className="housing-view-original">
    <button
      type="button"
      data-testid="housing-view-original-toggle"
      className="housing-view-original-toggle"
      onClick={() => setViewOriginalOpen((prev) => !prev)}
      aria-expanded={viewOriginalOpen}
    >
      {t('housing.detail.view_original')}
    </button>
    {viewOriginalOpen && (
      <ul className="housing-view-original-menu">
        {(listing.sourcePostUrls?.length ? listing.sourcePostUrls : listing.postUrl ? [listing.postUrl] : []).map(
          (url, i) => (
            <li key={url}>
              <a
                data-testid="housing-view-original-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('housing.detail.view_original_item', { index: i + 1 })}
              </a>
            </li>
          ),
        )}
      </ul>
    )}
  </div>
)}
```

コンポーネント関数の先頭付近に state を追加:

```ts
const [viewOriginalOpen, setViewOriginalOpen] = useState(false);
```

(`useState` が未importなら import に追加すること。)

- [ ] **Step 4: i18nキー追加(4言語)**

`src/locales/ja.json` の `housing.detail` ブロックに追記:

```json
        "view_original": "元の投稿を見る",
        "view_original_item": "投稿{{index}}",
```

`src/locales/en.json`:

```json
        "view_original": "View original post",
        "view_original_item": "Post {{index}}",
```

`src/locales/ko.json`:

```json
        "view_original": "원본 게시물 보기",
        "view_original_item": "게시물 {{index}}",
```

`src/locales/zh.json`:

```json
        "view_original": "查看原帖",
        "view_original_item": "帖子{{index}}",
```

- [ ] **Step 5: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/listing/HousingDetailContent.tsx src/components/housing/listing/__tests__/HousingDetailContent.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 元の投稿を見るをドロップダウン化(複数URL対応・Batch2)"
```

---

### Task 10: i18n エラーメッセージキーの追加確認

**Files:**
- Modify: `src/locales/ja.json`・`en.json`・`ko.json`・`zh.json`(`housing.register.snsUrl.error` ブロック)

**Interfaces:**
- Consumes: Task6/Task8で参照している `housing.register.snsUrl.error.duplicate_url` / `housing.register.snsUrl.error.video_limit`

- [ ] **Step 1: キーが揃っているか確認**

Run (PowerShell): `Select-String -Path src/locales/ja.json,src/locales/en.json,src/locales/ko.json,src/locales/zh.json -Pattern "duplicate_url|video_limit"`
Expected: Task6/Task8実装時に追加していなければヒットしない → このタスクで追加する

- [ ] **Step 2: 4言語に追記**

`src/locales/ja.json` の `housing.register.snsUrl.error` ブロックに追記:

```json
                    "duplicate_url": "このURLは既に追加されています。",
                    "video_limit": "動画は1本までのため、この投稿の動画は追加されませんでした。",
```

`src/locales/en.json`:

```json
                    "duplicate_url": "This URL has already been added.",
                    "video_limit": "Only 1 video is allowed per listing, so this post's video wasn't added.",
```

`src/locales/ko.json`:

```json
                    "duplicate_url": "이 URL은 이미 추가되어 있습니다.",
                    "video_limit": "동영상은 1개까지만 등록할 수 있어 이 게시물의 동영상은 추가되지 않았습니다.",
```

`src/locales/zh.json`:

```json
                    "duplicate_url": "此URL已添加过。",
                    "video_limit": "每个房源最多只能有1个视频,因此未添加此帖子的视频。",
```

- [ ] **Step 3: 4言語のJSONパリティを確認**

Run: `npx vitest run` で既存のi18n parityテストがあれば実行(`Glob src/__tests__/**/*i18n*`や`*locale*`で存在確認)。無ければ `node -e "JSON.parse(require('fs').readFileSync('src/locales/ja.json'))"` を4ファイル分実行して構文エラーが無いことだけ確認する。

- [ ] **Step 4: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 複数URL関連のエラーi18nキーを4言語追加(Batch2)"
```

---

### Task 11: 投稿削除の生存監視(cron)が非影響であることの確認

**Files:**
- Read only: 生存監視cronスクリプト(`Glob scripts/*tweet*` または `Glob scripts/*purge*` で該当ファイルを特定)

**Interfaces:**
- 変更なし(検証のみ)。`lastTweetCheckAt`/`tweetId` は Task2 で `sourcePostUrls[0]` 由来の値がそのまま入るため、cron側のロジックは無改修で動く想定。

- [ ] **Step 1: 該当cronスクリプトを特定して読む**

Run: `Glob scripts/*.ts` で "tweet"・"purge"・"dead" を含むファイル名を探す(例: `purge-if-tweet-gone` 等、`_updateListingHandler.ts` のコメントに名前のヒントあり)。見つけたファイルを `Read` し、`tweetId`/`postUrl`/`lastTweetCheckAt` 以外のフィールド(`sourcePostUrls`)を読んでいないことを確認する。

- [ ] **Step 2: 確認結果を記録**

読んだ内容が「単一 `tweetId`/`postUrl` のみを見ている」ことを確認できたら、このタスクは完了(コード変更なし)。もし複数URL全部を監視すべき処理が既にあった場合は、設計書の「Phase B含まないこと」(`sourcePostUrls[0]`のみ監視)との齟齬なので、実装を進めず一旦報告して指示を仰ぐこと。

- [ ] **Step 3: Commit不要(コード変更なしのため)**

---

### Task 12: 最終ビルド・テストゲート

**Files:** なし(検証のみ)

- [ ] **Step 1: フルテストスイートを実行**

Run: `npx vitest run`
Expected: 全件PASS(既存の失敗中テスト5件[TopBar4+HousingWorkspace1、既知・撤去予定]とEphemeralAddPanel.test 7件[環境依存・既知]を除き、新規追加分も含め全PASS)

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 型エラー・ビルドエラーなし(Vercelのtsc厳密チェックと同等)

- [ ] **Step 3: 手動確認チェックリストをユーザーに提示**

このタスクはコードでは検証できない。実装完了後、ユーザーに以下を実機で確認してもらうよう伝える:
1. 新規登録で3つのURL(Twitterスレッド想定)を貼り、画像が合算されること
2. 2本目のURLに動画があった場合、動画は無視され画像だけ追加されること(トースト表示)
3. 同じURLを2回貼ると重複エラーが出ること
4. 編集ページでURLを追加すると、既存の画像が消えず追加されること
5. 「元の投稿を見る」でドロップダウンが複数URL分表示されること
6. 登録ページの初期表示でURL欄が前面、アップロードは折りたたまれていること
7. 英語モードで文言崩れがないこと

- [ ] **Step 4: Commit(必要なら最終調整分をまとめて)**

```bash
git status
# 未コミットの変更があれば個別に確認してcommit
```

---

## Self-Review メモ (このプランを書いた直後のセルフチェック結果)

- **設計書カバレッジ**: 複数URL追加(Task5-8)/住所自動入力・最初勝ち(Task6)/画像プール・自動切り捨てなし(Task6,8)/動画1本・部分拒否(Task6,8)/重複URL拒否(Task4,6,8)/元の投稿を見るドロップダウン(Task9)/上限明記(Task7,8)/URL推奨導線(Task7)/生存監視は先頭のみ(Task2で自動的に満たす+Task11で確認)/データモデル後方互換(Task1,2)。すべてタスクに対応済み。
- **オートセーブの扱い**: 設計書では明記していなかったが、`registerAutosave.ts` は `postUrl` 単数のみ保存する既存仕様を**変更しない**(2本目以降のURLはオートセーブ復元の対象外・既知の制限として許容)。これは新規のスコープ決定なので、実装時に `docs/TODO.md` か本ファイル末尾に一言残すこと。
- **YouTube+複数URLの扱い**: 既存の `conflict_sources` 制約(YouTubeは画像/動画と排他)は維持し、YouTube確定後に画像URLを追加しようとした場合は`video_limit`と同じエラー経路で拒否する(Task6 Step4のhandleYoutubeFetched/handleOgpFetched参照)。Twitterスレッドの主要ユースケースには影響しない。
- **型一貫性**: `SnsCapture`型は変更せず(tweetData/tweetSource/youtube/ogpは単数のまま、"最初に確定したもの"を保持)、`sourcePostUrls: string[]`だけを並行して集約する設計で全タスクを通して一貫させた。
