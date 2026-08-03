# ハウジング タグ検索: 個人タグ廃止・ownerUidベース化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探すページの「ハウジンガー」名前検索が、タグの有無に関係なくその人が登録した物件を全て返すようにする。あわせて不要になった「個人タグ (`personal_tags`)」という裏側の概念を UI・API・型・Firestore・データの全層から削除する。

**Architecture:** 検索のヒット判定を `listing.tags` 配列の membership チェックから `listing.ownerUid` の直接比較に置き換える。ハウジンガー一覧・「1人選択時のページ導線」は `personal_tags` コレクションではなく `housing_profiles` コレクション(マイページ公開情報)を直接ソースにする。フィルター状態(URL共有・store)で使う `personal_<uid>` という文字列 ID の**見た目は変えない**(既存の `personalTagIdForUid`/`isPersonalTagIdFormat`/`PERSONAL_TAG_ID_PREFIX` を流用)。中身の意味だけ「実在するタグドキュメントの ID」から「ハウジンガーを指す擬似 ID (uid から機械的に逆算可能)」へ変わる。

**Tech Stack:** React + TypeScript (Vite)、Firestore (Admin SDK / Client SDK)、Vercel Serverless Functions (`api/`)、vitest。

**設計書:** `docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md`(承認済み)

## Global Constraints

- 日本語でコメント・コミットメッセージを書く(プロジェクト規約)。
- i18n: UI文字列は必ず翻訳キー経由(ハードコード禁止)。
- 触ってはいけないもの: `.claude/worktrees/**` 配下(前セッションの残骸worktreeに同名ファイルの旧コピーが残っているが無関係、絶対に編集しない)。
- 各タスックの最後に `npx vitest run <対象ファイル>` で対象テストが green であることを確認してからコミットする。
- コミットは日本語メッセージ、`git add` は個別ファイル指定(`-A`/`.` 禁止)。
- Firestore rules/indexes・データ移行スクリプトの本番適用(`firebase deploy --only firestore:rules,firestore:indexes` および `--apply` 付きスクリプト実行)は、コードの実装・テストが全部終わった後、**ユーザーに確認してから**実行する(このタスクは自動実行しない)。

---

### Task 1: ownerUid ベースの判定ヘルパー + applyFilters コア修正

これが今回のユーザー向けコア修正(検索が直る部分)。

**Files:**
- Modify: `src/lib/housing/housingerProfile.ts`
- Modify: `src/lib/housing/applyFilters.ts`
- Test: `src/lib/housing/__tests__/housingerProfile.test.ts`
- Test: `src/__tests__/housing/applyFilters.test.ts`

**Interfaces:**
- Produces: `ownerUidFromPersonalFilterId(filterId: string): string`(`housingerProfile.ts` からexport。`personalTagIdForUid` の逆変換)

- [ ] **Step 1: 失敗するテストを書く (`ownerUidFromPersonalFilterId` の往復変換)**

`src/lib/housing/__tests__/housingerProfile.test.ts` の `describe('resolvePersonalTagId', ...)` ブロック(69-85行目)を、以下の `describe('ownerUidFromPersonalFilterId', ...)` に**置き換える**(`resolvePersonalTagId` は Task 10 で本体ごと削除するため、このテストも同時に置き換える):

```ts
describe('ownerUidFromPersonalFilterId', () => {
  it('personalTagIdForUid の逆変換 (personal_<hex> → hashed:<hex>)', () => {
    expect(ownerUidFromPersonalFilterId('personal_abc123')).toBe('hashed:abc123');
  });

  it('personalTagIdForUid と往復して元の uid に戻る', () => {
    const uid = 'hashed:abc123';
    expect(ownerUidFromPersonalFilterId(personalTagIdForUid(uid))).toBe(uid);
  });
});
```

ファイル冒頭の import を更新(`resolvePersonalTagId` を `ownerUidFromPersonalFilterId` に置換):

```ts
import {
  validateHousingerSnsUrl,
  personalTagIdForUid,
  ownerUidFromPersonalFilterId,
  isValidHousingerReportReason,
  stripHashedPrefix,
  normalizeHousingerUid,
} from '../housingerProfile';
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/housingerProfile.test.ts`
Expected: FAIL (`ownerUidFromPersonalFilterId` が存在しない)

- [ ] **Step 3: `ownerUidFromPersonalFilterId` を実装**

`src/lib/housing/housingerProfile.ts` の `personalTagIdForUid` 関数の直後に追加:

```ts
/**
 * personalTagIdForUid の逆変換。 探すページのタグ検索でハウジンガーを選んだとき、
 * その擬似 ID (`personal_<hex>`) から本来の uid (`hashed:<hex>`) を復元するために使う
 * (applyFilters.ts の ownerUid 判定、 PersonalTagFilterLink.tsx のプロフィール解決)。
 */
export function ownerUidFromPersonalFilterId(filterId: string): string {
  return `hashed:${filterId.replace(/^personal_/, '')}`;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/housingerProfile.test.ts`
Expected: PASS

- [ ] **Step 5: applyFilters のテストを ownerUid ベースに書き換える (失敗するテストを先に書く)**

`src/__tests__/housing/applyFilters.test.ts` の3つの `it('housinger タグ...')` ブロック(60-77行目)を、以下に**置き換える**(重要: 置き換え後のテストは listing の `tags` 配列に `personal_` を**一切含めない** — これが「タグを付けていない物件でもヒットする」という今回の修正の回帰テスト):

```ts
    it('housinger タグ (personal_) は listing.tags ではなく ownerUid で判定する (タグを付けていない物件もヒットする)', () => {
        const a = { ...MOCK_LISTINGS[0], id: 'h-a', ownerUid: 'hashed:taro', tags: [] };
        const b = { ...MOCK_LISTINGS[0], id: 'h-b', ownerUid: 'hashed:hanako', tags: [] };
        const c = { ...MOCK_LISTINGS[0], id: 'h-c', ownerUid: 'hashed:jiro', tags: [] };
        const result = applyFilters([a, b, c], { ...EMPTY, tags: ['personal_taro', 'personal_hanako'] });
        expect(result.map((l) => l.id).sort()).toEqual(['h-a', 'h-b']);
    });

    it('housinger タグを選んだときだけ、他のタグ条件とAND結合になる (ownerUid 判定)', () => {
        const matches = { ...MOCK_LISTINGS[0], id: 'm', ownerUid: 'hashed:taro', tags: ['theme_wafu'] };
        const wrongHousinger = { ...MOCK_LISTINGS[0], id: 'wrong-h', ownerUid: 'hashed:hanako', tags: ['theme_wafu'] };
        const wrongTheme = { ...MOCK_LISTINGS[0], id: 'wrong-t', ownerUid: 'hashed:taro', tags: ['theme_modern'] };
        const result = applyFilters([matches, wrongHousinger, wrongTheme], {
            ...EMPTY,
            tags: ['theme_wafu', 'personal_taro'],
        });
        expect(result.map((l) => l.id)).toEqual(['m']);
    });
```

（3つ目の `it('housinger タグを選んでいなければ...')` は非housingerタグの挙動確認で本修正と無関係のためそのまま残す)

- [ ] **Step 6: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/applyFilters.test.ts`
Expected: FAIL(現状の `listing.tags.includes` 判定では `tags: []` のリスティングはヒットしないため)

- [ ] **Step 7: applyFilters.ts の判定ロジックを変更**

`src/lib/housing/applyFilters.ts` の import に追加:

```ts
import { ownerUidFromPersonalFilterId } from './housingerProfile';
```

37行目を置き換え:

```ts
        // ハウジンガー選択の判定は listing.tags ではなく listing.ownerUid の一致で行う。
        // タグを実際に物件へ付けたかどうかに関係なく、 本人が登録した物件は全てヒットする
        // (2026-08-04 設計変更。 詳細: docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md)。
        if (personalTags.length > 0 && !personalTags.some((t) => listing.ownerUid === ownerUidFromPersonalFilterId(t))) return false;
```

- [ ] **Step 8: テストを実行して全部通ることを確認**

Run: `npx vitest run src/__tests__/housing/applyFilters.test.ts src/lib/housing/__tests__/housingerProfile.test.ts`
Expected: PASS (全件)

- [ ] **Step 9: コミット**

```bash
git add src/lib/housing/housingerProfile.ts src/lib/housing/applyFilters.ts src/lib/housing/__tests__/housingerProfile.test.ts src/__tests__/housing/applyFilters.test.ts
git commit -m "$(cat <<'EOF'
fix(housing): タグ検索のハウジンガー判定をownerUidベースに変更

物件にタグを手動で付けていなくても、登録した本人が名前検索で必ずヒットするようにする。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 物件タグ登録の妥当性検証から personal_ 形式を除外する

listing の `tags` フィールドに `personal_` 形式の値をこれ以上受け付けないようにする(検索は Task 1 で ownerUid ベースになったので、listing 側が personal_ タグを持つ意味がもう無い)。

**Files:**
- Modify: `src/data/housingTags.ts`
- Modify: `api/housing/_registerListingHandler.ts`
- Modify: `api/housing/_updateListingHandler.ts`
- Delete: `api/housing/_personalTagAttachGuard.ts`
- Test: `src/__tests__/housing/housingTags.test.ts`

**Interfaces:**
- Consumes: なし(Task 1 と独立)
- Produces: `isValidTagId(id)` は静的タグのみ true を返す(personal_ 形式は false)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/housingTags.test.ts` の `describe('isValidTagId', ...)` ブロック内、136-138行目を置き換え:

```ts
    it('personal_ 形式の id はもう有効な listing タグではない (2026-08-04: ownerUid ベースの検索に一本化)', () => {
      expect(isValidTagId('personal_yuura')).toBe(false);
    });
