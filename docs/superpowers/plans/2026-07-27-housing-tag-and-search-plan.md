# ハウジング 探すページ タグ検索(AND対応) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探すページに「タグ」ビューを新設し、公式/季節/テーマ/初心者/ハウジンガーの全タグ種別を1つのUIに統合。ハウジンガーを選んだときだけ他条件とAND絞り込みにする。

**Architecture:** 中央パネルの「一覧|マップ」トグルに3つ目のタブ「タグ」を追加し、選択すると`WorldSelectGate`と同じ要領で中央パネルの中身が丸ごとタグ選択画面(`BrowseTagView`)に切り替わる。中身(ハウジンガーセクション+タグ全部セクション+件数プレビュー+絞り込む/クリアボタン)は`TagPickerPanel`という共有コンポーネントに実装し、PCは`BrowseTagView`が全画面コンテナとして、スマホは`HousingFilterSheet`内のインラインアコーディオンとして、それぞれ別の入れ物で同じ中身を表示する。選択は「保留(pending)」状態を専用の軽量Zustandストアで持ち、「絞り込む」ボタンを押すまで実際のフィルタ結果(`useHousingFilterStore.tags`)には反映しない。ロジック本体は`applyFilters.ts`の1関数のみを拡張し、呼び出し側のシグネチャは変えない。

**Tech Stack:** React + TypeScript, Zustand, react-i18next, Vitest + Testing Library (happy-dom), Firebase Firestore (client SDK直読み)。

**設計書:** `docs/superpowers/specs/2026-07-27-housing-tag-and-search-design.md` (承認済み)

## Global Constraints

- 会話・コメント・コミットメッセージは日本語 (CLAUDE.md)。
- UI文字列は必ずi18nキー経由。ハードコーディング禁止 (`.claude/rules/i18n.md`)。新規キーはja/en/ko/zhの4言語すべてに追加し、コピー残り(未翻訳)ゼロを維持する。
- `src/components/housing/**` と `src/styles/housing.css` は独自トンマナ対象 (`.claude/rules/housing-design.md`)。白黒のみ/Inter禁止ルールは適用されない。色・font-size・寸法・影は必ず既存の `--housing-*` トークン経由、ハードコード禁止。
- 新規CSSクラスは `src/styles/housing.css` に集約し、コンポーネント側で `style={{}}` の新規定義をしない。
- push前に `npm run build` + `npx vitest run` がグリーンであることを確認する (`.claude/rules/` および memory `feedback_vercel_tsc_strict`)。
- 各タスックの最後に個別コミットする (frequent commits)。

---

### Task 1: `applyFilters.ts` にハウジンガーAND絞り込みを実装

**Files:**
- Modify: `src/lib/housing/applyFilters.ts`
- Test: `src/__tests__/housing/applyFilters.test.ts`

**Interfaces:**
- Consumes: `isPersonalTagIdFormat(id: string): boolean` (`src/data/housingTags.ts`、既存)
- Produces: `applyFilters(listings, filters: FilterCondition): MockListing[]` のシグネチャ自体は不変 (呼び出し側=`FilterPanel.tsx`/`BrowsePage.tsx`は無改修)。挙動のみ変更: `filters.tags` のうち `personal_` 形式のIDと、それ以外のIDを内部で分離し、両グループをANDで結合する (各グループ内はOR)。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/applyFilters.test.ts` の既存 `describe('applyFilters', ...)` ブロック内、`'combines filters with AND across categories'` テストの直後に追記:

```ts
    it('housinger タグ (personal_) は選んだ複数人の中でOR一致する', () => {
        const a = { ...MOCK_LISTINGS[0], id: 'h-a', tags: ['personal_taro'] };
        const b = { ...MOCK_LISTINGS[0], id: 'h-b', tags: ['personal_hanako'] };
        const c = { ...MOCK_LISTINGS[0], id: 'h-c', tags: ['personal_jiro'] };
        const result = applyFilters([a, b, c], { ...EMPTY, tags: ['personal_taro', 'personal_hanako'] });
        expect(result.map((l) => l.id).sort()).toEqual(['h-a', 'h-b']);
    });

    it('housinger タグを選んだときだけ、他のタグ条件とAND結合になる', () => {
        const matches = { ...MOCK_LISTINGS[0], id: 'm', tags: ['theme_wafu', 'personal_taro'] };
        const wrongHousinger = { ...MOCK_LISTINGS[0], id: 'wrong-h', tags: ['theme_wafu', 'personal_hanako'] };
        const wrongTheme = { ...MOCK_LISTINGS[0], id: 'wrong-t', tags: ['theme_modern', 'personal_taro'] };
        const result = applyFilters([matches, wrongHousinger, wrongTheme], {
            ...EMPTY,
            tags: ['theme_wafu', 'personal_taro'],
        });
        expect(result.map((l) => l.id)).toEqual(['m']);
    });

    it('housinger タグを選んでいなければ、非housingerタグ同士は従来どおり単純OR', () => {
        const result = applyFilters(MOCK_LISTINGS, { ...EMPTY, tags: ['wafu'] });
        expect(result.every((l) => l.tags.includes('wafu'))).toBe(true);
    });
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/applyFilters.test.ts`
Expected: 新規3件のうち上2件がFAIL (現行の`.some()`単純ORではANDが効かず `wrong-h`/`wrong-t` も混ざって返るため)。3件目は既存ロジックのままなのでPASSする。

- [ ] **Step 3: `applyFilters.ts` を最小実装する**

`src/lib/housing/applyFilters.ts` の全文を以下に置き換える:

```ts
import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { Region } from '../../data/housing/dcServerMap';
import { isPersonalTagIdFormat } from '../../data/housingTags';

export interface FilterCondition {
    dc: string | null;
    regions: Region[] | string[];
    servers: string[];
    areas: HousingArea[];
    sizes: HousingSize[];
    tags: string[];
}

