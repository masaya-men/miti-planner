# OGPカード背景画像選択機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジンガーページ(マイページ)で、既に代表作として選択済みの画像の中から1枚を「背景にも使う」と明示的に選べるようにする。

**Architecture:** データモデルに `ogBackgroundListingId`(1件のみ・null許容)を追加し、選ばれたlistingの画像を「OGPカード用に画像配列を組み立てる処理」の中で配列の先頭へ並べ替えるだけに留める。カード描画本体(`api/og/_housingerCard.ts`)は「配列の先頭=背景」という既存ルールをそのまま使うため無改修。

**Tech Stack:** React (HousingerPage/ListingGrid/ListingCard) + Firestore Admin SDK (`api/share/_housingerPageHandler.ts` / `api/housing/_upsertHousingerProfileHandler.ts`) + vitest。

## Global Constraints

- 対象spec: `docs/superpowers/specs/2026-08-03-ogp-card-background-image-selection-design.md`(承認済み・コミット済み `d49c3629`)。この計画の内容と食い違う場合は spec を正とする。
- **サブエージェントはコミットしない**。各タスクは実装+テストパスまでで停止する。全タスク完了後、親セッション(orchestrator)が `git diff` を検収してからまとめてコミットする(このリポジトリの運用ルール: 並行実行時はエージェントにコミットさせず親が検収)。
- **触ってはいけないファイル(このタスクでは無改修で済む・既に別タスクで検証済み)**: `api/og/_housingerCard.ts`, `src/lib/ogpHousingerCard.ts`, `api/og-cache/_ogCacheLogic.ts`, これらの `__tests__`。`docs/TODO.md` もこのタスクでは触らない(orchestratorがセッション終了時にまとめて更新する)。
- 新トグルの選択中の色は**ハニーゴールド**(`--housing-honey`/`--housing-honey-border`/`--housing-honey-text`)にする(ユーザー指示2026-08-03: 既存の代表作チェック=青と同じ色だと2つのトグルの意味が見分けられないため、あえて別アクセントにする。housing-design.mdの「青=選択」原則より、この場では視認性の指示を優先)。
- 文言は必ず i18n キー経由(ハードコーディング禁止)。日本語だけでなく en/ko/zh/zh-Hant の4言語すべてに追加する。
- 既存パターン(`ogRepresentativeListingIds` の型/バリデーション/トグルUI、`handleToggleOgSelect` の楽観的更新+ロールバック)を踏襲し、新しい設計を持ち込まない。
- コミットメッセージ・コメントは日本語。

## File Structure

| ファイル | 役割 |
|---|---|
| `src/types/housing.ts` | `HousingerProfile` 型に `ogBackgroundListingId` 追加 |
| `src/lib/housing/housingerProfileService.ts` | `upsertHousingerProfile` の入力型に同フィールド追加 |
| `api/housing/_upsertHousingerProfileHandler.ts` | バリデーション + Firestore書き込み |
| `api/share/_housingerPageHandler.ts` | 画像配列を背景指定に応じて並べ替える純粋関数 + 呼び出し側の配線 |
| `src/components/housing/browse/ListingCard.tsx` | カード上の「背景にも使う」トグルボタン本体 |
| `src/components/housing/browse/ListingGrid.tsx` | `backgroundId`/`onToggleBackground` を`ListingCard`へ橋渡し |
| `src/components/housing/pages/HousingerPage.tsx` | state・トグルハンドラー・`ListingGrid`への配線・代表作解除時の連動解除 |
| `src/styles/housing.css` | 新トグルの見た目(`housing-card-background-select`) |
| `src/locales/{ja,en,ko,zh,zh-Hant}.json` | 文言追加 |

---

### Task 1: バックエンド — プロフィール型 + 保存API に `ogBackgroundListingId` を追加

**Files:**
- Modify: `src/types/housing.ts:342-344`
- Modify: `src/lib/housing/housingerProfileService.ts:58-63`
- Modify: `api/housing/_upsertHousingerProfileHandler.ts:29-56`, `:113-127`
- Test: `api/housing/__tests__/upsertHousingerProfile.test.ts`