```

同ファイル末尾の `PERSONAL_TAG_LIMIT_PER_USER` のテスト(153-155行目)と、冒頭の import (`PERSONAL_TAG_LIMIT_PER_USER`, `PERSONAL_TAG_ID_PREFIX` のうち `PERSONAL_TAG_LIMIT_PER_USER` 部分)を削除する(`PERSONAL_TAG_LIMIT_PER_USER` 定数は Task 12 で削除するため、参照を残さない):

```ts
import { PERSONAL_TAG_ID_PREFIX } from '../../constants/housing';
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/housingTags.test.ts`
Expected: FAIL (`isValidTagId('personal_yuura')` が現状 `true` を返すため)

- [ ] **Step 3: `isValidTagId` を実装変更**

`src/data/housingTags.ts` の145-152行目のコメント+関数を置き換え:

```ts
/**
 * タグ id の構造的妥当性 (静的レジストリに存在するか)。
 * 2026-08-04: ハウジンガー検索は listing.tags ではなく ownerUid ベースの判定に変わったため、
 * personal_ 形式は物件の tags フィールドに書き込める値としてはもう無効。
 * (personal_ 形式の文字列は探すページのフィルター選択状態の中でのみ意味を持つ擬似 ID —
 *  isPersonalTagIdFormat / applyFilters.ts 参照)
 */
export function isValidTagId(id: string): boolean {
  return isStaticTagId(id);
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/__tests__/housing/housingTags.test.ts`
Expected: PASS

- [ ] **Step 5: register/update ハンドラから personal タグガードを削除**

`api/housing/_registerListingHandler.ts`:
- import 行 `import { assertPersonalTagsAttachable, PersonalTagAttachError } from './_personalTagAttachGuard.js';` を削除
- 65-78行目のブロック全体(コメント + try/catch)を削除:

```ts
    // 個人タグ (personal_*) が含まれる場合、 自分の所有かつ非表示でないことを確認する
    // (validateRegistrationDraft は同期関数のため personal_ id は形式チェックのみ)。
    try {
      await assertPersonalTagsAttachable(adminDb, draft.tags ?? [], uid);
    } catch (e) {
      if (e instanceof PersonalTagAttachError) {
        return res.status(400).json({
          error: 'invalid_personal_tag',
          rejectedTagId: e.rejectedTagId,
          reason: e.reason,
        });
      }
      throw e;
    }
```

`api/housing/_updateListingHandler.ts`: 同様に import 行と108-119行目の同型ブロックを削除。

(personal_ 形式の id が `tags` に来た場合は Step 3 の `isValidTagId` 変更により、この削除より手前の `validateRegistrationDraft` の `validateTags` で `{ error: 'invalid_draft', errors: { tags: 'unknown_tag' } }` として弾かれるようになる。 クライアントは Task 7 で personal_ を送らなくなるので実運用では到達しない経路)

- [ ] **Step 6: `_personalTagAttachGuard.ts` を削除**

```bash
rm api/housing/_personalTagAttachGuard.ts
```

- [ ] **Step 7: 関連する既存テストが壊れていないか確認**

Run: `npx vitest run api/housing/__tests__/`
Expected: PASS(`_personalTagAttachGuard` を直接テストするファイルは存在しない想定。 register/update ハンドラの既存テストが `assertPersonalTagsAttachable` の削除で壊れていないか確認し、 もし `invalid_personal_tag` を期待するテストがあれば削除する)

- [ ] **Step 8: コミット**

```bash
git add src/data/housingTags.ts src/__tests__/housing/housingTags.test.ts api/housing/_registerListingHandler.ts api/housing/_updateListingHandler.ts
git rm api/housing/_personalTagAttachGuard.ts
git commit -m "$(cat <<'EOF'
refactor(housing): 物件タグからpersonal_形式の受け付けを廃止

ownerUidベースの検索に一本化したため、物件のtagsフィールドに個人タグを
付ける経路(検証ガード含む)は不要になった。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: housing_profiles に displayNameLower を追加 + 公開ハウジンガー一覧取得関数を新設

**Files:**
- Modify: `src/types/housing.ts`
- Modify: `api/housing/_upsertHousingerProfileHandler.ts`
- Create: `src/lib/housing/publishedHousingers.ts`
- Test: `src/lib/housing/__tests__/publishedHousingers.test.ts` (新規、`personalTagLookup.test.ts` を置き換え)
- (削除は Task 6 末尾で実施): `src/lib/housing/personalTagLookup.ts` / `src/lib/housing/__tests__/personalTagLookup.test.ts`

**Interfaces:**
- Produces: `HousingerProfile.displayNameLower: string`(型に追加)
- Produces: `listPublishedHousingers(max?: number): Promise<PublishedHousinger[]>`、`PublishedHousinger = HousingerProfile & { uid: string }`
- Produces: `stripLeadingSymbolsForSort(s: string): string`(`publishedHousingers.ts` に移設)

- [ ] **Step 1: HousingerProfile 型に displayNameLower を追加**

`src/types/housing.ts` の `HousingerProfile` interface(330-346行目)、`displayName: string;` の直後に追加:

```ts
  /** displayName の小文字正規化 (探すページのハウジンガー一覧クエリの orderBy に使う検索専用フィールド)。 */
  displayNameLower: string;
```

- [ ] **Step 2: upsert ハンドラで displayNameLower を書き込むよう変更**

`api/housing/_upsertHousingerProfileHandler.ts` の `next` オブジェクト(133-150行目)、`displayName,` の直後に追加:

```ts
        displayNameLower: normalizeDisplayNameForSearch(displayName),
```

(import は既存の `normalizeDisplayNameForSearch` をそのまま使う。 このファイルの personal_tags upsert ブロック自体の削除は Task 10 で行う — このタスクでは触らない)

- [ ] **Step 3: 失敗するテストを書く (`publishedHousingers.ts`)**

`src/lib/housing/__tests__/publishedHousingers.test.ts` を新規作成 (`personalTagLookup.test.ts` の `listAllPersonalTags`/`stripLeadingSymbolsForSort` 系テストを移植・改名):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
}));

const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import { listPublishedHousingers, stripLeadingSymbolsForSort } from '../publishedHousingers';

const PROFILE = {
  displayName: 'yuura',
  displayNameLower: 'yuura',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  mockCollection.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockGetDocs.mockReset();
});

describe('listPublishedHousingers', () => {
  it('isPublished==true かつ isModerationHidden==false を displayNameLower 昇順・既定500件でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'hashed:taro', data: () => ({ ...PROFILE, displayName: 'taro', displayNameLower: 'taro' }) },
        { id: 'hashed:hanako', data: () => ({ ...PROFILE, displayName: 'hanako', displayNameLower: 'hanako' }) },
      ],
    });
    const r = await listPublishedHousingers();
    expect(r.map((h) => h.uid)).toEqual(['hashed:hanako', 'hashed:taro']);
    expect(mockWhere).toHaveBeenCalledWith('isPublished', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('isModerationHidden', '==', false);
    expect(mockOrderBy).toHaveBeenCalledWith('displayNameLower');
    expect(mockLimit).toHaveBeenCalledWith(500);
  });

  it('各要素に uid (doc ID) が含まれる', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'hashed:abc', data: () => PROFILE }],
    });
    const r = await listPublishedHousingers();
    expect(r[0].uid).toBe('hashed:abc');
    expect(r[0].displayName).toBe('yuura');
  });

  it('max を指定するとその件数でクエリする', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await listPublishedHousingers(50);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('0件なら空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await listPublishedHousingers();
    expect(r).toEqual([]);
  });

  it('例外時は空配列に丸める', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('permission-denied'));
    const r = await listPublishedHousingers();
    expect(r).toEqual([]);
  });

  it('先頭記号を無視して並び替える', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'hashed:e', data: () => ({ ...PROFILE, displayName: '#Ephemeral_studio', displayNameLower: '#ephemeral_studio' }) },
        { id: 'hashed:a', data: () => ({ ...PROFILE, displayName: 'Ayase', displayNameLower: 'ayase' }) },
        { id: 'hashed:z', data: () => ({ ...PROFILE, displayName: 'Zebra', displayNameLower: 'zebra' }) },
      ],
    });
    const r = await listPublishedHousingers();
    expect(r.map((h) => h.uid)).toEqual(['hashed:a', 'hashed:e', 'hashed:z']);
  });
});

describe('stripLeadingSymbolsForSort', () => {
  it('先頭の記号・アンダースコアを取り除く', () => {
    expect(stripLeadingSymbolsForSort('#ephemeral_studio')).toBe('ephemeral_studio');
    expect(stripLeadingSymbolsForSort('__foo')).toBe('foo');
  });

  it('先頭が既に文字・数字ならそのまま', () => {
    expect(stripLeadingSymbolsForSort('ayase')).toBe('ayase');
  });

  it('記号のみで全て取り除かれる場合は元の文字列にフォールバックする', () => {
    expect(stripLeadingSymbolsForSort('###')).toBe('###');
  });
});
```

- [ ] **Step 4: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/publishedHousingers.test.ts`
Expected: FAIL(`../publishedHousingers` が存在しない)

- [ ] **Step 5: `publishedHousingers.ts` を実装**

`src/lib/housing/publishedHousingers.ts` を新規作成:

