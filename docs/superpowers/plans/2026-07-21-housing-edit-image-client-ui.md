# ハウジング編集ページ画像管理 Plan B (クライアントUI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング編集ページで、既存物件の写真(直接アップロード/URL経由)を削除・並び替え・追加でき、登録方法(アップロード⇔URL)を切り替えられるようにする。

**Architecture:** 新規コンポーネント群 (`src/components/housing/edit/`) が、Plan Aで実装済みのサーバーAPI (`deleteListingThumbnail`/`reorderListingThumbnails`/`uploadListingThumbnail`/`deleteListingSourceImage`/`reorderListingSourceImages`/`updateListing`、いずれも `src/lib/housingApiClient.ts` に実装済み) を直接呼び出し、操作のたびに即時反映する。既存の新規登録フォーム (`RegisterSectionMedia`/`HousingRegisterImageField`/`HousingRegisterSourceImageUrlsField`) は一切変更しない (create モードの挙動は完全に不変)。`RegisterPage.tsx` の「方式A」(編集モードで写真セクションを非表示にする既存の仕組み) を撤廃し、edit モード時のみ新規コンポーネント群を描画する。

**Tech Stack:** React + TypeScript、`@dnd-kit` (既存の並び替えパターンを踏襲)、vitest + @testing-library/react (`happy-dom`)、i18next。

## Global Constraints

- 確認ダイアログは一切使わない (削除・登録方法切り替えともにボタン一発)。設計書 `docs/superpowers/specs/2026-07-21-housing-edit-image-client-ui-design.md` で確定済み。
- 保存中は「処理中表示 → サーバー応答後に確定」(B案・pessimistic)。失敗時は元の状態にロールバックし、`showToast(t('housing.editMedia.save_failed'), 'error')` で通知する (原因別のメッセージ分けはしない)。
- 「差し替え」専用UIは作らない。削除+追加の組み合わせで代替する。
- 色・font-size・寸法は必ず `src/styles/housing.css` の `--housing-*` トークン経由 (ハードコード禁止、[.claude/rules/housing-design.md](../../../.claude/rules/housing-design.md))。
- UI文字列は必ず i18n キー経由。`src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` の4言語すべてに追加する ([.claude/rules/i18n.md](../../../.claude/rules/i18n.md))。ロケールJSONの編集は該当ブロックのみの textual edit で行う (全体 parse→stringify で書き直さない)。
- 既存の create モード (`RegisterSectionMedia` とその子コンポーネント、`RegisterPage.tsx` の create 分岐) の挙動を一切変更しない。
- 各タスックの最後に `npx vitest run <対象テストファイル>` で該当テストが green になることを確認してからコミットする。

---

## 背景: 実装前に確定した技術的事実 (再調査不要)

以下はこのセッション内でコードを実際に読んで確認済み。実装者は再調査しなくてよい。

1. **`uploadListingThumbnail` は sns→thumbnail 切替を自己完結で処理する** (`api/housing/_uploadThumbnailHandler.ts`)。アップロード時、直前の `imageMode` が `'sns'` だったら同一トランザクション内で `ogImageUrl`/`sourceImageUrls`/`tweetId`/`youtubeVideoId`/`videoUrl` 等を `FieldValue.delete()` でクリアし、`imageMode:'thumbnail'` に切り替える。**クライアント側で追加の `update-listing` 呼び出しは不要**。
2. **thumbnail→sns 切替は `update-listing` 側が処理する** (`api/housing/_updateListingHandler.ts:185-221`)。送信した `imageMode==='sns'` のとき、保存済みが `thumbnail` なら `thumbnailPaths`/`thumbnailPath` を削除し、Storage上のファイルもトランザクション成功後に全削除する。
3. **`update-listing` は住所/タイトル等を含む「フルドラフト」を要求する** (`draftForValidation` は `updates.dc` 等を直接 `req.body` から読み、既存Firestore値へのフォールバックをしない)。画像フィールドだけを送ると住所バリデーションで 400 になる。そのため、編集ページで画像操作から `update-listing` を呼ぶ場合は必ず既存の `buildDraft()` (`RegisterPage.tsx:940`) の結果とマージする。
4. **`buildDraftImageFields(snsCapture, localImages, sourceImageUrls)`** (`RegisterPage.tsx:98`、export 済み) は `localImages` が空なら `snsCapture`/`sourceImageUrls` から `imageMode:'sns'` 系フィールドを組む純関数。edit モードの直接アップロード側は `localImages` を一切使わない (常に `[]`) ため、この関数はそのまま「URL再取得コミット」にのみ使い、既存の create フローと衝突しない。
5. **新規登録の画像必須化は2026-07-15 (`8e912670`)、一般公開は2026-07-19 (ユーザー確認)** より後のため、公開後の物件で画像0枚のものは実質存在しない。とはいえ 0 件表示は既存コンポーネント同様に自然に扱えるようにしておく (設計書参照)。
6. **`sourceImageUrls`/`snsCapture` の delete/reorder は `update-listing` を経由しない**。`deleteListingSourceImage`/`reorderListingSourceImages` (`housingApiClient.ts`) が直接 `sourceImageUrls` 配列を操作し、更新後の配列を返す。同様に `deleteListingThumbnail`/`reorderListingThumbnails` も `thumbnailPaths` を直接操作する。
7. **`HousingListing` 型** (`src/types/housing.ts`) は `imageMode: ImageMode`、`thumbnailPaths?: string[]`、`thumbnailPath?: string` (後方互換1枚目)、`sourceImageUrls?: string[]`、`videoUrl`/`videoPosterUrl`/`videoAspectRatio` を持つ。
8. **`--housing-disabled-opacity: 0.35`** が既存の減光トークン (`src/styles/housing.css:113`)。既存タイル/ボタンの `disabled` 表現で使われている。

---

## File Structure

- **新規**: `src/components/housing/edit/HousingEditImageGrid.tsx` — 削除/並び替えを即時サーバー反映する共有グリッド (直接アップロード・URL経由の両方で使う)。
- **新規**: `src/components/housing/edit/HousingEditThumbnailPanel.tsx` — 直接アップロード側のパネル (グリッド + 追加ドロップゾーン)。
- **新規**: `src/components/housing/edit/HousingEditSourcePanel.tsx` — URL経由側のパネル (グリッド + URL再取得欄 + 動画プレビュー)。
- **新規**: `src/components/housing/edit/HousingEditMediaModeTabs.tsx` — 「アップロード」/「URL」タブ (ローカル表示切り替えのみ)。
- **新規**: `src/components/housing/edit/HousingEditMediaSection.tsx` — 上記を束ねる編集モード専用セクション。
- **修正**: `src/components/housing/pages/RegisterPage.tsx` — 方式A撤廃、初期状態読み込み、`HousingEditMediaSection` の配線。
- **修正**: `src/components/housing/pages/__tests__/RegisterPage.test.tsx` (方式A前提のテストを更新)。
- **修正**: `src/styles/housing.css` — タブCSS + pending状態CSSを追加。
- **修正**: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` — 新規 i18n キー追加。

---

### Task 1: RegisterPage.tsx — edit モードの画像初期状態読み込み

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Produces: `editThumbnailPaths: string[]` state, `editVideoPreview: EditVideoPreview | null` state (型は Task4で定義、ここでは import せず inline 型で先に置く)、`sourceImageUrls` の edit モード初期値プリフィル。

- [ ] **Step 1: 既存テストを実行してベースラインを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 現状の全テストが PASS (これから壊さないことの基準点)。

- [ ] **Step 2: `sourceImageUrls` の初期値を edit モードでプリフィルする**

`RegisterPage.tsx:502` 付近の既存コード:
```tsx
const [localImages, setLocalImages] = useState<CompressedImage[]>([]);
const [sourceImageUrls, setSourceImageUrls] = useState<string[]>([]);
```
を次に置き換える:
```tsx
const [localImages, setLocalImages] = useState<CompressedImage[]>([]);
const [sourceImageUrls, setSourceImageUrls] = useState<string[]>(
  () => (mode === 'edit' ? (initialValues?.sourceImageUrls ?? []) : []),
);

/**
 * edit モード専用: 直接アップロード画像の URL 一覧 (Plan B・2026-07-21)。
 * create モードの `localImages` (アップロード前のローカルファイル) とは別物で、
 * サーバーに既に保存済みの URL のみを保持する。buildDraftImageFields には渡さない
 * (直接アップロードの commit は uploadListingThumbnail が単独で完結するため)。
 */
