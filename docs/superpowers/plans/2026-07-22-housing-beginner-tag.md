# ハウジング初心者タグ「ハウジング若葉」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自己申告制の初心者タグ「ハウジング若葉」(id: `beginner_sprout`)を新設し、既存の公式/季節/テーマと同じ「選べば付く」形式でハウジング登録・編集フォームのタグピッカーから選択できるようにする。

**Architecture:** `src/data/housingTags.ts` の静的レジストリに `beginner` kind を1件追加するだけ。`HousingRegisterTagPicker.tsx` はタブ列・タグ一覧ともに `HOUSING_TAG_KINDS`/`HOUSING_TAGS` を map するレジストリ駆動設計のため、コンポーネント側のコード変更は不要 (レジストリに1件足せばタブとタグが自動的に出現する)。

**Tech Stack:** TypeScript / React / vitest + @testing-library/react (happy-dom) / react-i18next

**設計書:** `docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md` の Phase C 節。タグ文言「ハウジング若葉」は確定済み (2026-07-21)。EN/KO/ZH訳は2026-07-22にユーザー承認済み:
- EN: `Housing Newcomer`
- KO: `하우징 새싹`
- ZH: `房屋新人`

タブのカテゴリ見出し (`housing.register.tag_kind.beginner`、他 kind の「公式」「個人」等と同じ立ち位置の総称ラベル) は上記タグ文言とは別に以下を採用する (設計書の指示範囲外の実装判断だが、既存 kind ラベルの命名パターン=総称名詞、に合わせた):
- JA: `初心者` / EN: `Beginner` / KO: `초보자` / ZH: `新手`

## Global Constraints

- UIテキストは必ず i18n キー経由。ハードコード禁止 ([i18n.md](../../../.claude/rules/i18n.md))。
- 4言語 (ja/en/ko/zh) 同時追加・parity 維持。ロケールJSONは該当ブロックのみ textual 編集し、全体 parse→stringify で書き直さない (他行を差分で汚さない)。
- kind 増設は既存の「レジストリに1エントリ足す + ロケール追加」パターンを踏襲する。コンポーネント側に `kind === 'beginner'` のような分岐を新規に書かない (既存コードに personal だけ特別分岐があるのは Firestore動的データだからであり、beginner は静的レジストリなので同分岐は不要)。
- vitest 実行は `npm test -- <path>` を使う (`npx vitest` は使わない・exit code 伝達バグ回避)。出力は `> .vt.txt 2>&1` でファイルに落として Read で読む。**`| grep` 等へのパイプ禁止** (Windows で EPIPE→ハングする既知問題)。Bashツールの timeout を 70000ms 程度で必ず指定する。

## 設計書との差分 (実装前調査で判明・要記録)

設計書 Phase A の記述「API側の validation (許可 kind リスト) も追従が必要」は **本タスクには該当しない**。`src/utils/housingValidation.ts` の `validateTags()` (`housingValidation.ts:179-186`) は各 tag id を `isValidTagId()` (`src/data/housingTags.ts:141-143`) に通しているだけで、これは「静的レジストリ (`HOUSING_TAGS`配列) に存在するか」または「`personal_` 形式か」しか見ていない。kind ごとの許可リストという概念はサーバー側に存在しない。よって `beginner_sprout` を `HOUSING_TAGS` 配列に足せば、サーバー側 validation は自動的にこれを許可する。API 側の変更タスクは不要 (下記タスクにも含めない)。

同様に `FilterPanel.tsx` の絞り込みは `theme` kind のみを対象にしており (`FilterPanel.tsx:28`)、`official`/`season`/`personal` も含め既存の他 kind もフィルタ対象になっていない。設計書は beginner タグをフィルタ対象にする指示をしていないため、本タスクでもフィルタ機能追加はスコープ外とする (指示範囲だけ変更・波及を広げない)。

---

### Task 1: レジストリ + ロケール4言語 + レジストリテスト

**Files:**
- Modify: `src/data/housingTags.ts`
- Modify: `src/__tests__/housing/housingTags.test.ts`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**Interfaces:**
- Produces: `HousingTagKind` 型に `'beginner'` が追加される。`HOUSING_TAG_KINDS` = `['official', 'season', 'theme', 'beginner', 'personal']`。`STATIC_HOUSING_TAG_KINDS` = `['official', 'season', 'theme', 'beginner']`。`HOUSING_TAGS` 配列に `{ id: 'beginner_sprout', kind: 'beginner', i18nKey: 'housing.tag.beginner_sprout' }` が追加され、`getTagsByKind('beginner')` が `[{id: 'beginner_sprout', ...}]` を返す。`isValidTagId('beginner_sprout')` が `true` を返す (既存の `isStaticTagId` 経由・コード変更不要)。
- Consumes: なし (このタスクが起点)。

