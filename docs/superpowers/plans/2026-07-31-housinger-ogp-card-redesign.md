# ハウジンガーOGPカード作り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジンガーページ(`/housing/housinger/:uid`)のOGPシェアカードを、本人が選んだ最大10件の代表作(1件目=背景兼ヒーロー)を使った、LoPoハウジングの意匠を反映したカードに作り直す。

**Architecture:** 既存の「hash計算→og_image_meta保存→`/og/{hash}.png`をog:imageに設定、実際の画像生成(satori)は初回アクセス時に1回だけ」というキャッシュ構造は変えない。変更は (1) ハウジンガー本人がマイページで代表作を選べるデータモデル+UIの追加、(2) `buildHousingerOgCardParams`のパラメータ拡張(bio追加・画像3→10枚)、(3) `api/og/_housingerCard.ts`のレイアウト刷新(背景ぼかし+ハウジング意匠パネル+10枚グリッド)の3層。

**Tech Stack:** React + TypeScript (フロント) / Vercel Serverless Function (Node, `api/housing/*`) / Vercel Edge Function (`api/og/*`, `@vercel/og`=satori) / Firestore (Admin SDK) / Vitest。

## Global Constraints

- 代表作は最大10件、1件目が背景兼ヒーロー画像として二重に使われる。
- 選択できるのは `visibility === 'public'` の物件のみ(住所非公開の`unlisted`・`private`は選択不可、選ぼうとしたらエラートースト)。
- 画像取得ロジックは動画のみの物件(`imageMode:'none'`)も対象に含める(`videoPosterUrl`/YouTubeサムネイル経由)。
- 何も選択していないハウジンガーは表示順(新着順)上位10件を自動採用するフォールバックを維持する。
- 既存の「内容が変わった時だけ画像を1回作り直し、以降は使い回す」キャッシュ設計を壊さない(コスト維持)。
- 物件0件(または画像が1枚も解決できない)場合の背景は `TOUR_INVITE_BG_DATA_URI`(`api/og/_tourInviteBg.generated.ts`)を流用する。
- UIテキストは必ずi18nキー経由(ja/en/ko/zh/zh-Hant の5言語を追加する。zh-Hant完全性テスト `src/locales/__tests__/zh-hant-completeness.test.ts` を壊さないこと)。カード内の「Shared via LoPo Housing」表記のみ、既存の「LoPo Housing」バッジ文言と同様に**常に英語の固定文字列**(i18nキー化しない、satoriレンダリングコード内に直書き)。
- ハウジング配下のCSS/UIは `.claude/rules/housing-design.md` のトークン経由ルールに従う(色・寸法のハードコード禁止、`src/styles/housing.css` の `--housing-*` トークンを使う)。ただし `api/og/_housingerCard.ts` は satori (CSSファイル非読込・スタイルはJSオブジェクトリテラル直書き) のため、既存コードの慣例どおりファイル内の色定数(`ACCENT_HONEY`等)を使う。
- 本タスクでは以下を**変更しない**(別件としてTODO.mdに記録済み): マイページのシェアボタン位置移動、ハウジンガーページの通報用「…」メニューが画面外に開くバグ。

---

### Task 1: データ型拡張(`ogRepresentativeListingIds` / `avatarPngUrl`)

**Files:**
- Modify: `src/types/housing.ts:328-338`(`HousingerProfile`)
- Modify: `src/types/firebase.ts:16-31`(`FirestoreUser`)
- Test: `src/__tests__/housing/housingerProfileTypes.test.ts`(新規)

**Interfaces:**
- Produces: `HousingerProfile.ogRepresentativeListingIds?: string[] | null`(順序付き、先頭=背景兼ヒーロー、最大10件)。`HousingerProfile.avatarPngUrl?: string | null`。`FirestoreUser.avatarPngUrl?: string | null`。

- [ ] **Step 1: 型定義を拡張する**

`src/types/housing.ts:328-338` を以下に置き換える:

```ts
export interface HousingerProfile {
  displayName: string;
  avatarUrl: string | null;
  /** WebP非対応環境(satoriのOGPレンダラー等)向けのPNG変換済みコピー。無ければnull(旧アバターのまま未変換)。 */
  avatarPngUrl?: string | null;
  bio: string | null;
  snsUrl: string | null;
  isPublished: boolean;
  isModerationHidden: boolean;
  reportCount: number;
  createdAt: number;
  updatedAt: number;
  /** OGPカードに使う代表作(最大10件、listing id、順序付き・先頭=背景兼ヒーロー)。未設定/空なら新着順上位10件を自動採用する。 */
  ogRepresentativeListingIds?: string[] | null;
}
```

`src/types/firebase.ts:16-31` の `FirestoreUser` インターフェースに以下を追加(`avatarUrl` の直後):

```ts
  /** アバター画像URL */
  avatarUrl: string | null;
  /** WebP非対応環境向けのPNG変換済みアバターコピー(2026-07-31追加、既存ユーザーはnullのまま)。 */
  avatarPngUrl?: string | null;
```

- [ ] **Step 2: 型が壊れていないことを確認するテストを書く**

`src/__tests__/housing/housingerProfileTypes.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import type { HousingerProfile } from '../../types/housing';

describe('HousingerProfile型', () => {
  it('ogRepresentativeListingIds/avatarPngUrlを省略してもコンパイルできる(既存データ互換)', () => {
    const legacy: HousingerProfile = {
      displayName: 'テスト',
      avatarUrl: null,
      bio: null,
      snsUrl: null,
      isPublished: true,
      isModerationHidden: false,
      reportCount: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(legacy.ogRepresentativeListingIds).toBeUndefined();
  });

  it('ogRepresentativeListingIdsに順序付き配列を設定できる', () => {
    const profile: HousingerProfile = {
      displayName: 'テスト',
      avatarUrl: null,
      avatarPngUrl: 'https://example.com/a.png',
      bio: null,
      snsUrl: null,
      isPublished: true,
      isModerationHidden: false,
      reportCount: 0,
      createdAt: 0,
      updatedAt: 0,
      ogRepresentativeListingIds: ['listing-1', 'listing-2'],
    };
    expect(profile.ogRepresentativeListingIds?.[0]).toBe('listing-1');
  });
});
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/__tests__/housing/housingerProfileTypes.test.ts`
Expected: PASS(2 tests)

- [ ] **Step 4: Commit**

```bash
git add src/types/housing.ts src/types/firebase.ts src/__tests__/housing/housingerProfileTypes.test.ts
git commit -m "feat(housing): HousingerProfile/FirestoreUserにogRepresentativeListingIds/avatarPngUrlを追加"
```

---

### Task 2: 代表作として選択可能かの判定関数を追加

**Files:**
- Modify: `src/lib/housing/listingPublish.ts`
- Test: `src/lib/housing/__tests__/listingPublish.test.ts`

**Interfaces:**
- Consumes: `isEffectivelyPublic`・`isAddressHidden`(同ファイル内の既存関数、変更しない)
- Produces: `isEligibleForOgRepresentative(listing: { visibility?: 'public'|'unlisted'|'private'; publishUntil?: number|null }, nowMs: number): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/listingPublish.test.ts` の末尾(既存の `describe` ブロックの外)に追加:

```ts
import { isEligibleForOgRepresentative } from '../listingPublish';

describe('isEligibleForOgRepresentative', () => {
  const now = 1_700_000_000_000;
  it('visibility=public かつ期限内なら true', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'public' }, now)).toBe(true);
  });
  it('visibility=unlisted(住所非公開)は false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'unlisted' }, now)).toBe(false);
  });
  it('visibility=private は false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'private' }, now)).toBe(false);
  });
  it('visibility=public でも publishUntil 経過済みなら false', () => {
    expect(isEligibleForOgRepresentative({ visibility: 'public', publishUntil: now - 1000 }, now)).toBe(false);
  });
  it('visibility未設定はfalse(publicを明示していない限り選択不可)', () => {
    expect(isEligibleForOgRepresentative({}, now)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/listingPublish.test.ts -t isEligibleForOgRepresentative`