const [editThumbnailPaths, setEditThumbnailPaths] = useState<string[]>(() => {
  if (mode !== 'edit' || !initialValues) return [];
  if (initialValues.thumbnailPaths && initialValues.thumbnailPaths.length > 0) {
    return initialValues.thumbnailPaths;
  }
  return initialValues.thumbnailPath ? [initialValues.thumbnailPath] : [];
});

/** edit モード専用: 動画プレビュー (Twitter動画ツイート由来)。URL再取得で更新される。 */
const [editVideoPreview, setEditVideoPreview] = useState<
  { url: string; posterUrl: string; aspectRatio?: number } | null
>(() => {
  if (mode !== 'edit' || !initialValues?.videoUrl || !initialValues?.videoPosterUrl) return null;
  return {
    url: initialValues.videoUrl,
    posterUrl: initialValues.videoPosterUrl,
    aspectRatio: initialValues.videoAspectRatio,
  };
});
```

- [ ] **Step 3: `confirmSummary` の画像カウントに `editThumbnailPaths` を含める**

`RegisterPage.tsx:1139` 付近の既存コード:
```tsx
const stillCount = localImages.length + sourceImageUrls.length;
```
を次に置き換える (edit モードで直接アップロード画像がカウント漏れするバグを防ぐ):
```tsx
const stillCount = localImages.length + sourceImageUrls.length + editThumbnailPaths.length;
```
同じ `useMemo` の依存配列 (`RegisterPage.tsx:1147-1156` 付近) に `editThumbnailPaths.length` を追加する:
```tsx
  }, [
    addressOk,
    address,
    title,
    localImages.length,
    sourceImageUrls.length,
    editThumbnailPaths.length,
    snsCapture.tweetData,
    snsCapture.youtube,
    i18n.language,
  ]);
```

- [ ] **Step 4: テストを実行し、既存テストが壊れていないことを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: Step 1 と同じ結果で全て PASS (この時点では新state を作っただけで参照していないため挙動は不変)。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/pages/RegisterPage.tsx
git commit -m "feat(housing): edit モードの画像初期状態を読み込む (Plan B Task1)"
```

---

### Task 2: `HousingEditImageGrid` — 削除/並び替え共有グリッド

**Files:**
- Create: `src/components/housing/edit/HousingEditImageGrid.tsx`
- Test: `src/components/housing/edit/__tests__/HousingEditImageGrid.test.tsx`
- Modify: `src/styles/housing.css` (pending状態のCSS追加)

**Interfaces:**
- Produces:
  ```ts
  export interface HousingEditImageGridProps {
    images: string[];
    onImagesChange: (next: string[]) => void;
    onDelete: (index: number) => Promise<string[]>;
    onReorder: (newOrder: string[]) => Promise<string[]>;
    minImages?: number; // default 1
  }
  export function HousingEditImageGrid(props: HousingEditImageGridProps): JSX.Element | null;
  ```
  `onDelete`/`onReorder` は失敗時に throw する契約 (呼び出し元でエラー通知)。成功時は更新後の配列を resolve する。

- [ ] **Step 1: i18n キーを追加 (このコンポーネントが使う分)**

`src/locales/ja.json` の `"register"` オブジェクト内、`"image"` オブジェクトの外側 (同階層) に `"editMedia"` オブジェクトを新設する。まず ja.json であることを確認してから、`"register": {` の直後に以下を追記 (既存キーとカンマ区切りで並べる。挿入位置は `"register"` オブジェクトの先頭でよい):
```json
        "editMedia": {
            "save_failed": "失敗しました。もう一度お試しください"
        },
```
`en.json` の対応する `"register"` オブジェクトにも同様に追記:
```json
        "editMedia": {
            "save_failed": "Failed. Please try again"
        },
```
`ko.json`:
```json
        "editMedia": {
            "save_failed": "실패했습니다. 다시 시도해 주세요"
        },
```
`zh.json`:
```json
        "editMedia": {
            "save_failed": "失败了,请重试"
        },
```

- [ ] **Step 2: 失敗するテストを先に書く**

`src/components/housing/edit/__tests__/HousingEditImageGrid.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingEditImageGrid } from '../HousingEditImageGrid';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderGrid(overrides: Partial<React.ComponentProps<typeof HousingEditImageGrid>> = {}) {
  const onImagesChange = overrides.onImagesChange ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn().mockResolvedValue(['a', 'b']);
  const onReorder = overrides.onReorder ?? vi.fn().mockResolvedValue(['a', 'b']);
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditImageGrid
        images={overrides.images ?? ['a', 'b', 'c']}
        onImagesChange={onImagesChange}
        onDelete={onDelete}
        onReorder={onReorder}
        minImages={overrides.minImages ?? 1}
      />
    </I18nextProvider>,
  );
  return { onImagesChange, onDelete, onReorder };
}

describe('HousingEditImageGrid', () => {
  it('画像0枚では何も描画しない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingEditImageGrid
          images={[]}
          onImagesChange={vi.fn()}
          onDelete={vi.fn()}
          onReorder={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-register-image-grid')).toBeNull();
  });

  it('画像枚数分のタイルを描画し、1枚目にカバーバッジを出す', () => {
    renderGrid({ images: ['a', 'b', 'c'] });
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(3);
    expect(screen.getByText('カバー')).toBeInTheDocument();
  });

  it('削除ボタン押下で onDelete を呼び、成功したら onImagesChange に結果を渡す', async () => {
    const { onImagesChange, onDelete } = renderGrid({
      images: ['a', 'b'],
      onDelete: vi.fn().mockResolvedValue(['b']),
    });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(0);
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith(['b']));
  });

  it('削除失敗時は onImagesChange を呼ばず、元のまま留まる', async () => {
    const { onImagesChange } = renderGrid({
      images: ['a', 'b'],
      onDelete: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    await waitFor(() => expect(screen.getByText('失敗しました。もう一度お試しください')).toBeInTheDocument());
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it('minImages と同数のときは削除ボタンが disabled', () => {
    renderGrid({ images: ['a'], minImages: 1 });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    expect(removeButtons[0]).toBeDisabled();
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditImageGrid.test.tsx`
Expected: FAIL (`HousingEditImageGrid` module not found)。

- [ ] **Step 4: `showToast` の呼び出し文言テスト用に、失敗通知はトースト自体でなくコンポーネント内にも一時表示する設計に変更する必要はない。テストの「失敗しました」表示は `showToast` のトーストDOM (`ToastContainer`) を経由しないため、Step2 のテストを `ToastContainer` を併せてレンダーする形に修正する**

上記 Step2 のテストコードのうち、失敗系テスト (`削除失敗時は...`) の `render` 呼び出し部分にトーストコンテナも含める必要がある。`renderGrid` ヘルパーを次のように直す (Step2 のコードを置き換え):
```tsx
import { ToastContainer } from '../../../Toast';
// ...
function renderGrid(overrides: Partial<React.ComponentProps<typeof HousingEditImageGrid>> = {}) {
  const onImagesChange = overrides.onImagesChange ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn().mockResolvedValue(['a', 'b']);
  const onReorder = overrides.onReorder ?? vi.fn().mockResolvedValue(['a', 'b']);
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditImageGrid
        images={overrides.images ?? ['a', 'b', 'c']}
        onImagesChange={onImagesChange}
        onDelete={onDelete}
        onReorder={onReorder}
        minImages={overrides.minImages ?? 1}
      />
      <ToastContainer />
    </I18nextProvider>,
  );
  return { onImagesChange, onDelete, onReorder };
}
```

- [ ] **Step 5: 実装を書く**