- [ ] **Step 1: housingTags.test.ts を新しい期待値に書き換える (失敗させる)**

`src/__tests__/housing/housingTags.test.ts` の以下2ブロックを置き換える:

```typescript
  it('kind は 公式/季節/テーマ/初心者/個人 の 5 種 (この順序)', () => {
    expect(HOUSING_TAG_KINDS).toEqual(['official', 'season', 'theme', 'beginner', 'personal']);
  });

  it('静的レジストリを持つ kind は 公式/季節/テーマ/初心者 の 4 種 (個人は Firestore 動的管理)', () => {
    expect(STATIC_HOUSING_TAG_KINDS).toEqual(['official', 'season', 'theme', 'beginner']);
  });
```

(元の「4 種」「3 種」テストをこれで上書きする。テキストは完全一致で置換すること。)

続けて、以下のブロックも置き換える:

```typescript
  it('総数は 48 (公式23 + 季節12 + テーマ12 + 初心者1)', () => {
    expect(HOUSING_TAGS.length).toBe(48);
  });
```

さらに、`'テーマタグの id が確定リストと一致 (botanical を含む)'` のテストブロックの直後 (`getTagById は存在する id でタグを返す` のテストの直前) に以下を新規追加する:

```typescript
  it('初心者タグは 1 件 (beginner_sprout)', () => {
    const ids = getTagsByKind('beginner').map((t) => t.id);
    expect(ids).toEqual(['beginner_sprout']);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/__tests__/housing/housingTags.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms 指定)
その後 Read で `.vt.txt` を読む。Expected: 上記4ブロックが FAIL (現在の実装は `beginner` を含まないため)。

- [ ] **Step 3: housingTags.ts にレジストリを追加**

`src/data/housingTags.ts` の line 19 を置き換える:

```typescript
export const HOUSING_TAG_KINDS = ['official', 'season', 'theme', 'beginner', 'personal'] as const;
```

line 23 を置き換える:

```typescript
export const STATIC_HOUSING_TAG_KINDS = ['official', 'season', 'theme', 'beginner'] as const;
```

`THEME_TAGS` の定義ブロック (line 91-104) と `HOUSING_TAGS` の定義 (line 106-111) の間に、以下を新規追加する:

```typescript
/**
 * 初心者タグ (1 件のみ)。 自己申告で「まだ不慣れです」を可視化するタグ。
 * 公式/季節/テーマとは性質が異なる自己申告カテゴリのため kind を分けている。
 */
const BEGINNER_TAGS: readonly HousingTag[] = [
  t('beginner_sprout', 'beginner'),
];
```

`HOUSING_TAGS` の定義 (line 106-111) を置き換える:

```typescript
/** 静的タグ全件 (公式23 + 季節12 + テーマ12 + 初心者1 = 48)。 個人タグはここに含まれない。 */
export const HOUSING_TAGS: readonly HousingTag[] = [
  ...OFFICIAL_TAGS,
  ...SEASON_TAGS,
  ...THEME_TAGS,
  ...BEGINNER_TAGS,
];
```

- [ ] **Step 4: ロケール4言語に追加**

`src/locales/ja.json` の `"tag"` ブロック内、`"theme_botanical": "ボタニカル"` の行 (末尾のカンマなし・ブロック最終行) を以下に置き換える:

```json
            "theme_botanical": "ボタニカル",
            "beginner_sprout": "ハウジング若葉"
```

同ファイルの `"tag_kind"` ブロック内、`"theme": "テーマ",` の行の直後・`"personal": "個人"` の行の直前に以下を挿入する:

```json
                "beginner": "初心者",
```

`src/locales/en.json` の `"tag"` ブロック、`"theme_botanical": "Botanical"` を置き換える:

```json
            "theme_botanical": "Botanical",
            "beginner_sprout": "Housing Newcomer"
```

`"tag_kind"` ブロックの `"theme": "Theme",` の直後・`"personal": "Personal"` の直前に挿入:

```json
                "beginner": "Beginner",
```

`src/locales/ko.json` の `"tag"` ブロック、`"theme_botanical": "보태니컬"` を置き換える:

```json
            "theme_botanical": "보태니컬",
            "beginner_sprout": "하우징 새싹"