**Interfaces:**
- Produces: `HousingerProfile.ogBackgroundListingId?: string | null`(型)。`validateUpsertBody(body)` が `ogBackgroundListingId` を受理し、不正値なら `{ ok: false, error: 'invalid_og_background_id' }` を返す。`housing_profiles/{uid}` ドキュメントに `ogBackgroundListingId` フィールドが保存される。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/upsertHousingerProfile.test.ts` の末尾( `});` の直前、32行目の後)に追記:

```ts
  it('ogBackgroundListingIdは文字列またはnullのみok(空文字・数値はinvalid)', () => {
    expect(validateUpsertBody({ ogBackgroundListingId: 'l-1' }).ok).toBe(true);
    expect(validateUpsertBody({ ogBackgroundListingId: null }).ok).toBe(true);
    expect(validateUpsertBody({}).ok).toBe(true);
    expect(validateUpsertBody({ ogBackgroundListingId: '' }))
      .toEqual({ ok: false, error: 'invalid_og_background_id' });
    expect(validateUpsertBody({ ogBackgroundListingId: 123 }))
      .toEqual({ ok: false, error: 'invalid_og_background_id' });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: FAIL(`ogBackgroundListingId` 未対応のため、`ok:true` にならない/エラーコード不一致)

- [ ] **Step 3: `src/types/housing.ts` に型を追加**

`src/types/housing.ts:342-344` を以下に置き換え:

```ts
  /** OGPカードに使う代表作(最大10件、listing id、順序付き・先頭=背景兼ヒーロー)。未設定/空なら新着順上位10件を自動採用する。 */
  ogRepresentativeListingIds?: string[] | null;
  /** 代表作の中から「背景にも使う」と明示指定した1件のlisting id。未設定/nullなら ogRepresentativeListingIds の先頭を自動的に背景として使う(既存挙動のフォールバック)。 */
  ogBackgroundListingId?: string | null;
}
```

- [ ] **Step 4: `housingerProfileService.ts` の入力型を拡張**

`src/lib/housing/housingerProfileService.ts:58-63` を以下に置き換え:

```ts
export async function upsertHousingerProfile(input: {
  isPublished?: boolean;
  bio?: string | null;
  snsUrl?: string | null;
  ogRepresentativeListingIds?: string[] | null;
  ogBackgroundListingId?: string | null;
}): Promise<{ ok: boolean; error?: string; profile?: HousingerProfile }> {
```

- [ ] **Step 5: `_upsertHousingerProfileHandler.ts` のバリデーションを拡張**

`api/housing/_upsertHousingerProfileHandler.ts:29-56` を以下に置き換え:

```ts
export function validateUpsertBody(body: any):
  | {
      ok: true;
      isPublished?: boolean;
      bio?: string | null;
      snsUrl?: string | null;
      ogRepresentativeListingIds?: string[] | null;
      ogBackgroundListingId?: string | null;
    }
  | {
      ok: false;
      error:
        | 'invalid_bio'
        | 'invalid_sns_url'
        | 'invalid_body'
        | 'invalid_og_representative_ids'
        | 'invalid_og_background_id';
    } {
  const { isPublished, bio, snsUrl, ogRepresentativeListingIds, ogBackgroundListingId } = body || {};
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
  if (ogBackgroundListingId !== undefined && ogBackgroundListingId !== null) {
    if (typeof ogBackgroundListingId !== 'string' || !ogBackgroundListingId) {
      return { ok: false, error: 'invalid_og_background_id' };
    }
  }
  return { ok: true, isPublished, bio, snsUrl, ogRepresentativeListingIds, ogBackgroundListingId };
}
```

- [ ] **Step 6: トランザクションの書き込みに追加**

`api/housing/_upsertHousingerProfileHandler.ts:113-127` の `next` オブジェクトのうち、`ogRepresentativeListingIds` の行の直後に1行追加(前後は変更しない):

```ts
        ogRepresentativeListingIds: v.ogRepresentativeListingIds !== undefined
          ? v.ogRepresentativeListingIds
          : prev?.ogRepresentativeListingIds ?? null,
        ogBackgroundListingId: v.ogBackgroundListingId !== undefined
          ? v.ogBackgroundListingId
          : prev?.ogBackgroundListingId ?? null,
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `npx vitest run api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: PASS(全件)

---

### Task 2: バックエンド — 画像配列の背景並べ替えロジック

**Files:**
- Modify: `api/share/_housingerPageHandler.ts`(新規エクスポート関数追加 + `handler()` 内の配線変更、`:190-229` 付近)
- Test: `api/share/__tests__/_housingerPageHandler.test.ts`

**Interfaces:**
- Produces: `reorderListingImageArraysByBackgroundId(entries: { id: string; images: string[] }[], backgroundListingId: string | null | undefined): { id: string; images: string[] }[]`(named export、`_housingerPageHandler.ts` からテストが直接importする)

- [ ] **Step 1: 失敗するテストを書く**

`api/share/__tests__/_housingerPageHandler.test.ts` の1行目を以下に置き換え(import追加):

```ts
import { describe, it, expect } from 'vitest';
import { listingRepresentativeImages, collectImagesFromListings, reorderListingImageArraysByBackgroundId } from '../_housingerPageHandler.js';
```

ファイル末尾(74行目、最後の `});` の後)に追記:

```ts

describe('reorderListingImageArraysByBackgroundId', () => {
  it('backgroundListingIdが一致する要素を先頭へ移動する', () => {
    const entries = [
      { id: 'l-1', images: ['1a'] },
      { id: 'l-2', images: ['2a'] },
      { id: 'l-3', images: ['3a'] },
    ];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-3');
    expect(result.map((e) => e.id)).toEqual(['l-3', 'l-1', 'l-2']);
    expect(result.map((e) => e.images)).toEqual([['3a'], ['1a'], ['2a']]);
  });

  it('一致する要素が無ければ並び順をそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-999');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('未指定(null/undefined)ならそのまま返す', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    expect(reorderListingImageArraysByBackgroundId(entries, null).map((e) => e.id)).toEqual(['l-1', 'l-2']);
    expect(reorderListingImageArraysByBackgroundId(entries, undefined).map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('既に先頭にある場合は並び替えしない', () => {
    const entries = [{ id: 'l-1', images: ['1a'] }, { id: 'l-2', images: ['2a'] }];
    const result = reorderListingImageArraysByBackgroundId(entries, 'l-1');
    expect(result.map((e) => e.id)).toEqual(['l-1', 'l-2']);
  });

  it('空配列はそのまま空配列', () => {
    expect(reorderListingImageArraysByBackgroundId([], 'l-1')).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run api/share/__tests__/_housingerPageHandler.test.ts`
Expected: FAIL(`reorderListingImageArraysByBackgroundId` が存在しない)

- [ ] **Step 3: 純粋関数を実装する**

`api/share/_housingerPageHandler.ts` の `collectImagesFromListings` 関数(現在の`:112-127`)の直後に追加:

```ts

/**
 * `listingImageArrays` の中から `backgroundListingId` に一致する要素を先頭へ移動する。
 * 一致なし(未指定/代表作から外れた/非公開になった等)ならそのまま返す = 既存の並び順を使う
 * (このあとの `collectImagesFromListings` が並び順の先頭を「背景兼ヒーロー」として扱う)。
 */
export function reorderListingImageArraysByBackgroundId(
  entries: { id: string; images: string[] }[],
  backgroundListingId: string | null | undefined,
): { id: string; images: string[] }[] {
  if (!backgroundListingId) return entries;
  const idx = entries.findIndex((e) => e.id === backgroundListingId);
  if (idx <= 0) return entries;
  const copy = [...entries];
  const [target] = copy.splice(idx, 1);
  copy.unshift(target);
  return copy;
}
```

- [ ] **Step 4: テストを実行して純粋関数のテストが通ることを確認する**

Run: `npx vitest run api/share/__tests__/_housingerPageHandler.test.ts`
Expected: PASS(全件。この時点では `handler()` 本体はまだ未配線)

- [ ] **Step 5: `handler()` 内の配線を変更する**

`api/share/_housingerPageHandler.ts:190-226` の現在のブロック(`const nowMs = Date.now();` から `resolvedImages = collectImagesFromListings(listingImageArrays, MAX_CARD_IMAGES);` まで)を、以下に置き換え:

```ts
          const nowMs = Date.now();
          let resolvedImages: string[] = [];
          try {
            const selectedIds: string[] = Array.isArray(profile.ogRepresentativeListingIds)
              ? profile.ogRepresentativeListingIds.slice(0, 10)
              : [];

            const listingImageEntries: { id: string; images: string[] }[] = [];
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
                listingImageEntries.push({ id: snap.id, images: listingRepresentativeImages(data) });
              }
            } else {
              const listingSnap = await db.collection(LISTING_COLLECTION)
                .where('ownerUid', '==', uid)
                .where('visibility', '==', 'public')
                .where('isHidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .select('visibility', 'isHidden', 'deletedAt', 'createdAt', 'imageMode', 'thumbnailPath', 'thumbnailPaths', 'ogImageUrl', 'sourceImageUrls', 'videoPosterUrl', 'youtubeVideoId', 'ownerUid', 'publishUntil')
                .get();
              for (const doc of listingSnap.docs) {
                const data = doc.data();
                if (data.deletedAt != null) continue;
                if (!isEligibleForOgRepresentative(data, nowMs)) continue;
                listingImageEntries.push({ id: doc.id, images: listingRepresentativeImages(data) });
              }
            }
            const backgroundListingId = typeof profile.ogBackgroundListingId === 'string' ? profile.ogBackgroundListingId : null;
            const orderedEntries = reorderListingImageArraysByBackgroundId(listingImageEntries, backgroundListingId);
            resolvedImages = collectImagesFromListings(orderedEntries.map((e) => e.images), MAX_CARD_IMAGES);
          } catch (err) {
            console.error('Housinger page listing fetch error:', err);
          }
```

- [ ] **Step 6: テストを実行して全体が通ることを確認する**

Run: `npx vitest run api/share/__tests__/_housingerPageHandler.test.ts`
Expected: PASS(全件)

---

### Task 3: i18n文言の追加(5言語)

**Files:**
- Modify: `src/locales/ja.json:2712-2716`
- Modify: `src/locales/en.json:2691-2695`
- Modify: `src/locales/ko.json:2656-2660`
- Modify: `src/locales/zh.json:2656-2660`
- Modify: `src/locales/zh-Hant.json:2656-2660`

**Interfaces:**
- Produces: `housing.housinger.ogSelect.backgroundToggle` キー(全5言語)。`housing.housinger.ogSelect.hint` の文言を更新(全5言語)。

- [ ] **Step 1: `ja.json` を更新**

`src/locales/ja.json:2712-2716` を以下に置き換え:

```json
            "ogSelect": {
                "hint": "カード左上のチェックで、シェア時の画像に使う代表作(最大10件)を選べます。選んだカードに出るアイコンをタップすると、その1枚を背景にも使えます",
                "publicOnly": "公開物件のみ選択できます",
                "maxReached": "代表作は最大10件までです",
                "backgroundToggle": "背景にも使う"
            }
```

- [ ] **Step 2: `en.json` を更新**

`src/locales/en.json:2691-2695` を以下に置き換え:

```json
            "ogSelect": {
                "hint": "Check the top-left of a card to pick up to 10 featured listings for your share image. Tap the icon that appears on a selected card to also use that photo as the background",
                "publicOnly": "Only public listings can be selected",
                "maxReached": "You can select up to 10 featured listings",
                "backgroundToggle": "Also use as background"
            }
```

- [ ] **Step 3: `ko.json` を更新**

`src/locales/ko.json:2656-2660` を以下に置き換え:

```json
            "ogSelect": {
                "hint": "카드 왼쪽 위 체크로 공유 이미지에 쓸 대표작(최대 10개)을 선택할 수 있어요. 선택한 카드에 나타나는 아이콘을 누르면 그 사진을 배경으로도 쓸 수 있어요",
                "publicOnly": "공개 매물만 선택할 수 있어요",
                "maxReached": "대표작은 최대 10개까지예요",
                "backgroundToggle": "배경으로도 사용"
            }
```

- [ ] **Step 4: `zh.json` を更新**

`src/locales/zh.json:2656-2660` を以下に置き換え:

```json
            "ogSelect": {
                "hint": "点击卡片左上角的勾选,可以选择最多10个用于分享图片的代表作。点击已选卡片上出现的图标,还可以把这张照片也用作背景",
                "publicOnly": "只能选择公开房屋",
                "maxReached": "代表作最多可选10个",
                "backgroundToggle": "也用作背景"
            }
```

- [ ] **Step 5: `zh-Hant.json` を更新**

`src/locales/zh-Hant.json:2656-2660` を以下に置き換え:

```json
            "ogSelect": {
                "hint": "點擊卡片左上角的勾選,可以選擇最多10個用於分享圖片的代表作。點擊已選卡片上出現的圖示,還可以把這張照片也用作背景",
                "publicOnly": "只能選擇公開房屋",
                "maxReached": "代表作最多可選10個",
                "backgroundToggle": "也用作背景"
            }
```

- [ ] **Step 6: JSON構文とパリティテストを確認する**

Run: `npx vitest run src/locales/__tests__/zh-hant-completeness.test.ts`
Expected: PASS(zh.json↔zh-Hant.jsonのキーパリティが崩れていないこと)

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/ja.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/ko.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/zh.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/zh-Hant.json','utf8')); console.log('ok')"`
Expected: `ok`(5ファイルとも構文エラー無し)

---

### Task 4: フロントエンド — `ListingCard` に「背景にも使う」トグルを追加

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx:5`, `:24-43`, `:57-67`, `:177-198`
- Modify: `src/styles/housing.css`(`:7031` の直後に追加)
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`

**Interfaces:**
- Consumes: なし(既存の `selectable`/`selected`/`onToggleSelect` はそのまま)
- Produces: `ListingCardProps.isBackground?: boolean`、`ListingCardProps.onToggleBackground?: (id: string) => void`。`selectable && selected && onToggleBackground` の時だけ `data-testid="housing-card-background-select"` のボタンを描画し、クリックで `onToggleBackground(listing.id)` を呼ぶ。`isBackground` が true なら `is-selected` クラスが付く。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/ListingCard.test.tsx:71` (`describe('ListingCard — selectable (選択UI)')` ブロックの閉じ `});` の直後、73行目の前)に追記:

```tsx