```ts
/**
 * housing_profiles コレクションから「マイページを公開しているハウジンガー」を読む。
 *
 * listPublishedHousingers: 全件取得。 探すページ「タグ」ビューのハウジンガーセクション用
 * (design 2026-08-04-housing-tag-search-by-owner-design.md §3.1)。
 * 旧 personal_tags コレクション経由 (personalTagLookup.ts) を置き換える。
 *
 * firestore.rules: `isPublished==true && isModerationHidden==false` の housing_profiles は
 * 誰でも get/list 可能なので、 認証不要の直接読み。
 */
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { HousingerProfile } from '../../types/housing';

const COLLECTION = 'housing_profiles';

export interface PublishedHousinger extends HousingerProfile {
  uid: string;
}

/**
 * 並び替え用に、 先頭の英数字・かな・漢字等 (Unicode の「文字」「数字」カテゴリ) 以外の文字
 * (記号・絵文字・アンダースコア等) を取り除いたキーを作る (personalTagLookup.ts から移設、ロジック不変)。
 */
export function stripLeadingSymbolsForSort(s: string): string {
  const stripped = s.replace(/^[^\p{L}\p{N}]+/u, '');
  return stripped.length > 0 ? stripped : s;
}

export async function listPublishedHousingers(max = 500): Promise<PublishedHousinger[]> {
  try {
    const qref = query(
      collection(db, COLLECTION),
      where('isPublished', '==', true),
      where('isModerationHidden', '==', false),
      orderBy('displayNameLower'),
      limit(max),
    );
    const snap = await getDocs(qref);
    const housingers = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as HousingerProfile) }));
    return housingers.slice().sort((a, b) => (
      stripLeadingSymbolsForSort(a.displayNameLower).localeCompare(stripLeadingSymbolsForSort(b.displayNameLower), 'ja')
    ));
  } catch {
    return [];
  }
}
```

- [ ] **Step 6: テストを実行して通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/publishedHousingers.test.ts`
Expected: PASS

(注: `personalTagLookup.ts` はこの時点ではまだ削除しない — `HousingerTagSection.tsx`(Task 5)と `PersonalTagFilterLink.tsx`(Task 6)がまだそれを import しているため、ここで消すとビルドが壊れる。 削除は最後の消費者を移行し終える Task 6 の末尾で行う)

- [ ] **Step 7: コミット**

```bash
git add src/types/housing.ts api/housing/_upsertHousingerProfileHandler.ts src/lib/housing/publishedHousingers.ts src/lib/housing/__tests__/publishedHousingers.test.ts
git commit -m "$(cat <<'EOF'
feat(housing): 公開ハウジンガー一覧取得をhousing_profiles直読みで新設

personal_tagsコレクション経由(personalTagLookup)の置き換え先として、
displayNameLowerを追加したhousing_profilesから直接一覧取得する関数を追加。
旧ファイルの削除は消費者側の移行完了後(Task 6末尾)に行う。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ヘッダー検索窓のハウジンガー名サジェストを housing_profiles ベースに移行

**発見の経緯(重要)**: 設計時の調査では見落としていたが、`src/components/housing/shell/AppHeader.tsx`(探すページ上部の共通検索窓)が `personalTagApiClient.ts` の `searchPersonalTags` を**実際に使用している**(孤児コンポーネントではない、ライブ機能)。探すページの検索窓にハウジンガー名を打つと候補がドロップダウンで出て、選ぶと `toggleTag(tag.id)` でその人の物件に絞り込む、という「タグピッカーの『ハウジンガー』セクションとは別口の、もう一つの名前検索導線」。`personal_tags` コレクションを廃止する以上、これも `housing_profiles` ベースに移行しないと機能自体が壊れる(検索しても何も出なくなる)。

**Files:**
- Create: `api/housing/_searchHousingersHandler.ts`
- Modify: `api/housing/index.ts`(action 追加。 旧 `search-personal-tags` の削除は Task 9 で別途行う)
- Create: `src/lib/housing/housingerSearchApiClient.ts`
- Modify: `src/components/housing/shell/AppHeader.tsx`
- Test: `src/components/housing/shell/__tests__/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `PublishedHousinger`(Task 3)
- Produces: `searchPublishedHousingers(query: string): Promise<PublishedHousinger[]>`(`housingerSearchApiClient.ts` からexport)

**注記**: この検索は Firestore の prefix range query (`orderBy('displayNameLower').startAt(q).endAt(...)`) を使うため、Task 13 で追加する `housing_profiles` の複合インデックス (`isPublished`/`isModerationHidden`/`displayNameLower`) のデプロイが本番で必要 (テストは Firestore をモックするため影響しない)。

- [ ] **Step 1: サーバーハンドラを新規作成 (`_searchPersonalTagsHandler.ts` のロジックを housing_profiles 向けに移植)**

`api/housing/_searchHousingersHandler.ts` を新規作成:

```ts
/**
 * GET /api/housing?action=search-housingers&q=...
 *
 * マイページ公開中のハウジンガー名を前方一致検索する (ヘッダー検索窓のサジェスト用)。
 * 旧 search-personal-tags (personal_tags コレクション) の置き換え
 * (2026-08-04 設計変更。 detail: docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md)。
 * 認証不要 (公開検索)、 isPublished=true && isModerationHidden=false のみ返す。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';

const COLLECTION = 'housing_profiles';
const MAX_QUERY_LENGTH = 40;
const SEARCH_LIMIT = 20;

/**
 * 前方一致検索の定石 (Firestore に LIKE 演算子は無いため):
 * endAt に Unicode Private Use Area の最終コードポイント (U+F8FF) を付けた文字列を渡すと、
 * 「prefix で始まる文字列すべて」の範囲になる。
 */
function buildPrefixRangeEnd(prefix: string): string {
  return prefix + String.fromCharCode(0xf8ff);
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 公開検索 (認証不要)。 匿名の探すページから呼ばれるため App Check は課さない。 DoW は rate limit で担う。
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    const q = req.query?.q;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({ housingers: [] });
    }
    const normalized = normalizeDisplayNameForSearch(q).slice(0, MAX_QUERY_LENGTH);

    initAdmin();
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection(COLLECTION)
      .where('isPublished', '==', true)
      .where('isModerationHidden', '==', false)
      .orderBy('displayNameLower')
      .startAt(normalized)
      .endAt(buildPrefixRangeEnd(normalized))
      .limit(SEARCH_LIMIT)
      .get();

    const housingers = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    return res.status(200).json({ housingers });
  } catch (error: any) {
    console.error('[housing/search-housingers] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: ルーティングを追加**

`api/housing/index.ts`:
- import を追加: `import searchHousingersHandler from './_searchHousingersHandler.js';`
- `case 'search-personal-tags': return searchPersonalTagsHandler(req, res);` の直後に追加: `case 'search-housingers': return searchHousingersHandler(req, res);`
- 冒頭のコメント一覧に1行追加: ` * ?action=search-housingers          → GET ハウジンガー名検索 (探すページヘッダー検索窓のサジェスト用)`
- default 節のエラーメッセージに `|search-housingers` を追記

- [ ] **Step 3: クライアント関数を新規作成**

`src/lib/housing/housingerSearchApiClient.ts` を新規作成:

```ts
/**
 * /api/housing?action=search-housingers クライアント。
 * ヘッダー検索窓 (AppHeader.tsx) のハウジンガー名サジェスト専用
 * (探すページ「ハウジンガー」チップ一覧の全件取得 = publishedHousingers.ts の直接読みとは別経路。
 *  こちらは検索キーワード単位のサーバーサイド前方一致検索 + rate limit を要するため API 経由)。
 */
import { buildHousingHeaders } from './housingAuthHeaders';
import type { PublishedHousinger } from './publishedHousingers';

export async function searchPublishedHousingers(query: string): Promise<PublishedHousinger[]> {
  const headers = await buildHousingHeaders(false);
  const res = await fetch(`/api/housing?action=search-housingers&q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(`search-housingers failed: ${res.status}`);
  const body = (await res.json()) as { housingers: PublishedHousinger[] };
  return body.housingers;
}
```

(import パスに注意: このファイルは `src/lib/housing/` 直下に置くため `./housingAuthHeaders` で良い。 `personalTagApiClient.ts` は `src/lib/` 直下だったため `./housingAuthHeaders` の相対パスが1階層違う点に注意)

- [ ] **Step 4: 失敗するテストを書く (`AppHeader.tsx` の検索ドロップダウン)**

`src/components/housing/shell/__tests__/AppHeader.test.tsx` に以下を追加(既存の import 群の下、`describe('AppHeader', ...)` の外側にモックを追加してから、新しい `describe` ブロックを追加):

```ts
const searchPublishedHousingersMock = vi.fn();
vi.mock('../../../../lib/housing/housingerSearchApiClient', () => ({
  searchPublishedHousingers: (...args: unknown[]) => searchPublishedHousingersMock(...args),
}));
```

(この `vi.mock` はファイル冒頭、他の `vi.mock` と同じ場所に置く)

`describe('AppHeader', ...)` ブロックの中、既存の2つの `it` の後に追加:

```ts
  it('/housing で検索窓にハウジンガー名を打つと候補が出て、選ぶと絞り込まれる', async () => {
    searchPublishedHousingersMock.mockResolvedValue([
      { uid: 'taro', displayName: 'taro', displayNameLower: 'taro', avatarUrl: null, bio: null, snsUrl: null, isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0 },
    ]);
    renderHeader('/housing');
    const input = screen.getByPlaceholderText('housing.header.search_placeholder');
    fireEvent.change(input, { target: { value: 'taro' } });

    await waitFor(() => {
      expect(searchPublishedHousingersMock).toHaveBeenCalledWith('taro');
    });
    expect(await screen.findByText('housing.header.search_view_homes')).toBeInTheDocument();
  });
```

**注記**: `i18n` はテスト内で `t` を実物のまま使っており、`housing.header.search_view_homes` キーは `{{name}}` 補間を含む(`ja.json` で `"{{name}}さんの家を見る"` のような文言)。`react-i18next` の実装では補間があるとテキストノードが分割されるため、`screen.findByText` は完全一致ではなく `(content) => content.includes('taro')` のような関数マッチャか、`screen.findByRole('button', { name: /taro/ })` を使うこと(実装時に実際のDOM構造を見て調整する)。

- [ ] **Step 5: テストが失敗することを確認**

Run: `npx vitest run src/components/housing/shell/__tests__/AppHeader.test.tsx`
Expected: FAIL(`housingerSearchApiClient` が存在しない)

- [ ] **Step 6: AppHeader.tsx を修正**

`src/components/housing/shell/AppHeader.tsx`:
- 9-10行目を置き換え:

```ts
import { searchPublishedHousingers } from '../../../lib/housing/housingerSearchApiClient';
import type { PublishedHousinger } from '../../../lib/housing/publishedHousingers';
```

- 49行目を置き換え: `const [housingerHits, setHousingerHits] = useState<PersonalTag[]>([]);` → `const [housingerHits, setHousingerHits] = useState<PublishedHousinger[]>([]);`
- 88-92行目(`searchPersonalTags(q)` 呼び出し)を置き換え:

```ts
    debounceRef.current = setTimeout(() => {
      searchPublishedHousingers(q)
        .then((housingers) => setHousingerHits(housingers.slice(0, 5)))
        .catch(() => setHousingerHits([]));
    }, 300);
```

- 150-166行目(候補ドロップダウンの `.map`)を置き換え:

```tsx
              {housingerHits.map((h) => (
                <button
                  key={h.uid}
                  type="button"
                  className="housing-app-search-housinger"
                  onClick={() => {
                    toggleTag(personalTagIdForUid(h.uid));
                    // 名前は listing 本体に無く擬似タグ経由で絞るため、残った検索語で
                    // AND 二重フィルタして 0 件になるのを防ぐ (keyword をクリア)。
                    setKeyword('');
                    setHousingerHits([]);
                    setDropdownOpen(false);
                  }}
                >
                  {t('housing.header.search_view_homes', { name: h.displayName })}
                </button>
              ))}
```

- import に `personalTagIdForUid` を追加: `import { personalTagIdForUid } from '../../../lib/housing/housingerProfile';`

- [ ] **Step 7: テストを実行して通ることを確認**

Run: `npx vitest run src/components/housing/shell/__tests__/AppHeader.test.tsx`
Expected: PASS(全件。 既存の2件も壊れていないこと)

- [ ] **Step 8: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 9: コミット**

```bash
git add api/housing/_searchHousingersHandler.ts api/housing/index.ts src/lib/housing/housingerSearchApiClient.ts src/components/housing/shell/AppHeader.tsx src/components/housing/shell/__tests__/AppHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(housing): ヘッダー検索窓のハウジンガー名サジェストをhousing_profilesベースに移行

personal_tags廃止に伴い、探すページ検索窓の名前サジェスト機能
(search-personal-tags経由)が壊れる前にhousing_profilesベースの
新エンドポイント(search-housingers)へ切り替える。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: HousingerTagSection のデータ取得元を切り替え

**Files:**
- Modify: `src/components/housing/browse/tagpicker/HousingerTagSection.tsx`

**Interfaces:**
- Consumes: `listPublishedHousingers()`, `PublishedHousinger`(Task 3)、`personalTagIdForUid(uid)`(既存、`housingerProfile.ts`)

- [ ] **Step 1: コンポーネントを書き換え**

`src/components/housing/browse/tagpicker/HousingerTagSection.tsx` の全文を置き換え:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listPublishedHousingers, type PublishedHousinger } from '../../../../lib/housing/publishedHousingers';
import { personalTagIdForUid } from '../../../../lib/housing/housingerProfile';
import { HousingerAvatar } from '../../housinger/HousingerAvatar';