export function applyFilters(listings: MockListing[], filters: FilterCondition): MockListing[] {
    // ハウジンガー (personal_) タグと、それ以外 (公式/季節/テーマ/初心者) のタグを分離する。
    // 非ハウジンガー側 = 選んだタグのどれか1つでも一致すればOK (OR)。
    // ハウジンガー側 = 選んだハウジンガーのうち誰か1人の家であればOK (OR)。
    // 両グループとも選択されている場合は、それぞれの条件を両方満たす必要がある (AND)。
    // 片方しか選んでいない場合は、選んでいない側の条件は無条件で満たす扱い (下のif文が素通りする)。
    const personalTags = filters.tags.filter((t) => isPersonalTagIdFormat(t));
    const otherTags = filters.tags.filter((t) => !isPersonalTagIdFormat(t));
    return listings.filter((listing) => {
        if (filters.dc && listing.dc !== filters.dc) return false;
        if (listing.region !== undefined && filters.regions.length > 0 && !filters.regions.includes(listing.region)) return false;
        if (filters.servers.length > 0 && (listing.server === undefined || !filters.servers.includes(listing.server))) return false;
        if (filters.areas.length > 0 && (listing.area === undefined || !filters.areas.includes(listing.area))) return false;
        if (filters.sizes.length > 0 && (listing.size === undefined || !filters.sizes.includes(listing.size))) return false;
        if (otherTags.length > 0 && !otherTags.some((t) => listing.tags.includes(t))) return false;
        if (personalTags.length > 0 && !personalTags.some((t) => listing.tags.includes(t))) return false;
        return true;
    });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/applyFilters.test.ts`
Expected: 全件PASS (既存テスト含む)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/applyFilters.ts src/__tests__/housing/applyFilters.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): applyFiltersでハウジンガータグ選択時のみAND絞り込みに対応

personal_ prefixのタグとそれ以外を分離し、両グループをANDで結合。
各グループ内は従来どおりOR。呼び出し側のシグネチャは変更なし。
EOF
)"
```

---

### Task 2: `useHousingFilterStore` に `setTags` アクションを追加

**Files:**
- Modify: `src/store/useHousingFilterStore.ts`
- Test: `src/__tests__/housing/useHousingFilterStore.test.ts`

**Interfaces:**
- Produces: `setTags: (tags: string[]) => void` — Task 3以降のpendingタグ確定処理から呼ばれる。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/useHousingFilterStore.test.ts` の `it('toggles area (multi select)', ...)` ブロックの直後に追記:

```ts
    it('setTags は tags 配列をまるごと置き換える (絞り込む確定時に使用)', () => {
        const s = useHousingFilterStore.getState();
        s.toggleTag('official_cafe');
        expect(useHousingFilterStore.getState().tags).toEqual(['official_cafe']);
        s.setTags(['theme_wafu', 'personal_taro']);
        expect(useHousingFilterStore.getState().tags).toEqual(['theme_wafu', 'personal_taro']);
    });
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/useHousingFilterStore.test.ts`
Expected: FAIL (`setTags is not a function`)。

- [ ] **Step 3: `setTags` を実装する**

`src/store/useHousingFilterStore.ts` の interface に1行追加 (`toggleTag` の直後、29行目):

```ts
    toggleTag: (tag: string) => void;
    setTags: (tags: string[]) => void;
```

実装本体にも1行追加 (`toggleTag:` の直後、63行目):

```ts
    toggleTag: (tag) => set((s) => ({ tags: toggleInArray(s.tags, tag) })),
    setTags: (tags) => set({ tags }),
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/useHousingFilterStore.test.ts`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/store/useHousingFilterStore.ts src/__tests__/housing/useHousingFilterStore.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): useHousingFilterStoreにsetTagsアクションを追加

タグ検索の「絞り込む」確定時に、保留中の選択を一括で書き込むために使う。
EOF
)"
```

---

### Task 3: 保留中のタグ選択を持つ `useHousingTagPickerStore` を新設

**Files:**
- Create: `src/store/useHousingTagPickerStore.ts`
- Test: `src/__tests__/housing/useHousingTagPickerStore.test.ts`

**Interfaces:**
- Produces:
  - `useHousingTagPickerStore.getState().pendingTags: string[]`
  - `.initialized: boolean`
  - `.toggleTag(id: string): void`
  - `.clearPending(): void`
  - `.syncFromCommitted(committed: string[]): void`
- 呼び出し規約 (Task 9 `TagPickerPanel` で使用): マウント時に `!initialized` のときだけ `syncFromCommitted(現在の useHousingFilterStore.tags)` を呼ぶ。ストア自体はガードを持たず、呼ばれれば常に上書きする。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/useHousingTagPickerStore.test.ts` を新規作成:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';

describe('useHousingTagPickerStore', () => {
    beforeEach(() => {
        useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
    });

    it('初期状態は空・未初期化', () => {
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual([]);
        expect(s.initialized).toBe(false);
    });

    it('syncFromCommitted で pendingTags を確定値から初期化し initialized=true にする', () => {
        useHousingTagPickerStore.getState().syncFromCommitted(['theme_wafu', 'personal_taro']);
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual(['theme_wafu', 'personal_taro']);
        expect(s.initialized).toBe(true);
    });

    it('toggleTag で追加/削除をトグルする', () => {
        const s = useHousingTagPickerStore.getState();
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual([]);
    });

    it('clearPending は pendingTags を空にするが initialized は保つ', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['theme_wafu']);
        s.clearPending();
        const after = useHousingTagPickerStore.getState();
        expect(after.pendingTags).toEqual([]);
        expect(after.initialized).toBe(true);
    });

    it('syncFromCommitted は呼ばれるたびに常に上書きする (呼び出し側が !initialized ガードを持つ規約)', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['a']);
        s.toggleTag('b');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['a', 'b']);
        s.syncFromCommitted(['c']);
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['c']);
    });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/useHousingTagPickerStore.test.ts`
Expected: FAIL (モジュール `../../store/useHousingTagPickerStore` が存在しない)。

- [ ] **Step 3: ストアを実装する**

`src/store/useHousingTagPickerStore.ts` を新規作成:

```ts
import { create } from 'zustand';

/**
 * 探すページ「タグ」ビューの保留中(pending)選択。
 * `useHousingFilterStore.tags` (実際に適用中のフィルタ) とは別に持ち、
 * 「絞り込む」ボタンを押すまで実際の検索結果には反映しない (design 2026-07-27 §3)。
 */
interface HousingTagPickerState {
    pendingTags: string[];
    /** syncFromCommitted が一度でも呼ばれたか。呼び出し側はこれが false の間だけ再同期する。 */
    initialized: boolean;
    toggleTag: (id: string) => void;
    clearPending: () => void;
    syncFromCommitted: (committed: string[]) => void;
}

export const useHousingTagPickerStore = create<HousingTagPickerState>((set) => ({
    pendingTags: [],
    initialized: false,
    toggleTag: (id) => set((s) => ({
        pendingTags: s.pendingTags.includes(id)
            ? s.pendingTags.filter((v) => v !== id)
            : [...s.pendingTags, id],
    })),
    clearPending: () => set({ pendingTags: [] }),
    syncFromCommitted: (committed) => set({ pendingTags: committed, initialized: true }),
}));
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/useHousingTagPickerStore.test.ts`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/store/useHousingTagPickerStore.ts src/__tests__/housing/useHousingTagPickerStore.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索の保留中選択を持つuseHousingTagPickerStoreを新設

絞り込むボタンを押すまで実際のフィルタに反映しないpending状態を分離管理する。
EOF
)"
```

---

### Task 4: `personalTagLookup.ts` にハウジンガー全件取得を追加

**Files:**
- Modify: `src/lib/housing/personalTagLookup.ts`
- Modify: `src/lib/housing/__tests__/personalTagLookup.test.ts`

**Interfaces:**
- Produces: `listAllPersonalTags(max?: number): Promise<PersonalTag[]>` — `isHidden===false` を `displayNameLower` 昇順で最大 `max` 件 (既定500) 取得する。Firestore security rules (`personal_tags/{tagId}`) は `isHidden==false` の `list` を認証不要で許可済み。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/personalTagLookup.test.ts` の全文を以下に置き換える (既存の `getPersonalTagById` テストは維持しつつ、`firebase/firestore` モックに `collection/query/where/orderBy/limit/getDocs` を追加し、新規 `describe` を追記):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
}));

const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import { getPersonalTagById, listAllPersonalTags } from '../personalTagLookup';
import type { PersonalTag } from '../../../types/housing';

const TAG: PersonalTag = {
  id: 'personal_abc123',
  displayName: 'yuura',
  displayNameLower: 'yuura',
  ownerUid: 'u1',
  createdAt: 0,
  reportCount: 0,
  isHidden: false,
};

beforeEach(() => {
  mockDoc.mockReset();
  mockGetDoc.mockReset();
  mockCollection.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockGetDocs.mockReset();
});

describe('getPersonalTagById', () => {
  it('存在すればタグを返す (探すページの個人タグ絞り込みリンク用、 spec §3.3 契約4)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => TAG });
    const r = await getPersonalTagById('personal_abc123');
    expect(r).toEqual(TAG);
    expect(mockDoc).toHaveBeenCalledWith({}, 'personal_tags', 'personal_abc123');
  });

  it('ドキュメント不存在なら null', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const r = await getPersonalTagById('nope');
    expect(r).toBeNull();
  });

  it('rules 拒否等の例外 (非公開タグ等) も null に丸める', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('permission-denied'));
    const r = await getPersonalTagById('hidden-tag');
    expect(r).toBeNull();
  });
});