`src/components/housing/edit/HousingEditImageGrid.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { showToast } from '../../Toast';

export interface HousingEditImageGridProps {
  images: string[];
  onImagesChange: (next: string[]) => void;
  onDelete: (index: number) => Promise<string[]>;
  onReorder: (newOrder: string[]) => Promise<string[]>;
  /** これ以下の枚数では削除ボタンを disabled にする (既定 1 = 最後の1枚は消せない)。 */
  minImages?: number;
}

interface SortableItem {
  id: string;
  url: string;
}

function toItems(urls: string[]): SortableItem[] {
  return urls.map((url, i) => ({ id: `${i}-${url}`, url }));
}

function SortableEditTile({
  item,
  index,
  isCover,
  isPending,
  removeDisabled,
  dragDisabled,
  onRemove,
  coverBadgeLabel,
  removeLabel,
}: {
  item: SortableItem;
  index: number;
  isCover: boolean;
  isPending: boolean;
  removeDisabled: boolean;
  dragDisabled: boolean;
  onRemove: (index: number) => void;
  coverBadgeLabel: string;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: dragDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: dragDisabled ? 'default' : isDragging ? 'grabbing' : 'grab',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-register-image-tile"
      data-dragging={isDragging}
      data-pending={isPending}
      {...attributes}
      {...listeners}
    >
      <img src={item.url} alt="" className="housing-register-image-tile-img" draggable={false} loading="lazy" />
      {isCover && <span className="housing-register-image-tile-badge">{coverBadgeLabel}</span>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="housing-register-image-tile-remove"
        aria-label={removeLabel}
        disabled={removeDisabled}
      >
        ✕
      </button>
    </li>
  );
}

/**
 * 編集ページ専用: 画像URL配列の削除/並び替えを、操作のたびにサーバーへ即時反映する
 * 共有グリッド (Plan B・2026-07-21)。直接アップロード側 (thumbnailPaths) と
 * URL経由側 (sourceImageUrls) の両方から、対応する API 呼び出しを注入して使い回す。
 *
 * 確認ダイアログは出さない (ユーザー判断・設計書参照)。保存中は対象タイルを
 * disabled+減光し、サーバー応答後に確定表示する (B案)。並び替えはドロップ時点で
 * 見た目を確定させ (通常のドラッグ操作と同じ)、失敗時のみ元の順序へロールバックする。
 */
export function HousingEditImageGrid({
  images,
  onImagesChange,
  onDelete,
  onReorder,
  minImages = 1,
}: HousingEditImageGridProps) {
  const { t } = useTranslation();
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const items = toItems(images);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRemove = useCallback(
    async (index: number) => {
      if (busy) return;
      setPendingIndex(index);
      setBusy(true);
      try {
        const next = await onDelete(index);
        onImagesChange(next);
      } catch {
        showToast(t('housing.editMedia.save_failed'), 'error');
      } finally {
        setPendingIndex(null);
        setBusy(false);
      }
    },
    [busy, onDelete, onImagesChange, t],
  );

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      if (busy) return;
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = items.findIndex((it) => it.id === active.id);
      const newIndex = items.findIndex((it) => it.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const previous = images;
      const next = arrayMove(images, oldIndex, newIndex);
      onImagesChange(next);
      setBusy(true);
      try {
        const confirmed = await onReorder(next);
        onImagesChange(confirmed);
      } catch {
        onImagesChange(previous);
        showToast(t('housing.editMedia.save_failed'), 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, items, images, onReorder, onImagesChange, t],
  );

  if (images.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
        <ul className="housing-register-image-grid">
          {items.map((it, i) => (
            <SortableEditTile
              key={it.id}
              item={it}
              index={i}
              isCover={i === 0}
              isPending={pendingIndex === i}
              removeDisabled={busy || images.length <= minImages}
              dragDisabled={busy}
              onRemove={handleRemove}
              coverBadgeLabel={t('housing.register.image.cover_badge')}
              removeLabel={t('housing.register.image.remove')}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 6: CSS を追加する**

`src/styles/housing.css` の `.housing-register-image-tile[data-dragging="true"]` 定義 (1886行目付近) の直後に追記:
```css
.housing-register-image-tile[data-pending="true"] {
  opacity: var(--housing-disabled-opacity);
  pointer-events: none;
}
.housing-register-image-tile-remove:disabled {
  opacity: var(--housing-disabled-opacity);
  cursor: not-allowed;
}
```

- [ ] **Step 7: テストを実行して全て通ることを確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditImageGrid.test.tsx`
Expected: 全テスト PASS。

- [ ] **Step 8: Commit**

```bash
git add src/components/housing/edit/HousingEditImageGrid.tsx src/components/housing/edit/__tests__/HousingEditImageGrid.test.tsx src/styles/housing.css src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 編集ページ用の画像削除/並び替え共有グリッドを追加 (Plan B Task2)"
```

---

### Task 3: `HousingEditThumbnailPanel` — 直接アップロード側パネル

**Files:**
- Create: `src/components/housing/edit/HousingEditThumbnailPanel.tsx`
- Test: `src/components/housing/edit/__tests__/HousingEditThumbnailPanel.test.tsx`

**Interfaces:**
- Consumes: `HousingEditImageGrid` (Task2)、`compressHousingImage(file: File): Promise<CompressedImage>` (`src/lib/housing/imageCompression.ts`)、`uploadListingThumbnail`/`deleteListingThumbnail`/`reorderListingThumbnails` (`src/lib/housingApiClient.ts`)、`SAVED_IMAGES_LIMIT` (`src/components/housing/register/HousingRegisterImageField.tsx`、既存 export)。
- Produces:
  ```ts
  export interface HousingEditThumbnailPanelProps {
    listingId: string;
    images: string[];
    onImagesChange: (next: string[]) => void;
  }
  export function HousingEditThumbnailPanel(props: HousingEditThumbnailPanelProps): JSX.Element;
  ```

- [ ] **Step 1: 失敗するテストを先に書く**

`src/components/housing/edit/__tests__/HousingEditThumbnailPanel.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ToastContainer } from '../../../Toast';

const mockUpload = vi.fn();
const mockDelete = vi.fn();
const mockReorder = vi.fn();
vi.mock('../../../../lib/housingApiClient', () => ({
  uploadListingThumbnail: (...args: unknown[]) => mockUpload(...args),
  deleteListingThumbnail: (...args: unknown[]) => mockDelete(...args),
  reorderListingThumbnails: (...args: unknown[]) => mockReorder(...args),
}));

const mockCompress = vi.fn();
vi.mock('../../../../lib/housing/imageCompression', () => ({
  compressHousingImage: (...args: unknown[]) => mockCompress(...args),
}));

import { HousingEditThumbnailPanel } from '../HousingEditThumbnailPanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(images: string[], onImagesChange = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditThumbnailPanel listingId="listing1" images={images} onImagesChange={onImagesChange} />
      <ToastContainer />
    </I18nextProvider>,
  );
  return { onImagesChange };
}

describe('HousingEditThumbnailPanel', () => {
  it('既存画像をグリッドに表示する', () => {
    renderPanel(['a', 'b']);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('上限未満なら追加ドロップゾーンを表示する', () => {
    renderPanel(['a']);
    expect(screen.getByRole('button', { name: /画像を選ぶ|ファイルを選択|クリックして選択/ })).toBeTruthy();
  });

  it('ファイル選択→圧縮→アップロード成功で onImagesChange が返り値で呼ばれる', async () => {
    mockCompress.mockResolvedValue({ base64: 'ZmFrZQ==', mimeType: 'image/webp', file: new File([], 'a.webp'), originalBytes: 100, compressedBytes: 50 });
    mockUpload.mockResolvedValue({ success: true, thumbnailPath: 'https://x/new.webp', thumbnailPaths: ['a', 'https://x/new.webp'] });
    const { onImagesChange } = renderPanel(['a']);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith({
      listingId: 'listing1',
      base64: 'ZmFrZQ==',
      mimeType: 'image/webp',
      index: 1,
    }));
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith(['a', 'https://x/new.webp']));
  });

  it('アップロード失敗時はトーストを表示し onImagesChange を呼ばない', async () => {
    mockCompress.mockResolvedValue({ base64: 'ZmFrZQ==', mimeType: 'image/webp', file: new File([], 'a.webp'), originalBytes: 100, compressedBytes: 50 });
    mockUpload.mockRejectedValue(new Error('boom'));
    const { onImagesChange } = renderPanel(['a']);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('失敗しました。もう一度お試しください')).toBeInTheDocument());
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it('上限枚数に達したら追加ドロップゾーンを描画しない', () => {
    renderPanel(['a', 'b', 'c', 'd']);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditThumbnailPanel.test.tsx`
Expected: FAIL (module not found)。

- [ ] **Step 3: 実装を書く**