Expected: FAIL(`isEligibleForOgRepresentative is not a function` 等)

- [ ] **Step 3: 実装を追加**

`src/lib/housing/listingPublish.ts` の末尾に追加:

```ts
/**
 * OGPカードの代表作として選択可能か(spec 2026-07-31 §確定済みの決定「選べる物件の条件」)。
 * visibility が明示的に 'public' であることを要求する(unlisted=住所非公開・private・未設定は不可)。
 * isEffectivelyPublic と異なり visibility 未設定を許容しない(選択は本人の能動的操作のため、
 * バックフィル前の保険的デフォルトに頼らず厳密に判定する)。
 */
export function isEligibleForOgRepresentative(
  listing: { visibility?: 'public' | 'unlisted' | 'private'; publishUntil?: number | null },
  nowMs: number,
): boolean {
  if (listing.visibility !== 'public') return false;
  if (listing.publishUntil != null && listing.publishUntil <= nowMs) return false;
  return true;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/listingPublish.test.ts`
Expected: PASS(既存テスト含め全件)

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/listingPublish.ts src/lib/housing/__tests__/listingPublish.test.ts
git commit -m "feat(housing): OGP代表作の選択可否判定isEligibleForOgRepresentativeを追加"
```

---

### Task 3: `ogpHousingerCard.ts` を bio対応・10枚化に拡張

**Files:**
- Modify: `src/lib/ogpHousingerCard.ts`
- Modify: `src/lib/__tests__/ogpHousingerCard.test.ts`

**Interfaces:**
- Produces: `HousingerOgCardInput.bio?: string | null` を追加。`buildHousingerOgCardParams` は `bio` パラメータを追加し、`img` は最大10枚まで許容する。`CARD_VERSION` を `'3'` に更新。

- [ ] **Step 1: 既存テストを新仕様に更新(先に失敗させる)**

`src/lib/__tests__/ogpHousingerCard.test.ts` の23-34行目を以下に置き換え:

```ts
describe('buildHousingerOgCardParams', () => {
    it('パラメータの並び順は type → ver → name → bio → avatar → img の固定順', () => {
        const params = buildHousingerOgCardParams({ ...baseInput, bio: 'よろしくお願いします' });
        expect([...params.keys()]).toEqual(['type', 'ver', 'name', 'bio', 'avatar', 'img', 'img', 'img']);
    });

    it('bio未指定でもbioパラメータは空文字で含まれる(バージョン変更と合わせて必ずハッシュに反映する)', () => {
        const params = buildHousingerOgCardParams(baseInput);
        expect(params.get('bio')).toBe('');
    });

    it('imgs は先頭から最大10枚に切り詰められる', () => {
        const params = buildHousingerOgCardParams({
            ...baseInput,
            imageUrls: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        });
        expect(params.getAll('img')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    });
```

(このファイル内の他の `it` ブロックは変更不要。上記3件だけ差し替える。)

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/ogpHousingerCard.test.ts`
Expected: FAIL(パラメータ順序に `bio` が無い・`img` が3枚で切り詰められる 等)

- [ ] **Step 3: 実装を拡張**

`src/lib/ogpHousingerCard.ts` の29行目・33行目・35-42行目・49-60行目を以下に置き換え:

```ts
/**
 * v3: ハウジンガーOGPカード全面刷新(2026-07-31・背景ぼかし+ハウジング意匠パネル+
 * 代表作最大10枚グリッド)に伴い更新。パラメータの並びも type→ver→name→bio→avatar→img に変更したため、
 * 旧v2キャッシュを一切踏まないようversionを必ず上げる。
 */
const CARD_VERSION = '3';
```

```ts
/** カードに載せる公開ハウジング画像の最大枚数(代表作10件、先頭=背景兼ヒーロー)。 */
const MAX_CARD_IMAGES = 10;
```

```ts
export interface HousingerOgCardInput {
  /** ハウジンガー表示名。空文字/未指定でも可(フォールバックは呼び出し側の表示ロジックに委ねる)。 */
  name: string;
  /** 紹介文(ひとこと)。未指定/nullは空文字として扱う。 */
  bio?: string | null;
  /** アバター画像 URL。無ければ省略。 */
  avatarUrl?: string | null;
  /** 代表作(公開ハウジング)の画像 URL 一覧。先頭が背景兼ヒーロー。最大 {@link MAX_CARD_IMAGES} 枚まで使用。 */
  imageUrls?: (string | null | undefined)[];
}
```

```ts
export function buildHousingerOgCardParams(input: HousingerOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'housinger');
  params.set('ver', CARD_VERSION);
  params.set('name', input.name || '');
  params.set('bio', input.bio || '');
  if (input.avatarUrl) params.set('avatar', input.avatarUrl);
  const imgs = (input.imageUrls || [])
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, MAX_CARD_IMAGES);
  for (const url of imgs) params.append('img', url);
  return params;
}
```

ファイル冒頭のコメント(18行目)も実態に合わせて更新する:

```ts
 * パラメータ順序(固定・sig を除く): type → ver → name → bio → avatar? → img (0〜10個、順に複数指定)。
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/ogpHousingerCard.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ogpHousingerCard.ts src/lib/__tests__/ogpHousingerCard.test.ts
git commit -m "feat(housing): buildHousingerOgCardParamsにbioを追加し画像上限を10枚化(CARD_VERSION 3へ)"
```

---

### Task 4: `upsert-housinger-profile` APIで代表作選択を保存できるようにする

**Files:**
- Modify: `api/housing/_upsertHousingerProfileHandler.ts`
- Modify: `api/housing/__tests__/upsertHousingerProfile.test.ts`

**Interfaces:**
- Produces: `validateUpsertBody` が `ogRepresentativeListingIds?: string[] | null` を受け付ける(`ok:false, error:'invalid_og_representative_ids'` を新設)。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/upsertHousingerProfile.test.ts` に以下を追加(既存の `describe` ブロック内、末尾):

```ts
  it('ogRepresentativeListingIds は10件以下の文字列配列のみ ok', () => {
    expect(validateUpsertBody({ ogRepresentativeListingIds: ['a', 'b'] }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: [] }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: null }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: Array(11).fill('x') }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
    expect(validateUpsertBody({ ogRepresentativeListingIds: ['a', 123] }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
    expect(validateUpsertBody({ ogRepresentativeListingIds: 'not-an-array' }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: FAIL(`ogRepresentativeListingIds` を無視して常に `ok:true` になる/型エラー)

- [ ] **Step 3: `validateUpsertBody` と保存ロジックを拡張**

`api/housing/_upsertHousingerProfileHandler.ts:29-47` を以下に置き換え:

```ts
export function validateUpsertBody(body: any):
  | { ok: true; isPublished?: boolean; bio?: string | null; snsUrl?: string | null; ogRepresentativeListingIds?: string[] | null }
  | { ok: false; error: 'invalid_bio' | 'invalid_sns_url' | 'invalid_body' | 'invalid_og_representative_ids' } {
  const { isPublished, bio, snsUrl, ogRepresentativeListingIds } = body || {};
  if (isPublished !== undefined && typeof isPublished !== 'boolean') {
    return { ok: false, error: 'invalid_body' };
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.length > HOUSINGER_BIO_MAX_LENGTH) {
      return { ok: false, error: 'invalid_bio' };
    }
  }
  if (snsUrl !== undefined && snsUrl !== null) {
    if (typeof snsUrl !== 'string' || !validateHousingerSnsUrl(snsUrl).ok) {
      return { ok: false, error: 'invalid_sns_url' };
    }
  }
  if (ogRepresentativeListingIds !== undefined && ogRepresentativeListingIds !== null) {
    if (
      !Array.isArray(ogRepresentativeListingIds)
      || ogRepresentativeListingIds.length > 10
      || ogRepresentativeListingIds.some((id: unknown) => typeof id !== 'string' || !id)
    ) {
      return { ok: false, error: 'invalid_og_representative_ids' };
    }
  }
  return { ok: true, isPublished, bio, snsUrl, ogRepresentativeListingIds };
}
```

`api/housing/_upsertHousingerProfileHandler.ts:104-114` の `next` オブジェクトに1行追加(既存フィールドの差分更新パターンを踏襲。**この`next`は`tx.set`で完全上書きされるため、追加を忘れると既存の代表作選択が消える**):

```ts
      const next = {
        displayName,
        avatarUrl: userData.avatarUrl ?? null,
        avatarPngUrl: userData.avatarPngUrl ?? null,
        bio: v.bio !== undefined ? v.bio : prev?.bio ?? null,
        snsUrl: v.snsUrl !== undefined ? v.snsUrl : prev?.snsUrl ?? null,
        ogRepresentativeListingIds: v.ogRepresentativeListingIds !== undefined
          ? v.ogRepresentativeListingIds
          : prev?.ogRepresentativeListingIds ?? null,
        isPublished: nextPublished,
        isModerationHidden: prev?.isModerationHidden ?? false,
        reportCount: prev?.reportCount ?? 0,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
```

(`avatarPngUrl` の転記は Task 6 の前提になるためここで一緒に追加する。)

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add api/housing/_upsertHousingerProfileHandler.ts api/housing/__tests__/upsertHousingerProfile.test.ts
git commit -m "feat(housing): upsert-housinger-profileでogRepresentativeListingIds/avatarPngUrlを保存できるようにする"
```

---

### Task 5: クライアント側 `upsertHousingerProfile` の入力型を拡張

**Files:**
- Modify: `src/lib/housing/housingerProfileService.ts`

**Interfaces:**
- Consumes: Task 4 で拡張した `POST /api/housing?action=upsert-housinger-profile` のbody形式。
- Produces: `upsertHousingerProfile(input: { isPublished?; bio?; snsUrl?; ogRepresentativeListingIds?: string[] | null })`

- [ ] **Step 1: 型を拡張する**(このファイルは薄いAPIクライアントで分岐ロジックが無いため、先に失敗するテストを書く意味がない。既存の型を直接拡張する)

`src/lib/housing/housingerProfileService.ts:58-62` を以下に置き換え:

```ts
export async function upsertHousingerProfile(input: {
  isPublished?: boolean;
  bio?: string | null;
  snsUrl?: string | null;
  ogRepresentativeListingIds?: string[] | null;
}): Promise<{ ok: boolean; error?: string; profile?: HousingerProfile }> {
```

- [ ] **Step 2: 既存のvitestフルスイートで型エラーが出ないことを確認**

Run: `npx tsc -b`
Expected: エラーなし(このファイルの呼び出し元は全てオプショナルプロパティのみ渡しているため既存呼び出しは無変更で通る)

- [ ] **Step 3: Commit**

```bash
git add src/lib/housing/housingerProfileService.ts
git commit -m "feat(housing): upsertHousingerProfileの入力型にogRepresentativeListingIdsを追加"
```

---

### Task 6: アバターのPNG併存アップロード(WebP問題の解消)

**Files:**
- Modify: `src/utils/avatarUpload.ts`
- Test: `src/utils/__tests__/avatarUpload.test.ts`(新規)

**Interfaces:**
- Produces: `uploadAvatar(userId, blob)` が既存の戻り値(WebP URL文字列)はそのまま維持しつつ、副作用として `users/{userId}/avatar.png` をStorageに追加アップロードし、Firestoreの `avatarPngUrl` フィールドを更新する。呼び出し側のシグネチャ・戻り値は一切変更しない(既存8ファイルの呼び出し箇所に影響なし)。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/avatarUpload.test.ts` を新規作成。`firebase/storage` と `firebase/firestore` をモックする(このリポジトリの既存パターンに合わせ `vi.mock` を使用):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadBytesMock = vi.fn().mockResolvedValue(undefined);
const getDownloadURLMock = vi.fn()
  .mockResolvedValueOnce('https://storage.example.com/avatar.webp')
  .mockResolvedValueOnce('https://storage.example.com/avatar.png');
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const getDocMock = vi.fn().mockResolvedValue({ exists: () => true });

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
}));
vi.mock('../lib/firebase', () => ({ storage: {}, db: {} }));

// createImageBitmap / canvas は jsdom に無いため最小限のグローバルモックを用意する。
beforeEach(() => {
  uploadBytesMock.mockClear();
  updateDocMock.mockClear();
  (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 128, height: 128 });
  (globalThis as any).HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() });
  (globalThis as any).HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (b: Blob | null) => void) => {
    cb(new Blob(['png-bytes'], { type: 'image/png' }));
  });
});

describe('uploadAvatar', () => {
  it('WebP本体に加えPNG派生版もアップロードし、両方のURLをFirestoreに保存する', async () => {
    const { uploadAvatar } = await import('../avatarUpload');
    const webpBlob = new Blob(['webp-bytes'], { type: 'image/webp' });
    const url = await uploadAvatar('user-1', webpBlob);

    expect(url).toBe('https://storage.example.com/avatar.webp');
    expect(uploadBytesMock).toHaveBeenCalledTimes(2);
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        avatarUrl: 'https://storage.example.com/avatar.webp',
        avatarPngUrl: 'https://storage.example.com/avatar.png',
      }),
    );
  });

  it('PNG変換に失敗してもWebP本体のアップロードは成功として返す(致命的にしない)', async () => {
    (globalThis as any).createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'));
    const { uploadAvatar } = await import('../avatarUpload');
    const webpBlob = new Blob(['webp-bytes'], { type: 'image/webp' });
    const url = await uploadAvatar('user-2', webpBlob);
    expect(url).toBe('https://storage.example.com/avatar.webp');
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ avatarPngUrl: null }),
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/avatarUpload.test.ts`
Expected: FAIL(`uploadBytesMock` が1回しか呼ばれない・`avatarPngUrl` が呼び出しに含まれない)

- [ ] **Step 3: 実装を追加**

`src/utils/avatarUpload.ts:69-81` (`uploadAvatar` 関数)を以下に置き換え:

```ts
/**
 * WebP Blobから128x128 PNGを派生させる(satori等WebP非対応環境向け)。
 * createImageBitmapはWebPをデコードできるブラウザでのみ動く前提(WebP生成自体が
 * 同じブラウザで既に成功している = デコードも同一エンジンでサポートされている)。
 * 失敗しても致命的にしない(戻り値nullでOGPカードのアイコンがプレースホルダに留まるだけ)。
 */