describe('listAllPersonalTags', () => {
  it('isHidden==false を displayNameLower 昇順・既定500件でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ ...TAG, id: 'personal_taro', displayName: 'taro' }) },
        { data: () => ({ ...TAG, id: 'personal_hanako', displayName: 'hanako' }) },
      ],
    });
    const r = await listAllPersonalTags();
    expect(r.map((t) => t.id)).toEqual(['personal_taro', 'personal_hanako']);
    expect(mockWhere).toHaveBeenCalledWith('isHidden', '==', false);
    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
    expect(mockLimit).toHaveBeenCalledWith(500);
  });

  it('max を指定するとその件数でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await listAllPersonalTags(50);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('0件なら空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await listAllPersonalTags();
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/housing/__tests__/personalTagLookup.test.ts`
Expected: `listAllPersonalTags` 関連3件がFAIL (`listAllPersonalTags is not a function`)。`getPersonalTagById` の3件はPASSのまま。

- [ ] **Step 3: `listAllPersonalTags` を実装する**

`src/lib/housing/personalTagLookup.ts` の全文を以下に置き換える:

```ts
/**
 * personal_tags コレクションの読み取り。
 *
 * getPersonalTagById: 単発解決。探すページで個人タグ 1 つに絞り込んでいるとき、 結果一覧の上に
 * 「{{name}} のハウジンガーページを見る →」 リンクを出すために使う
 * (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
 * タグ→uid の解決は personal_tags/{tagId}.ownerUid、 表示名は同ドキュメントの displayName。
 *
 * listAllPersonalTags: 全件取得。探すページ「タグ」ビューのハウジンガーセクション用
 * (design 2026-07-27-housing-tag-and-search-design.md §2)。
 *
 * firestore.rules: `isHidden===false` のタグは誰でも get/list 可能なので、 認証不要の直接読み。
 * 非公開/不存在/rules 拒否はすべて null または空配列に丸める (housingerProfileService と同方針)。
 */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { PersonalTag } from '../../types/housing';

const COLLECTION = 'personal_tags';

export async function getPersonalTagById(tagId: string): Promise<PersonalTag | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, tagId));
    if (!snap.exists()) return null;
    return snap.data() as PersonalTag;
  } catch {
    return null;
  }
}

export async function listAllPersonalTags(max = 500): Promise<PersonalTag[]> {
  try {
    const qref = query(
      collection(db, COLLECTION),
      where('isHidden', '==', false),
      orderBy('displayNameLower'),
      limit(max),
    );
    const snap = await getDocs(qref);
    return snap.docs.map((d) => d.data() as PersonalTag);
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/lib/housing/__tests__/personalTagLookup.test.ts`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/personalTagLookup.ts src/lib/housing/__tests__/personalTagLookup.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): personalTagLookupにハウジンガー全件取得listAllPersonalTagsを追加

タグ検索のハウジンガーセクション用。isHidden==falseのみdisplayNameLower昇順で
クライアント直読み (getPersonalTagByIdと同じrules前提)。
EOF
)"
```

---

### Task 5: i18nキー追加 (ja/en/ko/zh) + パリティテスト

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`
- Create: `src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts`

**Interfaces:**
- Produces i18nキー: `housing.browse.view_tags`、`housing.tagpicker.*` (housinger_section_title / all_tags_section_title / housinger_loading / housinger_empty / housinger_error / preview_count / apply_button / clear_button)。既存の `housing.register.tag_kind.*` (official/season/theme/beginner/personal) をタグ全部セクションの区切りラベルとして再利用する (新規キーは切らない)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts` を新規作成 (既存の `register/__tests__/i18nParity.test.ts` と同型):

```ts
import { describe, it, expect } from 'vitest';
import ja from '../../../../../locales/ja.json';
import en from '../../../../../locales/en.json';
import ko from '../../../../../locales/ko.json';
import zh from '../../../../../locales/zh.json';

/**
 * housing.tagpicker.* の i18n パリティ検証 (design 2026-07-27-housing-tag-and-search-design.md)。
 * キー構造が ja/en/ko/zh で一致し、 かつ ja のコピー残り (未翻訳) が無いことを保証する。
 */

type Tree = { housing: { tagpicker: Record<string, unknown> } };

function flattenLeaves(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenLeaves(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(flattenLeaves(obj, prefix)).sort();
}

const tagpickerOf = (data: unknown): Record<string, unknown> => (data as Tree).housing.tagpicker;

const jaKeys = collectKeyPaths(tagpickerOf(ja));
const others: Record<string, unknown> = { en, ko, zh };

describe('housing.tagpicker i18n parity', () => {
  it('ja に housing.tagpicker キーが存在する', () => {
    expect(jaKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tagpicker キーが ja と一致する`, () => {
      expect(collectKeyPaths(tagpickerOf(others[lang]))).toEqual(jaKeys);
    });
  }
});

const HIRAGANA_KATAKANA = /[぀-ヿ]/;