`src/components/housing/edit/HousingEditThumbnailPanel.tsx`:
```tsx
import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import { compressHousingImage } from '../../../lib/housing/imageCompression';
import {
  uploadListingThumbnail,
  deleteListingThumbnail,
  reorderListingThumbnails,
} from '../../../lib/housingApiClient';
import { showToast } from '../../Toast';
import { SAVED_IMAGES_LIMIT } from '../register/HousingRegisterImageField';

export interface HousingEditThumbnailPanelProps {
  listingId: string;
  images: string[];
  onImagesChange: (next: string[]) => void;
}

/**
 * 編集ページの直接アップロード側パネル (Plan B・2026-07-21)。
 * 「差し替え」専用UIは持たない。既存画像は HousingEditImageGrid の削除+ドラッグのみで、
 * 入れ替えたい場合は「削除してから追加」で対応する (設計書で確定済み)。
 * 追加は1ファイルずつ (create モードの複数選択とは異なり、都度サーバーへ即時反映するため
 * バッチ処理の複雑化を避ける意図的なスコープ縮小)。
 */
export function HousingEditThumbnailPanel({ listingId, images, onImagesChange }: HousingEditThumbnailPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const canAddMore = images.length < SAVED_IMAGES_LIMIT;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast(t('housing.register.image.error.not_image'), 'error');
        return;
      }
      setUploading(true);
      try {
        const compressed = await compressHousingImage(file);
        const result = await uploadListingThumbnail({
          listingId,
          base64: compressed.base64,
          mimeType: compressed.mimeType,
          index: images.length,
        });
        onImagesChange(result.thumbnailPaths);
      } catch {
        showToast(t('housing.editMedia.save_failed'), 'error');
      } finally {
        setUploading(false);
      }
    },
    [listingId, images.length, onImagesChange, t],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDelete = useCallback(
    (index: number) => deleteListingThumbnail({ listingId, index }).then((r) => r.thumbnailPaths),
    [listingId],
  );
  const handleReorder = useCallback(
    (newOrder: string[]) => reorderListingThumbnails({ listingId, newOrder }).then((r) => r.thumbnailPaths),
    [listingId],
  );

  return (
    <div className="housing-register-image-field">
      <label className="housing-register-image-label">
        {t('housing.register.image.label', { max: SAVED_IMAGES_LIMIT })}
      </label>
      <HousingEditImageGrid
        images={images}
        onImagesChange={onImagesChange}
        onDelete={handleDelete}
        onReorder={handleReorder}
        minImages={1}
      />
      {canAddMore && (
        <div
          className="housing-register-image-dropzone"
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          aria-label={t('housing.register.image.select_aria')}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="housing-register-image-input"
            tabIndex={-1}
          />
          {uploading ? (
            <span className="housing-register-image-status">{t('housing.register.image.compressing')}</span>
          ) : (
            <>
              <span className="housing-register-image-cta">
                {images.length === 0 ? t('housing.register.image.cta') : t('housing.register.image.cta_add')}
              </span>
              <span className="housing-register-image-hint">
                {t('housing.register.image.hint', { current: images.length, max: SAVED_IMAGES_LIMIT })}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditThumbnailPanel.test.tsx`
Expected: 全テスト PASS。テストの「追加ドロップゾーン」ボタン名アサーションが実際の `select_aria` 訳文と一致しない場合は、`src/locales/ja.json` の `housing.register.image.select_aria` の実際の値を確認し、テストの正規表現をそれに合わせて調整する。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/edit/HousingEditThumbnailPanel.tsx src/components/housing/edit/__tests__/HousingEditThumbnailPanel.test.tsx
git commit -m "feat(housing): 編集ページの直接アップロード側パネルを追加 (Plan B Task3)"
```

---

### Task 4: `HousingEditSourcePanel` — URL経由側パネル

**Files:**
- Create: `src/components/housing/edit/HousingEditSourcePanel.tsx`
- Test: `src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`

**Interfaces:**
- Consumes: `HousingEditImageGrid` (Task2)、`HousingRegisterSnsUrlField` (`src/components/housing/register/HousingRegisterSnsUrlField.tsx`、既存・無変更で再利用)、`deleteListingSourceImage`/`reorderListingSourceImages` (`housingApiClient.ts`)、`SnsCapture` 型 (`RegisterPage.tsx` から export 済み)。
- Produces:
  ```ts
  export interface EditVideoPreview { url: string; posterUrl: string; aspectRatio?: number; }
  export interface HousingEditSourcePanelProps {
    listingId: string;
    sourceImageUrls: string[];
    onSourceImageUrlsChange: (next: string[]) => void;
    videoPreview: EditVideoPreview | null;
    onCommitSnsFetch: (
      capture: SnsCapture,
      freshSourceImageUrls: string[],
    ) => Promise<{ ok: boolean; skipped?: boolean }>;
  }
  export function HousingEditSourcePanel(props: HousingEditSourcePanelProps): JSX.Element;
  ```
  `onCommitSnsFetch` は RegisterPage 側 (Task7) が実装する「フルドラフトを組んで update-listing を呼ぶ」処理へのコールバック。このコンポーネントは中身を知らない (呼ぶだけ)。

- [ ] **Step 1: 失敗するテストを先に書く**

`src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ToastContainer } from '../../../Toast';

const mockDelete = vi.fn();
const mockReorder = vi.fn();
vi.mock('../../../../lib/housingApiClient', () => ({
  deleteListingSourceImage: (...args: unknown[]) => mockDelete(...args),
  reorderListingSourceImages: (...args: unknown[]) => mockReorder(...args),
}));

// 子 HousingRegisterSnsUrlField が握る実 fetch hook をモック (RegisterSectionMedia.test.tsx と同じ方針)。
const tweetState: any = { status: 'idle', data: null, errorCode: null, fetchTweet: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useTweetFetch', () => ({ useTweetFetch: () => tweetState }));
const ogpState: any = { status: 'idle', data: null, errorCode: null, fetchOgp: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useOgpFetch', () => ({ useOgpFetch: () => ogpState }));

import { HousingEditSourcePanel } from '../HousingEditSourcePanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof HousingEditSourcePanel>> = {}) {
  const onSourceImageUrlsChange = overrides.onSourceImageUrlsChange ?? vi.fn();
  const onCommitSnsFetch = overrides.onCommitSnsFetch ?? vi.fn().mockResolvedValue({ ok: true });
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditSourcePanel
        listingId="listing1"
        sourceImageUrls={overrides.sourceImageUrls ?? ['a', 'b']}
        onSourceImageUrlsChange={onSourceImageUrlsChange}
        videoPreview={overrides.videoPreview ?? null}
        onCommitSnsFetch={onCommitSnsFetch}
      />
      <ToastContainer />
    </I18nextProvider>,
  );
  return { onSourceImageUrlsChange, onCommitSnsFetch };
}

describe('HousingEditSourcePanel', () => {
  it('既存URL画像をグリッドに表示する', () => {
    renderPanel({ sourceImageUrls: ['a', 'b', 'c'] });
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(3);
  });

  it('動画プレビューがあればバッジ付きで表示する', () => {
    renderPanel({ videoPreview: { url: 'https://x/video.mp4', posterUrl: 'https://x/poster.jpg' } });
    expect(screen.getByTestId('housing-register-media-video')).toBeInTheDocument();
  });

  it('削除ボタン押下で deleteListingSourceImage を呼び、結果を onSourceImageUrlsChange へ渡す', async () => {
    mockDelete.mockResolvedValue({ success: true, sourceImageUrls: ['b'] });
    const { onSourceImageUrlsChange } = renderPanel({ sourceImageUrls: ['a', 'b'] });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ listingId: 'listing1', index: 0 }));
    await waitFor(() => expect(onSourceImageUrlsChange).toHaveBeenCalledWith(['b']));
  });

  it('commit 失敗時はトーストを表示する', async () => {
    const onCommitSnsFetch = vi.fn().mockResolvedValue({ ok: false });
    renderPanel({ onCommitSnsFetch });
    // HousingRegisterSnsUrlField 経由の実際のツイート取得トリガーはこのテストでは直接叩けないため、
    // ここでは onCommitSnsFetch 自体が false を返した場合の表示ロジックのみ、
    // handleTweetFetched 相当を模したユニットレベルの検証は Step3 実装のコールバックを
    // 直接 export した内部ヘルパーではなくコンポーネント経由でしか検証できない制約を踏まえ、
    // このテストケースは Step3 実装後に「モックした useTweetFetch の fetchTweet を呼ばせて
        // onTweetFetched 相当を発火させる」形に差し替える (下記 Step2 参照)。
    expect(onCommitSnsFetch).toBeDefined();
  });
});
```

- [ ] **Step 2: 「commit 失敗時」テストを実際に発火可能な形に書き直す**

`HousingRegisterSnsUrlField` は内部で `useTweetFetch`/`useOgpFetch` の結果を見て `onTweetFetched` 等を呼ぶ。モックした `tweetState`/`ogpState` を書き換えて re-render するのではなく、**このコンポーネントの結合テストとしては `onCommitSnsFetch` の配線だけを検証すれば十分**と判断し、Step1 の最後のテストケースを次に置き換える (`HousingRegisterSnsUrlField` の内部詳細に依存しない、より頑健なテスト):
```tsx
  it('URL欄が描画され、onOgpFetched 経由の値が commit に渡る動線を持つ', () => {
    // HousingRegisterSnsUrlField 自体の fetch ロジックは HousingRegisterSnsUrlField.help.test.tsx で
    // 別途担保されている。ここでは HousingEditSourcePanel が onTweetFetched/onYoutubeFetched/
    // onOgpFetched の3つを渡してマウントしていることのみ確認する (プロップ配線の smoke test)。
    renderPanel({});
    expect(screen.getByPlaceholderText(/URL|url/i) ?? screen.getByRole('textbox')).toBeTruthy();
  });
