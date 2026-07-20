# ハウジング画像アップロード上限 + 投稿URL消失バグ 修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング登録画面の画像アップロード欄を「12枚選んで先頭4枚だけ保存」から「最初から4枚までしか選べない」に作り直し、一括で上限を超えて選んだ場合は確認モーダルで知らせる。あわせて、投稿URL(postUrl)を貼った後に画像を直接アップロードすると投稿URLごと消えてしまうバグを、host検証込みで修正する。

**Architecture:** クライアント側 (`HousingRegisterImageField.tsx` / `RegisterSectionMedia.tsx` / `RegisterPage.tsx`) とサーバー側共有バリデーション (`src/utils/housingValidation.ts`、クライアント・`api/housing/_registerListingHandler.ts` の両方から呼ばれる) を順番に直す。postUrl の host 検証は、URL 貼り付け時に既に使われている `parseTweetUrl` / `parseYoutubeUrl` / `isOgpUrlAllowed` をそのまま再利用し、新しい判定基準を作らない。

**Tech Stack:** React + TypeScript, vitest + @testing-library/react, i18next (ja/en/ko/zh)

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-20-housing-image-upload-postUrl-fix-design.md`
- ハウジング配下は独自トンマナ (honey色 OK、Inter フォント OK、既存 `HousingDuplicateWarningDialog.tsx` と同じ CSS 変数パターンを使う。ハードコード color/px は禁止、`--housing-*` トークン経由)
- 文言は日本語で実装 (`ja.json`)、`en.json` も正しく翻訳して追加。`ko.json`/`zh.json` は既存の同ブロックが日本語プレースホルダのままなので、新規キーも同じ慣習に合わせて日本語文字列を入れる (新たに翻訳を創作しない)
- 各タスクは「失敗するテストを書く→実装→テストを通す→コミット」の順を厳守
- 各タスクの最後に `npx vitest run <対象ファイル>` を実行して確認する。全タスク完了後に `npx tsc -b --force` + `npm test` (フルスイート) を実行する (Task 6)

---

### Task 1: 画像ピッカーの上限を4枚にし、「使用」バッジを撤去する

**Files:**
- Modify: `src/components/housing/register/HousingRegisterImageField.tsx`
- Modify: `src/components/housing/register/RegisterSectionMedia.tsx`
- Modify: `src/styles/housing.css:1898-1920`
- Modify: `src/locales/ja.json` (`housing.register.image` ブロック)
- Modify: `src/locales/en.json` (同ブロック)
- Modify: `src/locales/ko.json` (同ブロック)
- Modify: `src/locales/zh.json` (同ブロック)
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: なし (既存 `SAVED_IMAGES_LIMIT` export 済み定数を使う)
- Produces: `HousingRegisterImageField` の `maxImages` prop 実質デフォルト 4 (呼び出し側で明示的に `SAVED_IMAGES_LIMIT` を渡す)。`SortableImageTile` から `isUsed` / `usedBadgeLabel` props を削除 (以後のタスクはこれらを参照しない)

- [ ] **Step 1: 失敗するテストを書く (4枚上限を超えて選ぶと入力欄が消える)**

`src/components/housing/pages/__tests__/RegisterPage.test.tsx` の既存 `attachImage` ヘルパーの直後に、複数枚まとめて添付するヘルパーを追加する:

```ts
async function attachImages(container: HTMLElement, count: number) {
  const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
  const files = Array.from({ length: count }, (_, i) => new File(['x'], `photo${i}.png`, { type: 'image/png' }));
  fireEvent.change(input, { target: { files } });
  await waitFor(() =>
    expect(container.querySelectorAll('.housing-register-image-tile').length).toBeGreaterThan(0),
  );
}
```

同ファイル内、「5枚以上添付しても uploadListingThumbnail は先頭 SAVED_IMAGES_LIMIT 枚だけ呼ばれる」テストの直後に追加:

```ts
  it('mode=create: 画像ピッカーは4枚で上限に達し、追加エリアが消える', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, SAVED_IMAGES_LIMIT);

    expect(container.querySelectorAll('.housing-register-image-tile').length).toBe(
      SAVED_IMAGES_LIMIT,
    );
    expect(container.querySelector('.housing-register-image-input')).toBeNull();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx -t "画像ピッカーは4枚で上限"`
Expected: FAIL (現状 `maxImages=12` のため、4枚追加しても入力欄は消えずテストが失敗する)

- [ ] **Step 3: `HousingRegisterImageField.tsx` を実装する**

`src/components/housing/register/HousingRegisterImageField.tsx` の定数定義 (現在の `DEFAULT_MAX_IMAGES` / `SAVED_IMAGES_LIMIT` の2行) を置き換える:

```ts
/**
 * 登録時に物件画像として保存される枚数、かつピッカー自体の選択上限
 * (2026-07-20: 「12枚選んで先頭4枚だけ保存」という二段構えが実ユーザーの混乱を招いたため、
 * ピッカー自体をこの枚数までに制限する設計へ変更)。
 * サーバー側上限 (`api/housing/_uploadThumbnailHandler.ts` の `MAX_IMAGES_PER_LISTING`) と
 * 一致させる必要がある。
 */