describe('housing.tagpicker 翻訳完了 (ja のコピー残りゼロ)', () => {
  const jaValues = flattenLeaves(tagpickerOf(ja));

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tagpicker 値に ja からのコピー残り (未翻訳) が無い`, () => {
      const otherValues = flattenLeaves(tagpickerOf(others[lang]));
      const untranslated = Object.keys(jaValues).filter((path) => {
        const value = otherValues[path];
        if (typeof value !== 'string') return false;
        if (lang === 'zh') return HIRAGANA_KATAKANA.test(value);
        return value === jaValues[path];
      });
      expect(untranslated).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts`
Expected: FAIL (`housing.tagpicker` が ja.json 等に存在しないため `Cannot read properties of undefined`)。

- [ ] **Step 3: 4言語のロケールJSONにキーを追記する**

`src/locales/ja.json` の `"housing": { "browse": { ... } }` ブロック内、`"view_map": "マップ",` の直後 (2018行目相当) に1行追加:

```json
            "view_map": "マップ",
            "view_tags": "タグ",
```

`src/locales/ja.json` の `"housing": { ... }` 直下 (`"workspace"` ブロックの直前など、既存の名前空間と衝突しない位置) に新規オブジェクト `"tagpicker"` を追加する。既存の `"workspace": {` の直前に挿入:

```json
        "tagpicker": {
            "housinger_section_title": "ハウジンガー",
            "all_tags_section_title": "すべてのタグ",
            "housinger_loading": "読み込み中…",
            "housinger_empty": "まだハウジンガーが登録されていません",
            "housinger_error": "読み込みに失敗しました",
            "preview_count": "この条件で {{count}}件",
            "apply_button": "この条件で絞り込む",
            "clear_button": "選択をクリア"
        },
```

同様に `src/locales/en.json`:

```json
            "view_map": "Map",
            "view_tags": "Tags",
```

```json
        "tagpicker": {
            "housinger_section_title": "Housingers",
            "all_tags_section_title": "All Tags",
            "housinger_loading": "Loading…",
            "housinger_empty": "No housingers registered yet",
            "housinger_error": "Failed to load",
            "preview_count": "{{count}} matches",
            "apply_button": "Apply filters",
            "clear_button": "Clear selection"
        },
```

`src/locales/ko.json`:

```json
            "view_map": "지도",
            "view_tags": "태그",
```

```json
        "tagpicker": {
            "housinger_section_title": "하우징어",
            "all_tags_section_title": "전체 태그",
            "housinger_loading": "불러오는 중…",
            "housinger_empty": "등록된 하우징어가 없습니다",
            "housinger_error": "불러오지 못했습니다",
            "preview_count": "이 조건으로 {{count}}개",
            "apply_button": "필터 적용",
            "clear_button": "선택 초기화"
        },
```

`src/locales/zh.json`:

```json
            "view_map": "地图",
            "view_tags": "标签",
```

```json
        "tagpicker": {
            "housinger_section_title": "房主",
            "all_tags_section_title": "全部标签",
            "housinger_loading": "加载中…",
            "housinger_empty": "暂无已登记的房主",
            "housinger_error": "加载失败",
            "preview_count": "此条件下 {{count}}件",
            "apply_button": "应用筛选",
            "clear_button": "清空选择"
        },
```

**注意:** 4ファイルとも `"housing"` オブジェクト直下・`"workspace"` キーの直前に `"tagpicker"` を挿入すること (既存キーの構造・カンマ位置を壊さないよう、対象ブロックだけをtextual編集する。全体parse→stringifyでの書き直しは禁止 — 既存ルール `feedback_locale_json_textual_edit` 準拠)。

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索UI用のi18nキーをhousing.tagpicker.*として4言語追加

housing.browse.view_tagsとhousing.tagpicker名前空間を新設。
既存housing.register.tag_kind.*を種別ラベルとして再利用する。
EOF
)"
```

---

### Task 6: `housing.css` にタグ検索UI用の新規クラスを追加

**Files:**
- Modify: `src/styles/housing.css`

**Interfaces:**
- Produces CSSクラス: `.housing-tagpicker-view` / `.housing-tagpicker` / `.housing-tagpicker-section` / `.housing-tagpicker-section-header` / `.housing-tagpicker-section-title` / `.housing-tagpicker-section-body` / `.housing-tagpicker-status` / `.housing-tagpicker-kind-group` / `.housing-tagpicker-kind-label` / `.housing-tagpicker-chip-grid` / `.housing-tagpicker-chip` (`data-selected` 属性で選択表現) / `.housing-tagpicker-footer` / `.housing-tagpicker-preview` / `.housing-tagpicker-footer-actions` / `.housing-tagpicker-clear-btn` / `.housing-tagpicker-apply-btn` / `.housing-tagpicker-inline-body`。Task 7〜13のコンポーネントがこれらを参照する。

このタスクにはユニットテストが無い (CSS単体の自動テストは既存コードにも無い)。ビルドが通ることと、Task 13完了時点でのユーザー実画面確認 (memory `feedback_housing_whitespace_rhythm` / `feedback_housing_no_ai_pills` 準拠) で検証する。

- [ ] **Step 1: `housing.css` に新規ブロックを追記する**

`src/styles/housing.css` の `.housing-world-gate-chip[data-selected="true"]` ブロック (既存6113〜6117行目付近) の直後に、以下のブロックをまるごと追記する:

```css

/* タグ検索ビュー (探すページ 3タブ目「タグ」・design 2026-07-27)。
   WorldSelectGate と同じ chip の見た目 (section/label/grid/chip) を踏襲しつつ、
   ゲートと違い1画面に収めず縦スクロールする長尺レイアウトにする。 */
.housing-tagpicker-view {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 4px 24px;
}
.housing-tagpicker {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.housing-tagpicker-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.housing-tagpicker-section-header {
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  font-family: inherit;
}
.housing-tagpicker-section-title {
  font-size: var(--housing-text-sm);
  font-weight: 600;
  color: var(--housing-text);
}
.housing-tagpicker-section-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.housing-tagpicker-status {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-dim);
}
.housing-tagpicker-kind-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
}
.housing-tagpicker-kind-group:first-child {
  padding-top: 0;
}
.housing-tagpicker-kind-group:not(:first-child) {
  border-top: 1px solid var(--housing-divider);
}
.housing-tagpicker-kind-label {
  font-size: var(--housing-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--housing-text-dim);
}
.housing-tagpicker-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.housing-tagpicker-chip {
  appearance: none;
  cursor: pointer;
  height: 32px;
  padding: 0 12px;
  font-family: inherit;
  font-size: var(--housing-text-sm);
  font-weight: 600;
  color: var(--housing-text-dim);
  background: var(--housing-panel-inner);
  border: 1px solid var(--housing-panel-border);
  border-radius: 9px;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.housing-tagpicker-chip:hover {
  border-color: var(--housing-panel-border-strong);
  color: var(--housing-text);
}
.housing-tagpicker-chip[data-selected="true"] {
  color: var(--housing-candle);
  background: var(--housing-honey-medium);
  border-color: var(--housing-honey-border);
}
.housing-tagpicker-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  padding: 12px 4px 4px;
  background: var(--housing-panel-bg-solid);
  border-top: 1px solid var(--housing-divider);
}
.housing-tagpicker-preview {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-dim);
}
.housing-tagpicker-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.housing-tagpicker-clear-btn {
  appearance: none;
  cursor: pointer;
  padding: 8px 12px;
  font-family: inherit;
  font-size: var(--housing-text-sm);
  font-weight: 600;
  color: var(--housing-text-dim);
  background: transparent;
  border: 1px solid var(--housing-panel-border);
  border-radius: 9px;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.housing-tagpicker-clear-btn:hover {
  color: var(--housing-text);
  border-color: var(--housing-panel-border-strong);
  background: var(--housing-chip-bg-hover);
}
.housing-tagpicker-apply-btn {
  appearance: none;
  cursor: pointer;
  padding: 8px 16px;
  font-family: inherit;
  font-size: var(--housing-text-sm);
  font-weight: 600;
  color: var(--housing-candle);
  background: var(--housing-honey-soft);
  border: 1px solid var(--housing-honey-border);
  border-radius: 9px;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.housing-tagpicker-apply-btn:hover {
  background: var(--housing-honey-medium);
  box-shadow: 0 0 0 1px var(--housing-honey-inset) inset, 0 0 12px var(--housing-honey-shadow-soft);
}
.housing-tagpicker-inline-body {
  padding-top: 12px;
}
```

- [ ] **Step 2: ビルドを実行し構文エラーが無いことを確認する**

Run: `npm run build`
Expected: 正常終了 (exit code 0)。Lightning CSS が新規ブロックをエラー無く処理すること。

- [ ] **Step 3: コミット**

```bash
git add src/styles/housing.css
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索UI用のCSSクラス一式をhousing.cssに追加

WorldSelectGateのchip見た目とRegisterCTAのhoney CTAボタンを踏襲し、
既存トークン経由で新規クラスを定義。
EOF
)"
```

---

### Task 7: `HousingerTagSection` コンポーネント

**Files:**
- Create: `src/components/housing/browse/tagpicker/HousingerTagSection.tsx`
- Test: `src/__tests__/housing/HousingerTagSection.test.tsx`

**Interfaces:**
- Consumes: `listAllPersonalTags(): Promise<PersonalTag[]>` (Task 4)
- Produces: `HousingerTagSectionProps = { selected: string[]; onToggle: (id: string) => void }`。マウント時に `listAllPersonalTags()` を呼び、ロード中/エラー/0件/一覧の4状態をチップグリッドで表示する折りたたみ可能セクション。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingerTagSection.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { HousingerTagSection } from '../../components/housing/browse/tagpicker/HousingerTagSection';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  listAllPersonalTagsMock.mockReset();
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const TAGS = [
  { id: 'personal_taro', displayName: 'taro', displayNameLower: 'taro', ownerUid: 'u1', createdAt: 0, reportCount: 0, isHidden: false },
  { id: 'personal_hanako', displayName: 'hanako', displayNameLower: 'hanako', ownerUid: 'u2', createdAt: 0, reportCount: 0, isHidden: false },
];

describe('HousingerTagSection', () => {
  it('ロード中はローディング文言を表示する', () => {
    listAllPersonalTagsMock.mockReturnValue(new Promise(() => {}));
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('取得できたら全員分をチップで表示する', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('hanako')).toBeInTheDocument();
  });

  it('selected に含まれるチップは data-selected=true', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={['personal_taro']} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    expect(screen.getByText('taro').closest('button')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('hanako').closest('button')).toHaveAttribute('data-selected', 'false');
  });

  it('チップクリックで onToggle が呼ばれる', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    const onToggle = vi.fn();
    wrap(<HousingerTagSection selected={[]} onToggle={onToggle} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByText('taro'));
    expect(onToggle).toHaveBeenCalledWith('personal_taro');
  });

  it('0件なら空状態の文言を表示する', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce([]);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('まだハウジンガーが登録されていません')).toBeInTheDocument());
  });

  it('セクション見出しクリックで折りたたむ (チップが非表示になる)', async () => {
    listAllPersonalTagsMock.mockResolvedValueOnce(TAGS);
    wrap(<HousingerTagSection selected={[]} onToggle={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('taro')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'ハウジンガー' }));
    expect(screen.queryByText('taro')).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/HousingerTagSection.test.tsx`
Expected: FAIL (モジュール `../../components/housing/browse/tagpicker/HousingerTagSection` が存在しない)。

- [ ] **Step 3: コンポーネントを実装する**

`src/components/housing/browse/tagpicker/HousingerTagSection.tsx` を新規作成:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listAllPersonalTags } from '../../../../lib/housing/personalTagLookup';
import type { PersonalTag } from '../../../../types/housing';