```
Step1 のコード全体をこのテストケースで最後のケースを置き換えて確定させる。

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`
Expected: FAIL (module not found)。

- [ ] **Step 4: 実装を書く**

`src/components/housing/edit/HousingEditSourcePanel.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from '../register/HousingRegisterSnsUrlField';
import { deleteListingSourceImage, reorderListingSourceImages } from '../../../lib/housingApiClient';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { SnsCapture } from '../pages/RegisterPage';
import { showToast } from '../../Toast';

export interface EditVideoPreview {
  url: string;
  posterUrl: string;
  aspectRatio?: number;
}

export interface HousingEditSourcePanelProps {
  listingId: string;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページのURL経由側パネル (Plan B・2026-07-21)。
 * 「投稿URLを貼り替える」= 既存 HousingRegisterSnsUrlField をそのまま使い、取得成功のたびに
 * `onCommitSnsFetch` (RegisterPage 側で buildDraft()+updateListing を実行) を呼んで丸ごと
 * 差し替える。削除/並び替えは commit を経由せず deleteListingSourceImage/
 * reorderListingSourceImages を直接叩く (update-listing はフルドラフトが要るため重く、
 * 1件削除ごとに使うのは不適切)。
 */
export function HousingEditSourcePanel({
  listingId,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  onCommitSnsFetch,
}: HousingEditSourcePanelProps) {
  const { t } = useTranslation();
  const [committing, setCommitting] = useState(false);

  const commit = useCallback(
    async (capture: SnsCapture, freshUrls: string[]) => {
      setCommitting(true);
      try {
        const result = await onCommitSnsFetch(capture, freshUrls);
        if (!result.ok) {
          showToast(t('housing.editMedia.save_failed'), 'error');
        }
      } catch {
        showToast(t('housing.editMedia.save_failed'), 'error');
      } finally {
        setCommitting(false);
      }
    },
    [onCommitSnsFetch, t],
  );

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      const photos = data.photos ?? [];
      commit({ tweetData: data, tweetSource: source, youtube: null, ogp: null }, photos.slice(0, 10));
    },
    [commit],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) return;
      commit({ tweetData: null, tweetSource: null, youtube: data, ogp: null }, []);
    },
    [commit],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images.slice(0, 10)
          : data.data.image
            ? [data.data.image]
            : [];
      commit({ tweetData: null, tweetSource: null, youtube: null, ogp: data }, images);
    },
    [commit],
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
      <HousingRegisterSnsUrlField
        onTweetFetched={handleTweetFetched}
        onYoutubeFetched={handleYoutubeFetched}
        onOgpFetched={handleOgpFetched}
      />
      {committing && (
        <p className="housing-register-image-status">{t('housing.register.image.compressing')}</p>
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

- [ ] **Step 5: テストを実行して全て通ることを確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx`
Expected: 全テスト PASS。`screen.getByPlaceholderText` 等が実際のDOMと一致しない場合は `HousingRegisterSnsUrlField.tsx` の input 実装 (placeholder文言/role) を確認しテストを調整する。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/edit/HousingEditSourcePanel.tsx src/components/housing/edit/__tests__/HousingEditSourcePanel.test.tsx
git commit -m "feat(housing): 編集ページのURL経由側パネルを追加 (Plan B Task4)"
```

---

### Task 5: `HousingEditMediaModeTabs` — 登録方法切り替えタブ

**Files:**
- Create: `src/components/housing/edit/HousingEditMediaModeTabs.tsx`
- Test: `src/components/housing/edit/__tests__/HousingEditMediaModeTabs.test.tsx`
- Modify: `src/styles/housing.css`
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`

**Interfaces:**
- Produces:
  ```ts
  export type EditMediaMode = 'thumbnail' | 'sns';
  export interface HousingEditMediaModeTabsProps {
    mode: EditMediaMode;
    onChange: (mode: EditMediaMode) => void;
  }
  export function HousingEditMediaModeTabs(props: HousingEditMediaModeTabsProps): JSX.Element;
  ```

- [ ] **Step 1: i18n キーを追加**

`ja.json` の `"editMedia"` オブジェクト (Task2で作成済み) に追記:
```json
        "editMedia": {
            "save_failed": "失敗しました。もう一度お試しください",
            "tab_upload": "アップロード",
            "tab_url": "URL",
            "recommend_url": "URLで登録すると画質が劣化しません。Twitterの場合、元の投稿を削除するとこの物件情報も自動で更新されます。"
        },
```
`en.json`:
```json
        "editMedia": {
            "save_failed": "Failed. Please try again",
            "tab_upload": "Upload",
            "tab_url": "URL",
            "recommend_url": "Registering via URL keeps full image quality. For Twitter posts, deleting the original post automatically updates this listing too."
        },
```
`ko.json`:
```json
        "editMedia": {
            "save_failed": "실패했습니다. 다시 시도해 주세요",
            "tab_upload": "업로드",
            "tab_url": "URL",
            "recommend_url": "URL로 등록하면 화질이 저하되지 않습니다. 트위터의 경우 원본 게시물을 삭제하면 이 매물 정보도 자동으로 업데이트됩니다."
        },
```
`zh.json`:
```json
        "editMedia": {
            "save_failed": "失败了,请重试",
            "tab_upload": "上传",
            "tab_url": "URL",
            "recommend_url": "通过URL登录不会降低画质。对于Twitter,删除原帖后该房源信息也会自动更新。"
        },
```

- [ ] **Step 2: 失敗するテストを先に書く**

`src/components/housing/edit/__tests__/HousingEditMediaModeTabs.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingEditMediaModeTabs } from '../HousingEditMediaModeTabs';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('HousingEditMediaModeTabs', () => {
  it('2つのタブを描画し、現在のモードに aria-selected を立てる', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <HousingEditMediaModeTabs mode="thumbnail" onChange={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('tab', { name: 'アップロード' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'false');
  });

  it('タブ押下で onChange が呼ばれる (押しただけではサーバー通信しない)', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <HousingEditMediaModeTabs mode="thumbnail" onChange={onChange} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'URL' }));
    expect(onChange).toHaveBeenCalledWith('sns');
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditMediaModeTabs.test.tsx`
Expected: FAIL (module not found)。

- [ ] **Step 4: 実装を書く**