export const SAVED_IMAGES_LIMIT = 4;
const DEFAULT_MAX_IMAGES = SAVED_IMAGES_LIMIT;
```

`SortableImageTile` 関数の props 型・分割代入から `isUsed` / `usedBadgeLabel` を削除する:

```tsx
function SortableImageTile({
  item,
  index,
  previewUrl,
  isCover,
  onRemove,
  coverBadgeLabel,
  removeLabel,
}: {
  item: SortableItem;
  index: number;
  previewUrl: string;
  isCover: boolean;
  onRemove: (index: number) => void;
  coverBadgeLabel: string;
  removeLabel: string;
}) {
```

同関数内の `<li>` から `data-used={isUsed}` を削除し、バッジ表示の三項分岐を `isCover` のみに単純化する:

```tsx
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-register-image-tile"
      data-dragging={isDragging}
      {...attributes}
      {...listeners}
    >
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="housing-register-image-tile-img"
          draggable={false}
        />
      )}
      {isCover && (
        <span className="housing-register-image-tile-badge">{coverBadgeLabel}</span>
      )}
```

呼び出し側 (`items.map` 内の `<SortableImageTile>`) から `isUsed` / `usedBadgeLabel` を削除する:

```tsx
              {items.map((it, i) => (
                <SortableImageTile
                  key={it.id}
                  item={it}
                  index={i}
                  previewUrl={previewUrls.get(it.id) ?? ''}
                  isCover={i === 0}
                  onRemove={handleRemove}
                  coverBadgeLabel={t('housing.register.image.cover_badge')}
                  removeLabel={t('housing.register.image.remove')}
                />
              ))}
```

- [ ] **Step 4: `RegisterSectionMedia.tsx` を実装する**

`src/components/housing/register/RegisterSectionMedia.tsx` の import と呼び出し箇所を変更する:

```tsx
import { HousingRegisterImageField, SAVED_IMAGES_LIMIT } from './HousingRegisterImageField';
```

```tsx
      <HousingRegisterImageField
        value={localImages}
        onChange={onLocalImagesChange}
        hasSnsUrl={sourceImageUrls.length > 0}
        maxImages={SAVED_IMAGES_LIMIT}
      />