export interface HousingerTagSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * タグ検索「ハウジンガー」セクション。全員分の個人タグをチップで並べる (検索欄なし)。
 * design 2026-07-27-housing-tag-and-search-design.md §2。
 */
export const HousingerTagSection: React.FC<HousingerTagSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tags, setTags] = useState<PersonalTag[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAllPersonalTags()
      .then((result) => {
        if (cancelled) return;
        setTags(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = t('housing.tagpicker.housinger_section_title');

  return (
    <div className="housing-tagpicker-section">
      <button
        type="button"
        className="housing-tagpicker-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="housing-tagpicker-section-title">{title}</span>
      </button>
      {open && (
        <div className="housing-tagpicker-section-body">
          {status === 'loading' && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_loading')}</div>
          )}
          {status === 'error' && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_error')}</div>
          )}
          {status === 'ready' && tags.length === 0 && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_empty')}</div>
          )}
          {status === 'ready' && tags.length > 0 && (
            <div className="housing-tagpicker-chip-grid">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="housing-tagpicker-chip"
                  data-selected={selected.includes(tag.id) ? 'true' : 'false'}
                  onClick={() => onToggle(tag.id)}
                >
                  {tag.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/HousingerTagSection.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/tagpicker/HousingerTagSection.tsx src/__tests__/housing/HousingerTagSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索「ハウジンガー」セクションを実装

listAllPersonalTagsで全員分を取得し検索欄なしのチップ一覧で表示。
折りたたみ可能・選択状態はdata-selected属性で表現。
EOF
)"
```

---

### Task 8: `AllTagsSection` コンポーネント

**Files:**
- Create: `src/components/housing/browse/tagpicker/AllTagsSection.tsx`
- Test: `src/__tests__/housing/AllTagsSection.test.tsx`

**Interfaces:**
- Consumes: `STATIC_HOUSING_TAG_KINDS`, `getTagsByKind(kind)` (`src/data/housingTags.ts`、既存)
- Produces: `AllTagsSectionProps = { selected: string[]; onToggle: (id: string) => void }`。公式/季節/テーマ/初心者の48タグを、kindごとの軽い区切り(ラベル+区切り線)付きで1つのチップ羅列として表示する折りたたみ可能セクション。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/AllTagsSection.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { AllTagsSection } from '../../components/housing/browse/tagpicker/AllTagsSection';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('AllTagsSection', () => {
  it('kindごとの区切りラベル (公式/季節/テーマ/初心者) を表示する', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('公式')).toBeInTheDocument();
    expect(screen.getByText('季節')).toBeInTheDocument();
    expect(screen.getByText('テーマ')).toBeInTheDocument();
    expect(screen.getByText('初心者')).toBeInTheDocument();
  });

  it('48件のタグチップを表示する', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    const chips = document.querySelectorAll('.housing-tagpicker-chip');
    expect(chips.length).toBe(48);
  });

  it('selected に含まれるチップは data-selected=true', () => {
    wrap(<AllTagsSection selected={['theme_wafu']} onToggle={vi.fn()} />);
    const wafuChip = screen.getByText('和風').closest('button');
    expect(wafuChip).toHaveAttribute('data-selected', 'true');
  });

  it('チップクリックで onToggle が呼ばれる', () => {
    const onToggle = vi.fn();
    wrap(<AllTagsSection selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('和風'));
    expect(onToggle).toHaveBeenCalledWith('theme_wafu');
  });

  it('セクション見出しクリックで折りたたむ', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'すべてのタグ' }));
    expect(screen.queryByText('和風')).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/AllTagsSection.test.tsx`
Expected: FAIL (モジュールが存在しない)。

- [ ] **Step 3: コンポーネントを実装する**

`src/components/housing/browse/tagpicker/AllTagsSection.tsx` を新規作成:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATIC_HOUSING_TAG_KINDS, getTagsByKind } from '../../../../data/housingTags';

export interface AllTagsSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

/**
 * タグ検索「タグ全部」セクション。公式/季節/テーマ/初心者 (計48件) を1つのチップ羅列にまとめ、
 * kindごとに軽い区切り線+小ラベルを添えて見分けやすくする (design 2026-07-27 §2)。
 * kindラベルは housing.register.tag_kind.* を再利用する (新規キーを切らない)。
 */
export const AllTagsSection: React.FC<AllTagsSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const title = t('housing.tagpicker.all_tags_section_title');

  return (
    <div className="housing-tagpicker-section">
      <button
        type="button"
        className="housing-tagpicker-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="housing-tagpicker-section-title">{title}</span>
      </button>
      {open && (
        <div className="housing-tagpicker-section-body">
          {STATIC_HOUSING_TAG_KINDS.map((kind) => (
            <div key={kind} className="housing-tagpicker-kind-group">
              <div className="housing-tagpicker-kind-label">
                {t(`housing.register.tag_kind.${kind}`)}
              </div>
              <div className="housing-tagpicker-chip-grid">
                {getTagsByKind(kind).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className="housing-tagpicker-chip"
                    data-selected={selected.includes(tag.id) ? 'true' : 'false'}
                    onClick={() => onToggle(tag.id)}
                  >
                    {t(tag.i18nKey, { defaultValue: tag.id })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/AllTagsSection.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/tagpicker/AllTagsSection.tsx src/__tests__/housing/AllTagsSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索「タグ全部」セクションを実装

公式/季節/テーマ/初心者48件を1つのチップ羅列にまとめ、kindごとに
軽い区切り線+ラベル(既存housing.register.tag_kind.*を再利用)で見分ける。
EOF
)"
```

---

### Task 9: `TagPickerPanel` 共有コンテンツコンポーネント

**Files:**
- Create: `src/components/housing/browse/tagpicker/TagPickerPanel.tsx`
- Test: `src/__tests__/housing/TagPickerPanel.test.tsx`

**Interfaces:**
- Consumes: `HousingerTagSection` (Task 7), `AllTagsSection` (Task 8), `useHousingTagPickerStore` (Task 3), `useHousingFilterStore.setTags` (Task 2), `applyFilters` (Task 1)
- Produces: `TagPickerPanelProps = { onApplied: () => void }`。PC (`BrowseTagView`, Task 11) とスマホ (`HousingFilterSheet`, Task 13) の両方から同じ中身として使われる。`onApplied` は「絞り込む」押下時、`setTags` 反映後に呼ばれる (PCは一覧ビューへの遷移、スマホはアコーディオンの折りたたみに使う)。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/TagPickerPanel.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { TagPickerPanel } from '../../components/housing/browse/tagpicker/TagPickerPanel';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  listAllPersonalTagsMock.mockReset();
  listAllPersonalTagsMock.mockResolvedValue([]);
  useHousingFilterStore.getState().clearAll();
  useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
  useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('TagPickerPanel', () => {
  it('マウント時に committed tags からpendingを初期化する', async () => {
    useHousingFilterStore.getState().setTags(['theme_wafu']);
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
  });

  it('チップを選んでもすぐには committed tags に反映しない', async () => {
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('和風'));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
    expect(useHousingFilterStore.getState().tags).toEqual([]);
  });

  it('「絞り込む」を押すと committed tags に反映し onApplied を呼ぶ', async () => {
    const onApplied = vi.fn();
    wrap(<TagPickerPanel onApplied={onApplied} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('和風'));
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(useHousingFilterStore.getState().tags).toEqual(['theme_wafu']);
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it('「クリア」を押すと pending だけ空にする (committed tagsは変えない)', async () => {
    useHousingFilterStore.getState().setTags(['theme_wafu']);
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']));
    fireEvent.click(screen.getByText('選択をクリア'));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual([]);
    expect(useHousingFilterStore.getState().tags).toEqual(['theme_wafu']);
  });

  it('件数プレビューを表示する', async () => {
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    expect(screen.getByText(`この条件で ${MOCK_LISTINGS.length}件`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/TagPickerPanel.test.tsx`
Expected: FAIL (モジュールが存在しない)。

- [ ] **Step 3: コンポーネントを実装する**

`src/components/housing/browse/tagpicker/TagPickerPanel.tsx` を新規作成:

```tsx
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingTagPickerStore } from '../../../../store/useHousingTagPickerStore';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { applyFilters } from '../../../../lib/housing/applyFilters';
import { useKeywordFilteredListings } from '../../../../lib/housing/useKeywordFilteredListings';
import { HousingerTagSection } from './HousingerTagSection';
import { AllTagsSection } from './AllTagsSection';

export interface TagPickerPanelProps {
  /** 「絞り込む」で committed tags へ反映した直後に呼ばれる (PC=一覧へ遷移 / スマホ=折りたたみ)。 */
  onApplied: () => void;
}

/**
 * タグ検索の中身 (ハウジンガー+タグ全部の2セクション、件数プレビュー、絞り込む/クリア)。
 * PC (BrowseTagView) とスマホ (HousingFilterSheet インライン) の両方から使う共有コンポーネント
 * (design 2026-07-27-housing-tag-and-search-design.md 技術的な注意点)。
 */
export const TagPickerPanel: React.FC<TagPickerPanelProps> = ({ onApplied }) => {
  const { t } = useTranslation();

  const committedTags = useHousingFilterStore((s) => s.tags);
  const setTags = useHousingFilterStore((s) => s.setTags);
  const dc = useHousingFilterStore((s) => s.dc);
  const regions = useHousingFilterStore((s) => s.regions);
  const servers = useHousingFilterStore((s) => s.servers);
  const areas = useHousingFilterStore((s) => s.areas);
  const sizes = useHousingFilterStore((s) => s.sizes);
  const keyword = useHousingFilterStore((s) => s.keyword);

  const pendingTags = useHousingTagPickerStore((s) => s.pendingTags);
  const initialized = useHousingTagPickerStore((s) => s.initialized);
  const toggleTag = useHousingTagPickerStore((s) => s.toggleTag);
  const clearPending = useHousingTagPickerStore((s) => s.clearPending);
  const syncFromCommitted = useHousingTagPickerStore((s) => s.syncFromCommitted);

  // タブ往復では pending を保持したいので、初回マウント時 (未初期化) だけ committed から同期する。
  useEffect(() => {
    if (!initialized) syncFromCommitted(committedTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const viewMode = useHousingViewStore((s) => s.viewMode);
  const realListings = useHousingListingsStore((s) => s.listings);
  const source = viewMode === 'map' ? MOCK_LISTINGS : realListings;

  const previewBase = useMemo(
    () => applyFilters(source, { dc, regions, servers, areas, sizes, tags: pendingTags }),
    [source, dc, regions, servers, areas, sizes, pendingTags],
  );
  const preview = useKeywordFilteredListings(previewBase, keyword);

  const handleApply = () => {
    setTags(pendingTags);
    onApplied();
  };

  return (
    <div className="housing-tagpicker">
      <HousingerTagSection selected={pendingTags} onToggle={toggleTag} />
      <AllTagsSection selected={pendingTags} onToggle={toggleTag} />
      <div className="housing-tagpicker-footer">
        <span className="housing-tagpicker-preview">
          {t('housing.tagpicker.preview_count', { count: preview.length })}
        </span>
        <div className="housing-tagpicker-footer-actions">
          <button type="button" className="housing-tagpicker-clear-btn" onClick={clearPending}>
            {t('housing.tagpicker.clear_button')}
          </button>
          <button type="button" className="housing-tagpicker-apply-btn" onClick={handleApply}>
            {t('housing.tagpicker.apply_button')}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/TagPickerPanel.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/tagpicker/TagPickerPanel.tsx src/__tests__/housing/TagPickerPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): タグ検索の共有コンテンツTagPickerPanelを実装

2セクション+件数プレビュー+絞り込む/クリアを1コンポーネントに集約し、
PC/スマホ両方の入れ物から使い回せるようにする。
EOF
)"
```

---

### Task 10: `BrowseViewToggle` / `useHousingViewStore` を3タブ化

**Files:**
- Modify: `src/components/housing/browse/BrowseViewToggle.tsx`
- Modify: `src/store/useHousingViewStore.ts`
- Modify: `src/__tests__/housing/BrowseViewToggle.test.tsx`

**Interfaces:**
- Produces: `HousingBrowseView = 'list' | 'map' | 'tags'` (`useHousingViewStore.ts`)。`BrowseViewToggle` の `VIEWS` 配列に `'tags'` を追加。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/BrowseViewToggle.test.tsx` の既存内容を確認し (Host コンポーネントで store 直結)、末尾に追記:

```tsx
  it('renders a third "タグ" tab and selecting it updates the store', () => {
    wrap(<Host />);
    expect(screen.getByRole('tab', { name: 'タグ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'タグ' }));
    expect(useHousingViewStore.getState().browseView).toBe('tags');
  });
```

(`fireEvent` が未importならファイル冒頭のimportに追加する。)

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/BrowseViewToggle.test.tsx`
Expected: FAIL (「タグ」タブが存在しない)。

- [ ] **Step 3: 型とコンポーネントを拡張する**

`src/store/useHousingViewStore.ts` の9行目を変更:

```ts
export type HousingBrowseView = 'list' | 'map' | 'tags';
```

(`DEFAULTS.browseView` は `'list'` のまま変更不要。)

`src/components/housing/browse/BrowseViewToggle.tsx` の9行目を変更:

```ts
const VIEWS: HousingBrowseView[] = ['list', 'map', 'tags'];
```

`src/locales/ja.json` 等には Task 5 で既に `view_tags` を追加済みのため、ここでの追加i18n作業は無い。

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/BrowseViewToggle.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/store/useHousingViewStore.ts src/components/housing/browse/BrowseViewToggle.tsx src/__tests__/housing/BrowseViewToggle.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): 一覧|マップの切替トグルに「タグ」タブを追加

HousingBrowseViewを'list'|'map'|'tags'に拡張。
EOF
)"
```

---

### Task 11: `BrowseTagView` (PC全画面コンテナ) + `BrowsePage` 配線

**Files:**
- Create: `src/components/housing/browse/BrowseTagView.tsx`
- Test: `src/__tests__/housing/BrowseTagView.test.tsx`
- Modify: `src/components/housing/pages/BrowsePage.tsx`
- Modify: `src/__tests__/housing/BrowsePage.test.tsx` (または `src/components/housing/pages/__tests__/BrowsePage.test.tsx` — 既存の2ファイルのうち、中央パネルのビュー分岐を検証している方に追記する)

**Interfaces:**
- Consumes: `TagPickerPanel` (Task 9), `useHousingViewStore.setBrowseView` (既存)
- Produces: `BrowseTagView: React.FC` (props無し)。`onApplied` で常に `setBrowseView('list')` を呼ぶ (design §3: マップには戻らない)。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/BrowseTagView.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { BrowseTagView } from '../../components/housing/browse/BrowseTagView';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  listAllPersonalTagsMock.mockReset();
  listAllPersonalTagsMock.mockResolvedValue([]);
  useHousingFilterStore.getState().clearAll();
  useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
  useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
  useHousingViewStore.getState().reset();
  useHousingViewStore.getState().setBrowseView('tags');
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('BrowseTagView', () => {
  it('絞り込むを押すと browseView が list に戻る', async () => {
    wrap(<BrowseTagView />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(useHousingViewStore.getState().browseView).toBe('list');
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/BrowseTagView.test.tsx`
Expected: FAIL (モジュールが存在しない)。

- [ ] **Step 3: `BrowseTagView` を実装し `BrowsePage` に配線する**

`src/components/housing/browse/BrowseTagView.tsx` を新規作成:

```tsx
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { TagPickerPanel } from './tagpicker/TagPickerPanel';

/**
 * 探すページ中央パネル「タグ」ビュー。WorldSelectGate と同じ「中央パネルを丸ごと差し替える」
 * 仕組みで、一覧|マップと並ぶ3つ目のビューとして表示する (design 2026-07-27 §1)。
 * 絞り込み確定後は常に一覧へ戻る (マップには戻らない: 地図はワールド1件に絞られていないと表示できない)。
 */
export const BrowseTagView: React.FC = () => {
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  return (
    <div className="housing-tagpicker-view" data-testid="housing-browse-tag-view">
      <TagPickerPanel onApplied={() => setBrowseView('list')} />
    </div>
  );
};
```

`src/components/housing/pages/BrowsePage.tsx` に3箇所変更する。

まずimportを追加 (24行目 `BrowseMapView` importの直後):

```tsx
import { BrowseMapView } from '../browse/map/BrowseMapView';
import { BrowseTagView } from '../browse/BrowseTagView';
```

`useHousingTagPickerStore` のimportも追加 (30行目 `PERSONAL_TAG_ID_PREFIX` importの直後):

```tsx
import { PERSONAL_TAG_ID_PREFIX } from '../../../constants/housing';
import { useHousingTagPickerStore } from '../../../store/useHousingTagPickerStore';
```

次に、中央パネルのビュー分岐 (192行目) を変更:

```tsx
              {effectiveView === 'tags' ? (
                <BrowseTagView />
              ) : effectiveView === 'map' ? (
                <BrowseMapView filtered={filtered} onAddToTour={addToTray} />
              ) : filtered.length === 0 ? (
                <EmptyResult />
              ) : (
                <ListingGrid
                  listings={sorted}
                  onAddToTour={addToTray}
                  sort={sort}
                  onSortChange={setSort}
                  listKey="browse"
                  sortOrders={['random', 'newest', 'oldest']}
                />
              )}
```

最後に、全体クリアボタン (186行目) が保留中のタグ選択も一緒にクリアするよう変更:

```tsx
                    onClick={() => {
                      useHousingFilterStore.getState().clearAll();
                      useHousingTagPickerStore.getState().clearPending();
                    }}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/BrowseTagView.test.tsx`
Expected: 全件PASS。

続けて既存の `BrowsePage` テスト2ファイルを実行し、回帰が無いことを確認する:

Run: `npx vitest run src/__tests__/housing/BrowsePage.test.tsx src/components/housing/pages/__tests__/BrowsePage.test.tsx`
Expected: 全件PASS (中央パネルの分岐に新しい `'tags'` ケースが増えただけで、既存の `'map'`/`'list'` 分岐ロジックは変更していないため)。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/BrowseTagView.tsx src/__tests__/housing/BrowseTagView.test.tsx src/components/housing/pages/BrowsePage.tsx
git commit -m "$(cat <<'EOF'
feat(housing): 探すページ中央パネルに「タグ」ビューを配線

一覧|マップと同じビュー切替の仕組みでBrowseTagViewを表示。
絞り込み確定後は常に一覧へ戻る。全体クリアボタンは保留中のタグ選択も一緒にクリアする。
EOF
)"
```

---

### Task 12: `FilterPanel` から「テーマ」ドロップダウンを削除

**Files:**
- Modify: `src/components/housing/workspace/FilterPanel.tsx`
- Modify: `src/__tests__/housing/FilterPanel.test.tsx`

**Interfaces:**
- 変更なし (このタスクはUI削除のみ。`FilterPanel` のprops/exportは不変)。

- [ ] **Step 1: 既存テストを新しい期待値に書き換える (先に失敗させる)**

`src/__tests__/housing/FilterPanel.test.tsx` の1つ目のテスト (50〜60行目) を以下に置き換える:

```ts
    it('renders FILTER title and 4 base sections (DC / Region / Area / Size)', () => {
        renderPanel();
        expect(screen.getByText('FILTER')).toBeInTheDocument();
        expect(screen.getAllByText('データセンター').length).toBeGreaterThan(0);
        expect(screen.getByText('地域')).toBeInTheDocument();
        expect(screen.getByText('エリア')).toBeInTheDocument();
        expect(screen.getByText('サイズ')).toBeInTheDocument();
        // テーマドロップダウンは削除済み (探すページの「タグ」ビューに統合)。
        expect(screen.queryByRole('button', { name: 'テーマ' })).toBeNull();
    });
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/FilterPanel.test.tsx`
Expected: FAIL (現状はまだ「テーマ」ドロップダウンが存在するため `queryByRole` が要素を見つけてしまい、`toBeNull()` に反する)。

- [ ] **Step 3: `FilterPanel.tsx` から「テーマ」ドロップダウンを削除する**

`src/components/housing/workspace/FilterPanel.tsx` の10行目 `import { getTagsByKind } from '../../../data/housingTags';` を削除。

28行目 `const THEME_TAG_IDS = new Set(getTagsByKind('theme').map((tag) => tag.id));` を削除。

193〜204行目の `<FilterDropdown label={t('housing.workspace.filter.theme')} ... />` ブロック全体 (サイズセグメントボタンの `</div>` の直後、`{hasActiveFilter && (` の直前) を削除する。

`tags` (50行目) と `toggleTag` (57行目) の購読は、`hasActiveFilter` の算出 (104-106行目、`tags.length > 0` を含む) に引き続き使うため残す。`resultBase` の `applyFilters` 呼び出し (68-71行目) も `tags` をそのまま渡すため変更不要 (探すページの「タグ」ビューで確定した `useHousingFilterStore.tags` を、このパネルの件数バッジにも引き続き反映させるため)。

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/FilterPanel.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/workspace/FilterPanel.tsx src/__tests__/housing/FilterPanel.test.tsx
git commit -m "$(cat <<'EOF'
refactor(housing): FilterPanelから「テーマ」ドロップダウンを削除

探すページの新しい「タグ」ビューに統合されたため。tags状態自体
(hasActiveFilter判定・件数バッジ)は引き続き使うため残す。
EOF
)"
```

---

### Task 13: スマホ `HousingFilterSheet` にインラインのタグ検索を追加

**Files:**
- Modify: `src/components/housing/shell/HousingFilterSheet.tsx`
- Create: `src/__tests__/housing/HousingFilterSheet.test.tsx`

**Interfaces:**
- Consumes: `TagPickerPanel` (Task 9)
- Produces: 変更なし (`HousingFilterSheetProps` は不変)。「テーマ」があった位置に、既存 `FilterDropdown` と同じ見た目のトリガー行 (`housing-filter-select`) を新設し、押すとその場に `TagPickerPanel` をインライン展開する。「絞り込む」を押してもシート自体は閉じず、その場で折りたたまれるだけ。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingFilterSheet.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { HousingFilterSheet } from '../../components/housing/shell/HousingFilterSheet';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  listAllPersonalTagsMock.mockReset();
  listAllPersonalTagsMock.mockResolvedValue([]);
  useHousingFilterStore.getState().clearAll();
  useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
  useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
  useHousingViewStore.getState().reset();
});

const wrap = (ui: React.ReactElement) => render(
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
  </MemoryRouter>,
);

describe('HousingFilterSheet タグ検索 (インライン展開)', () => {
  it('「タグ」トリガーを押すとその場に展開する', async () => {
    wrap(<HousingFilterSheet isOpen onClose={vi.fn()} />);
    expect(screen.queryByText('ハウジンガー')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'タグ' }));
    await waitFor(() => expect(screen.getByText('ハウジンガー')).toBeInTheDocument());
  });

  it('「絞り込む」を押すとその場で折りたたまれるが、シートは閉じない (onCloseが呼ばれない)', async () => {
    const onClose = vi.fn();
    wrap(<HousingFilterSheet isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'タグ' }));
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('ハウジンガー')).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/__tests__/housing/HousingFilterSheet.test.tsx`
Expected: FAIL (「タグ」というトリガーが存在しない)。

- [ ] **Step 3: `HousingFilterSheet.tsx` にインライン展開を実装する**

`src/components/housing/shell/HousingFilterSheet.tsx` の全文を以下に置き換える:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { FilterPanel } from '../workspace/FilterPanel';
import { TagPickerPanel } from '../browse/tagpicker/TagPickerPanel';

export interface HousingFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * スマホ用フィルターシート (Task1: モバイルシェル基盤)。
 * キーワード入力 (PC 版はヘッダー内 .housing-app-search にしかないためここに複製) +
 * 既存 FilterPanel をそのまま流用する (中身は改変しない)。
 * 「テーマ」があった位置には、PC版「タグ」ビューと同じ中身 (TagPickerPanel) を
 * FilterDropdown と同じ見た目のインラインアコーディオンとして追加する
 * (design 2026-07-27-housing-tag-and-search-design.md §5)。
 * 「絞り込む」を押してもこのシート自体は閉じず、その場で折りたたまれるだけ
 * (他のフィルター項目を続けて調整できるように)。
 */
export const HousingFilterSheet: React.FC<HousingFilterSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const keyword = useHousingFilterStore((s) => s.keyword);
  const setKeyword = useHousingFilterStore((s) => s.setKeyword);
  const [tagOpen, setTagOpen] = useState(false);

  // 実機FB#1: 共有シートの白背景 (miti トークン) だと housing の白文字が見えない。
  // title prop はやめて housing 自前ヘッダーにし、className でシート面を housing トンマナ化する。
  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      height="80vh"
      className="housing-mobile-sheet"
      // 実機FB第3弾: 中身の縦スクロールが全面スワイプ閉じと衝突して不安定 → つまみだけで閉じる。
      swipeArea="handle"
    >
      <div className="housing-sheet-head">
        <span className="housing-sheet-title">{t('housing.mobile.filter_title')}</span>
        <button
          type="button"
          className="housing-sheet-close"
          onClick={onClose}
          aria-label={t('housing.card.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <input
        type="search"
        className="housing-app-search-input housing-mobile-filter-search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={t('housing.header.search_placeholder')}
        aria-label={t('housing.header.search_placeholder')}
      />
      <FilterPanel
        hideClose
        onClose={onClose}
        onRegisterClick={() => {
          onClose();
          navigate('/housing/register');
        }}
      />
      <div className="housing-filter-field housing-tagpicker-inline" data-open={tagOpen ? 'true' : 'false'}>
        <span className="housing-filter-field-label">{t('housing.browse.view_tags')}</span>
        <button
          type="button"
          className="housing-filter-select"
          aria-label={t('housing.browse.view_tags')}
          aria-expanded={tagOpen}
          onClick={() => setTagOpen((v) => !v)}
        >
          <span className="housing-filter-select-value">{t('housing.browse.view_tags')}</span>
          <ChevronDown size={15} aria-hidden="true" className="housing-filter-select-chevron" />
        </button>
        {tagOpen && (
          <div className="housing-tagpicker-inline-body">
            <TagPickerPanel onApplied={() => setTagOpen(false)} />
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
};
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run src/__tests__/housing/HousingFilterSheet.test.tsx`
Expected: 全件PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/shell/HousingFilterSheet.tsx src/__tests__/housing/HousingFilterSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): スマホのフィルターシートにインラインのタグ検索を追加

「テーマ」があった位置にFilterDropdownと同じ見た目のトリガーを新設し、
押すとTagPickerPanelをその場に展開。絞り込み確定後はシートを閉じず折りたたむのみ。
EOF
)"
```

---

### Task 14: 最終検証 (build + 全テスト)

**Files:** なし (検証のみ)

- [ ] **Step 1: フルビルドを実行する**

Run: `npm run build`
Expected: exit code 0。TypeScript strict + Lightning CSS がエラー無く通ること (特に `HousingBrowseView` 拡張で他の消費箇所に型エラーが出ていないか、`applyFilters.ts` の新規import `isPersonalTagIdFormat` の循環import等が無いか)。

- [ ] **Step 2: 全テストを実行する**

Run: `npx vitest run`
Expected: 全件PASS。特に以下が回帰していないことを確認する:
- `src/__tests__/housing/BrowsePage.test.tsx`
- `src/components/housing/pages/__tests__/BrowsePage.test.tsx`
- `src/__tests__/housing/BrowseMapView.test.tsx`
- `src/__tests__/housing/FilterPanel.test.tsx`
- `src/__tests__/housing/applyFilters.test.ts`

- [ ] **Step 3: ユーザーへ実機確認を依頼する (このステップはコミット不要)**

以下をユーザーに確認してもらう (memory `feedback_no_screenshots_local_verify` 準拠、目視チェックリストとして引き継ぐ):

- PC: 探すページ中央上部に「一覧 / マップ / タグ」の3タブが出るか
- 「タグ」を押すと中央パネルがハウジンガー/タグ全部の2セクションに切り替わるか、それぞれ折りたためるか
- チップを選んでも即座に一覧が絞り込まれないか (件数プレビューだけ変わるか)
- 「この条件で絞り込む」で一覧に戻り、結果に反映されるか
- ハウジンガーを2人選んだ状態で「絞り込む」を押すと、どちらか一方の家が両方出るか (OR)
- ハウジンガー1人+テーマ1つを選んだ状態で「絞り込む」を押すと、両方満たす家だけに絞られるか (AND)
- スマホ: フィルターシート最下部の「テーマ」が「タグ」に変わり、押すとその場に展開するか。「絞り込む」を押してもシートが閉じず、他のフィルター項目を続けて触れるか
- 左パネルから「テーマ」ドロップダウンが消えているか (PC・スマホシート内FilterPanel両方)

問題があれば該当タスクへ戻って修正する (このタスク自体のコミットは発生しない)。