async function deriveAvatarPng(webpBlob: Blob): Promise<Blob | null> {
    try {
        const bitmap = await createImageBitmap(webpBlob);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/png');
        });
    } catch {
        return null;
    }
}

/**
 * アバターをFirebase Storageにアップロードし、FirestoreにURLを保存
 * (WebP本体 + satori等WebP非対応環境向けPNG派生版の両方をアップロードする)
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
    const storageRef = ref(storage, `users/${userId}/avatar.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    const url = await getDownloadURL(storageRef);

    let pngUrl: string | null = null;
    const pngBlob = await deriveAvatarPng(blob);
    if (pngBlob) {
        const pngRef = ref(storage, `users/${userId}/avatar.png`);
        await uploadBytes(pngRef, pngBlob, { contentType: 'image/png' });
        pngUrl = await getDownloadURL(pngRef);
    }

    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: url, avatarPngUrl: pngUrl, updatedAt: new Date().toISOString() });
    }

    return url;
}
```

`deleteAvatar` (86-97行目) も対応するPNGを削除するよう更新:

```ts
/**
 * アバターを削除
 */
export async function deleteAvatar(userId: string): Promise<void> {
    try {
        await deleteObject(ref(storage, `users/${userId}/avatar.webp`));
    } catch {
        // ファイルが存在しない場合は無視
    }
    try {
        await deleteObject(ref(storage, `users/${userId}/avatar.png`));
    } catch {
        // 派生PNGが無い(旧アップロード等)場合は無視
    }
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: null, avatarPngUrl: null, updatedAt: new Date().toISOString() });
    }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/avatarUpload.test.ts`
Expected: PASS(2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/avatarUpload.ts src/utils/__tests__/avatarUpload.test.ts
git commit -m "feat(avatar): アップロード時にWebPと併せてPNG派生版も保存しavatarPngUrlに記録"
```