```

- [ ] **Step 5: `housing.css` から不要になった data-used ルールを削除する**

`src/styles/housing.css:1909-1920` の以下のブロックを削除する (削除前の内容):

```css
/* hotfix26: 1-4 枚目 = 登録時に物件画像として使われる枚を honey 枠で強調 */
.housing-register-image-tile[data-used="true"]:not([data-dragging="true"]) {
  border-color: var(--housing-honey-glow);
  box-shadow: 0 0 0 1px var(--housing-honey-glow);
}
/* hotfix26: 5 枚目以降 = 登録時に破棄される枚を半透明化 */
.housing-register-image-tile[data-used="false"] {
  opacity: 0.45;
}
.housing-register-image-tile-badge[data-variant="used"] {
  background: var(--housing-candle, #ffe2b3);
}
```

- [ ] **Step 6: i18n を修正する (ja/en/ko/zh)**

`src/locales/ja.json` の `housing.register.image` ブロック内、`hint` を書き換え、`used_badge` 行を削除する:

```json
                "hint": "{{current}} / {{max}} 枚・長辺 1920px・1 枚あたり最大 1MB に自動圧縮 (AVIF/WebP)。 ドラッグで並び替えできます (先頭が代表画像になります)",
```

`"used_badge": "使用",` の行を削除する。

`src/locales/en.json` の同ブロックも同様に:

```json
                "hint": "{{current}} / {{max}} · auto-resized to max 1920px / 1MB per image (AVIF/WebP). Drag to reorder (the first one becomes the cover photo)",
```

`"used_badge": "Used",` の行を削除する。

`src/locales/ko.json` / `src/locales/zh.json` は同ブロックが既に日本語プレースホルダのままなので、`hint` を ja.json と同じ日本語文に置き換え、`"used_badge": "使用",` の行を削除する (新規翻訳は創作しない、既存の慣習に合わせる)。

- [ ] **Step 7: テストファイル冒頭に `SAVED_IMAGES_LIMIT` の import を確認 (既存 import 済み)**

Task 前回セッションで既に `import { SAVED_IMAGES_LIMIT } from '../../register/HousingRegisterImageField';` が追加済みであることを確認する (無ければ追加)。

- [ ] **Step 8: テストを実行して通ることを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 全件 PASS (Task 1 で追加したテスト含む)

- [ ] **Step 9: 型チェック**

Run: `npx tsc -b --force`
Expected: エラー無し (`isUsed` を参照する箇所が残っていないことを含めて確認)

- [ ] **Step 10: コミット**

```bash
git add src/components/housing/register/HousingRegisterImageField.tsx src/components/housing/register/RegisterSectionMedia.tsx src/styles/housing.css src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/pages/__tests__/RegisterPage.test.tsx
git commit -m "$(cat <<'EOF'
fix(housing): 画像ピッカーの上限を最初から4枚にし「使用」バッジを撤去

「12枚選んで先頭4枚だけ保存」という二段構えの UI が実ユーザーの混乱を
招いたため、ピッカー自体を保存上限(4枚)までに制限する設計へ変更。
5枚目以降が「使用/破棄」で区別される旧UIは全アイテムが常に「使用」に
なり意味を失うため削除。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 一括で上限を超えて選んだ場合の確認モーダルを追加する

**Files:**
- Modify: `src/components/housing/register/HousingRegisterImageField.tsx`
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` (`housing.register.image` ブロック)
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 で確定した `SAVED_IMAGES_LIMIT` (=4)、`handleFiles` の既存シグネチャ
- Produces: なし (この機能は `HousingRegisterImageField` 内部で完結し、親コンポーネントには影響しない)

- [ ] **Step 1: 失敗するテストを書く**

`RegisterPage.test.tsx` に、Task 1 で追加したテストの直後に追加する:

```ts
  it('mode=create: 残り枚数を超えてまとめて選ぶと確認モーダルが出て先頭4枚だけ追加される', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, 6);

    expect(container.querySelectorAll('.housing-register-image-tile').length).toBe(
      SAVED_IMAGES_LIMIT,
    );
    const modal = await screen.findByText(
      i18n.t('housing.register.image.limitModal.body', { selected: 6, max: SAVED_IMAGES_LIMIT }),
    );
    expect(modal).not.toBeNull();

    const confirmBtn = screen.getByRole('button', {
      name: i18n.t('housing.register.image.limitModal.confirm'),
    });
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(
        screen.queryByText(
          i18n.t('housing.register.image.limitModal.body', { selected: 6, max: SAVED_IMAGES_LIMIT }),
        ),
      ).toBeNull(),
    );
  });

  it('mode=create: 上限ぴったりの枚数を選んだ場合は確認モーダルを出さない', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    const { container } = renderPage();

    await attachImages(container, SAVED_IMAGES_LIMIT);

    expect(container.querySelector('.housing-register-image-limit-modal-body')).toBeNull();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx -t "確認モーダル"`
Expected: FAIL (`housing.register.image.limitModal.*` キーが存在せず、モーダルも実装されていないため)

- [ ] **Step 3: i18n キーを追加する**

`src/locales/ja.json` の `housing.register.image` ブロック内、`"error": { ... }` の直前に追加する:

```json
                "limitModal": {
                    "title": "画像は{{max}}枚まで",
                    "body": "{{selected}}枚選択されましたが、保存できる画像は{{max}}枚までです。先頭{{max}}枚のみ追加しました。",
                    "confirm": "わかりました"
                },
```

`src/locales/en.json` の同位置に追加する:

```json
                "limitModal": {
                    "title": "Up to {{max}} images",
                    "body": "{{selected}} images were selected, but only {{max}} can be saved. The first {{max}} were added.",
                    "confirm": "Got it"
                },
```

`src/locales/ko.json` / `src/locales/zh.json` の同位置には、ja.json と同じ日本語文字列を追加する (既存ブロックの慣習に合わせる):

```json
                "limitModal": {
                    "title": "画像は{{max}}枚まで",
                    "body": "{{selected}}枚選択されましたが、保存できる画像は{{max}}枚までです。先頭{{max}}枚のみ追加しました。",
                    "confirm": "わかりました"
                },
```

- [ ] **Step 4: `HousingRegisterImageField.tsx` にモーダル状態とロジックを追加する**

state 定義 (`const [dragOver, setDragOver] = useState(false);` の直後) に追加:

```ts
  const [overflowNotice, setOverflowNotice] = useState<{ selected: number; max: number } | null>(null);

  useEffect(() => {
    if (!overflowNotice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowNotice(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overflowNotice]);
```

`handleFiles` を書き換える (既存の `remaining <= 0` 早期 return はそのまま維持し、その下から変更):

```ts
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const remaining = maxImages - items.length;
      if (remaining <= 0) {
        setError(t('housing.register.image.error.too_many', { max: maxImages }));
        return;
      }
      const allSelected = Array.from(files);
      const list = allSelected.slice(0, remaining);
      for (const f of list) {
        if (!f.type.startsWith('image/')) {
          setError(t('housing.register.image.error.not_image'));
          return;
        }
      }
      setCompressing(true);
      try {
        const compressed = await Promise.all(list.map((f) => compressHousingImage(f)));
        const newItems = compressed.map((img) => ({ id: makeId(), img }));
        updateItems([...items, ...newItems]);
        if (allSelected.length > remaining) {
          setOverflowNotice({ selected: allSelected.length, max: maxImages });
        }
      } catch (e) {
        console.error('[HousingRegisterImageField] compress failed', e);
        setError(t('housing.register.image.error.compress_failed'));
      } finally {
        setCompressing(false);
      }
    },
    [items, maxImages, t, updateItems],
  );
```

コンポーネントの return 文の末尾、既存の `{hasSnsUrl && items.length > 0 && (...)}` ブロックの直後に、モーダルの JSX を追加する (`HousingDuplicateWarningDialog.tsx` と同じ housing トークンパターン):

```tsx
      {overflowNotice && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'var(--housing-detail-backdrop-bg)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOverflowNotice(null);
          }}
        >
          <div
            className="max-w-sm w-full"
            style={{
              background: 'var(--housing-panel-bg)',
              border: '1px solid var(--housing-panel-border)',
              borderRadius: 'var(--housing-panel-radius)',
              color: 'var(--housing-text)',
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 'var(--housing-text-lg)', fontWeight: 600, marginBottom: 12 }}>
              {t('housing.register.image.limitModal.title', { max: overflowNotice.max })}
            </h2>
            <p
              className="housing-register-image-limit-modal-body"
              style={{ fontSize: 'var(--housing-text-base)', color: 'var(--housing-text-dim)', marginBottom: 20 }}
            >
              {t('housing.register.image.limitModal.body', {
                selected: overflowNotice.selected,
                max: overflowNotice.max,
              })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverflowNotice(null)}
                className="housing-action-btn housing-btn-primary"
                style={{ padding: '8px 16px' }}
              >
                {t('housing.register.image.limitModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
```

`useEffect` を使うため、ファイル冒頭の React import に `useEffect` が既に含まれていることを確認する (既存: `import { useCallback, useState, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';` — 変更不要)。

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 全件 PASS

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b --force`
Expected: エラー無し

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/register/HousingRegisterImageField.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/pages/__tests__/RegisterPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): 画像を上限超過でまとめて選んだ時に確認モーダルを表示

トーストではなく「わかりました」ボタンで閉じる明示的なモーダルにし、
何枚選んで何枚だけ追加されたかを確実に読ませる。ハウジングの
トンマナ(HousingDuplicateWarningDialogと同じCSS変数パターン)に合わせた。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `buildDraftImageFields` を export し、直接画像アップロード時も postUrl を保持する

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`
- Test: `src/components/housing/pages/__tests__/buildDraftImageFields.test.ts` (新規)

**Interfaces:**
- Consumes: なし
- Produces: `export function buildDraftImageFields(sns: SnsCapture, localImages: CompressedImage[], sourceImageUrls: string[]): Partial<RegistrationDraft>`、`export interface SnsCapture { tweetData: TweetData | null; tweetSource: { postUrl: string; tweetId: string } | null; youtube: YoutubeFetchedData | null; ogp: OgpFetchedData | null; }`、`export const EMPTY_SNS_CAPTURE: SnsCapture` — Task 4/5 はこの関数の出力する `postUrl` フィールドを前提にする

- [ ] **Step 1: 失敗するテストを書く**

新規ファイル `src/components/housing/pages/__tests__/buildDraftImageFields.test.ts` を作成する:

```ts
import { describe, it, expect } from 'vitest';
import { buildDraftImageFields, EMPTY_SNS_CAPTURE, type SnsCapture } from '../RegisterPage';
import type { CompressedImage } from '../../../../lib/housing/imageCompression';

const FAKE_IMAGE = {} as CompressedImage;

describe('buildDraftImageFields', () => {
  it('localImages も SNS 情報も無ければ {} を返す', () => {
    expect(buildDraftImageFields(EMPTY_SNS_CAPTURE, [], [])).toEqual({});
  });

  it('localImages がある + SNS 情報が無ければ {} を返す (画像は upload-thumbnail 経路)', () => {
    expect(buildDraftImageFields(EMPTY_SNS_CAPTURE, [FAKE_IMAGE], [])).toEqual({});
  });

  it('localImages がある + YouTube URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      youtube: { postUrl: 'https://youtu.be/abcdefghijk', ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg', videoId: 'abcdefghijk' } as any,
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://youtu.be/abcdefghijk',
    });
  });

  it('localImages がある + Twitter URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      tweetSource: { postUrl: 'https://x.com/foo/status/123', tweetId: '123' },
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://x.com/foo/status/123',
    });
  });

  it('localImages がある + OGP URL を捕捉済みなら postUrl だけ返す (2026-07-20 バグ修正)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      ogp: { postUrl: 'https://housingsnap.com/12345', data: {} } as any,
    };
    expect(buildDraftImageFields(sns, [FAKE_IMAGE], [])).toEqual({
      postUrl: 'https://housingsnap.com/12345',
    });
  });

  it('localImages が無ければ従来通り YouTube の全フィールドを返す (回帰確認)', () => {
    const sns: SnsCapture = {
      ...EMPTY_SNS_CAPTURE,
      youtube: { postUrl: 'https://youtu.be/abcdefghijk', ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg', videoId: 'abcdefghijk' } as any,
    };
    expect(buildDraftImageFields(sns, [], [])).toEqual({
      imageMode: 'sns',
      postUrl: 'https://youtu.be/abcdefghijk',
      ogImageUrl: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      youtubeVideoId: 'abcdefghijk',
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/buildDraftImageFields.test.ts`
Expected: FAIL (`buildDraftImageFields` / `SnsCapture` / `EMPTY_SNS_CAPTURE` が `RegisterPage.tsx` から export されていない)

- [ ] **Step 3: `RegisterPage.tsx` を実装する**

`interface SnsCapture` の宣言に `export` を付ける:

```ts
export interface SnsCapture {
  tweetData: TweetData | null;
  tweetSource: { postUrl: string; tweetId: string } | null;
  youtube: YoutubeFetchedData | null;
  ogp: OgpFetchedData | null;
}
```

`const EMPTY_SNS_CAPTURE` に `export` を付ける:

```ts
export const EMPTY_SNS_CAPTURE: SnsCapture = {
  tweetData: null,
  tweetSource: null,
  youtube: null,
  ogp: null,
};
```

`function buildDraftImageFields` に `export` を付け、`hasLocalImages` 分岐を書き換える:

```ts
export function buildDraftImageFields(
  sns: SnsCapture,
  localImages: CompressedImage[],
  sourceImageUrls: string[],
): Partial<RegistrationDraft> {
  const hasLocalImages = localImages.length > 0;
  if (hasLocalImages) {
    // ① localImages 優先。SNS 画像は draft に載せない (登録後に thumbnail upload)。
    // postUrl (元の投稿へのリンク) だけは画像と独立して保持する
    // (2026-07-20 実ユーザー報告: 直接画像アップロード時に postUrl ごと消えていたバグの修正)。
    const postUrl = sns.youtube?.postUrl ?? sns.tweetSource?.postUrl ?? sns.ogp?.postUrl;
    return postUrl ? { postUrl } : {};
  }
```

(以降の ② YouTube 〜 ⑤ どれも無し の分岐は変更しない)

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/buildDraftImageFields.test.ts`
Expected: 全件 PASS

- [ ] **Step 5: RegisterPage.test.tsx の既存テストが壊れていないか確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 全件 PASS (export 追加のみで既存の挙動は変えていないため回帰無し)

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b --force`
Expected: エラー無し

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/pages/RegisterPage.tsx src/components/housing/pages/__tests__/buildDraftImageFields.test.ts
git commit -m "$(cat <<'EOF'
fix(housing): 直接画像アップロード時にpostUrlが消えるバグを修正(クライアント側)

buildDraftImageFieldsはlocalImagesがあるとSNS由来のフィールドを
全て{}にしていたため、postUrl(元の投稿へのリンク)まで一緒に
消えていた。画像はこれまで通りローカルアップロード優先のまま、
postUrlだけ独立して保持するよう修正。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `validateImage` に postUrl のホスト検証を追加する (imageMode に関わらず)

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Test: `src/__tests__/housing/housingValidation.test.ts`

**Interfaces:**
- Consumes: `parseTweetUrl` (`src/lib/housing/tweetUrlParse.ts` の `export function parseTweetUrl(input: string): string | null`)、`parseYoutubeUrl` (`src/lib/housing/youtubeUrl.ts` の `export function parseYoutubeUrl(url: string): string | null`)、既存 `isOgpUrlAllowed`
- Produces: `validateImage` が `imageMode !== 'sns'` でも `postUrl` があれば host を検証するようになる。Task 5 はこの検証を前提に `buildListingImageFields` を実装する

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/housingValidation.test.ts` の `import { validateImage, buildListingImageFields } from '../../utils/housingValidation';` の直後、`describe('validateImage', ...)` ブロックの中の最初の `it('imageMode が sns 以外なら常に ok', ...)` を以下に置き換える (既存の「imageMode!=='sns'なら常にok」という前提が変わるため):

```ts
  it('imageMode が sns 以外 + postUrl 無しなら ok', () => {
    expect(validateImage({ imageMode: 'none' } as any).ok).toBe(true);
    expect(validateImage({} as any).ok).toBe(true);
  });

  // 2026-07-20: 直接画像アップロード時 (imageMode!=='sns') でも postUrl を保持できるようになった
  // ため、その場合は host を検証する (実ユーザー報告: postUrl ごと消えるバグの修正に伴う)。
  describe('imageMode!==\'sns\' でも postUrl があるケース (2026-07-20)', () => {
    it('X の投稿URLなら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://x.com/foo/status/123' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://twitter.com/foo/status/123' } as any).ok).toBe(true);
    });

    it('YouTube の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://youtu.be/dQw4w9WgXcQ' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } as any).ok).toBe(true);
    });

    it('OGP allowlist の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://housingsnap.com/12345' } as any).ok).toBe(true);
    });

    it('どれにも該当しない URL は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'https://evil.example.com/x' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });

    it('https でない postUrl は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'http://x.com/foo/status/123' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts -t "imageMode!=='sns' でも postUrl があるケース"`
Expected: FAIL (現状 `imageMode !== 'sns'` は即 `ok()` を返し、postUrl の中身を見ていないため)

- [ ] **Step 3: `housingValidation.ts` を実装する**

import に `parseTweetUrl` と `parseYoutubeUrl` を追加する (既存 `import { isOgpUrlAllowed } from '../lib/housing/ogpHostAllowlist.js';` の直後):

```ts
import { isOgpUrlAllowed } from '../lib/housing/ogpHostAllowlist.js';
import { parseTweetUrl } from '../lib/housing/tweetUrlParse.js';
import { parseYoutubeUrl } from '../lib/housing/youtubeUrl.js';
```

`validateImage` 関数のドキュメントコメント直後・関数本体の先頭を書き換える:

```ts
/**
 * SNS 画像フィールドの検証。imageMode!=='sns' のときは、postUrl が無ければ常に ok。
 * postUrl がある場合 (2026-07-20: 直接画像アップロード時も postUrl だけ独立して保持できる
 * ようになったため) は、URL 貼り付け時と同じ判定関数 (parseTweetUrl / parseYoutubeUrl /
 * isOgpUrlAllowed) で host を検証する。新しい allowlist は作らず既存の判定を再利用する。
 * sns のときは source が 3 種で排他:
 * - Twitter: ogImageUrl が pbs.twimg.com 限定、 tweetId は数字 1-20 桁。
 * - YouTube: ogImageUrl が img.youtube.com / i.ytimg.com 限定、 youtubeVideoId は 11 文字 [A-Za-z0-9_-]。
 * - OGP (housingsnap / studio-xiv 等): postUrl が ogpHostAllowlist 内、
 *   sourceImageUrls が 1-{MAX_SOURCE_IMAGE_URLS} 件、 各 URL は https + 非 private IP、
 *   ogImageUrl は sourceImageUrls[0] と一致 (= 1 枚目代表)。
 */
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') {
    if (draft.postUrl === undefined) return ok();
    if (!isKnownPostUrlHost(draft.postUrl)) return fail({ postUrl: 'invalid' });
    return ok();
  }
  const errors: ValidationErrors = {};
```

Twitter 分岐 (`} else if (hasTweet) {` の中、`tweetId` 検証の直後) に postUrl の host 検証を追加する:

```ts
  } else if (hasTweet) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^\d{1,20}$/.test(draft.tweetId!)) errors.tweetId = 'invalid';
    if (!parseTweetUrl(draft.postUrl ?? '')) errors.postUrl = 'invalid_host';
```

YouTube 分岐 (`if (hasYoutube) {` の中、`youtubeVideoId` 検証の直後) に postUrl の host 検証を追加する:

```ts
  if (hasYoutube) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isYoutubeThumbHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(draft.youtubeVideoId!)) {
      errors.youtubeVideoId = 'invalid';
    }
    if (!parseYoutubeUrl(draft.postUrl ?? '')) errors.postUrl = 'invalid_host';
```

ファイル末尾の private helper 群 (`function isPbsTwimgHost` 等が並んでいる箇所) の近くに新しいヘルパーを追加する:

```ts
/**
 * postUrl (元の投稿へのリンク) が、URL 貼り付け時に許可されているのと同じ種別
 * (Twitter/X の投稿URL・YouTube・OGP allowlist) のいずれかに一致するか判定する。
 * `classifySnsUrl` (src/lib/housing/snsUrlRouting.ts) が使う判定関数と完全に同一のものを
 * 再利用しているため、URL 貼り付け時に成功した postUrl はここでも必ず ok になる。
 */
function isKnownPostUrlHost(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return parseTweetUrl(url) !== null || parseYoutubeUrl(url) !== null || isOgpUrlAllowed(url);
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: 全件 PASS (既存の Twitter/YouTube/OGP sns 系テストも含め回帰無し)

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b --force`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add src/utils/housingValidation.ts src/__tests__/housing/housingValidation.test.ts
git commit -m "$(cat <<'EOF'
fix(housing): postUrlのhost検証をimageModeに関わらず行うよう強化

従来はTwitter/YouTube経路のpostUrl自体はhttpsであること以外
検証されていなかった(画像URLのhostは検証されていたが投稿URL自体は
未検証という抜けがあった)。URL貼り付け時に使っているのと同じ判定関数
(parseTweetUrl/parseYoutubeUrl/isOgpUrlAllowed)を再利用して、
imageModeに関わらずpostUrlがあれば必ずhostを検証するようにした。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `buildListingImageFields` で `imageMode!=='sns'` でも検証済み postUrl を保存する

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Test: `src/__tests__/housing/housingValidation.test.ts`

**Interfaces:**
- Consumes: Task 4 で強化済みの `validateImage` (呼び出しハンドラー側で既に validate 済みという前提)
- Produces: `buildListingImageFields` の戻り値型 `{ imageMode: 'none' }` が `{ imageMode: 'none'; postUrl?: string }` に変わる。詳細ページ (`HousingDetailContent.tsx`) は既に `listing.postUrl` があれば無条件でリンクを出す作りのため変更不要

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/housingValidation.test.ts` の `describe('buildListingImageFields', ...)` ブロック内、`it('sns 以外は none を返す', ...)` の直後に追加する:

```ts
  it('sns 以外は none を返す', () => {
    expect(buildListingImageFields({} as any, 1000)).toEqual({ imageMode: 'none' });
  });

  // 2026-07-20: 直接画像アップロード時でも postUrl だけは保存する (実ユーザー報告の修正)
  it('imageMode!==\'sns\' でも postUrl があれば none + postUrl を返す', () => {
    const out = buildListingImageFields(
      { imageMode: undefined, postUrl: 'https://x.com/foo/status/123' } as any,
      1000,
    );
    expect(out).toEqual({ imageMode: 'none', postUrl: 'https://x.com/foo/status/123' });
  });

  it('imageMode!==\'sns\' かつ postUrl も無ければ引き続き none のみ', () => {
    expect(buildListingImageFields({ imageMode: undefined } as any, 1000)).toEqual({
      imageMode: 'none',
    });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts -t "imageMode!=='sns' でも postUrl があれば"`
Expected: FAIL (現状 `buildListingImageFields` は sns 分岐以外で常に `{ imageMode: 'none' }` のみを返し `postUrl` を含めないため)

- [ ] **Step 3: `housingValidation.ts` を実装する**

`buildListingImageFields` の戻り値型定義の最後の union メンバーを書き換える:

```ts
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; sourceImageUrls: string[]; sourceImageAspectRatios?: number[] }
  | { imageMode: 'none'; postUrl?: string } {
```

関数本体の最後の `return { imageMode: 'none' };` を書き換える:

```ts
  // 直接画像アップロード等 (imageMode !== 'sns') でも、検証済みの postUrl (元の投稿への
  // リンク) だけは保持する (2026-07-20 実ユーザー報告の修正。host 検証は呼び出し側が
  // validateImage を先に通している前提)。
  return draft.postUrl ? { imageMode: 'none', postUrl: draft.postUrl } : { imageMode: 'none' };
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/__tests__/housing/housingValidation.test.ts`
Expected: 全件 PASS

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b --force`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add src/utils/housingValidation.ts src/__tests__/housing/housingValidation.test.ts
git commit -m "$(cat <<'EOF'
fix(housing): 直接画像アップロード時にpostUrlが消えるバグを修正(サーバー側)

buildListingImageFieldsはimageMode!=='sns'のとき常に{imageMode:'none'}
のみを返しpostUrlを保存していなかった。クライアントがTask3で
postUrlを送るようになっても、この関数が捨てていては意味が無いため、
検証済み(Task4のvalidateImage)のpostUrlがあれば一緒に保存するよう修正。
これで詳細ページの「元の投稿を見る」リンクが正しく出るようになる。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 全体回帰確認

**Files:** なし (確認のみ)

**Interfaces:**
- Consumes: Task 1〜5 の全変更
- Produces: なし

- [ ] **Step 1: 型チェック (フル)**

Run: `npx tsc -b --force`
Expected: エラー無し

- [ ] **Step 2: テストスイート (フル)**

Run: `npm test`
Expected: 既知の環境依存失敗 (`EphemeralAddPanel.test.tsx` 7件、TODO.md 記載済み・本タスクと無関係) を除き全件 PASS

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: `docs/TODO.md` の該当セクションを更新**

「✅ 画像登録5枚目以降サイレント失敗バグ = 修正済み」のセクションに、今回追加した postUrl 修正 + ピッカー4枚化の内容を追記する。

- [ ] **Step 5: コミット**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs: 画像ピッカー4枚化+postUrl消失バグ修正の完了をTODO.mdに反映

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