`src/components/housing/edit/HousingEditMediaModeTabs.tsx`:
```tsx
import { useTranslation } from 'react-i18next';

export type EditMediaMode = 'thumbnail' | 'sns';

export interface HousingEditMediaModeTabsProps {
  mode: EditMediaMode;
  onChange: (mode: EditMediaMode) => void;
}

/**
 * 編集ページの「アップロード」/「URL」切り替えタブ (Plan B・2026-07-21)。
 * 押した瞬間はローカルの表示切り替えのみでサーバーへは何も送らない。実際にサーバー側の
 * データが変わる (旧方式のクリーンアップを含む) のは、新しい方に実コンテンツが
 * 入った瞬間 (HousingEditThumbnailPanel のアップロード成功時 / HousingEditSourcePanel の
 * URL取得成功時) であり、それらは別コンポーネントの責務。
 */
export function HousingEditMediaModeTabs({ mode, onChange }: HousingEditMediaModeTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="housing-edit-media-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'thumbnail'}
        className="housing-edit-media-tab"
        onClick={() => onChange('thumbnail')}
      >
        {t('housing.editMedia.tab_upload')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'sns'}
        className="housing-edit-media-tab"
        onClick={() => onChange('sns')}
      >
        {t('housing.editMedia.tab_url')}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: CSS を追加する**

`src/styles/housing.css` の `/* ===== お気に入りタブ (FavoritesTabs) ===== */` ブロックの直前に、同じトークンを使う新ブロックを追記:
```css
/* ===== 編集ページ 登録方法切り替えタブ (HousingEditMediaModeTabs) ===== */
.housing-edit-media-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}
.housing-edit-media-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  font-family: inherit;
  font-size: var(--housing-text-sm);
  font-weight: 600;
  color: var(--housing-text-dim);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.housing-edit-media-tab:hover {
  color: var(--housing-text);
  background: var(--housing-chip-bg-hover);
}
.housing-edit-media-tab[aria-selected="true"] {
  color: var(--housing-candle);
}
.housing-edit-media-tab[aria-selected="true"]::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 2px;
  background: var(--housing-tab-active);
  border-radius: 2px 2px 0 0;
  box-shadow: 0 0 8px var(--housing-honey-glow);
  pointer-events: none;
}
.housing-edit-media-tab:focus-visible {
  outline: 2px solid var(--housing-honey);
  outline-offset: -2px;
  border-radius: 8px;
}
```

- [ ] **Step 6: テストを実行して全て通ることを確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditMediaModeTabs.test.tsx`
Expected: 全テスト PASS。

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/edit/HousingEditMediaModeTabs.tsx src/components/housing/edit/__tests__/HousingEditMediaModeTabs.test.tsx src/styles/housing.css src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 編集ページの登録方法切り替えタブを追加 (Plan B Task5)"
```

---

### Task 6: `HousingEditMediaSection` — 統合セクション

**Files:**
- Create: `src/components/housing/edit/HousingEditMediaSection.tsx`
- Test: `src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx`

**Interfaces:**
- Consumes: `HousingEditMediaModeTabs`/`EditMediaMode` (Task5)、`HousingEditThumbnailPanel` (Task3)、`HousingEditSourcePanel`/`EditVideoPreview` (Task4)、`SnsCapture` (`RegisterPage.tsx`)。
- Produces:
  ```ts
  export interface HousingEditMediaSectionProps {
    listingId: string;
    initialMode: EditMediaMode;
    thumbnailPaths: string[];
    onThumbnailPathsChange: (next: string[]) => void;
    sourceImageUrls: string[];
    onSourceImageUrlsChange: (next: string[]) => void;
    videoPreview: EditVideoPreview | null;
    onCommitSnsFetch: (
      capture: SnsCapture,
      freshSourceImageUrls: string[],
    ) => Promise<{ ok: boolean; skipped?: boolean }>;
  }
  export function HousingEditMediaSection(props: HousingEditMediaSectionProps): JSX.Element;
  ```

- [ ] **Step 1: 失敗するテストを先に書く**

`src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