---

### Task 7: `_housingerPageHandler.ts` の代表作解決ロジック刷新

**Files:**
- Modify: `api/share/_housingerPageHandler.ts`

**Interfaces:**
- Consumes: `HousingerProfile.ogRepresentativeListingIds`/`avatarPngUrl`(Task 1)・`isEligibleForOgRepresentative`(Task 2、`.js`拡張子でimport)・`buildHousingerOgCardParams`の新シグネチャ(Task 3、`bio`引数)。
- Produces: `og_image_meta` に保存する `imageUrls` は最大10件・動画のみ物件のポスター画像を含む。アバターはPNG派生版が有れば優先して使う。

- [ ] **Step 1: アバターのPNG優先化(WebP問題の実質的な解消箇所)**

`api/share/_housingerPageHandler.ts` の `avatarUrl` 算出行(97-102行目付近、`isPublic` ブロック内)を以下に置き換える。**Task 6 でPNG派生版をアップロードするようにしても、ここでPNGを優先しない限りOGPカードには相変わらずWebPが渡りイニシャル表示のままになる点に注意**:

```ts
          const displayName: string = typeof profile.displayName === 'string' && profile.displayName
            ? profile.displayName
            : '';
          const bio: string = typeof profile.bio === 'string' ? profile.bio.slice(0, HOUSINGER_BIO_MAX_LENGTH) : '';
          // OGPレンダラー(satori)はWebP非対応のため、PNG派生版(Task6でアップロード)があれば
          // そちらを優先する。無ければ(旧アップロードのまま等)従来通りWebP URLを渡し、
          // レンダラー側でイニシャルプレースホルダにフォールバックさせる(致命的にしない)。
          const avatarUrl: string | null =
            typeof profile.avatarPngUrl === 'string' && profile.avatarPngUrl
              ? profile.avatarPngUrl
              : (typeof profile.avatarUrl === 'string' && profile.avatarUrl ? profile.avatarUrl : null);
```

- [ ] **Step 2: 動画ポスター対応 + 代表作ID順序解決 + bio連携を実装する**

`api/share/_housingerPageHandler.ts` の import 群(20-23行目)に追加:

```ts
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { normalizeHousingerUid, stripHashedPrefix, HOUSINGER_BIO_MAX_LENGTH } from '../../src/lib/housing/housingerProfile.js';
import { buildHousingerOgCardParams } from '../../src/lib/ogpHousingerCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { isEligibleForOgRepresentative } from '../../src/lib/housing/listingPublish.js';
import { buildYoutubeThumbnailUrl } from '../../src/lib/housing/youtubeUrl.js';
```

`listingRepresentativeImage` 関数(44-56行目)を、動画のみ物件のポスター画像にもフォールバックするよう置き換え:

```ts
/**
 * 公開 listing 1 件分から代表画像 URL を解決する。
 * 優先順: thumbnail → sns(ogImageUrl) → Twitter動画のvideoPosterUrl → YouTubeサムネイル → なし。
 * 動画のみ登録(imageMode:'none')の物件も、動画由来の静止画があればここで拾う
 * (2026-07-31: 従来はimageMode==='none'を一律除外していたため、動画メインのハウジンガーの
 * カードが空になっていた不具合の修正)。
 */
function listingRepresentativeImage(listing: {
  imageMode?: unknown;
  thumbnailPath?: unknown;
  ogImageUrl?: unknown;
  videoPosterUrl?: unknown;
  youtubeVideoId?: unknown;
}): string | null {
  if (listing.imageMode === 'thumbnail' && typeof listing.thumbnailPath === 'string' && listing.thumbnailPath) {
    return listing.thumbnailPath;
  }
  if (listing.imageMode === 'sns' && typeof listing.ogImageUrl === 'string' && listing.ogImageUrl) {
    return listing.ogImageUrl;
  }
  if (typeof listing.videoPosterUrl === 'string' && listing.videoPosterUrl) {
    return listing.videoPosterUrl;
  }
  if (typeof listing.youtubeVideoId === 'string' && listing.youtubeVideoId) {
    return buildYoutubeThumbnailUrl(listing.youtubeVideoId);
  }
  return null;
}
```

代表画像解決部分(107-128行目、`resolvedImages` の組み立て)を、`ogRepresentativeListingIds` があればその順序で個別取得するロジックに置き換え:

```ts
          // 代表画像: ハウジンガー本人がマイページで選んだ代表作(最大10件・順序付き・先頭=背景兼ヒーロー)。
          // 未選択(ogRepresentativeListingIds が空/未設定)なら新着順上位10件を自動採用するフォールバック。
          // どちらの経路でも「選択後に非公開/住所非公開/削除された」listingはここで除外する。
          const nowMs = Date.now();
          const resolvedImages: string[] = [];
          try {
            const selectedIds: string[] = Array.isArray(profile.ogRepresentativeListingIds)
              ? profile.ogRepresentativeListingIds.slice(0, 10)
              : [];

            if (selectedIds.length > 0) {
              const snaps = await Promise.all(
                selectedIds.map((id: string) => db.collection(LISTING_COLLECTION).doc(id).get()),
              );
              for (const snap of snaps) {
                if (!snap.exists) continue;
                const data = snap.data()!;
                if (data.ownerUid !== uid) continue; // 改ざん防止: 他人のlistingを混入させない
                if (data.deletedAt != null || data.isHidden === true) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                const img = listingRepresentativeImage(data);
                if (img) resolvedImages.push(img);
              }
            } else {
              const listingSnap = await db.collection(LISTING_COLLECTION)
                .where('ownerUid', '==', uid)
                .where('visibility', 'in', PUBLIC_VISIBILITY)
                .where('isHidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .select('visibility', 'isHidden', 'deletedAt', 'createdAt', 'imageMode', 'thumbnailPath', 'ogImageUrl', 'videoPosterUrl', 'youtubeVideoId', 'ownerUid', 'publishUntil')
                .get();
              for (const doc of listingSnap.docs) {
                const data = doc.data();
                if (data.deletedAt != null) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                const img = listingRepresentativeImage(data);
                if (img) resolvedImages.push(img);
                if (resolvedImages.length >= 10) break;
              }
            }
          } catch (err) {
            console.error('Housinger page listing fetch error:', err);
          }
```

`buildHousingerOgCardParams` の呼び出し(136-140行目)に `bio` を渡すよう変更:

```ts
            const params = buildHousingerOgCardParams({
              name: displayName,
              bio,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
            });
```

`og_image_meta` への保存(142-149行目)にも `bio` を追加(デバッグ・監査のため保存内容と実パラメータを一致させる):

```ts
            await db.collection('og_image_meta').doc(hash).set({
              type: 'housinger',
              name: displayName,
              bio,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
```

- [ ] **Step 3: 型チェックを実行**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 4: フルテストスイートで既存housing関連テストが壊れていないことを確認**

Run: `npx vitest run src/__tests__/housing`
Expected: PASS(既知の無関係failure=EphemeralAddPanel.test.tsx 7件のみ許容)

- [ ] **Step 5: Commit**

```bash
git add api/share/_housingerPageHandler.ts
git commit -m "feat(housing): ハウジンガーOGP代表作をogRepresentativeListingIds順に解決しavatarPngUrl優先化・動画ポスターも対象化"
```

---

### Task 8: `api/og/_housingerCard.ts` レイアウト刷新

**Files:**
- Modify: `api/og/_housingerCard.ts`
- Test: `api/og/__tests__/_housingerCard.test.ts`(新規)