describe('ListingCard — 背景にも使うトグル', () => {
  it('selected=falseなら背景トグルは出ない', () => {
    renderCard({ selectable: true, selected: false, onToggleSelect: vi.fn(), onToggleBackground: vi.fn() });
    expect(screen.queryByTestId('housing-card-background-select')).not.toBeInTheDocument();
  });

  it('selected=trueかつonToggleBackground指定なら背景トグルが出る', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn(), onToggleBackground: vi.fn() });
    expect(screen.getByTestId('housing-card-background-select')).toBeInTheDocument();
  });

  it('onToggleBackground未指定なら背景トグルは出ない', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.queryByTestId('housing-card-background-select')).not.toBeInTheDocument();
  });

  it('背景トグルをクリックするとonToggleBackgroundがlisting.idで呼ばれる', () => {
    const onToggleBackground = vi.fn();
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn(), onToggleBackground });
    fireEvent.click(screen.getByTestId('housing-card-background-select'));
    expect(onToggleBackground).toHaveBeenCalledWith(mockListing.id);
  });

  it('isBackground=trueのとき is-selected クラスが付く', () => {
    renderCard({
      selectable: true, selected: true, onToggleSelect: vi.fn(),
      onToggleBackground: vi.fn(), isBackground: true,
    });
    expect(screen.getByTestId('housing-card-background-select')).toHaveClass('is-selected');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL(`housing-card-background-select` が存在しない)

- [ ] **Step 3: import を追加**

`src/components/housing/browse/ListingCard.tsx:5` を以下に置き換え:

```tsx
import { Plus, Check, Pencil, Image as ImageIcon } from 'lucide-react';
```

- [ ] **Step 4: Props を追加**

`src/components/housing/browse/ListingCard.tsx:24-43` の `ListingCardProps` インターフェースのうち、`onToggleSelect?: (id: string) => void;` の行の直後(現在の33行目の後)に追加:

```tsx
  /** selectable=true かつ selected=true の時だけ表示する「背景にも使う」トグルの選択状態。 */
  isBackground?: boolean;
  /** 背景トグルクリック時のコールバック。未指定ならトグル自体を描画しない。 */
  onToggleBackground?: (id: string) => void;
```

- [ ] **Step 5: コンポーネント引数に追加**

`src/components/housing/browse/ListingCard.tsx:57-67` を以下に置き換え:

```tsx
export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onAddToTour,
  selectable,
  selected,
  onToggleSelect,
  isBackground,
  onToggleBackground,
  onCardClick,
  showOwnerControls,
  onRequestVisibilityChange,
  onEditListing,
}) => {
```

- [ ] **Step 6: ボタンを描画する**

`src/components/housing/browse/ListingCard.tsx:177-198` の `<div className="housing-listing-card-topleft">` ブロックを以下に置き換え:

```tsx
        <div className="housing-listing-card-topleft">
          {selectable && (
            <button
              type="button"
              className={`housing-card-select${selected ? ' is-selected' : ''}`}
              aria-label={t('housing.card.select')}
              aria-pressed={selected ?? false}
              data-testid="housing-card-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(listing.id);
              }}
            >
              {selected && <Check size={14} aria-hidden="true" />}
            </button>
          )}
          {selectable && selected && onToggleBackground && (
            <button
              type="button"
              className={`housing-card-background-select${isBackground ? ' is-selected' : ''}`}
              aria-label={t('housing.housinger.ogSelect.backgroundToggle')}
              aria-pressed={isBackground ?? false}
              data-testid="housing-card-background-select"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBackground(listing.id);
              }}
            >
              <ImageIcon size={13} aria-hidden="true" />
            </button>
          )}
          {((isPrivate && !showOwnerControls) || isExpired) && (
            <span className="housing-listing-card-mine-note" data-testid="housing-card-mine-note">
              {isPrivate ? t('housing.register.badge_private') : t('housing.register.badge_expired')}
            </span>
          )}
        </div>
```

- [ ] **Step 7: CSSを追加する**

`src/styles/housing.css:7031` (`.housing-card-select.is-selected { ... }` ブロックの閉じ `}` の直後、「自分の登録の非公開/期限切れ印」コメントの前)に追加:

```css
/* 「背景にも使う」トグル(代表作選択済みのカードにのみ表示)。既存の選択チェック(青=選択)とは
   あえて別アクセント(ハニーゴールド)にする(2026-08-03ユーザー指示: 同じ青だと2つのトグルの
   意味が見分けられないため)。塗り/文字色は housing.css 既存の honey 塗りボタン(例:
   .housing-filter-option[data-selected="true"] .housing-filter-option-check)と同じトークンの
   組み合わせ(--housing-honey / --housing-honey-border / --housing-honey-text)を使う。 */
.housing-card-background-select {
  flex: 0 0 auto;
  width: 22px; height: 22px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--housing-bubble-bg);
  border: 2px solid var(--housing-panel-border-strong);
  color: var(--housing-text-mute); cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.housing-card-background-select:hover {
  border-color: var(--housing-honey);
  color: var(--housing-honey);
}
.housing-card-background-select:active { transform: scale(0.92); }
.housing-card-background-select.is-selected {
  background: var(--housing-honey);
  border-color: var(--housing-honey-border);
  color: var(--housing-honey-text);
}
```

- [ ] **Step 8: テストを実行して成功を確認する**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS(全件、既存テスト含む)

---

### Task 5: フロントエンド — `ListingGrid` の橋渡し

**Files:**
- Modify: `src/components/housing/browse/ListingGrid.tsx:9-31`, `:38-51`, `:88-100`
- Test: `src/__tests__/housing/ListingGrid.test.tsx`

**Depends on:** Task 4(`ListingCard` の `isBackground`/`onToggleBackground` props が前提)

**Interfaces:**
- Consumes: Task4の `ListingCardProps.isBackground` / `onToggleBackground`
- Produces: `ListingGridProps.backgroundId?: string | null`、`ListingGridProps.onToggleBackground?: (id: string) => void`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/ListingGrid.test.tsx` の末尾(63行目、ファイル末尾)に追記:

```tsx

describe('ListingGrid backgroundId', () => {
  it('backgroundIdに一致するカードだけ背景トグルがis-selectedになる', () => {
    const onToggleBackground = vi.fn();
    renderGrid({
      selectable: true,
      selectedIds: new Set(['a', 'b']),
      onToggleSelect: vi.fn(),
      backgroundId: 'b',
      onToggleBackground,
    });

    const bgButtons = screen.getAllByTestId('housing-card-background-select');
    expect(bgButtons).toHaveLength(2);
    expect(bgButtons[0].className).not.toContain('is-selected');
    expect(bgButtons[1].className).toContain('is-selected');
    fireEvent.click(bgButtons[0]);
    expect(onToggleBackground).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/__tests__/housing/ListingGrid.test.tsx`
Expected: FAIL(`backgroundId`/`onToggleBackground` が forward されず `housing-card-background-select` が見つからない)

- [ ] **Step 3: Props を追加**

`src/components/housing/browse/ListingGrid.tsx:9-31` の `ListingGridProps` インターフェースのうち `onToggleSelect?: (id: string) => void;` の行の直後に追加:

```tsx
  /** selectable=true のとき、背景に使うと明示指定されたlisting id(0/1件)。 */
  backgroundId?: string | null;
  /** selectable=true のとき、背景トグル時のコールバック。 */
  onToggleBackground?: (id: string) => void;
```

- [ ] **Step 4: コンポーネント引数を追加**

`src/components/housing/browse/ListingGrid.tsx:38-51` を以下に置き換え:

```tsx
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
  backgroundId,
  onToggleBackground,
}) => {
```

- [ ] **Step 5: `ListingCard` へ forward する**

`src/components/housing/browse/ListingGrid.tsx:88-100` の `<ListingCard ... />` を以下に置き換え:

```tsx
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
            isBackground={selectable ? backgroundId === l.id : undefined}
            onToggleBackground={onToggleBackground}
          />
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/__tests__/housing/ListingGrid.test.tsx`
Expected: PASS(全件)

---

### Task 6: フロントエンド — `HousingerPage` への統合配線

**Files:**
- Modify: `src/components/housing/pages/HousingerPage.tsx:209-251`(state/handler追加・`handleToggleOgSelect`変更), `:555-566`(`ListingGrid`呼び出し)
- Test: `src/__tests__/housing/HousingerPage.test.tsx`

**Depends on:** Task 1(`upsertHousingerProfile` が `ogBackgroundListingId` を受理)、Task 5(`ListingGrid` の `backgroundId`/`onToggleBackground`)

**Interfaces:**
- Consumes: Task1の `upsertHousingerProfile({ ogBackgroundListingId })`、Task5の `ListingGridProps.backgroundId`/`onToggleBackground`
- Produces: state `ogBackgroundId: string | null`、関数 `handleToggleOgBackground(id: string): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingerPage.test.tsx:414` (`});` の直前、末尾のテストの後)に追記:

```tsx

  it('代表作選択済みのカードだけ背景トグルが出て、押すと選ばれる', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({ ...publishedProfile, ogRepresentativeListingIds: ['l-1', 'l-2'] });
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 50 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const bgButtons = await screen.findAllByTestId('housing-card-background-select');
    expect(bgButtons).toHaveLength(2);
    fireEvent.click(bgButtons[1]);

    await screen.findByText((_, el) => el?.className === 'housing-card-background-select is-selected' && bgButtons[1] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({ ogBackgroundListingId: 'l-2' });
  });

  it('背景に選んだカードを代表作から外すと、背景指定も一緒に解除される', async () => {
    authUid = 'uid-1';
    mockGetHousingerProfile.mockResolvedValueOnce({
      ...publishedProfile,
      ogRepresentativeListingIds: ['l-1', 'l-2'],
      ogBackgroundListingId: 'l-1',
    });
    mockGetHousingerListings.mockResolvedValueOnce([
      rawListing('l-1', 'uid-1'),
      { ...rawListing('l-2', 'uid-1'), createdAt: 50 },
    ]);
    mockUpsertHousingerProfile.mockResolvedValueOnce({ ok: true, profile: publishedProfile });

    renderPage('uid-1');

    await screen.findByRole('heading', { name: 'たかし' });
    const selectButtons = await screen.findAllByTestId('housing-card-select');
    fireEvent.click(selectButtons[0]); // l-1(背景指定済み)を代表作から外す

    await screen.findByText((_, el) => el?.className === 'housing-card-select' && selectButtons[0] === el);
    expect(mockUpsertHousingerProfile).toHaveBeenCalledWith({
      ogRepresentativeListingIds: ['l-2'],
      ogBackgroundListingId: null,
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/__tests__/housing/HousingerPage.test.tsx`
Expected: FAIL(`housing-card-background-select` が描画されない/呼び出し引数が一致しない)

- [ ] **Step 3: state と effect を追加**

`src/components/housing/pages/HousingerPage.tsx:209-227` の既存ブロック(`ogSelectionIds` の宣言〜useEffect)の直後、`const ogSelectionSet = ...` の行の**前**に追加:

```tsx
  // OGP背景選択(本人閲覧時のみ)。初期値: profile.ogBackgroundListingId。未設定ならnull
  // (ogSelectionIds[0]が自動的に背景として使われる、既存フォールバック)。
  const [ogBackgroundId, setOgBackgroundId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSelf) return;
    setOgBackgroundId(profile?.ogBackgroundListingId ?? null);
  }, [isSelf, profile?.ogBackgroundListingId]);
```

- [ ] **Step 4: `handleToggleOgSelect` を変更し、`handleToggleOgBackground` を追加**

`src/components/housing/pages/HousingerPage.tsx:231-251` の `handleToggleOgSelect` 全体を以下に置き換え:

```tsx
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
    const previousSelection = ogSelectionIds;
    const previousBackground = ogBackgroundId;
    const next = isSelected ? ogSelectionIds.filter((x) => x !== id) : [...ogSelectionIds, id];
    // 背景に指定していたカードを代表作から外す場合は、背景指定も一緒に解除する
    // (外れたlistingが背景のまま残ると、次回描画時にサーバー側フォールバックで無視されるだけで
    // 見た目には問題ないが、UI上の状態としては矛盾するため明示的に解除する)。
    const clearsBackground = isSelected && ogBackgroundId === id;
    setOgSelectionIds(next);
    if (clearsBackground) setOgBackgroundId(null);
    const result = await upsertHousingerProfile({
      ogRepresentativeListingIds: next,
      ...(clearsBackground ? { ogBackgroundListingId: null } : {}),
    });
    if (!result.ok) {
      setOgSelectionIds(previousSelection);
      if (clearsBackground) setOgBackgroundId(previousBackground);
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };

  const handleToggleOgBackground = async (id: string) => {
    if (!ogSelectionIds.includes(id)) return;
    const previous = ogBackgroundId;
    const next = ogBackgroundId === id ? null : id;
    setOgBackgroundId(next);
    const result = await upsertHousingerProfile({ ogBackgroundListingId: next });
    if (!result.ok) {
      setOgBackgroundId(previous);
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };
```

- [ ] **Step 5: `ListingGrid` の呼び出しに配線を追加**

`src/components/housing/pages/HousingerPage.tsx:555-566` の `<ListingGrid ... />` を以下に置き換え:

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
                  backgroundId={isSelf ? ogBackgroundId : undefined}
                  onToggleBackground={isSelf ? handleToggleOgBackground : undefined}
                />
```

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `npx vitest run src/__tests__/housing/HousingerPage.test.tsx`
Expected: PASS(全件)

---

### Task 7(orchestrator専用・サブエージェントに渡さない): 統合検証 + コミット

- [ ] **Step 1: 全体ビルドを実行**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 2: 全テストを実行**

Run: `npx vitest run`
Expected: 既知の無関係failure(EphemeralAddPanel 7件)以外は全てPASS

- [ ] **Step 3: `git diff` で全変更を検収**

Task1〜6の変更に加え、このセッションの前段で既に完成していた「OGPカードgrid/sidebarパターン本体」の未コミット変更(`api/og/_housingerCard.ts` 等)も一緒にレビューする(ユーザーが「まとめて1つのコミットにする」と明示選択済み)。

- [ ] **Step 4: `docs/TODO.md` の「現在の状態」を更新**

背景画像選択機能の完了を反映し、次セッション最優先の内容を更新する。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(housing): OGPカード新デザイン(grid/sidebar)+背景画像の明示選択機能

grid/sidebar 2パターンのカードデザインを実装。写真は常に10枚固定
スロットで巡回コピー穴埋め、配信時ランダム2択+両方事前キャッシュ。
さらに、代表作として選んだ画像の中から1枚を「背景にも使う」と
明示的に選べるようにした(未指定時は先頭の代表作を自動的に背景に
使う既存フォールバックを維持)。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: push・デプロイの要否をユーザーに確認**