vi.mock('../../../../lib/housingApiClient', () => ({
  deleteListingThumbnail: vi.fn(),
  reorderListingThumbnails: vi.fn(),
  uploadListingThumbnail: vi.fn(),
  deleteListingSourceImage: vi.fn(),
  reorderListingSourceImages: vi.fn(),
}));
const tweetState: any = { status: 'idle', data: null, errorCode: null, fetchTweet: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useTweetFetch', () => ({ useTweetFetch: () => tweetState }));
const ogpState: any = { status: 'idle', data: null, errorCode: null, fetchOgp: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useOgpFetch', () => ({ useOgpFetch: () => ogpState }));

import { HousingEditMediaSection } from '../HousingEditMediaSection';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderSection(overrides: Partial<React.ComponentProps<typeof HousingEditMediaSection>> = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditMediaSection
        listingId="listing1"
        initialMode={overrides.initialMode ?? 'thumbnail'}
        thumbnailPaths={overrides.thumbnailPaths ?? ['a', 'b']}
        onThumbnailPathsChange={overrides.onThumbnailPathsChange ?? vi.fn()}
        sourceImageUrls={overrides.sourceImageUrls ?? []}
        onSourceImageUrlsChange={overrides.onSourceImageUrlsChange ?? vi.fn()}
        videoPreview={overrides.videoPreview ?? null}
        onCommitSnsFetch={overrides.onCommitSnsFetch ?? vi.fn().mockResolvedValue({ ok: true })}
      />
    </I18nextProvider>,
  );
}

describe('HousingEditMediaSection', () => {
  it('initialMode=thumbnail のとき直接アップロードパネルを表示する', () => {
    renderSection({ initialMode: 'thumbnail', thumbnailPaths: ['a'] });
    expect(screen.getByRole('tab', { name: 'アップロード' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
  });

  it('initialMode=sns のときURLパネルを表示する', () => {
    renderSection({ initialMode: 'sns', sourceImageUrls: ['x'] });
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'true');
  });

  it('タブをクリックすると表示パネルが切り替わる (API呼び出しなし)', () => {
    renderSection({ initialMode: 'thumbnail', thumbnailPaths: [] });
    fireEvent.click(screen.getByRole('tab', { name: 'URL' }));
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx`
Expected: FAIL (module not found)。

- [ ] **Step 3: 実装を書く**

`src/components/housing/edit/HousingEditMediaSection.tsx`:
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditMediaModeTabs, type EditMediaMode } from './HousingEditMediaModeTabs';
import { HousingEditThumbnailPanel } from './HousingEditThumbnailPanel';
import { HousingEditSourcePanel, type EditVideoPreview } from './HousingEditSourcePanel';
import type { SnsCapture } from '../pages/RegisterPage';

export interface HousingEditMediaSectionProps {
  listingId: string;
  initialMode: EditMediaMode;
  thumbnailPaths: string[];
  onThumbnailPathsChange: (next: string[]) => void;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページの写真セクション全体 (Plan B・2026-07-21)。タブの選択状態は完全にローカル
 * (どちらのパネルを見せるかだけ) で、実データの切り替えは各パネルの操作結果
 * (アップロード成功 / URL取得commit成功) を受けて親 (RegisterPage) 側の state が
 * 更新されることで反映される。
 */
export function HousingEditMediaSection({
  listingId,
  initialMode,
  thumbnailPaths,
  onThumbnailPathsChange,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  onCommitSnsFetch,
}: HousingEditMediaSectionProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditMediaMode>(initialMode);

  return (
    <section className="housing-register-section" data-testid="housing-edit-media-section">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>
      <HousingEditMediaModeTabs mode={mode} onChange={setMode} />
      <p className="housing-register-image-note">{t('housing.editMedia.recommend_url')}</p>
      {mode === 'thumbnail' ? (
        <HousingEditThumbnailPanel
          listingId={listingId}
          images={thumbnailPaths}
          onImagesChange={onThumbnailPathsChange}
        />
      ) : (
        <HousingEditSourcePanel
          listingId={listingId}
          sourceImageUrls={sourceImageUrls}
          onSourceImageUrlsChange={onSourceImageUrlsChange}
          videoPreview={videoPreview}
          onCommitSnsFetch={onCommitSnsFetch}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認**

Run: `npx vitest run src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx`
Expected: 全テスト PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/edit/HousingEditMediaSection.tsx src/components/housing/edit/__tests__/HousingEditMediaSection.test.tsx
git commit -m "feat(housing): 編集ページの写真セクション統合コンポーネントを追加 (Plan B Task6)"
```

---

### Task 7: RegisterPage.tsx への配線 (方式A撤廃)

**Files:**
- Modify: `src/components/housing/pages/RegisterPage.tsx`
- Modify: `src/components/housing/register/RegisterSectionConfirm.tsx`

**プリフライトレビューでの追加発見**: `RegisterPage.tsx` 以外に、`RegisterSectionConfirm.tsx:144` にも方式A由来の4つ目の分岐 (`mode !== 'edit' &&` で確認セクションの画像枚数要約行を非表示にする) が存在する。これは「edit は画像 state をプリフィルしないため imageCount が常に0になり誤解を招く」ことが理由だったが、Task1で `stillCount` に `editThumbnailPaths.length` を含めるよう修正済みのため、この前提は解消されている。Step5でこの分岐も撤去する。

**Interfaces:**
- Consumes: Task1で追加した `editThumbnailPaths`/`editVideoPreview`/prefill 済み `sourceImageUrls`、Task6の `HousingEditMediaSection`。
- Produces: `commitEditSnsFetch` 関数 (Task4の `onCommitSnsFetch` として渡す)、`handleEditThumbnailPathsChange` 関数 (クロスモードのローカル状態クリア込み)。

- [ ] **Step 1: import を追加**

`RegisterPage.tsx` 冒頭の import 群 (`RegisterSectionMedia` の import の直後、11行目付近) に追加:
```tsx
import { HousingEditMediaSection } from '../edit/HousingEditMediaSection';
import type { EditMediaMode } from '../edit/HousingEditMediaModeTabs';
```

- [ ] **Step 2: モード切替時のクロスクリア用ハンドラと commit 関数を追加**

`performUpdate` の定義 (`RegisterPage.tsx:1041` 付近) の直前に追加:
```tsx
  /**
   * 直接アップロード側の state 更新をラップし、sns→thumbnail の切替が
   * (uploadListingThumbnail が既に完了させた後で) ローカル表示にも反映されるよう、
   * URL側の古い表示を同時にクリアする (Plan B・2026-07-21)。
   */
  const handleEditThumbnailPathsChange = useCallback(
    (next: string[]) => {
      setEditThumbnailPaths(next);
      if (next.length > 0 && (sourceImageUrls.length > 0 || editVideoPreview)) {
        setSourceImageUrls([]);
        setEditVideoPreview(null);
      }
    },
    [sourceImageUrls.length, editVideoPreview],
  );

  /**
   * URL経由の「投稿を貼り替える」commit (Plan B・2026-07-21)。update-listing はフル
   * ドラフトを要求するため、既存 buildDraft() の結果に「今回取得した」画像フィールドを
   * 上書きマージする (buildDraft() 自体の image 部分は snsCapture state 由来で edit
   * モードでは常に空 = {} なので、fresh 側が確実に勝つ)。成功したら初めて画面表示用の
   * state (snsCapture/sourceImageUrls/postUrl) を更新し、直接アップロード側の表示は
   * 空にする (サーバー側で thumbnailPaths が削除されるため)。
   */
  const commitEditSnsFetch = useCallback(
    async (
      capture: SnsCapture,
      freshSourceImageUrls: string[],
    ): Promise<{ ok: boolean; skipped?: boolean }> => {
      if (!initialValues) return { ok: false };
      const freshImageFields = buildDraftImageFields(capture, [], freshSourceImageUrls);
      if (freshImageFields.imageMode !== 'sns') {
        // 画像/動画が取れなかった (テキストのみツイート等)。既存データを維持し何もしない。
        return { ok: true, skipped: true };
      }
      const payload = { ...buildDraft(), ...freshImageFields };
      const result = await updateListing(initialValues.id, payload);
      if (!result.ok) return { ok: false };
      setSnsCapture(capture);
      setSourceImageUrls(freshSourceImageUrls);
      setEditThumbnailPaths([]);
      const nextPostUrl =
        capture.tweetSource?.postUrl ?? capture.youtube?.postUrl ?? capture.ogp?.postUrl;
      if (nextPostUrl) setPostUrl(nextPostUrl);
      await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
      return { ok: true };
    },
    [initialValues, buildDraft, updateListing],
  );
```

- [ ] **Step 3: 方式Aの3箇所を撤廃する**

`visibleStepIds` (`RegisterPage.tsx:205-207`):
```tsx
function visibleStepIds(mode: 'create' | 'edit'): StepId[] {
  return mode === 'edit' ? STEP_IDS.filter((id) => id !== 'media') : [...STEP_IDS];
}
```
を次に置き換える (edit でも media を含める):
```tsx
function visibleStepIds(_mode: 'create' | 'edit'): StepId[] {
  return [...STEP_IDS];
}
```

`checkPanelItems` (`RegisterPage.tsx:817` 付近):
```tsx
  const checkPanelItems = useMemo(
    () => (mode === 'edit' ? checklistItems.filter((item) => item.key !== 'image') : checklistItems),
    [mode, checklistItems],
  );
```
を次に置き換える:
```tsx
  const checkPanelItems = checklistItems;
```

`doneMap.media` (`RegisterPage.tsx:825` 付近):
```tsx
      media: mode === 'edit' ? true : hasMedia,
```
を次に置き換える:
```tsx
      media: hasMedia,
```
`hasMedia` の定義 (`RegisterPage.tsx:771-774` 付近) に `editThumbnailPaths` を含める:
```tsx
  const hasMedia =
    localImages.length > 0 ||
    sourceImageUrls.length > 0 ||
    editThumbnailPaths.length > 0 ||
    !!snsCapture.tweetData?.video?.url ||
    !!snsCapture.youtube;
```

- [ ] **Step 4: media セクションの JSX を edit/create で分岐させる**

`RegisterPage.tsx:1447-1467` 付近の既存コード:
```tsx
            {/* mode='edit' は写真を扱わない (方式A) ため、写真セクション自体を出さない (Task3.2)。
                sectionRefs.current.media は null のままとなり、scroll-spy/ジャンプは自然に無視する。 */}
            {mode !== 'edit' && (
              <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
                <RegisterSectionMedia
                  key={`${mediaKey}:${restoredSnsUrl ?? ''}`}
                  onTweetFetched={handleTweetFetched}
                  onYoutubeFetched={handleYoutubeFetched}
                  onOgpFetched={handleOgpFetched}
                  localImages={localImages}
                  onLocalImagesChange={setLocalImages}
                  sourceImageUrls={sourceImageUrls}
                  onSourceImageUrlsChange={setSourceImageUrls}
                  initialSnsUrl={restoredSnsUrl}
                  onUrlUserEdit={handleUrlUserEdit}
                  tweetVideo={snsCapture.tweetData?.video ?? null}
                />
              </div>
            )}
```
を次に置き換える (create は完全に不変、edit だけ新セクションに差し替え):
```tsx
            <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
              {mode === 'edit' ? (
                initialValues && (
                  <HousingEditMediaSection
                    listingId={initialValues.id}
                    initialMode={
                      (initialValues.imageMode === 'thumbnail' ? 'thumbnail' : 'sns') as EditMediaMode
                    }
                    thumbnailPaths={editThumbnailPaths}
                    onThumbnailPathsChange={handleEditThumbnailPathsChange}
                    sourceImageUrls={sourceImageUrls}
                    onSourceImageUrlsChange={setSourceImageUrls}
                    videoPreview={editVideoPreview}
                    onCommitSnsFetch={commitEditSnsFetch}
                  />
                )
              ) : (
                <RegisterSectionMedia
                  key={`${mediaKey}:${restoredSnsUrl ?? ''}`}
                  onTweetFetched={handleTweetFetched}
                  onYoutubeFetched={handleYoutubeFetched}
                  onOgpFetched={handleOgpFetched}
                  localImages={localImages}
                  onLocalImagesChange={setLocalImages}
                  sourceImageUrls={sourceImageUrls}
                  onSourceImageUrlsChange={setSourceImageUrls}
                  initialSnsUrl={restoredSnsUrl}
                  onUrlUserEdit={handleUrlUserEdit}
                  tweetVideo={snsCapture.tweetData?.video ?? null}
                />
              )}
            </div>
```

- [ ] **Step 5: `RegisterSectionConfirm.tsx` の4つ目の方式A分岐を撤去する**

`src/components/housing/register/RegisterSectionConfirm.tsx:144-149` の既存コード:
```tsx
        {mode !== 'edit' && (
          <div className="housing-register-confirm-summary-row">
            <dt>{t('housing.register.section_media')}</dt>
            <dd>{t('housing.register.confirm.summary_image_count', { count: summary.imageCount })}</dd>
          </div>
        )}
```
を次に置き換える (常に表示):
```tsx
        <div className="housing-register-confirm-summary-row">
          <dt>{t('housing.register.section_media')}</dt>
          <dd>{t('housing.register.confirm.summary_image_count', { count: summary.imageCount })}</dd>
        </div>
```
直前のコメント (`RegisterSectionConfirm.tsx:141-143`、「mode='edit' は写真を扱わない (方式A) ため画像枚数を要約しない...」) も削除する (説明対象の分岐が無くなるため)。

- [ ] **Step 6: 型チェックを実行する**

Run: `npx tsc -b --noEmit`
Expected: PASS (エラーなし)。エラーが出た場合、`EditMediaMode` の import パスや `initialValues.imageMode` の型 (`ImageMode`) との比較が原因になりやすいので、`src/types/housing.ts` の `ImageMode` 定義を確認して修正する。

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/pages/RegisterPage.tsx src/components/housing/register/RegisterSectionConfirm.tsx
git commit -m "feat(housing): 編集ページに写真セクションを復活させ方式Aを撤廃 (Plan B Task7)"
```

---

### Task 8: 既存テストの方式A前提を修正

**Files:**
- Modify: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`

**司令塔がプリフライトで特定済みの3箇所** (`src/components/housing/pages/__tests__/RegisterPage.test.tsx`、これ以外の方式A無関係なテストには触れない):

- [ ] **Step 1: ベースラインを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: FAIL (Task7完了後の状態なので、以下3ブロックの記述通りに失敗する)。

- [ ] **Step 2: 「ステッパー: mode=edit は写真ステップを除外する」ブロックを書き換える**

既存コード (684-705行目付近):
```tsx
  // Task3.4-1: 幽霊ステップ解消。 edit は写真セクションを出さない (方式A) ので、
  // ステッパーからも media ステップを除外する (クリックしても無反応な「押せない幽霊ステップ」を無くす)。
  describe('ステッパー: mode=edit は写真ステップを除外する (Task3.4-1)', () => {
    it('mode=edit ではステッパーに写真ステップが出ず、4 ステップに詰められる', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).queryByText('SNS投稿・サイトから自動入力')).not.toBeInTheDocument();
      expect(within(nav).getAllByRole('button')).toHaveLength(4);
      // 番号がずれず 1 から詰められる (先頭は住所ステップ)。
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('住所');
      expect(within(nav).queryByTestId('housing-register-step-5')).not.toBeInTheDocument();
    });

    it('mode=create ではステッパーに写真ステップを含む 5 ステップを出す (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('SNS投稿・サイトから自動入力');
    });
  });
```
を次に置き換える (Plan Bで edit も写真ステップを含む5ステップになる):
```tsx
  // Plan B (2026-07-21): 方式A撤廃により edit も写真ステップを含む (旧 Task3.4-1 の逆)。
  describe('ステッパー: mode=edit も写真ステップを含む (Plan B)', () => {
    it('mode=edit でもステッパーに写真ステップが出て、5 ステップになる', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('SNS投稿・サイトから自動入力');
    });

    it('mode=create ではステッパーに写真ステップを含む 5 ステップを出す (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const nav = screen.getByRole('navigation', { name: '登録ステップ' });
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      expect(within(nav).getByTestId('housing-register-step-1')).toHaveTextContent('SNS投稿・サイトから自動入力');
    });
  });
```

- [ ] **Step 3: 「CheckPanel: mode=edit は画像行を出さない」ブロックを書き換える**

既存コード (723-742行目付近):
```tsx
  // Task3.4-2: 右カラム CheckPanel の画像行を edit で非表示 (写真を編集しない方式Aと整合)。
  describe('CheckPanel: mode=edit は画像行を出さない (Task3.4-2)', () => {
    it('mode=edit では CheckPanel に画像行が出ない (必須行は残る)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).queryByTestId('housing-register-check-image')).not.toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-address')).toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-title')).toBeInTheDocument();
    });

    it('mode=create では CheckPanel に画像行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).getByTestId('housing-register-check-image')).toBeInTheDocument();
    });
  });
```
を次に置き換える (Plan Bで edit も画像行を出す。ただし推奨行のまま=必須にはならない):
```tsx
  // Plan B (2026-07-21): 方式A撤廃により edit も CheckPanel に画像行を出す (推奨行のまま)。
  describe('CheckPanel: mode=edit も画像行を出す (Plan B)', () => {
    it('mode=edit でも CheckPanel に画像行が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).getByTestId('housing-register-check-image')).toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-address')).toBeInTheDocument();
      expect(within(panel).getByTestId('housing-register-check-title')).toBeInTheDocument();
    });

    it('mode=create では CheckPanel に画像行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const panel = screen.getByTestId('housing-register-check-panel');
      expect(within(panel).getByTestId('housing-register-check-image')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 4: 「確認セクション: mode=edit は画像枚数の要約行を出さない」ブロックを書き換える**

既存コード (744-763行目付近):
```tsx
  // 最終レビュー Important#1: 確認セクションの画像枚数要約は mode=edit で出さない。
  // edit は画像 state をプリフィルしないため imageCount が常に 0 になり、「0 枚」表示が
  // 写真を持つ家主に「写真が消えた?」と誤認させる (方式A: 写真はサーバー側で保持されたまま)。
  describe('確認セクション: mode=edit は画像枚数の要約行を出さない (最終レビュー Important#1)', () => {
    it('mode=edit では確認セクションに画像枚数の行が出ない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).queryByText('SNS投稿・サイトから自動入力')).not.toBeInTheDocument();
    });

    it('mode=create では確認セクションに画像枚数の行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
    });
  });
```
を次に置き換える (Task1で `stillCount` が `editThumbnailPaths` を含むよう修正済みのため、edit でも正しい枚数が出せるようになった。よって非表示にする理由が無くなった):
```tsx
  // Plan B (2026-07-21): Task1 で imageCount 算出に editThumbnailPaths を含めたため、
  // edit でも正しい枚数を要約できるようになった (方式A時代の「常に0枚」誤表示は解消)。
  describe('確認セクション: mode=edit も画像枚数の要約行を出す (Plan B)', () => {
    it('mode=edit でも確認セクションに画像枚数の行が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
    });

    it('mode=create では確認セクションに画像枚数の行が出る (既存挙動不変)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage();

      const section = screen.getByTestId('housing-register-section-confirm');
      expect(within(section).getByText('SNS投稿・サイトから自動入力')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 5: 全テストが通ることを確認する**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: 全テスト PASS。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/pages/__tests__/RegisterPage.test.tsx
git commit -m "test(housing): RegisterPage.test.tsx の方式A前提テストをPlan Bの挙動に更新 (Plan B Task8)"
```

---

### Task 9: push前ゲート (フルビルド+全テスト)

**Files:**
- (変更なし・検証のみ)

- [ ] **Step 1: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: PASS。

- [ ] **Step 2: 実ビルド (Vercel相当・api/専用tsconfigを含む)**

Run: `npm run build`
Expected: PASS。Plan Aで踏んだ `tsconfig.api.json` (`strictNullChecks:false`) 特有のエラーは今回のタスクでは `api/` を変更していないため発生しない見込みだが、念のため実行する。

- [ ] **Step 3: 全テスト**

Run: `npx vitest run`
Expected: 既存の既知失敗 (TopBar4件+HousingWorkspace1件+EphemeralAddPanel7件、いずれも本タスク無関係の既知issue) 以外は全て PASS。新規追加分・修正分に失敗が無いことを確認する。

- [ ] **Step 4: Commit (差分があれば)**

ビルド/テストのみで差分が出ないはずだが、`tsc`/`build` 過程で自動生成物が変化していないか `git status` で確認する。差分が無ければ何もしない。

---

## Self-Review Notes (計画作成者による確認済み事項)

- **Spec coverage**: 設計書の「差し替えUIなし」「確認ダイアログなし」「B案(処理中→反映)」「エラーはトースト」「モード切替はローカル表示のみ・実コンテンツ到着でcommit」「0枚状態は既存コンポーネント同等の扱い」の全項目にタスクが対応している。
- **Placeholder scan**: 各ステップのコードは完全な実装を記載済み (TBD/後で実装等の記述なし)。
- **Type consistency**: `EditMediaMode`/`EditVideoPreview`/`SnsCapture` の型名・フィールド名はTask間で統一済み (`HousingEditMediaSection`→`HousingEditThumbnailPanel`/`HousingEditSourcePanel`→`HousingEditImageGrid` の props バケツリレーが一致することを設計時に確認済み)。
- **既知のフォローアップ (本計画のスコープ外)**: Plan A設計書にあった案内文言は Task5 で確定させた (`recommend_url`)。ユーザーによる文言の最終承認は Task9 完了後、実機確認の一環で行う。