**Interfaces:**
- Consumes: `TOUR_INVITE_BG_DATA_URI`(`./_tourInviteBg.generated.js`、物件0件フォールバック用)
- Produces: `buildHousingerCard(params: { name, bio, avatarSrc, imageSrcs })` (シグネチャ変更、`bio`追加)。`handleHousingerCardRequest` は `img` を最大10件・`bio` パラメータを読む。

- [ ] **Step 1: 新レイアウトの単体テストを書く(失敗させる)**

`api/og/__tests__/_housingerCard.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import { buildHousingerCard, buildHousingerFallbackCard } from '../_housingerCard.js';

function findByText(node: any, text: string): boolean {
  if (node == null) return false;
  if (typeof node === 'string') return node === text;
  if (Array.isArray(node)) return node.some((n) => findByText(n, text));
  if (node.props?.children != null) return findByText(node.props.children, text);
  return false;
}

function countImgNodes(node: any): number {
  if (node == null) return 0;
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + countImgNodes(n), 0);
  if (typeof node !== 'object') return 0;
  let count = node.type === 'img' ? 1 : 0;
  if (node.props?.children != null) count += countImgNodes(node.props.children);
  return count;
}

describe('buildHousingerCard', () => {
  it('画像0枚(物件0件/全滅)でもフォールバック背景付きで破綻しない', () => {
    const tree = buildHousingerCard({ name: 'ソロ活動家', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(countImgNodes(tree)).toBe(0);
    expect(findByText(tree, 'ソロ活動家')).toBe(true);
  });

  it('画像1枚は背景兼ヒーローとして1回だけ使われる(背景と同じdata URIをヒーローにも描画)', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: null, avatarSrc: null, imageSrcs: ['data:image/png;base64,AAA'] });
    // 背景(blur)用に1回 + パネル内ヒーロー表示に1回 = 2つのimgノードが同じsrcを指す
    expect(countImgNodes(tree)).toBe(2);
  });

  it('画像10枚全てがグリッドに描画される(背景兼ヒーロー1 + 上4 + 中1 + 下4)', () => {
    const imageSrcs = Array.from({ length: 10 }, (_, i) => `data:image/png;base64,IMG${i}`);
    const tree = buildHousingerCard({ name: 'テスト', bio: 'よろしく', avatarSrc: null, imageSrcs });
    // 背景1 + ヒーロー1 + 残り9枚 = 11個のimgノード
    expect(countImgNodes(tree)).toBe(11);
    expect(findByText(tree, 'よろしく')).toBe(true);
  });

  it('紹介文が無ければbio行を出さない', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: '', avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, '')).toBe(false);
  });

  it('「Shared via LoPo Housing」の固定英語表記を必ず含む', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, 'Shared via LoPo Housing')).toBe(true);
  });
});

describe('buildHousingerFallbackCard', () => {
  it('従来どおり名前とLoPo Housing表記のみで構成される', () => {
    const tree = buildHousingerFallbackCard('テスト');
    expect(findByText(tree, 'テスト')).toBe(true);
    expect(findByText(tree, 'LoPo Housing')).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run api/og/__tests__/_housingerCard.test.ts`
Expected: FAIL(`buildHousingerCard` が `bio` 引数を受け付けない・画像1枚が2回描画されない 等)

- [ ] **Step 3: レイアウトを実装する**

`api/og/_housingerCard.ts` の1〜24行目(ヘッダーコメント+import)を以下に置き換え:

```ts
/**
 * ハウジンガーページ (/housing/housinger/:uid) 専用 OGP カードのレイアウト定義 (v3・2026-07-31刷新)
 *
 * api/og/index.ts の `type=housinger` 分岐から呼ばれる(新規 Edge Function は作らない)。
 * satori の要素ツリーは実 JSX ではなく、既存 api/og/index.ts と同じくプレーンな
 * オブジェクトリテラル ({ type, props: { style, children } }) で組み立てる流儀に合わせる。
 *
 * v3レイアウト(spec docs/superpowers/specs/2026-07-31-housinger-ogp-card-redesign-design.md):
 * 代表作の1枚目(背景兼ヒーロー) → 拡大+ぼかしでカード全面の背景にし、同じ画像をパネル内
 * 右下にもぼかさず大きめに再表示する。パネルはヘッダー/フッターなしのハウジング意匠(honey accent)。
 * 中央にアイコン+名前+紹介文+「Shared via LoPo Housing」固定英語表記。残り9枚は上4・下4・
 * 中1のグリッドに配置する。画像が1枚も無ければ物件0件用の固定背景(ツアー招待カードと共通)に
 * フォールバックしパネルのみ表示する。
 *
 * 重要 (satori の画像フェッチに関する制約): 既存の index.ts / _tourInviteCard.ts と同じく、
 * リモート URL は avatar/img とも事前に fetch → base64 data URI 化してから要素ツリーに渡す
 * (レンダリング中の画像 fetch 失敗は ImageResponse 生成後の非同期ストリーム内で起きるため
 * try/catch で捕捉できない)。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';

// ハウジングのトンマナ(正典 docs/.private/housing-tour-mockup/index.html 系統の色)
const BG_COLOR = '#111725';
const ACCENT_HONEY = '#ffc987';
const ACCENT_HONEY_GLOW = '#ffb35a';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';
const PANEL_BORDER = 'rgba(255,201,135,0.35)';
const PANEL_BG = 'rgba(17,23,37,0.72)';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const PANEL_MARGIN = 28;
const HERO_SIZE = 220;
const GRID_THUMB = 84;
const GRID_GAP = 10;
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};
/** 画像1枚あたりの取得タイムアウト(外部SNS画像等が遅い/無応答でもカード生成全体を巻き込まない)。 */
const IMAGE_FETCH_TIMEOUT_MS = 4000;
/** 異常に大きい画像レスポンスを弾く上限(OGP用途でここまでのサイズは不要)。 */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
```

`buildHousingerCard`・`buildHeaderRow`・`buildImageArea` (旧48-182行目)を以下にまるごと置き換え:

```ts
/**
 * `type=housinger` カード用の要素ツリーを組み立てる。
 * imageSrcs は0〜10枚のいずれでも破綻しない(0枚ならツアー背景+パネルのみ、
 * 1枚以上なら先頭を背景兼ヒーローとして使う)。
 */
export function buildHousingerCard(params: {
  name: string;
  bio: string | null;
  avatarSrc: string | null;
  imageSrcs: string[];
}) {
  const { name, bio, avatarSrc, imageSrcs } = params;
  const displayName = name || 'ハウジンガー';
  const heroSrc = imageSrcs[0] ?? null;
  const gridSrcs = imageSrcs.slice(1, 10); // 残り最大9枚(上4/中1/下4)

  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        buildBackgroundLayer(heroSrc),
        buildScrimLayer(),
        buildPanel(displayName, bio, avatarSrc, heroSrc, gridSrcs),
      ],
    },
  };
}

/** 背景兼ヒーロー画像を拡大+ぼかしてカード全面に敷く。画像が無ければツアー招待カードと共通の固定背景。 */
function buildBackgroundLayer(heroSrc: string | null) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', inset: 0, display: 'flex',
        backgroundImage: `url(${heroSrc ?? TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        // ヒーロー画像(ユーザー写真)のときだけ強くぼかす。ツアー背景は既にぼかし加工済みの
        // 素材のためここで二重にぼかさない(輪郭が甘くなりすぎるのを防ぐ)。
        ...(heroSrc ? { filter: 'blur(32px)', transform: 'scale(1.15)' } : {}),
      },
    },
  };
}

/** 可読性のための暗幕(ツアー招待カードと同じ考え方)。 */
function buildScrimLayer() {
  return {
    type: 'div',
    props: { style: { position: 'absolute', inset: 0, display: 'flex', backgroundColor: 'rgba(10,14,24,0.55)' } },
  };
}