export interface HousingerTagSectionProps {
  selected: string[];
  onToggle: (id: string) => void;
}

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * タグ検索「ハウジンガー」セクション。マイページを公開している全員をチップで並べる (検索欄なし)。
 * design 2026-07-27-housing-tag-and-search-design.md §2 / 2026-08-04 個人タグ廃止でデータ元を
 * housing_profiles に変更 (design 2026-08-04-housing-tag-search-by-owner-design.md §3.1)。
 */
export const HousingerTagSection: React.FC<HousingerTagSectionProps> = ({ selected, onToggle }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [housingers, setHousingers] = useState<PublishedHousinger[]>([]);

  useEffect(() => {
    let cancelled = false;
    listPublishedHousingers()
      .then((result) => {
        if (cancelled) return;
        setHousingers(result);
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
          {status === 'ready' && housingers.length === 0 && (
            <div className="housing-tagpicker-status">{t('housing.tagpicker.housinger_empty')}</div>
          )}
          {status === 'ready' && housingers.length > 0 && (
            <div className="housing-tagpicker-chip-grid">
              {housingers.map((h) => {
                const filterId = personalTagIdForUid(h.uid);
                return (
                  <button
                    key={h.uid}
                    type="button"
                    className="housing-tagpicker-chip"
                    data-selected={selected.includes(filterId) ? 'true' : 'false'}
                    onClick={() => onToggle(filterId)}
                  >
                    <HousingerAvatar avatarUrl={h.avatarUrl ?? null} name={h.displayName} className="housing-tagpicker-chip-avatar" />
                    <span>{h.displayName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 既存テストを更新 (`src/__tests__/housing/HousingerTagSection.test.tsx`)**

8-11行目のモックを置き換え:

```ts
const listPublishedHousingersMock = vi.fn();
vi.mock('../../lib/housing/publishedHousingers', () => ({
  listPublishedHousingers: (...args: unknown[]) => listPublishedHousingersMock(...args),
}));
```

25-27行目の `beforeEach` を置き換え:

```ts
beforeEach(() => {
  listPublishedHousingersMock.mockReset();
});
```

31-34行目のテストデータを `PublishedHousinger` 形に置き換え(`id`/`ownerUid` を `uid` に変更。`uid` の値は prefix 無しの `'taro'`/`'hanako'` にすることで、`personalTagIdForUid` が生成する擬似 ID が既存の `'personal_taro'`/`'personal_hanako'` と一致し、以降のアサーションを変更せずに済む):

```ts
const HOUSINGERS = [
  { uid: 'taro', displayName: 'taro', displayNameLower: 'taro', avatarUrl: null, bio: null, snsUrl: null, isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0 },
  { uid: 'hanako', displayName: 'hanako', displayNameLower: 'hanako', avatarUrl: null, bio: null, snsUrl: null, isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0 },
];
```

ファイル内の残り全ての `listAllPersonalTagsMock` を `listPublishedHousingersMock` に、`TAGS` を `HOUSINGERS` に一括置換する(`avatarUrl` を上書きするテスト、例えば61-79行目の `{ ...TAGS[0], avatarUrl: '...' }` は `{ ...HOUSINGERS[0], avatarUrl: '...' }` に読み替え)。アサーション文字列(`'personal_taro'` 等)・画面表示テキスト(`'taro'`/`'hanako'`)・data-testid は変更不要。

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/__tests__/housing/ -t HousingerTagSection` (または該当テストファイルを直接指定)
Expected: PASS

- [ ] **Step 4: 型・ビルドチェック**

Run: `npx tsc -b`
Expected: `HousingerTagSection.tsx` 関連のエラーなし(`personalTagLookup` を参照している他ファイルはまだ Task 6 未実施ならエラーが残るのは想定内)

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/tagpicker/HousingerTagSection.tsx
git add <Step2で更新したテストファイル>
git commit -m "$(cat <<'EOF'
refactor(housing): ハウジンガーチップ一覧をhousing_profiles直読みに変更

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: PersonalTagFilterLink の解決ロジック切り替え

**Files:**
- Modify: `src/components/housing/workspace/PersonalTagFilterLink.tsx`
- Test: `src/__tests__/housing/PersonalTagFilterLink.test.tsx`
- Delete: `src/lib/housing/personalTagLookup.ts`、`src/lib/housing/__tests__/personalTagLookup.test.ts`(最後の消費者の移行完了に伴う削除、Step 5 参照)

**Interfaces:**
- Consumes: `ownerUidFromPersonalFilterId`(Task 1)、`getHousingerProfile(uid)`(既存 `housingerProfileService.ts`)

- [ ] **Step 1: 失敗するテストを書く (モック差し替え)**

`src/__tests__/housing/PersonalTagFilterLink.test.tsx` の10-13行目を置き換え:

```ts
const getHousingerProfileMock = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => getHousingerProfileMock(...args),
}));
```

38-73行目のテスト本体を置き換え:

```tsx
describe('PersonalTagFilterLink', () => {
  beforeEach(() => {
    getHousingerProfileMock.mockReset();
  });

  it('個人タグが選択されていなければ何も表示しない', () => {
    const { container } = renderLink([]);
    expect(container).toBeEmptyDOMElement();
    expect(getHousingerProfileMock).not.toHaveBeenCalled();
  });

  it('個人タグが2つ以上選択されていれば何も表示しない (1つに絞られているときだけ)', () => {
    const { container } = renderLink(['personal_a', 'personal_b']);
    expect(container).toBeEmptyDOMElement();
    expect(getHousingerProfileMock).not.toHaveBeenCalled();
  });

  it('個人タグ1つで絞り込み中なら解決してハウジンガーページへのリンクを出す', async () => {
    getHousingerProfileMock.mockResolvedValue({
      displayName: 'yuura', avatarUrl: null, bio: null, snsUrl: null,
      isPublished: true, isModerationHidden: false, reportCount: 0, createdAt: 0, updatedAt: 0,
      displayNameLower: 'yuura',
    });
    renderLink(['personal_abc123']);

    const link = await screen.findByRole('link', { name: /yuura.*ハウジンガーページを見る/ });
    expect(link).toHaveAttribute('href', '/housing/housinger/abc123');
    expect(getHousingerProfileMock).toHaveBeenCalledWith('hashed:abc123');
  });

  it('プロフィール解決に失敗 (null、非公開等) したら何も表示しない', async () => {
    getHousingerProfileMock.mockResolvedValue(null);
    const { container } = renderLink(['personal_gone']);
    await waitFor(() => {
      expect(getHousingerProfileMock).toHaveBeenCalledWith('hashed:gone');
    });
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/PersonalTagFilterLink.test.tsx`
Expected: FAIL

- [ ] **Step 3: コンポーネントを書き換え**

`src/components/housing/workspace/PersonalTagFilterLink.tsx` の全文を置き換え:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getHousingerProfile } from '../../../lib/housing/housingerProfileService';
import { ownerUidFromPersonalFilterId, stripHashedPrefix } from '../../../lib/housing/housingerProfile';
import type { HousingerProfile } from '../../../types/housing';

export interface PersonalTagFilterLinkProps {
  /** 探すページのタグフィルタのうち personal_ prefix のもの (FilterPanel/BrowsePage と同じ抽出)。 */
  tagIds: string[];
}

/**
 * 探すページで個人タグ 1 つに絞り込んでいるとき、結果一覧の上に
 * 「{{name}} のハウジンガーページを見る →」リンクを出す
 * (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
 *
 * 2 つ以上選択されている状態は「絞り込み中」の意味が薄れる (どちらのページ?) ため、
 * ちょうど 1 つのときだけ表示する。 擬似タグ ID → uid の変換は ownerUidFromPersonalFilterId
 * (2026-08-04: personal_tags 廃止に伴い、housing_profiles を直接読むように変更)。
 */
export const PersonalTagFilterLink: React.FC<PersonalTagFilterLinkProps> = ({ tagIds }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const soleTagId = tagIds.length === 1 ? tagIds[0] : null;
  const ownerUid = soleTagId ? ownerUidFromPersonalFilterId(soleTagId) : null;

  useEffect(() => {
    if (!ownerUid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getHousingerProfile(ownerUid).then((result) => {
      if (!cancelled) setProfile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerUid]);

  if (!ownerUid || !profile) return null;

  return (
    <Link to={`/housing/housinger/${stripHashedPrefix(ownerUid)}`} className="housing-personal-tag-filter-link">
      {t('housing.housinger.viewPage', { name: profile.displayName })}
    </Link>
  );
};
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run src/__tests__/housing/PersonalTagFilterLink.test.tsx`
Expected: PASS

- [ ] **Step 5: 旧 personalTagLookup.ts を削除 (最後の消費者だったため、ここで安全に削除できる)**

```bash
grep -rn "personalTagLookup" src/ --include=*.ts --include=*.tsx
```

Expected: ヒットなし(Task 3/5/6 で全消費者を `publishedHousingers.ts`/`housingerProfileService.ts` に移行済みのはず)。ヒットが無いことを確認したら削除:

```bash
rm src/lib/housing/personalTagLookup.ts src/lib/housing/__tests__/personalTagLookup.test.ts
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/workspace/PersonalTagFilterLink.tsx src/__tests__/housing/PersonalTagFilterLink.test.tsx
git rm src/lib/housing/personalTagLookup.ts src/lib/housing/__tests__/personalTagLookup.test.ts
git commit -m "$(cat <<'EOF'
refactor(housing): PersonalTagFilterLinkの名前解決をhousing_profiles直読みに変更

最後の消費者だった旧personalTagLookup.tsをあわせて削除。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 物件登録・編集画面から「個人タグを付ける」操作を撤去

**Files:**
- Modify: `src/components/housing/register/HousingRegisterTagPicker.tsx`
- Delete: `src/components/housing/register/usePersonalTag.ts`
- Test: `src/__tests__/housing/HousingRegisterTagPicker.test.tsx`

**Interfaces:**
- Consumes: `STATIC_HOUSING_TAG_KINDS`(既存 `data/housingTags.ts`)

- [ ] **Step 1: テストから「個人タブ」関連を削除**

`src/__tests__/housing/HousingRegisterTagPicker.test.tsx`:
- 8-11行目 (`getMyPersonalTagMock` の定義と `vi.mock('../../lib/personalTagApiClient', ...)`) を削除
- `beforeEach` 内 15-16行目 (`getMyPersonalTagMock.mockReset(); getMyPersonalTagMock.mockResolvedValue(null);`) を削除
- `describe('個人タブ', ...)` ブロック全体(71-135行目)を削除

- [ ] **Step 2: 残ったテストを実行 (この時点ではまだ本体未変更なので green のはず)**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTagPicker.test.tsx`
Expected: PASS(削除しただけなので影響なし。 次のステップでコンポーネント変更後にもう一度確認する)

- [ ] **Step 3: コンポーネント本体を書き換え**

`src/components/housing/register/HousingRegisterTagPicker.tsx` の全文を置き換え:

```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HOUSING_TAGS,
  STATIC_HOUSING_TAG_KINDS,
  type StaticHousingTagKind,
} from '../../../data/housingTags';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * kind タブ (公式/季節/テーマ/初心者) + 検索 + 選択 chips のコンパクトピッカー。
 * タブ列は STATIC_HOUSING_TAG_KINDS (レジストリ) から導出、 kind 名の switch 分岐は書かない。
 * 2026-08-04: 「個人」タブを撤去 (ハウジンガー名検索は ownerUid ベースの自動判定になり、
 * 物件ごとに手動でタグを付ける操作が不要になったため)。
 */
export const HousingRegisterTagPicker: React.FC<Props> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const isFull = selected.length >= HOUSING_LIMITS.MAX_TAGS_PER_LISTING;
  const [activeKind, setActiveKind] = useState<StaticHousingTagKind>(STATIC_HOUSING_TAG_KINDS[0]);
  const [query, setQuery] = useState('');

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onChange([...selected, id]);
    }
  };

  // 検索中: 静的タグ (公式/季節/テーマ/初心者) を横断、 マッチを翻訳済み表示名でフィルタ。
  const visibleTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return HOUSING_TAGS.filter((tag) => {
        const label = String(t(tag.i18nKey, { defaultValue: tag.id })).toLowerCase();
        return tag.id.includes(q) || label.includes(q);
      });
    }
    return HOUSING_TAGS.filter((tag) => tag.kind === activeKind);
  }, [query, activeKind, t]);

  const selectedStaticTags = useMemo(
    () => selected.map((id) => HOUSING_TAGS.find((tag) => tag.id === id)).filter(Boolean) as typeof HOUSING_TAGS,
    [selected],
  );
  const selectedCount = selectedStaticTags.length;

  return (
    <div className="housing-tag-picker">
      <div className="housing-tag-picker-selected" aria-label={t('housing.register.selected_tags')}>
        {selectedCount === 0 && (
          <span className="housing-tag-picker-counter">
            {t('housing.register.tag_pick_hint', { max: HOUSING_LIMITS.MAX_TAGS_PER_LISTING })}
          </span>
        )}
        {selectedStaticTags.map((tag) => (
          <span key={tag.id} className="housing-tag-chip">
            {t(tag.i18nKey)}
            <button
              type="button"
              aria-label={t('housing.register.remove_tag')}
              onClick={() => toggle(tag.id)}
              className="housing-tag-chip-remove"
            >
              ×
            </button>
          </span>
        ))}
        {selectedCount > 0 && (
          <span className="housing-tag-picker-counter">
            {selected.length} / {HOUSING_LIMITS.MAX_TAGS_PER_LISTING}
          </span>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('housing.register.tag_search_placeholder')}
        className="housing-input housing-tag-picker-search"
      />

      {!query && (
        <div className="housing-tag-picker-tabs" role="tablist">
          {STATIC_HOUSING_TAG_KINDS.map((kind) => (
            <button
              key={kind}
              role="tab"
              type="button"
              aria-selected={activeKind === kind}
              onClick={() => setActiveKind(kind)}
              className="housing-tag-picker-tab"
            >
              {t(`housing.register.tag_kind.${kind}`)}
            </button>
          ))}
        </div>
      )}

      <div className="housing-tag-picker-list">
        {visibleTags.length === 0 ? (
          <div className="housing-tag-picker-empty">
            {t('housing.register.tag_no_results')}
          </div>
        ) : (
          visibleTags.map((tag) => {
            const sel = selected.includes(tag.id);
            const disabled = !sel && isFull;
            return (
              <button
                key={tag.id}
                type="button"
                disabled={disabled}
                aria-pressed={sel}
                onClick={() => toggle(tag.id)}
                className="housing-tag-picker-option"
              >
                {t(tag.i18nKey)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: 旧フックを削除**

```bash
rm src/components/housing/register/usePersonalTag.ts
```

- [ ] **Step 5: テストを実行して通ることを確認**

Run: `npx vitest run src/__tests__/housing/HousingRegisterTagPicker.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: コミット**

```bash
git add src/components/housing/register/HousingRegisterTagPicker.tsx src/__tests__/housing/HousingRegisterTagPicker.test.tsx
git rm src/components/housing/register/usePersonalTag.ts
git commit -m "$(cat <<'EOF'
refactor(housing): 物件登録画面から個人タグ手動付与UIを撤去

ハウジンガー名検索がownerUidベースの自動判定になったため、
物件ごとに「個人タグを付ける」チェックを入れる操作が不要になった。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 物件詳細ページのタグ欄から個人名チップを撤去

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx`
- Test: `src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`

- [ ] **Step 1: テストから個人タグ関連を削除**

`src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`:
- 29-34行目 (`vi.mock('../../housinger/HousingerByline', ...)`) は byline 自体のモックなので**残す**
- 36-40行目 (`mockUseHousingerProfile` の定義と `vi.mock('../../housinger/useHousingerProfile', ...)`) を削除
- `beforeEach` 内 74-75行目 (`mockUseHousingerProfile.mockReset(); mockUseHousingerProfile.mockReturnValue(...)`) を削除
- 98-112行目 `it('個人タグはオーナーの公開プロフィールがあれば displayName で表示される', ...)` を削除
- 114-126行目 `it('個人タグはオーナー非公開 (profile=null) のとき chip を出さない', ...)` を削除
- 258-271行目 `it('個人タグをクリックしても toggleTag(id) (生 personal_ 形式) が呼ばれる', ...)` を削除
- 128-134行目 `it('未知の旧 id は描画せずクラッシュしない...')` はそのまま残す(静的タグのみのテストとして引き続き有効)

- [ ] **Step 2: 本体を修正**

`src/components/housing/listing/HousingDetailContent.tsx`:
- 24行目 `import { useHousingerProfile } from '../housinger/useHousingerProfile';` を削除
- 25行目を変更: `import { getTagById, isPersonalTagIdFormat } from '../../../data/housingTags';` → `import { getTagById } from '../../../data/housingTags';`
- 92-113行目の `resolvedTags` 計算ブロックを置き換え:

```ts
  // タグは静的レジストリ (official/season/theme/beginner) のみ描画する。
  // 2026-08-04: 個人タグ (personal_) はハウジンガー名検索が ownerUid ベースの自動判定になった
  // ため撤去 (同じ情報は上の HousingerByline に一本化済み)。
  // 未知の旧 id (静的レジストリに無い文字列) は描画しない (生 id 露出とクラッシュを防ぐ)。
  const resolvedTags = useMemo(
    () =>
      listing.tags.flatMap((tag) => {
        const staticTag = getTagById(tag);
        return staticTag ? [{ id: tag, label: t(staticTag.i18nKey) }] : [];
      }),
    [listing.tags, t],
  );
```

(`useHousingerProfile(listing.ownerUid)` の呼び出しと `ownerProfile` 変数はこのブロックにしか使われていないため、まとめて削除される)

- [ ] **Step 3: テストを実行**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`
Expected: PASS(全件)

- [ ] **Step 4: 型チェック**

Run: `npx tsc -b`
Expected: このファイル由来のエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/listing/HousingDetailContent.tsx src/components/housing/listing/__tests__/HousingDetailContent.test.tsx
git commit -m "$(cat <<'EOF'
refactor(housing): 物件詳細のタグ欄から個人名チップを撤去

投稿者名は既にHousingerBylineで表示済みのため、タグ欄への重複表示をやめる。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 個人タグ関連の公開APIエンドポイント + 孤児コンポーネントを削除

**Files:**
- Delete: `api/housing/_myPersonalTagHandler.ts`
- Delete: `api/housing/_searchPersonalTagsHandler.ts`
- Delete: `api/housing/_reportPersonalTagHandler.ts`
- Modify: `api/housing/index.ts`
- Delete: `src/lib/personalTagApiClient.ts`
- Delete: `src/components/housing/workspace/PersonalTagFilter.tsx`、`src/__tests__/housing/PersonalTagFilter.test.tsx`(`personalTagApiClient.ts` の最後の消費者。 孤児コンポーネントでどの画面からもマウントされていない — 2026-07-27 設計書でも既知)

**Interfaces:**
- Consumes: なし(Task 7 で `usePersonalTag.ts` を既に削除済みのため、`personalTagApiClient.ts` の消費者は `PersonalTagFilter.tsx` のみ残っている)

- [ ] **Step 1: 呼び出し元を確認**

Run: `grep -rln "personalTagApiClient\|my-personal-tag\|search-personal-tags\|report-personal-tag" src/ --include=*.tsx --include=*.ts`
Expected: `api/housing/index.ts` と `src/components/housing/workspace/PersonalTagFilter.tsx` の2件のみ(後者は本タスクでファイルごと削除するので問題ない。 他にヒットがあれば対応漏れとして先に洗い出す)

- [ ] **Step 2: api/housing/index.ts からルーティングを削除**

`api/housing/index.ts`:
- import 行3つ(`myPersonalTagHandler`/`searchPersonalTagsHandler`/`reportPersonalTagHandler`)を削除
- `case 'my-personal-tag': ... case 'search-personal-tags': ... case 'report-personal-tag': ...` の3ブロックを削除
- ファイル冒頭のコメント一覧(22-26行目付近)から該当3行を削除
- default 節のエラーメッセージ文字列から `my-personal-tag|search-personal-tags|report-personal-tag|` を削除

- [ ] **Step 3: ハンドラファイル + クライアント + 孤児コンポーネントを削除**

```bash
rm api/housing/_myPersonalTagHandler.ts api/housing/_searchPersonalTagsHandler.ts api/housing/_reportPersonalTagHandler.ts src/lib/personalTagApiClient.ts
rm src/components/housing/workspace/PersonalTagFilter.tsx src/__tests__/housing/PersonalTagFilter.test.tsx
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc -b`
Expected: エラーなし(この時点で src 側の personal_tags 関連参照はほぼ無くなっているはず)

- [ ] **Step 5: コミット**

```bash
git add api/housing/index.ts
git rm api/housing/_myPersonalTagHandler.ts api/housing/_searchPersonalTagsHandler.ts api/housing/_reportPersonalTagHandler.ts src/lib/personalTagApiClient.ts
git rm src/components/housing/workspace/PersonalTagFilter.tsx src/__tests__/housing/PersonalTagFilter.test.tsx
git commit -m "$(cat <<'EOF'
refactor(housing): 個人タグ関連の公開APIエンドポイントと孤児コンポーネントを削除

my-personal-tag/search-personal-tags/report-personal-tagはどの画面からも
呼ばれなくなったため削除。その最後の消費者だった孤児コンポーネント
PersonalTagFilter.tsx(どこにもマウントされていない)もあわせて削除。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: upsert-housinger-profile と housinger-reports から personal_tags 同期を撤去

**Files:**
- Modify: `api/housing/_upsertHousingerProfileHandler.ts`
- Modify: `api/admin/_housingerReportsHandler.ts`
- Delete: `api/admin/__tests__/housingerReportsHandler.test.ts`
- Modify: `src/lib/housing/housingerProfile.ts`(`resolvePersonalTagId` 削除)
- Test: `src/lib/housing/__tests__/housingerProfile.test.ts`(Task 1 で既に `resolvePersonalTagId` のテストは置き換え済みのため、このタスクでは追加変更なし)

- [ ] **Step 1: upsert ハンドラから personal_tags upsert ブロックを削除**

`api/housing/_upsertHousingerProfileHandler.ts`:

冒頭のコメント + import 行(1-27行目)を置き換え:

```ts
/**
 * POST /api/housing?action=upsert-housinger-profile
 *
 * ハウジンガー公開プロフィールの公開/更新/非公開/同期を 1 本で扱うハンドラ
 * (spec: docs/superpowers/specs/2026-07-10-housinger-profile-design.md §3.2/§3.3)。
 *
 * 常に「users/{uid} の現在値を読んで housing_profiles/{uid} へ転記」する。
 * 名前・アイコンは body で受け取らない (サーバーが users/{uid} から読む = 改ざん不可)。
 * body の isPublished/bio/snsUrl は差分指定 (undefined = 現状維持) のため、
 * 空 body での呼び出しは「名前・アイコン変更後の同期」として機能する (冪等)。
 *
 * 2026-08-04: 個人タグ (personal_tags) への転記は廃止 (ハウジンガー名検索は ownerUid ベースの
 * 判定に一本化されたため、 personal_tags コレクション自体が不要になった)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import {
  HOUSINGER_BIO_MAX_LENGTH,
  validateHousingerSnsUrl,
} from '../../src/lib/housing/housingerProfile.js';
import { normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';
```

- `const tagsCol = adminDb.collection('personal_tags');` 行を削除
- トランザクション内、`tx.set(profileRef, next);` の後に続く personal_tags 関連ブロック(153-171行目、`// 個人タグは同一 tx で...` コメントから `tx.set(tagRef, {...}, { merge: true });` まで)を丸ごと削除

- [ ] **Step 2: 既存テストを確認**

Run: `npx vitest run api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: PASS(このテストは `validateUpsertBody` のみを対象にしており personal_tags 削除の影響を受けない)

- [ ] **Step 3: housinger-reports ハンドラから personal_tags 同期を撤去**

`api/admin/_housingerReportsHandler.ts`:
- import 行 `import { resolvePersonalTagId } from '../../src/lib/housing/housingerProfile.js';` を削除
- ファイル冒頭コメントの `PATCH ?resource=housinger_reports&action=hide` 節(12-15行目)から personal_tags 同期の説明を削除し、「強制非公開: isModerationHidden=true のみ」に更新。`action=restore` 節(16-17行目)も同様に更新
- `hide` アクションの実装(167-186行目)を以下に置き換え:

```ts
      if (action === 'hide') {
        await db.runTransaction(async (tx) => {
          const profileSnap = await tx.get(profileRef);
          if (!profileSnap.exists) throw new Error('not_found');
          tx.update(profileRef, { isModerationHidden: true, updatedAt: Date.now() });
        });
        return res.status(200).json({ success: true });
      }
```

- `restore` アクションの実装(189-205行目)を以下に置き換え:

```ts
      if (action === 'restore') {
        await db.runTransaction(async (tx) => {
          const profileSnap = await tx.get(profileRef);
          if (!profileSnap.exists) throw new Error('not_found');
          tx.update(profileRef, { isModerationHidden: false, updatedAt: Date.now() });
        });
        return res.status(200).json({ success: true });
      }
```

- `const tagsCol = db.collection('personal_tags');` 行(165行目)を削除

- [ ] **Step 4: 個人タグ同期テストを削除**

```bash
rm api/admin/__tests__/housingerReportsHandler.test.ts
```

(このファイルの全テストが personal_tags 同期の検証だったため、 同期処理の削除に伴いテスト自体が意味を失う。 hide/restore の基本動作 — isModerationHidden の更新自体 — をカバーする既存テストが他に無ければ、 このタスクの Step 5 で確認する)

- [ ] **Step 5: hide/restore の基本動作テストの有無を確認、無ければ追加**

Run: `grep -rl "_housingerReportsHandler\|housinger_reports" api/admin/__tests__/`
既存テストが無ければ、`api/admin/__tests__/housingerReportsHandler.test.ts` を新規に以下の内容で作り直す(personal_tags 抜きの基本動作のみ):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAdmin, mockInitAdmin, mockGetAdminFirestore } = vi.hoisted(() => ({
  mockVerifyAdmin: vi.fn(),
  mockInitAdmin: vi.fn(),
  mockGetAdminFirestore: vi.fn(),
}));

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: mockInitAdmin,
  verifyAdmin: mockVerifyAdmin,
  getAdminFirestore: mockGetAdminFirestore,
}));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));

import handler from '../_housingerReportsHandler.js';

type Row = Record<string, any>;

function createFakeAdminFirestore(seed: { housing_profiles?: Record<string, Row> }) {
  const store = { housing_profiles: new Map(Object.entries(seed.housing_profiles ?? {})) };
  function makeDocRef(id: string) { return { __kind: 'doc', id }; }
  function readDoc(ref: any) {
    const data = store.housing_profiles.get(ref.id);
    return { exists: data !== undefined, id: ref.id, data: () => (data ? { ...data } : undefined) };
  }
  const tx = {
    get(ref: any) { return Promise.resolve(readDoc(ref)); },
    update(ref: any, data: Row) {
      const prev = store.housing_profiles.get(ref.id);
      if (prev === undefined) throw new Error(`no doc ${ref.id}`);
      store.housing_profiles.set(ref.id, { ...prev, ...data });
    },
  };
  return {
    collection() {
      return { doc: (id: string) => makeDocRef(id), where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
    },
    async runTransaction(fn: (tx: any) => Promise<any>) { return fn(tx); },
    __getDoc(id: string) { return store.housing_profiles.get(id); },
  };
}

function makeReq(overrides: Row = {}): any {
  return { method: 'PATCH', headers: {}, query: {}, ...overrides };
}
function makeRes(): any {
  const res: any = { statusCode: 200, body: undefined };
  res.setHeader = vi.fn();
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn((p: any) => { res.body = p; return res; });
  res.end = vi.fn(() => res);
  return res;
}

describe('_housingerReportsHandler PATCH hide/restore', () => {
  beforeEach(() => {
    mockVerifyAdmin.mockReset();
    mockVerifyAdmin.mockResolvedValue('admin-uid-1');
    mockInitAdmin.mockReset();
    mockGetAdminFirestore.mockReset();
  });

  it('hide で isModerationHidden=true になる', async () => {
    const uid = 'hashed:abc123';
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: false, reportCount: 0 } },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid } }), res);
    expect(res.statusCode).toBe(200);
    expect(db.__getDoc(uid)?.isModerationHidden).toBe(true);
  });

  it('restore で isModerationHidden=false になる', async () => {
    const uid = 'hashed:abc123';
    const db = createFakeAdminFirestore({
      housing_profiles: { [uid]: { displayName: 'Taro', isPublished: true, isModerationHidden: true, reportCount: 0 } },
    });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'restore', uid } }), res);
    expect(res.statusCode).toBe(200);
    expect(db.__getDoc(uid)?.isModerationHidden).toBe(false);
  });

  it('存在しない uid は 404', async () => {
    const db = createFakeAdminFirestore({ housing_profiles: {} });
    mockGetAdminFirestore.mockReturnValue(db);
    const res = makeRes();
    await handler(makeReq({ query: { resource: 'housinger_reports', action: 'hide', uid: 'hashed:nope' } }), res);
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 6: テスト実行**

Run: `npx vitest run api/admin/__tests__/housingerReportsHandler.test.ts api/housing/__tests__/upsertHousingerProfile.test.ts`
Expected: PASS

- [ ] **Step 7: `resolvePersonalTagId` を `housingerProfile.ts` から削除**

`src/lib/housing/housingerProfile.ts` の `resolvePersonalTagId` 関数とその docblock(63-82行目)を削除する(Task 1 で既にこの関数を使うテストは置き換え済み)。

- [ ] **Step 8: テスト再実行**

Run: `npx vitest run src/lib/housing/__tests__/housingerProfile.test.ts`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add api/housing/_upsertHousingerProfileHandler.ts api/admin/_housingerReportsHandler.ts src/lib/housing/housingerProfile.ts
git add api/admin/__tests__/housingerReportsHandler.test.ts
git commit -m "$(cat <<'EOF'
refactor(housing): upsert-housinger-profile/housinger-reportsからpersonal_tags同期を撤去

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: 管理画面の「個人タグ通報」ページを削除

**Files:**
- Delete: `src/components/admin/AdminPersonalTags.tsx`
- Delete: `api/admin/_personalTagsHandler.ts`
- Modify: `api/admin/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: ルーティング・ナビ・API dispatch を修正**

`src/App.tsx`: import 行 `import { AdminPersonalTags } from './components/admin/AdminPersonalTags';` と `<Route path="personal-tags" element={<AdminPersonalTags />} />` を削除。

`src/components/admin/AdminLayout.tsx`: `NAV_ITEMS` から `{ path: '/admin/personal-tags', labelKey: 'admin.personal_tags.title', end: false },` を削除。

`api/admin/index.ts`: import 行 `import personalTagsHandler from './_personalTagsHandler.js';`、`case 'personal_tags': return personalTagsHandler(req, res);`、冒頭コメントの該当行、default節エラーメッセージの `personal_tags|` を削除。

- [ ] **Step 2: ファイル削除**

```bash
rm src/components/admin/AdminPersonalTags.tsx api/admin/_personalTagsHandler.ts
```

- [ ] **Step 3: 既存テストの確認**

Run: `grep -rl "AdminPersonalTags\|_personalTagsHandler" src/ api/`
Expected: ヒットなし(あれば該当テストファイルも削除)

- [ ] **Step 4: ビルド確認**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx src/components/admin/AdminLayout.tsx api/admin/index.ts
git rm src/components/admin/AdminPersonalTags.tsx api/admin/_personalTagsHandler.ts
git commit -m "$(cat <<'EOF'
refactor(admin): 個人タグ通報管理ページを削除

該当の通報経路(report-personal-tag)は既にどの画面からも
呼ばれなくなっているため、対応する管理画面も撤去する。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: 残った個人タグ関連の型・定数・データ層を削除

**Files:**
- Modify: `src/types/housing.ts`(`PersonalTag`/`PersonalTagReport` 削除)
- Modify: `src/constants/housing.ts`(`PERSONAL_TAG_LIMIT_PER_USER`/`PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH`/`PERSONAL_TAG_SEARCH_LIMIT` 削除、`PERSONAL_TAG_ID_PREFIX` は残す)
- Modify: `src/data/personalTags.ts`(`normalizeDisplayNameForSearch` 以外を削除)
- Modify: `src/utils/housingValidation.ts`(`validatePersonalTagDisplayName` 削除)
- Delete: `src/__tests__/housing/personalTags.test.ts`

- [ ] **Step 1: 型を削除**

`src/types/housing.ts` から `PersonalTag` interface(298-316行目)と `PersonalTagReport` interface(318-324行目、直前の見出しコメント含む)を削除。

- [ ] **Step 2: 定数を削除**

`src/constants/housing.ts` から `PERSONAL_TAG_LIMIT_PER_USER`(42-47行目)・`PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH`(49-50行目)・`PERSONAL_TAG_SEARCH_LIMIT`(52-53行目)を削除。`PERSONAL_TAG_ID_PREFIX`(39-40行目)は `BrowsePage.tsx` が使い続けるため残す(コメントを「ハウジンガー選択の擬似ID prefix」に更新)。

- [ ] **Step 3: data/personalTags.ts を整理**

`src/data/personalTags.ts` から `buildPersonalTagId`・`slugifyDisplayName`・`defaultRandomSuffix`・`RANDOM_SUFFIX_CHARS`・`SLUG_INVALID_CHARS`・`canCreatePersonalTag`・`evaluatePersonalTagAttach`・`PersonalTagAttachRejection`・`PersonalTagAttachResult`・`computePersonalTagReportOutcome` を削除し、`normalizeDisplayNameForSearch` のみ残す:

```ts
/**
 * 表示名の検索用正規化。
 * housing_profiles の displayNameLower に保存する (探すページのハウジンガー一覧クエリ用)。
 */
export function normalizeDisplayNameForSearch(displayName: string): string {
  return displayName.trim().toLowerCase();
}
```

(冒頭の import `PERSONAL_TAG_ID_PREFIX` / `PersonalTag` 型も不要になるため削除)

- [ ] **Step 4: validatePersonalTagDisplayName を削除**

`src/utils/housingValidation.ts` から `validatePersonalTagDisplayName` 関数とその docblock を削除。

- [ ] **Step 5: 不要になったテストファイルを削除**

```bash
rm src/__tests__/housing/personalTags.test.ts
```

(`PersonalTagFilter.tsx` とそのテストは Task 9 で既に削除済み)

- [ ] **Step 6: 全体ビルド + テスト確認**

Run: `npx tsc -b`
Expected: エラーなし

Run: `npx vitest run src/ api/`
Expected: PASS(personal_tags 関連の残骸テストが無いこと)

- [ ] **Step 7: コミット**

```bash
git add src/types/housing.ts src/constants/housing.ts src/data/personalTags.ts src/utils/housingValidation.ts
git rm src/__tests__/housing/personalTags.test.ts
git commit -m "$(cat <<'EOF'
refactor(housing): 個人タグの残存型・定数・データ層を削除

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Firestore rules・indexes を更新

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: personal_tags の rules ブロックを削除**

`firestore.rules` から `match /personal_tags/{tagId} { ... }` ブロック(551-567行目、直前の見出しコメント含む)を削除。

- [ ] **Step 2: indexes を更新**

`firestore.indexes.json` から `personal_tags` の複合インデックス(88-94行目)を削除し、代わりに `housing_profiles` 用を追加:

```json
    {
      "collectionGroup": "housing_profiles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isPublished", "order": "ASCENDING" },
        { "fieldPath": "isModerationHidden", "order": "ASCENDING" },
        { "fieldPath": "displayNameLower", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 2.5: JSON構文確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf-8'))"`
Expected: エラーなし(構文的に壊れていないことの機械チェック)

- [ ] **Step 3: コミット (この時点ではデプロイしない)**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "$(cat <<'EOF'
chore(firestore): personal_tagsのrules/indexを削除しhousing_profiles用indexを追加

反映(firebase deploy --only firestore:rules,firestore:indexes)は
コード側の全タスク完了後、ユーザー確認の上で別途実行する。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**注記(実行者向け):** このタスクではコミットのみ行い、`firebase deploy --only firestore:rules,firestore:indexes` は実行しない。全タスク完了後、ユーザーに確認してからデプロイする(rules/indexes の本番反映はロールバックしづらい変更のため)。

---

### Task 14: i18n キーの削除 (5ロケール共通)

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/zh-Hant.json`

各ファイルで以下のキーを削除する(キーパスは全ロケール共通、`ja.json` で実測済みの構造は下記の通り)。**textual edit(該当ブロックのみの部分編集)で行い、JSON全体の parse→stringify は禁止**([[feedback_locale_json_textual_edit]])。

- [ ] **Step 1: `housing.register.personal_tag` オブジェクトを削除**

`ja.json` 2128-2132行目相当のブロック:
```json
            "personal_tag": {
                "loading": "読み込み中…",
                "not_published_hint": "ハウジンガーとして公開すると自分のタグが使えます",
                "open_account_settings": "公開設定を開く"
            },
```
を削除。他4ロケールでも `grep -n '"personal_tag"' src/locales/{en,ko,zh,zh-Hant}.json` で該当箇所を特定し、同じキー構造のオブジェクトを削除する。

- [ ] **Step 2: `housing.register.tag_kind.personal` を削除**

`ja.json` 2152行目相当の `"personal": "個人"` の1行を、`tag_kind` オブジェクト内から削除(カンマの位置に注意 — 直前の `"beginner"` 行の末尾カンマは削除しない、`"personal"` 行自体を削除するだけで良い。 `"personal"` が最後の要素なので前の行の末尾カンマは残したままでOK)。他4ロケールも同様。

- [ ] **Step 3: `admin.personal_tags` オブジェクトを削除**

`ja.json` 1805-1820行目相当のブロック(`"personal_tags": { ... }`)を削除。他4ロケールも `grep -n '"personal_tags"' src/locales/{en,ko,zh,zh-Hant}.json` で特定して同様に削除。

- [ ] **Step 4: 全ロケールが構文的に妥当な JSON であることを確認**

Run: `for f in src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf-8'))" && echo "$f OK"; done`
Expected: 5ファイル全て `OK`(bashで実行。 PowerShellの場合は `Get-Content $f -Raw | ConvertFrom-Json` を1ファイルずつ)

- [ ] **Step 5: 残存キー参照が無いことを確認**

Run: `grep -rn "register.personal_tag\.\|tag_kind.personal\|admin.personal_tags\." src/ --include=*.tsx --include=*.ts`
Expected: ヒットなし(Task 7/11 で該当コンポーネントは既に削除済みのはず)

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json
git commit -m "$(cat <<'EOF'
chore(i18n): 個人タグ関連の翻訳キーを全ロケールから削除

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: データ移行 (personal_tags 削除 + 物件tagsのクリーンアップ)

**Files:**
- Create: `scripts/delete-personal-tags-collection.ts`
- (再利用) `scripts/cleanup-legacy-housing-tags.ts`(既存、変更なし)

- [ ] **Step 1: personal_tags コレクション削除スクリプトを作成**

`scripts/delete-personal-tags-collection.ts` を新規作成(`scripts/cleanup-legacy-housing-tags.ts` と同じ env 読み込み・dry-run パターンを踏襲):

```ts
/**
 * delete-personal-tags-collection.ts
 *
 * 個人タグ(personal_tags)概念の廃止(設計書: docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md §5)。
 * ハウジング探すページの名前検索が housing_profiles + ownerUid ベースに切り替わったため、
 * personal_tags コレクションはコード側から一切参照されなくなった。 ユーザー承認済みで全削除する。
 *
 * 触るもの: personal_tags コレクション (サブコレクション reports 含む) のみ。 他コレクションは触らない。
 *
 * 使い方:
 *   npx tsx scripts/delete-personal-tags-collection.ts            # dry-run (既定・削除ゼロ)
 *   npx tsx scripts/delete-personal-tags-collection.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'personal_tags';

function loadEnv(filePath: string): Record<string, string> {
  const text = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`=== personal_tags コレクション全削除 (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const snap = await db.collection(COLLECTION).get();
console.log(`対象: ${COLLECTION} (${snap.size} 件)\n`);

if (snap.size === 0) {
  console.log('削除対象がありません。終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。削除は行っていません。適用するには --apply を付けて再実行。');
  console.log('\n(サンプル、最大5件)');
  for (const doc of snap.docs.slice(0, 5)) {
    console.log(`  ${doc.id}: ownerUid=${doc.data().ownerUid}`);
  }
  process.exit(0);
}

let deletedDocs = 0;
let deletedReports = 0;
for (const doc of snap.docs) {
  const reportsSnap = await doc.ref.collection('reports').get();
  if (reportsSnap.size > 0) {
    const batch = db.batch();
    reportsSnap.docs.forEach((r) => batch.delete(r.ref));
    await batch.commit();
    deletedReports += reportsSnap.size;
  }
  await doc.ref.delete();
  deletedDocs++;
}

console.log(`\n🔴 APPLY 完了: personal_tags ${deletedDocs} 件 (+ reports ${deletedReports} 件) を削除しました。`);
```

- [ ] **Step 2: dry-run で対象件数を確認 (このステップは自動実行せず、ユーザー確認後に実行者が手動で行う)**

Run: `npx tsx scripts/delete-personal-tags-collection.ts`
出力された件数をユーザーに報告する。

- [ ] **Step 3: 物件 tags のクリーンアップも dry-run で確認 (既存スクリプトを再利用)**

Task 2 で `isValidTagId` が personal_ 形式を弾くようになったため、既存の `scripts/cleanup-legacy-housing-tags.ts` を再実行するだけで `housing_listings.tags` から `personal_` 形式が自動的に除去対象になる(スクリプト自体の変更は不要)。

Run: `npx tsx scripts/cleanup-legacy-housing-tags.ts`
出力された「除去された旧タグ id の内訳」に `personal_` で始まる id が含まれることを確認し、件数をユーザーに報告する。

- [ ] **Step 4: ユーザーに dry-run 結果を提示し、適用の可否を確認する**

このステップは実装者(Claude)が対話で行う。 「ユーザー承認済みで削除して良い」という設計判断は既にあるが、**実際の対象件数**(何件のタグ・何件の物件が影響するか)は dry-run 結果でしか分からないため、具体的な件数を見せてから `--apply` の実行可否を最終確認する。

- [ ] **Step 5: 承認後に本番適用**

```bash
npx tsx scripts/delete-personal-tags-collection.ts --apply
npx tsx scripts/cleanup-legacy-housing-tags.ts --apply
```

- [ ] **Step 6: コミット (新規スクリプトのみ)**

```bash
git add scripts/delete-personal-tags-collection.ts
git commit -m "$(cat <<'EOF'
chore(scripts): personal_tagsコレクション削除用スクリプトを追加

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## 全タスク完了後の最終チェックリスト

- [ ] `npx tsc -b` がエラーなしで通る
- [ ] `npx vitest run` が全件 green(既知の legacy 失敗5件を除く。 詳細は `docs/TODO.md` 参照)
- [ ] `grep -rn "personal_tags\|personalTag\|PersonalTag" src/ api/ --include=*.ts --include=*.tsx` で `.claude/worktrees/` 以外・意図した残存(`personalTagIdForUid`/`ownerUidFromPersonalFilterId`/`PERSONAL_TAG_ID_PREFIX`/`isPersonalTagIdFormat`/`stripLeadingSymbolsForSort` 等、擬似ID関連の意図的な存続分)以外にヒットしないことを目視確認
- [ ] `firestore.rules`/`firestore.indexes.json` のデプロイをユーザーに確認の上で実行(Task 13 の注記通り。 Task 4 の `search-housingers` エンドポイントもこのインデックスに依存するため、フロントエンド反映と同時期にデプロイすること)
- [ ] Task 15 のデータ移行をユーザーに確認の上で実行
- [ ] 実機確認: マイページ公開済み・物件に一切タグを付けていないテストアカウントで、探すページ「ハウジンガー」から自分の名前を選び、登録した物件(住所非公開含む)が全部出ること/完全非公開の物件は出ないことを確認
- [ ] 実機確認: 物件詳細ページのタグ欄から名前チップが消え、投稿者欄のみになっていることを確認
- [ ] 実機確認: `/admin/personal-tags` への直リンクが 404 になること
- [ ] `docs/TODO.md`/`docs/TODO_COMPLETED.md` を更新(このタスクを完了として記録)