```

`"tag_kind"` ブロックの `"theme": "테마",` の直後・`"personal": "개인"` の直前に挿入:

```json
                "beginner": "초보자",
```

`src/locales/zh.json` の `"tag"` ブロック、`"theme_botanical": "植物风"` を置き換える:

```json
            "theme_botanical": "植物风",
            "beginner_sprout": "房屋新人"
```

`"tag_kind"` ブロックの `"theme": "主题",` の直後・`"personal": "个人"` の直前に挿入:

```json
                "beginner": "新手",
```

各ファイルとも、対象ブロック以外は一切変更しないこと (textual 編集・全体 parse→stringify 禁止)。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/__tests__/housing/housingTags.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 6: Commit**

```bash
git add src/data/housingTags.ts src/__tests__/housing/housingTags.test.ts src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): 初心者タグ「ハウジング若葉」をレジストリに追加"
```

---

### Task 2: タグピッカーの結線を統合テストで確認

**Files:**
- Modify: `src/__tests__/housing/HousingRegisterTagPicker.test.tsx`

**Interfaces:**
- Consumes: Task 1 で追加された `beginner_sprout` (kind: `beginner`)。`HousingRegisterTagPicker.tsx` 自体はコード変更不要 (`HOUSING_TAG_KINDS`/`HOUSING_TAGS` を map する既存実装がそのまま新 kind を描画する)。
- Produces: なし (このタスクで完結)。

**背景:** `HousingRegisterTagPicker.tsx` はタブ列を `HOUSING_TAG_KINDS.map(...)` (`HousingRegisterTagPicker.tsx:111-123`) で描画し、タグ一覧を `HOUSING_TAGS.filter((tag) => tag.kind === activeKind)` (`HousingRegisterTagPicker.tsx:50`) で描画するレジストリ駆動設計。Task 1 の変更だけで「初心者」タブと「ハウジング若葉」ボタンが自動的に出現するはずだが、これはコード上の推論に留まるため、実際に render してタブクリック→タグ選択→onChange 呼び出しまで通す統合テストで検証する。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingRegisterTagPicker.test.tsx` の `'既選択タグは × で削除できる'` テスト (現在の line 53-60) の直後、`describe('個人タブ', () => {` (現在の line 62) の直前に以下を追加する:

```typescript
  it('初心者タブから「ハウジング若葉」タグを選べる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getByText(/housing\.register\.tag_kind\.beginner/i));
    await user.click(screen.getByRole('button', { name: /housing\.tag\.beginner_sprout/i }));
    expect(onChange).toHaveBeenCalledWith(['beginner_sprout']);
  });
```

- [ ] **Step 2: テストが失敗することを確認 (Task 1 未適用の場合のみ意味を持つ)**

Task 1 が既に完了・コミット済みであれば、このテストは Step 1 の時点で既に PASS するはず (レジストリは既に `beginner_sprout` を含むため)。念のため実行して確認する:

Run: `npm test -- src/__tests__/housing/HousingRegisterTagPicker.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 新規テストを含め全件 PASS、`EXIT=0`。**もし FAIL していたら** Task 1 の変更が未反映 (コミット漏れ等) なので、先に Task 1 の完了を確認すること。

- [ ] **Step 3: (Step 2 で既に PASS しているため実装ステップは無し。念のため再実行して安定していることを確認)**

Run: `npm test -- src/__tests__/housing/HousingRegisterTagPicker.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/housing/HousingRegisterTagPicker.test.tsx
git commit -m "test(housing): 初心者タグピッカー結線の統合テストを追加"
```

---

## 完了確認 (エンドユーザー視点・実機1周)

自動テストは「タブが出てタグを選べる」ことしか検証しない。以下はデプロイ後に実機で確認する (ユーザー実施):

1. `/housing` の登録または編集フォームを開く。
2. タグピッカーのタブに「初心者」が公式/季節/テーマの次・個人の手前に表示されている。
3. 「初心者」タブをクリック→「ハウジング若葉」ボタンが表示され、クリックで選択状態 (chip 表示) になる。
4. 選択済み chip の × で解除できる。
5. 英語モード (設定言語を English に切替) で同じ手順を実施し、「Beginner」タブ/「Housing Newcomer」表示が崩れていないか確認 (英語は文字数が長くなりやすいため)。
6. 韓国語・中国語モードでも表示崩れがないか確認。