/** ヘッダー・フッターなしの1枚パネル。左=アイコン+名前+紹介文+ブランド表記、右=代表作グリッド。 */
function buildPanel(
  displayName: string,
  bio: string | null,
  avatarSrc: string | null,
  heroSrc: string | null,
  gridSrcs: string[],
) {
  const nameLen = displayName.length;
  const nameFontSize = nameLen > 20 ? 32 : nameLen > 12 ? 38 : 44;

  const avatarNode = avatarSrc
    ? { type: 'img', props: { src: avatarSrc, width: 88, height: 88, style: { borderRadius: 44, objectFit: 'cover' } } }
    : {
      type: 'div',
      props: {
        style: {
          width: 88, height: 88, borderRadius: 44, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,201,135,0.14)', border: `2px solid ${ACCENT_HONEY}`,
        },
        children: {
          type: 'div',
          props: { style: { fontSize: 36, fontWeight: 900, color: ACCENT_HONEY }, children: displayName.slice(0, 1) },
        },
      },
    };

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', display: 'flex', flexDirection: 'row',
        top: PANEL_MARGIN, left: PANEL_MARGIN, right: PANEL_MARGIN, bottom: PANEL_MARGIN,
        borderRadius: 24, border: `1px solid ${PANEL_BORDER}`, backgroundColor: PANEL_BG,
        padding: 36, gap: 32,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, minWidth: 0 },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 20 },
                  children: [
                    avatarNode,
                    { type: 'div', props: { style: { fontSize: nameFontSize, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5, lineHeight: 1.2, display: 'flex' }, children: displayName } },
                  ],
                },
              },
              ...(bio ? [{
                type: 'div',
                props: { style: { fontSize: 20, color: TEXT_MUTED, lineHeight: 1.5, display: 'flex', lineClamp: 2 }, children: bio },
              }] : []),
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: ACCENT_HONEY,
                    textTransform: 'uppercase', display: 'flex',
                  },
                  children: 'Shared via LoPo Housing',
                },
              },
            ],
          },
        },
        ...(heroSrc ? [buildGridColumn(heroSrc, gridSrcs)] : []),
      ],
    },
  };
}

/** 右側の代表作グリッド: 上4・(中1+ヒーロー)・下4。 */
function buildGridColumn(heroSrc: string, gridSrcs: string[]) {
  const top = gridSrcs.slice(0, 4);
  const leftover = gridSrcs[4] ?? null;
  const bottom = gridSrcs.slice(5, 9);

  return {
    type: 'div',
    props: {
      style: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: GRID_GAP },
      children: [
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP }, children: top.map((src) => buildGridThumb(src)) } },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP, alignItems: 'flex-end', justifyContent: 'space-between' },
            children: [
              leftover ? buildGridThumb(leftover) : { type: 'div', props: { style: { width: GRID_THUMB, height: GRID_THUMB, display: 'flex' } } },
              buildHeroThumb(heroSrc),
            ],
          },
        },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP }, children: bottom.map((src) => buildGridThumb(src)) } },
      ],
    },
  };
}

function buildHeroThumb(src: string) {
  return {
    type: 'div',
    props: {
      style: { width: HERO_SIZE, height: HERO_SIZE, borderRadius: 16, overflow: 'hidden', display: 'flex', border: `2px solid ${ACCENT_HONEY}`, flex: '0 0 auto' },
      children: { type: 'img', props: { src, width: HERO_SIZE, height: HERO_SIZE, style: { objectFit: 'cover' } } },
    },
  };
}

function buildGridThumb(src: string) {
  return {
    type: 'div',
    props: {
      style: { width: GRID_THUMB, height: GRID_THUMB, borderRadius: 8, overflow: 'hidden', display: 'flex', flex: '0 0 auto' },
      children: { type: 'img', props: { src, width: GRID_THUMB, height: GRID_THUMB, style: { objectFit: 'cover' } } },
    },
  };
}
```

`buildHousingerFallbackCard`(旧185-211行目、位置は変わらず、色定数追加分のみ影響なし)はそのまま維持する(変更不要)。

`handleHousingerCardRequest`(旧268-317行目)を、`bio` パラメータ読み取り+10枚対応+新シグネチャ呼び出しに更新:

```ts
export async function handleHousingerCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response('OGP card unavailable', { status: 400 });
  }

  const validSig = await verifyHousingerOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const name = (searchParams.get('name') || '').slice(0, 100);
  const bio = (searchParams.get('bio') || '').slice(0, 100) || null;
  const avatarUrl = searchParams.get('avatar');
  const imageUrls = searchParams.getAll('img').slice(0, 10);

  try {
    const [avatarSrc, ...imageSrcs] = await Promise.all([
      avatarUrl ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      ...imageUrls.map((u) => fetchAsDataUri(u)),
    ]);
    const resolvedImageSrcs = imageSrcs.filter((s): s is string => !!s);

    const uniqueChars = [...new Set('LoPo Housing Shared via LoPo Housing FF14 Housing Tour' + name + (bio ?? ''))].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);

    const element = buildHousingerCard({ name, bio, avatarSrc, imageSrcs: resolvedImageSrcs });
    return new ImageResponse(element as any, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error('Housinger OG card error:', err);
    try {
      const fonts = await loadMPlus1Fonts([...new Set('LoPo Housing' + name)].join('')).catch(() => []);
      const element = buildHousingerFallbackCard(name);
      return new ImageResponse(element as any, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts,
        headers: CACHE_HEADERS,
      });
    } catch (fallbackErr) {
      console.error('Housinger OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
```

(`arrayBufferToBase64`・`sniffSupportedImageMime`・`fetchAsDataUri` の3関数は変更不要、そのまま残す。)

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run api/og/__tests__/_housingerCard.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

実際のsatoriレンダリング結果(PNGの見た目)は `@vercel/og` の `ImageResponse` 生成にEdge runtime相当の環境が要るため、この場ではNode単体スクリプトで検証しない。単体テスト(要素ツリーの構造)がPASSしていることをこのタスクの完了条件とし、実際の見た目の確認はTask 11(統合確認、`npm run dev`+実URL閲覧)にまとめて行う。

```bash
git add api/og/_housingerCard.ts api/og/__tests__/_housingerCard.test.ts
git commit -m "feat(housing): ハウジンガーOGPカードを背景ぼかし+ハウジング意匠パネル+10枚グリッドに刷新"
```

---

### Task 9: マイページに代表作選択UI(丸トグル+説明文)を追加

**Files:**
- Modify: `src/components/housing/browse/ListingGrid.tsx`
- Modify: `src/components/housing/browse/ListingCard.tsx`(コメントのみ、177行目付近)
- Modify: `src/styles/housing.css`(6959行目付近・6958行目コメント更新+ヒント文スタイル追加)
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` / `zh-Hant.json`
- Test: `src/__tests__/housing/ListingGrid.test.tsx`(新規)

**Interfaces:**
- Produces: `ListingGridProps` に `selectable?: boolean`・`selectedIds?: Set<string>`・`onToggleSelect?: (id: string) => void` を追加。`true` のとき各 `ListingCard` に既存の `selectable`/`selected`/`onToggleSelect` を橋渡しする。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/ListingGrid.test.tsx` を新規作成。`ListingCard.test.tsx`(同ディレクトリ)と同じ設定(`i18next`直接初期化・`react-router-dom`の`useNavigate`モック・`@vitest-environment happy-dom`)に合わせる:

```tsx
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { MockListing } from '../../data/housing/mockListings';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { ListingGrid } from '../../components/housing/browse/ListingGrid';

function makeListing(id: string): MockListing {
  return {
    id, area: 'Mist', ward: 5, plot: 10, buildingType: 'house',
    size: 'M', imageMode: 'none', tags: [], ownerUid: 'owner-1', createdAt: 0, visibility: 'public',
  } as unknown as MockListing;
}

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderGrid(props: Partial<React.ComponentProps<typeof ListingGrid>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingGrid
        listings={[makeListing('a'), makeListing('b')]}
        sort="newest"
        onSortChange={() => {}}
        listKey="housinger"
        showOwnerControls
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('ListingGrid selectable', () => {
  it('selectable=trueのとき各カードに選択トグルが出て、クリックでonToggleSelectが呼ばれる', () => {
    const onToggleSelect = vi.fn();
    renderGrid({ selectable: true, selectedIds: new Set(['a']), onToggleSelect });

    const buttons = screen.getAllByTestId('housing-card-select');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toContain('is-selected');
    expect(buttons[1].className).not.toContain('is-selected');
    fireEvent.click(buttons[1]);
    expect(onToggleSelect).toHaveBeenCalledWith('b');
  });

  it('selectable未指定なら選択トグルは出ない', () => {
    renderGrid();
    expect(screen.queryByTestId('housing-card-select')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/ListingGrid.test.tsx`
Expected: FAIL(`selectable`等のpropが`ListingGrid`に無いため`ListingCard`に渡らず、トグルが出ない)

- [ ] **Step 3: `ListingGrid` を拡張する**

`src/components/housing/browse/ListingGrid.tsx:9-25` の `ListingGridProps` に追加:

```ts
export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
  /** スクロール位置の保存・復元、シャッフルボタンの対象キー。 */
  listKey: HousingListKey;
  /** BrowseSortSelect へ渡す選択肢一覧。未指定なら新着順/古い順の2択 (既存仕様)。 */
  sortOrders?: BrowseSortOrder[];
  /** true のとき各カードに家主向け管理コントロールを出す。マイページ専用 (2026-07-24)。 */
  showOwnerControls?: boolean;
  /** showOwnerControls=true のとき ListingCard へ橋渡しする。 */
  onRequestVisibilityChange?: (id: string, next: 'public' | 'unlisted' | 'private') => void;
  /** showOwnerControls=true のとき ListingCard へ橋渡しする。 */
  onEditListing?: (id: string) => void;
  /** true のとき各カード左上にOGP代表作選択トグルを出す。マイページ専用 (2026-07-31)。 */
  selectable?: boolean;
  /** selectable=true のとき、選択済みlisting idの集合。 */
  selectedIds?: Set<string>;
  /** selectable=true のとき、選択トグル時のコールバック。 */
  onToggleSelect?: (id: string) => void;
}
```

同ファイル32-42行目の分割代入と76-85行目の `ListingCard` 呼び出しを更新:

```ts
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
  listKey,
  sortOrders,
  showOwnerControls,
  onRequestVisibilityChange,
  onEditListing,
  selectable,
  selectedIds,
  onToggleSelect,
}) => {
```

```ts
      <div className="housing-listing-grid" ref={containerRef}>
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            onAddToTour={onAddToTour}
            showOwnerControls={showOwnerControls}
            onRequestVisibilityChange={onRequestVisibilityChange}
            onEditListing={onEditListing}
            selectable={selectable}
            selected={selectable ? (selectedIds?.has(l.id) ?? false) : undefined}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
```

トグルボタンのaria-labelは既存の `housing.card.select` キーを再利用するため新規i18nキーは不要(`ListingCard.tsx:181`で既に参照済み)。

`src/components/housing/browse/ListingCard.tsx:171` のJSXコメントを実態に合わせて更新する(この選択トグルがマイページのOGP代表作選択でも使われるようになるため):

```tsx
        {/* 常時表示 (左上): 選択チェック (お気に入りページのタグ選択・マイページのOGP代表作選択で共用)
            + 自分の登録の非公開/期限切れ印。
            印はホバー必須にしない (非公開かどうかが一覧で即分かることが安心につながるため常時)。
            showOwnerControls (マイページ) では isPrivate は右上の公開状態バッジと表示が重複する
            ため出さない。isExpired (visibility=public のまま公開期限切れで実質非表示) は
            バッジには出ない状態なので引き続き表示する。 */}
```

(既存の171-175行目の同等コメントを上記に置き換えるのみ。ロジック自体は変更しない。)

- [ ] **Step 4: 説明文をツールバー見出しに追加する**

`src/components/housing/browse/ListingGrid.tsx` の見出し部分(54-60行目)を以下に置き換え:

```tsx
        <h2 className="housing-listing-grid-heading">
          {t('housing.browse.listings_label')}
          <span className="housing-listing-grid-count">
            {t('housing.browse.count_unit', { count: listings.length })}
          </span>
          {selectable && (
            <span className="housing-listing-grid-og-hint">{t('housing.housinger.ogSelect.hint')}</span>
          )}
        </h2>
```

- [ ] **Step 5: CSSを追加する**

`src/styles/housing.css:6958` のコメントを更新(「お気に入りページ専用」が実態と合わなくなるため):

```css
/* 選択チェック(お気に入りページのタグ選択・マイページのOGP代表作選択で共用)。topleft 列の中に置く */
```

同ファイルの `.housing-listing-grid-count`(5924-5928行目)の直後に追加:

```css
/* マイページのみ: OGP代表作選択の説明(箱・pill化せず静かな注記に留める。feedback_housing_no_ai_pills)。 */
.housing-listing-grid-og-hint {
  font-size: var(--housing-text-sm); font-weight: 400;
  color: var(--housing-text-mute);
}
```

- [ ] **Step 6: i18nキーを5言語に追加する**

`src/locales/ja.json` の `housing.housinger` 配下(`housing.housinger.account` 等が並ぶ近く)に追加:

```json
"ogSelect": {
  "hint": "カード左上のチェックで、シェア時の画像に使う代表作(最大10件)を選べます",
  "publicOnly": "公開物件のみ選択できます",
  "maxReached": "代表作は最大10件までです"
}
```

同じキー構造を `en.json`(`"hint": "Check the top-left of a card to pick up to 10 featured listings for your share image", "publicOnly": "Only public listings can be selected", "maxReached": "You can select up to 10 featured listings"`)、`ko.json`(`"hint": "카드 왼쪽 위 체크로 공유 이미지에 쓸 대표작(최대 10개)을 선택할 수 있어요", "publicOnly": "공개 매물만 선택할 수 있어요", "maxReached": "대표작은 최대 10개까지예요"`)、`zh.json`(`"hint": "点击卡片左上角的勾选,可以选择最多10个用于分享图片的代表作", "publicOnly": "只能选择公开房屋", "maxReached": "代表作最多可选10个"`)、`zh-Hant.json`(`"hint": "點擊卡片左上角的勾選,可以選擇最多10個用於分享圖片的代表作", "publicOnly": "只能選擇公開房屋", "maxReached": "代表作最多可選10個"`)にも追加する。

- [ ] **Step 7: テストが通ることを確認**

Run: `npx vitest run src/__tests__/housing/ListingGrid.test.tsx src/locales/__tests__/zh-hant-completeness.test.ts`
Expected: PASS(全件)

- [ ] **Step 8: Commit**

```bash
git add src/components/housing/browse/ListingGrid.tsx src/components/housing/browse/ListingCard.tsx src/styles/housing.css src/locales/*.json src/__tests__/housing/ListingGrid.test.tsx
git commit -m "feat(housing): ListingGridにOGP代表作選択トグル配線+説明文+5言語i18nキーを追加"
```

---

### Task 10: `HousingerPage.tsx` に選択状態の管理・初期値・永続化を配線

**Files:**
- Modify: `src/components/housing/pages/HousingerPage.tsx`
- Modify: `src/__tests__/housing/HousingerPage.test.tsx`(既存ファイル、実在確認済み)

**Interfaces:**
- Consumes: `isEligibleForOgRepresentative`(Task 2)・`upsertHousingerProfile`(Task 5、`ogRepresentativeListingIds`対応済み)・`ListingGrid` の `selectable`/`selectedIds`/`onToggleSelect`(Task 9)。

- [ ] **Step 1: 既存モックを拡張し、失敗するテストを書く**

`src/__tests__/housing/HousingerPage.test.tsx` の18-21行目(既存の `housingerProfileService` モック)を、`upsertHousingerProfile` も含む形に置き換える:

```ts
const mockGetHousingerProfile = vi.fn();
const mockGetHousingerListings = vi.fn();
const mockUpsertHousingerProfile = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
  getHousingerListings: (...args: unknown[]) => mockGetHousingerListings(...args),
  upsertHousingerProfile: (...args: unknown[]) => mockUpsertHousingerProfile(...args),
}));
```

98-105行目の `beforeEach` に `mockUpsertHousingerProfile.mockReset()` を追加:

```ts
beforeEach(() => {
  mockGetHousingerProfile.mockReset();
  mockGetHousingerListings.mockReset();
  mockUpsertHousingerProfile.mockReset();
  showToastMock.mockClear();
  authUid = null;
  useHousingTourStore.getState().reset();
  useHousingListOrderStore.getState().reset();
});
```

ファイル末尾(336行目の最後の `});` の直前、`describe('HousingerPage', ...)` ブロック内)に以下のテストを追加:

```tsx
  it('本人閲覧・代表作未選択なら新着順上位が自動選択され、選択トグルにチェックが入る', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    expect(selectButtons).toHaveLength(1);
    expect(selectButtons[0].className).toContain('is-selected');
  });

  it('他人が見ると代表作選択トグルは出ない', async () => {
    authUid = 'uid-2';
    mockGetHousingerProfile.mockResolvedValueOnce(publishedProfile);
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1')]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    expect(screen.queryByTestId('housing-card-select')).not.toBeInTheDocument();
  });

  it('非公開物件を選ぼうとするとエラートーストが出て選択されず、APIも呼ばれない', async () => {
    authUid = 'uid-1';
    const privateListing = { ...rawListing('l-2', 'uid-1'), visibility: 'private' as const, createdAt: 200 };
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1'] });
    mockGetHousingerListings.mockResolvedValueOnce([rawListing('l-1', 'uid-1'), privateListing]);

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    expect(selectButtons).toHaveLength(2);
    fireEvent.click(selectButtons[1]); // l-2 (private) を選ぼうとする

    expect(await screen.findByText('公開物件のみ選択できます')).toBeInTheDocument();
    expect(selectButtons[1].className).not.toContain('is-selected');
    expect(mockUpsertHousingerProfile).not.toHaveBeenCalled();
  });

  it('公開物件のトグルを押すと選択され、upsertHousingerProfileがogRepresentativeListingIds込みで呼ばれる', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1'] });
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 200 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    fireEvent.click(selectButtons[1]); // l-2 を追加選択

    await screen.findByText((_, el) => el?.className === 'housing-card-select is-selected' && selectButtons[1] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({ ogRepresentativeListingIds: ['l-1', 'l-2'] });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/HousingerPage.test.tsx`
Expected: FAIL(新規4件が失敗。既存テストは影響を受けずPASSのまま)

- [ ] **Step 3: `HousingerPage.tsx` に状態管理を実装する**

import に追加(ファイル冒頭の既存import群):

```ts
import { isEligibleForOgRepresentative } from '../../../lib/housing/listingPublish';
import { upsertHousingerProfile } from '../../../lib/housing/housingerProfileService';
```

`onEditListing`(203-205行目)の直後に代表作選択のstateとハンドラを追加:

```ts
  // OGP代表作選択(本人閲覧時のみ)。初期値: profile.ogRepresentativeListingIds があればそれ、
  // 無ければ新着順上位10件を自動採用(spec: 何もしなくてもシェアできる状態にする)。
  const [ogSelectionIds, setOgSelectionIds] = useState<string[]>([]);
  useEffect(() => {
    if (!isSelf) return;
    const saved = profile.ogRepresentativeListingIds;
    if (saved && saved.length > 0) {
      setOgSelectionIds(saved);
      return;
    }
    const nowMs = Date.now();
    const defaultIds = [...listings]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((l) => isEligibleForOgRepresentative(l, nowMs))
      .slice(0, 10)
      .map((l) => l.id);
    setOgSelectionIds(defaultIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelf, profile.ogRepresentativeListingIds, listings]);

  const ogSelectionSet = useMemo(() => new Set(ogSelectionIds), [ogSelectionIds]);

  const handleToggleOgSelect = async (id: string) => {
    const target = listings.find((l) => l.id === id);
    if (!target) return;
    const isSelected = ogSelectionIds.includes(id);
    if (!isSelected && !isEligibleForOgRepresentative(target, Date.now())) {
      showToast(t('housing.housinger.ogSelect.publicOnly'), 'error');
      return;
    }
    if (!isSelected && ogSelectionIds.length >= 10) {
      showToast(t('housing.housinger.ogSelect.maxReached'), 'error');
      return;
    }
    const previous = ogSelectionIds;
    const next = isSelected ? ogSelectionIds.filter((x) => x !== id) : [...ogSelectionIds, id];
    setOgSelectionIds(next);
    const result = await upsertHousingerProfile({ ogRepresentativeListingIds: next });
    if (!result.ok) {
      setOgSelectionIds(previous);
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };
```

`ListingGrid` の呼び出し(504-512行目)に配線を追加:

```tsx
                <ListingGrid
                  listings={sorted}
                  sort={sort}
                  onSortChange={setSort}
                  listKey="housinger"
                  showOwnerControls={isSelf}
                  onRequestVisibilityChange={isSelf ? onRequestVisibilityChange : undefined}
                  onEditListing={isSelf ? onEditListing : undefined}
                  selectable={isSelf}
                  selectedIds={isSelf ? ogSelectionSet : undefined}
                  onToggleSelect={isSelf ? handleToggleOgSelect : undefined}
                />
```

(`useState`/`useEffect`/`useMemo` は既にこのファイルで `react` から import 済みのはず。未importなら import 文に追加すること。)

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/__tests__/housing/HousingerPage.test.tsx`
Expected: PASS(既存テスト+新規4件とも)

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/pages/HousingerPage.tsx src/__tests__/housing/HousingerPage.test.tsx
git commit -m "feat(housing): マイページに代表作選択の状態管理・初期自動選択・即時保存を配線"
```

---

### Task 11: 統合確認(フルゲート+実機確認)

**Files:** なし(検証のみ)

**Interfaces:** なし

- [ ] **Step 1: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 2: 本番ビルド**

Run: `npm run build`
Expected: exit code 0

- [ ] **Step 3: フルテストスイート**

Run: `npx vitest run`
Expected: 既知の無関係failure(`EphemeralAddPanel.test.tsx` 7件)以外は全てPASS

- [ ] **Step 4: ロケールJSON構文チェック**

Run: `node -e "['ja','en','ko','zh','zh-Hant'].forEach(l => { JSON.parse(require('fs').readFileSync('src/locales/'+l+'.json','utf8')); console.log(l, 'OK'); })"`
Expected: 5言語とも `OK`

- [ ] **Step 5: 実機確認(ユーザー担当)**

`npm run dev` を起動し、以下をブラウザで確認する(スクショはユーザー側で確認、実装者はここまでで完了):
1. `/housing/mypage` で物件一覧カード左上に選択トグルが出る、非公開物件を選ぼうとするとエラートーストが出る
2. 何も選ばず新規ハウジンガーとして見た場合、新着順上位が自動選択されている
3. 自分のハウジンガーページのOGP画像URL(ブラウザ開発者ツールでog:imageのURLを確認するか、`/api/share?type=housinger&uid=...`相当のHTMLソースを見る)を直接開き、背景ぼかし+パネル+グリッドの見た目を確認する
4. 物件0件のテストアカウントで、ツアー背景がフォールバックされることを確認する
5. アバターを再アップロードし、OGPカードにアイコンが正しく表示される(イニシャルにフォールバックしない)ことを確認する

- [ ] **Step 6: 最終Commit(必要なら微修正の追いコミット)**

実機確認で見た目の微調整(色・余白・フォントサイズ等の定数値)が必要になった場合のみ、`api/og/_housingerCard.ts` の該当定数を調整し追いコミットする。

```bash
git add -A
git commit -m "fix(housing): 実機確認に基づくOGPカードの微調整"
```
