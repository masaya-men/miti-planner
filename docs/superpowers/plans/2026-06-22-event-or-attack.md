# 敵攻撃 "or"（2択攻撃）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TimelineEvent` に任意 `altName` を1つ持たせ、タイムライン上で「攻撃1 or 攻撃2」と表示でき、ユーザーのイベントフォームと管理画面テンプレートエディタの両方で編集できるようにする。

**Architecture:** 既存の `name`（`LocalizedString`）のローカライズ取得・描画・編集パターンに全面的に相乗りする。表示ロジックは純関数 `formatEventName` に抽出して unit テスト可能にし、TimelineRow はそれを呼ぶだけ。ダメージ・属性・対象・時刻は1枠で共通（名前だけ変わる）なので軽減計算・配置ロジックは一切変更しない。

**Tech Stack:** React + TypeScript（Vite）/ react-i18next / Zustand / vitest（happy-dom, vmThreads）

**元 spec:** `docs/superpowers/specs/2026-06-22-event-or-attack-design.md`

## Global Constraints

以下は全タスク共通。各タスクの要件に暗黙的に含まれる。

- **`verbatimModuleSyntax: true`** — 型のみの import は必ず `import type`（または inline `type` 修飾子）。値 import（関数・コンポーネント）と分ける。違反は本番 `tsc -b` で500/ビルド失敗。
- **`noUnusedLocals` / `noUnusedParameters: true`** — 未使用の import・変数・引数を残さない。ビルドが落ちる。
- **`strict: true`、`exactOptionalPropertyTypes` は無効** — optional プロパティへの `undefined` 代入は許容されるが、本計画では削除には `delete` を使う。
- **i18n ハードコード禁止**（`.claude/rules/i18n.md`）— UI 文字列は必ず `t('...')` 経由。新規キーは ja/en/ko/zh の4ファイル全てに追加。
- **push 前に必ず `npm run build`（tsc -b 厳密）+ `npm run test`（vitest run）を緑にする**（[[feedback_vercel_tsc_strict]]）。vitest 出力をパイプしない（[[reference_vitest_appcheck_teardown]]）。
- **UI 見た目に影響する変更は既存トークン/クラスに相乗り**。新規の色・装飾を足さない（白黒+機能色のみ・`.claude/rules/ui-design.md`）。altName 入力欄は既存 `name` 入力欄と同じ class を流用する。
- **`altName` の意味論**: 「名前だけ変わる」。`damageType`/`damageAmount`/`target`/`time`/`ignoresDebuffMitigation` は A も B も共通。altName は計算に一切関与しない。
- **空欄＝通常イベント**: altName の全言語が空なら `altName` プロパティ自体を付けない（`undefined`）。

---

## File Structure

| ファイル | 責務 | 変更種別 |
|---|---|---|
| `src/types/index.ts` | `TimelineEvent.altName?: LocalizedString` 追加（1行） | Modify |
| `src/utils/eventName.ts` | 表示用名整形の純関数 `formatEventName`（新規・テスト対象） | Create |
| `src/utils/__tests__/eventName.test.ts` | `formatEventName` の unit テスト | Create |
| `src/locales/{ja,en,ko,zh}.json` | `event.*` 3キー + `admin.tpl_editor_altname_*` 4キー | Modify |
| `src/locales/__tests__/event-i18n-parity.test.ts` | 新規キーの4言語パリティテスト | Create |
| `src/components/TimelineRow.tsx` | `getEventName` を `formatEventName` 経由に（描画で "A or B"） | Modify |
| `src/components/EventForm.tsx` | altName 入力（現言語1言語）+ state/init/onSave 配線 | Modify |
| `src/components/__tests__/EventForm.altname.test.tsx` | altName onSave 挙動テスト | Create |
| `src/hooks/useTemplateEditor.ts` | `updateCell` が `altName.xx` を処理（undefined 生成・空で削除） | Modify |
| `src/hooks/__tests__/useTemplateEditor.test.ts` | altName セル編集テストを追記 | Modify |
| `src/components/admin/TemplateEditor.tsx` | altName 4列（colgroup/thead/td） | Modify |

---

## Task 1: データモデル + 名前整形の純関数

`altName` フィールドを型に足し、「A or B」連結ロジックを純関数 `formatEventName` に抽出して TDD でテストする。これが本機能の中核ロジック。

**Files:**
- Modify: `src/types/index.ts:108-121`（`TimelineEvent` に1行追加）
- Create: `src/utils/eventName.ts`
- Test: `src/utils/__tests__/eventName.test.ts`

**Interfaces:**
- Consumes: `getPhaseName(name, lang)` と `LocalizedString`（`src/types/index.ts`）
- Produces: `formatEventName(ev: { name: LocalizedString; altName?: LocalizedString }, lang: string | undefined, orConnector: string): string` — Task 3（TimelineRow）が使う。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/utils/__tests__/eventName.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatEventName } from '../eventName';

describe('formatEventName', () => {
  it('altName 無し → name のみ', () => {
    expect(
      formatEventName({ name: { ja: 'ホリゾンタル', en: 'Horizontal' } }, 'ja', 'or'),
    ).toBe('ホリゾンタル');
  });

  it('altName 有り（ja表示）→ "name or altName"', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: 'ヴァーティカル', en: 'Vertical' } },
        'ja',
        'or',
      ),
    ).toBe('ホリゾンタル or ヴァーティカル');
  });

  it('altName 有り（en表示）→ 現言語で連結', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: 'ヴァーティカル', en: 'Vertical' } },
        'en',
        'or',
      ),
    ).toBe('Horizontal or Vertical');
  });

  it('altName の現言語(zh)が無い → en→ja フォールバック（name と同じ挙動）', () => {
    expect(
      formatEventName(
        { name: { ja: '主', en: 'Main' }, altName: { ja: '副', en: 'Alt' } },
        'zh',
        'or',
      ),
    ).toBe('Main or Alt');
  });

  it('altName が空 LocalizedString → name のみ（空は連結しない）', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: '', en: '' } },
        'ja',
        'or',
      ),
    ).toBe('ホリゾンタル');
  });

  it('連結語は引数で差し替え可（i18n 非ハードコード）', () => {
    expect(
      formatEventName(
        { name: { ja: 'A', en: 'A' }, altName: { ja: 'B', en: 'B' } },
        'ja',
        '/',
      ),
    ).toBe('A / B');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/utils/__tests__/eventName.test.ts`
Expected: FAIL（`Failed to resolve import "../eventName"` または `formatEventName is not a function`）

- [ ] **Step 3: 純関数を実装**

Create `src/utils/eventName.ts`:

```ts
import { getPhaseName, type LocalizedString } from '../types';

/**
 * イベント名を表示用文字列に整形する。
 * altName があり、現言語(en→ja フォールバック後)が空でなければ「name {orConnector} altName」を返す。
 * altName が無い/空のときは name のみ。連結語(or)はハードコードせず呼び出し側が i18n 解決して渡す。
 */
export function formatEventName(
  ev: { name: LocalizedString; altName?: LocalizedString },
  lang: string | undefined,
  orConnector: string,
): string {
  const main = ev.name ? getPhaseName(ev.name, lang) : '';
  if (!ev.altName) return main;
  const alt = getPhaseName(ev.altName, lang);
  if (!alt) return main;
  return `${main} ${orConnector} ${alt}`;
}
```

- [ ] **Step 4: `TimelineEvent` に `altName` を追加**

Modify `src/types/index.ts` — `mechanicGroup?` 行（120行目付近）の直後、`TimelineEvent` の閉じ `}`（121行目）の直前に追加:

```ts
    /** @deprecated 旧データ互換用。新データはlabels[]を使用。読み込み時のみ参照される */
    mechanicGroup?: LocalizedString;
    /** 2択攻撃の代替名（"A or B" の B）。無し/空 = 通常イベント。名前だけ変わりダメージ等は共通。 */
    altName?: LocalizedString;
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm run test -- src/utils/__tests__/eventName.test.ts`
Expected: PASS（6 件）

- [ ] **Step 6: コミット**

```bash
rtk git add src/types/index.ts src/utils/eventName.ts src/utils/__tests__/eventName.test.ts
rtk git commit -m "feat(event): altName 型追加 + 名前整形純関数 formatEventName(テスト付き)"
```

---

## Task 2: i18n キー（event.* + 管理ヘッダ）4言語

連結語と入力ラベル・プレースホルダ、管理画面の altName 列ヘッダを4言語に追加し、パリティをテストで保証する。

**Files:**
- Modify: `src/locales/ja.json`（`mechanic_modal` 直前に `event` セクション新設 + `admin.tpl_editor_name_ko` 直後に altname ヘッダ）
- Modify: `src/locales/en.json` / `src/locales/ko.json` / `src/locales/zh.json`（同様）
- Test: `src/locales/__tests__/event-i18n-parity.test.ts`

**Interfaces:**
- Produces: i18n キー `event.or_connector` / `event.alt_name_label` / `event.alt_name_placeholder`（Task 3, 4 が使用）、`admin.tpl_editor_altname_{ja,en,zh,ko}`（Task 5 が使用）

- [ ] **Step 1: 失敗するパリティテストを書く**

Create `src/locales/__tests__/event-i18n-parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import ko from '../ko.json';
import zh from '../zh.json';

const locales: Record<string, any> = { ja, en, ko, zh };

describe('event.* / admin altname i18n パリティ', () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}: event.{or_connector,alt_name_label,alt_name_placeholder} が存在`, () => {
      expect(dict.event?.or_connector).toBeTruthy();
      expect(dict.event?.alt_name_label).toBeTruthy();
      expect(dict.event?.alt_name_placeholder).toBeTruthy();
    });
    it(`${lang}: admin.tpl_editor_altname_{ja,en,zh,ko} が存在`, () => {
      expect(dict.admin?.tpl_editor_altname_ja).toBeTruthy();
      expect(dict.admin?.tpl_editor_altname_en).toBeTruthy();
      expect(dict.admin?.tpl_editor_altname_zh).toBeTruthy();
      expect(dict.admin?.tpl_editor_altname_ko).toBeTruthy();
    });
  }
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/locales/__tests__/event-i18n-parity.test.ts`
Expected: FAIL（`expect(...).toBeTruthy()` が undefined で失敗・8 件中複数）

- [ ] **Step 3: `ja.json` にキー追加**

(3a) `src/locales/ja.json` の `"mechanic_modal": {`（1079行目付近）の**直前**にトップレベル `event` セクションを新設:

```json
    "event": {
        "or_connector": "or",
        "alt_name_label": "or（別の攻撃名・任意）",
        "alt_name_placeholder": "例: ヴァーティカル"
    },
    "mechanic_modal": {
```

(3b) `src/locales/ja.json` の `"tpl_editor_name_ko": "技名(KO)",`（1625行目付近）の**直後**に4ヘッダを追加:

```json
        "tpl_editor_name_ko": "技名(KO)",
        "tpl_editor_altname_ja": "or技名(JA)",
        "tpl_editor_altname_en": "or技名(EN)",
        "tpl_editor_altname_zh": "or技名(ZH)",
        "tpl_editor_altname_ko": "or技名(KO)",
```

- [ ] **Step 4: `en.json` にキー追加**

(4a) `src/locales/en.json` の `"mechanic_modal": {` の直前に:

```json
    "event": {
        "or_connector": "or",
        "alt_name_label": "or (alternate name, optional)",
        "alt_name_placeholder": "e.g. Vertical"
    },
    "mechanic_modal": {
```

(4b) `src/locales/en.json` の `"tpl_editor_name_ko": "Name (KO)",`（1621行目付近）の直後に:

```json
        "tpl_editor_name_ko": "Name (KO)",
        "tpl_editor_altname_ja": "or Name (JA)",
        "tpl_editor_altname_en": "or Name (EN)",
        "tpl_editor_altname_zh": "or Name (ZH)",
        "tpl_editor_altname_ko": "or Name (KO)",
```

- [ ] **Step 5: `ko.json` にキー追加**

(5a) `src/locales/ko.json` の `"mechanic_modal": {` の直前に:

```json
    "event": {
        "or_connector": "or",
        "alt_name_label": "or (다른 공격명·선택)",
        "alt_name_placeholder": "예: 버티컬"
    },
    "mechanic_modal": {
```

(5b) `src/locales/ko.json` の `"tpl_editor_name_ko": "이름 (한국어)",`（1586行目付近）の直後に:

```json
        "tpl_editor_name_ko": "이름 (한국어)",
        "tpl_editor_altname_ja": "or 이름 (JA)",
        "tpl_editor_altname_en": "or 이름 (EN)",
        "tpl_editor_altname_zh": "or 이름 (ZH)",
        "tpl_editor_altname_ko": "or 이름 (KO)",
```

- [ ] **Step 6: `zh.json` にキー追加**

(6a) `src/locales/zh.json` の `"mechanic_modal": {` の直前に:

```json
    "event": {
        "or_connector": "or",
        "alt_name_label": "or（其他攻击名·可选）",
        "alt_name_placeholder": "例: 垂直"
    },
    "mechanic_modal": {
```

(6b) `src/locales/zh.json` の `"tpl_editor_name_ko": "名称（韩文）",`（1586行目付近）の直後に:

```json
        "tpl_editor_name_ko": "名称（韩文）",
        "tpl_editor_altname_ja": "or名称（日文）",
        "tpl_editor_altname_en": "or名称（英文）",
        "tpl_editor_altname_zh": "or名称（中文）",
        "tpl_editor_altname_ko": "or名称（韩文）",
```

- [ ] **Step 7: パリティテストが通ることを確認 + JSON 妥当性**

Run: `npm run test -- src/locales/__tests__/event-i18n-parity.test.ts`
Expected: PASS（8 件）。JSON 構文エラーがあれば import 解決で即失敗するので、ここで検出される。

- [ ] **Step 8: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/__tests__/event-i18n-parity.test.ts
rtk git commit -m "feat(i18n): event.or_connector/alt_name_* + 管理 altname ヘッダを4言語追加(パリティテスト付き)"
```

---

## Task 3: タイムライン表示（TimelineRow）

`getEventName` を `formatEventName` 経由に置き換え、altName があれば「攻撃1 or 攻撃2」と描画する。ロジックは Task 1 でテスト済みなので、ここは純粋な配線。

**Files:**
- Modify: `src/components/TimelineRow.tsx:6`（import 追加）、`:279-280`（`getEventName` 置換）

**Interfaces:**
- Consumes: `formatEventName`（Task 1）、`t('event.or_connector')`（Task 2）、`contentLanguage`（既存 store）

- [ ] **Step 1: import を追加**

Modify `src/components/TimelineRow.tsx` — 既存の import 群（6行目 `import { getPhaseName } from '../types';` の直後）に追加:

```ts
import { getPhaseName } from '../types';
import { formatEventName } from '../utils/eventName';
```

（注: `getPhaseName` は同ファイル118行目でも使用しているため import は残す。）

- [ ] **Step 2: `getEventName` を置き換え**

Modify `src/components/TimelineRow.tsx:279-280` — 現状:

```ts
    const getEventName = (ev: TimelineEvent) =>
        ev.name ? getPhaseName(ev.name, contentLanguage) : ev.name;
```

を以下に置換:

```ts
    const orConnector = t('event.or_connector');
    const getEventName = (ev: TimelineEvent) => formatEventName(ev, contentLanguage, orConnector);
```

（`t` は同コンポーネント内 263行目で `const { t } = useTranslation();` 済み・スコープ内。`contentLanguage` も既存。）

- [ ] **Step 3: ビルドで型・未使用 import を確認**

Run: `npm run build`
Expected: 成功（tsc -b エラーなし）。`getPhaseName` が118行で使われ続けるため未使用エラーは出ない。

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/TimelineRow.tsx
rtk git commit -m "feat(timeline): イベント名を formatEventName 経由にし altName を「A or B」描画"
```

---

## Task 4: ユーザー編集（EventForm）

攻撃名入力の直下に「or（別の攻撃名・任意）」入力を1つ（現言語1言語分）追加。state/init/onSave を配線し、全言語空なら altName を付けずに保存する。

**Files:**
- Modify: `src/components/EventForm.tsx`（state `:55` 付近、init `:122`/`:137`、onSave `:596-603`、JSX `:655` の直後）
- Test: `src/components/__tests__/EventForm.altname.test.tsx`

**Interfaces:**
- Consumes: `t('event.alt_name_label')` / `t('event.alt_name_placeholder')`（Task 2）、`TimelineEvent.altName`（Task 1）、`contentLanguage`（既存）

- [ ] **Step 1: 失敗するテストを書く**

Create `src/components/__tests__/EventForm.altname.test.tsx`（既存 `EventForm.damage.test.tsx` の harness を踏襲）:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : opt?.defaultValue ?? k),
        i18n: { language: 'ja' },
    }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { EventForm } from '../EventForm';
import type { TimelineEvent } from '../../types';

beforeEach(() => {
    useMitigationStore.setState({ partyMembers: [], currentLevel: 100 } as any);
});

const baseEvent: TimelineEvent = {
    id: 'e1',
    time: 30,
    name: { ja: 'ホリゾンタル', en: 'Horizontal' },
    damageType: 'magical',
    damageAmount: 50000,
    target: 'MT',
};

function submitForm() {
    const form = document.getElementById('event-modal-form') as HTMLFormElement;
    form.requestSubmit
        ? form.requestSubmit()
        : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('EventForm altName(2択攻撃)', () => {
    it('altName を入力して保存すると onSave に altName が乗る', () => {
        let saved: any = null;
        render(<EventForm initialData={baseEvent} onSave={(e) => { saved = e; }} />);
        const alt = screen.getByTestId('event-altname-input') as HTMLInputElement;
        fireEvent.change(alt, { target: { value: 'ヴァーティカル' } });
        submitForm();
        expect(saved?.altName).toBeTruthy();
        expect(Object.values(saved.altName)).toContain('ヴァーティカル');
    });

    it('altName 空のまま保存すると altName は付かない(undefined)', () => {
        let saved: any = null;
        render(<EventForm initialData={baseEvent} onSave={(e) => { saved = e; }} />);
        submitForm();
        expect(saved).toBeTruthy();
        expect(saved.altName).toBeUndefined();
    });

    it('initialData.altName があると入力欄に初期表示される', () => {
        render(
            <EventForm
                initialData={{ ...baseEvent, altName: { ja: 'ヴァーティカル', en: 'Vertical' } }}
                onSave={() => {}}
            />,
        );
        const alt = screen.getByTestId('event-altname-input') as HTMLInputElement;
        expect(alt.value).toMatch(/ヴァーティカル|Vertical/);
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/components/__tests__/EventForm.altname.test.tsx`
Expected: FAIL（`Unable to find an element by: [data-testid="event-altname-input"]`）

- [ ] **Step 3: altName state を追加**

Modify `src/components/EventForm.tsx:55` — `name` state の直後に追加:

```ts
    const [name, setName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [altName, setAltName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
```

- [ ] **Step 4: init（useEffect）に altName を配線**

Modify `src/components/EventForm.tsx` — `if (initialData)` 分岐の `setName(initialData.name);`（122行目）の直後に1行、`else` 分岐の `setName({ ja: '', en: '' });`（137行目）の直後に1行追加:

```ts
        if (initialData) {
            setName(initialData.name);
            setAltName(initialData.altName ?? { ja: '', en: '' });
            setTime(initialData.time);
```

```ts
        } else {
            setName({ ja: '', en: '' });
            setAltName({ ja: '', en: '' });
            setTime(initialTime || 0);
```

- [ ] **Step 5: onSave（handleSubmit）に altName を条件付きで含める**

Modify `src/components/EventForm.tsx:596-603` — 現状:

```ts
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target,
            ignoresDebuffMitigation,
        });
```

を以下に置換（全言語空なら altName を付けない）:

```ts
        const hasAltName = !!(altName.ja?.trim() || altName.en?.trim() || altName.zh?.trim() || altName.ko?.trim());
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target,
            ignoresDebuffMitigation,
            ...(hasAltName ? { altName } : {}),
        });
```

- [ ] **Step 6: altName 入力 JSX を追加**

Modify `src/components/EventForm.tsx` — 攻撃名/時間の2列グリッドを閉じる `</div>`（655行目）の**直後**に、フル幅の altName 行を追加（`name` 入力と同じ class を流用・`required` は付けない）:

```tsx
                </div>
            </div>

            {/* or（2択攻撃の別名・任意） */}
            <div>
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('event.alt_name_label')}</label>
                <input
                    data-testid="event-altname-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? altName.en : altName.ja}
                    onChange={(e) => setAltName({ ...altName, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={clsx(
                        "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all border focus:outline-none focus:ring-1",
                        "bg-app-surface2 border-app-border text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                    )}
                    placeholder={t('event.alt_name_placeholder')}
                />
            </div>
```

（注: 直前の `</div>`（655）はグリッドの閉じ、その上の `</div>`（654）は name セルの閉じ。挿入は2列グリッド全体の直後＝name/time 行の下にフル幅で置く。)

- [ ] **Step 7: テストが通ることを確認**

Run: `npm run test -- src/components/__tests__/EventForm.altname.test.tsx`
Expected: PASS（3 件）

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/EventForm.tsx src/components/__tests__/EventForm.altname.test.tsx
rtk git commit -m "feat(eventform): or(別名)入力を追加・全空なら altName 無しで保存(テスト付き)"
```

---

## Task 5: 管理画面編集（TemplateEditor + useTemplateEditor）

`updateCell` が `altName.xx` パスを処理（altName が無ければ生成、全言語空なら削除）できるようにし、TemplateEditor のテーブルに altName 4列（colgroup/thead/td）を追加する。

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts:135-165`（`updateCell` の switch に altName ケース追加）
- Modify: `src/hooks/__tests__/useTemplateEditor.test.ts`（altName テスト追記）
- Modify: `src/components/admin/TemplateEditor.tsx`（colgroup `:450` 直後、thead `:474` 直後、td `:615` 直後、highlight 計算 `:495` 直後）

**Interfaces:**
- Consumes: `TimelineEvent.altName`（Task 1）、`admin.tpl_editor_altname_*`（Task 2）、既存 `EditableCell` / `getCellHighlight` / `highlightClass` / `onUpdateCell`

- [ ] **Step 1: 失敗するフックテストを書く**

Modify `src/hooks/__tests__/useTemplateEditor.test.ts` — `'updateCell で ignoresDebuffMitigation を更新し modified を記録する'` の it ブロック（57行目の `});` ）の直後に追記:

```ts
  it('updateCell で altName.ja を編集すると altName が生成される', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev3', 'altName.ja', 'ヴァーティカル'));
    const ev3 = result.current.state.current.find(e => e.id === 'ev3');
    expect(ev3?.altName?.ja).toBe('ヴァーティカル');
    expect(result.current.hasChanges).toBe(true);
  });

  it('updateCell で altName.en も独立して編集できる', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev3', 'altName.ja', 'ヴァーティカル'));
    act(() => result.current.updateCell('ev3', 'altName.en', 'Vertical'));
    const ev3 = result.current.state.current.find(e => e.id === 'ev3');
    expect(ev3?.altName).toEqual({ ja: 'ヴァーティカル', en: 'Vertical' });
  });

  it('updateCell で altName を全言語空にすると altName が外れる', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev3', 'altName.ja', 'ヴァーティカル'));
    act(() => result.current.updateCell('ev3', 'altName.ja', ''));
    const ev3 = result.current.state.current.find(e => e.id === 'ev3');
    expect(ev3?.altName).toBeUndefined();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: FAIL（`altName.ja` が `default: return prev` で無視され `ev3.altName` が undefined のまま・最初の2 件が失敗）

- [ ] **Step 3: `updateCell` に altName ケースを追加**

Modify `src/hooks/useTemplateEditor.ts:148-150` — `name.ko` ケースの直後、`damageAmount` ケースの直前に altName 4ケースを追加:

```ts
          case 'name.ko':
            ev.name.ko = value as string;
            break;
          case 'altName.ja':
          case 'altName.en':
          case 'altName.zh':
          case 'altName.ko': {
            const altLang = field.split('.')[1] as 'ja' | 'en' | 'zh' | 'ko';
            const next: LocalizedString = ev.altName
              ? { ...ev.altName }
              : { ja: '', en: '' };
            next[altLang] = value as string;
            const isEmpty = !next.ja.trim() && !next.en.trim() && !(next.zh ?? '').trim() && !(next.ko ?? '').trim();
            if (isEmpty) {
              delete ev.altName;
            } else {
              ev.altName = next;
            }
            break;
          }
          case 'damageAmount':
            ev.damageAmount = value as number | undefined;
            break;
```

（`LocalizedString` は同ファイル2行目で `import type { TimelineEvent, LocalizedString } from '../types';` 済み・追加 import 不要。`altName` は翻訳自動伝播（`translationFields`）の対象に**しない**＝per-event の任意名なので既存 `translationFields` 配列は変更しない。）

- [ ] **Step 4: フックテストが通ることを確認**

Run: `npm run test -- src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: PASS（既存 + 新規3 件すべて）

- [ ] **Step 5: TemplateEditor の colgroup に4列追加**

Modify `src/components/admin/TemplateEditor.tsx:450` — 技名KO の `<col>`（450行目）の直後に4列追加:

```tsx
          <col className="min-w-[100px]" />  {/* 技名KO */}
          <col className="min-w-[90px]" />   {/* or技名JA */}
          <col className="min-w-[90px]" />   {/* or技名EN */}
          <col className="min-w-[90px]" />   {/* or技名ZH */}
          <col className="min-w-[90px]" />   {/* or技名KO */}
          <col style={{ width: '70px' }} />  {/* 種別 */}
```

- [ ] **Step 6: TemplateEditor の thead に4ヘッダ追加**

Modify `src/components/admin/TemplateEditor.tsx:474` — `tpl_editor_name_ko` の `<th>`（474行目）の直後に4ヘッダ追加:

```tsx
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ko')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_ja')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_en')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_zh')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_ko')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage_type')}</th>
```

- [ ] **Step 7: altName セルの highlight 計算を追加**

Modify `src/components/admin/TemplateEditor.tsx:495` — name KO の highlight（495行目 `const nameKoHighlight = ...`）の直後に4行追加:

```ts
            const nameKoHighlight = getCellHighlight(evId, 'name.ko', editState);
            const altNameJaHighlight = getCellHighlight(evId, 'altName.ja', editState);
            const altNameEnHighlight = getCellHighlight(evId, 'altName.en', editState);
            const altNameZhHighlight = getCellHighlight(evId, 'altName.zh', editState);
            const altNameKoHighlight = getCellHighlight(evId, 'altName.ko', editState);
```

- [ ] **Step 8: TemplateEditor の td に altName 4セル追加**

Modify `src/components/admin/TemplateEditor.tsx:615` — 技名KO セルを閉じる `</td>`（615行目）の直後、`{/* 種別 */}`（617行目）の直前に4セル追加:

```tsx
                {/* 技名(KO) */}
                <td className={`py-1 pr-2 ${highlightClass(nameKoHighlight)}`}>
                  <EditableCell
                    value={event.name.ko ?? ''}
                    highlight={nameKoHighlight}
                    showAutoLabel={isKoAutoFilled && !isKoUntranslated}
                    isUntranslatedPlaceholder={isKoUntranslated && !isKoAutoFilled}
                    onCommit={(val) => onUpdateCell(evId, 'name.ko', val)}
                  />
                </td>

                {/* or技名(JA) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameJaHighlight)}`}>
                  <EditableCell
                    value={event.altName?.ja ?? ''}
                    highlight={altNameJaHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.ja', val)}
                  />
                </td>

                {/* or技名(EN) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameEnHighlight)}`}>
                  <EditableCell
                    value={event.altName?.en ?? ''}
                    highlight={altNameEnHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.en', val)}
                  />
                </td>

                {/* or技名(ZH) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameZhHighlight)}`}>
                  <EditableCell
                    value={event.altName?.zh ?? ''}
                    highlight={altNameZhHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.zh', val)}
                  />
                </td>

                {/* or技名(KO) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameKoHighlight)}`}>
                  <EditableCell
                    value={event.altName?.ko ?? ''}
                    highlight={altNameKoHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.ko', val)}
                  />
                </td>

                {/* 種別 */}
```

（altName は任意なので `showAutoLabel`/`isUntranslatedPlaceholder`（未翻訳の赤字警告）は付けない＝空が正常。`bulkUpdate`（複数選択一括編集）は altName 非対応のまま＝v1 スコープ外・unknown field は素通りで無害。）

- [ ] **Step 9: ビルド + 全テストで型と回帰を確認**

Run: `npm run build`
Expected: 成功（tsc -b エラーなし・未使用 highlight 変数なし＝全て td で使用）

Run: `npm run test -- src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: PASS

- [ ] **Step 10: コミット**

```bash
rtk git add src/hooks/useTemplateEditor.ts src/hooks/__tests__/useTemplateEditor.test.ts src/components/admin/TemplateEditor.tsx
rtk git commit -m "feat(admin): テンプレエディタに or技名4列追加 + updateCell が altName.xx を処理(テスト付き)"
```

---

## Task 6: 統合ビルド + 実機 E2E 検証

全変更を通してビルド・全テストを緑にし、エンドユーザー視点で1回通す（[[feedback_endpoint_user_verification]]）。

**Files:** なし（検証のみ）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功（Vercel と同じ tsc -b 厳密・`import type`・未使用なし）

- [ ] **Step 2: 全テスト**

Run: `npm run test`
Expected: 新規テスト（eventName 6 / i18n parity 8 / EventForm altName 3 / useTemplateEditor altName 3）が PASS。既存の `TopBar.test.tsx`(4) と `HousingWorkspace.test.tsx`(1) の既知 failure 以外に新規 failure が無いこと（[[reference_vitest_appcheck_teardown]] 出力をパイプしない）。

- [ ] **Step 3: 実機 — ユーザー側 2択イベント作成→表示**

`npm run dev` でアプリ起動 → 軽減表でイベント追加モーダルを開く → 攻撃名「ホリゾンタル」、or 欄「ヴァーティカル」を入力 → 保存。
確認: タイムライン行に「ホリゾンタル or ヴァーティカル」と表示される。長い場合は既存の truncate に乗る（ホバーで Tooltip）。

- [ ] **Step 4: 実機 — 編集往復**

同イベントを再度開く → or 欄に「ヴァーティカル」が残っている → or 欄を空にして保存 → タイムライン表示が「ホリゾンタル」のみに戻る（altName が外れる）。

- [ ] **Step 5: 実機 — 管理画面 + 言語切替**

`npm run dev:admin`（[[reference_admin_sandbox]]・本番非接触）でテンプレエディタを開く → or技名(JA/EN/ZH/KO) 4列が出る → 任意イベントの or技名(JA) と or技名(EN) を入力 → 言語を English に切替えてタイムライン表示が「name(en) or altName(en)」になることを確認（en 未入力なら en→ja フォールバック）。

- [ ] **Step 6: ユーザーへ実機確認を依頼**

[[feedback_one_fix_one_verify]] / [[feedback_deploy]] に従い、新機能のため本人のローカル確認をゲートにする。OK 後に main へ merge + デプロイ（spec §8）。merge は `superpowers:finishing-a-development-branch` で。

---

## 自己レビュー（spec 突合・完了）

**1. spec カバレッジ:**
- §3.1 データモデル `altName` → Task 1 Step 4 ✓
- §3.2 TimelineRow 表示（`getEventName` 連結・i18n `or_connector`・フォールバック・clip 相乗り）→ Task 1（純関数）+ Task 3（配線）✓
- §3.3 EventForm（state/init/onSave・全空で付けない・ラベル/プレースホルダ）→ Task 4 ✓
- §3.4 TemplateEditor（colgroup/thead/td 4列・`onUpdateCell('altName.xx')`・空で削除）→ Task 5 ✓
- §3.5 i18n（`or_connector`/`alt_name_label`/`alt_name_placeholder` 4言語）→ Task 2 ✓（＋ spec 未記載だった管理ヘッダ4キーも補完）
- §6 影響ファイル（types/EventForm/TemplateEditor/TimelineRow/useTemplateEditor/locales）→ 全タスクで網羅 ✓
- §7 テスト計画（getEventName 純関数 unit / EventForm onSave / TemplateEditor altName セル / i18n パリティ / build / 実機）→ Task 1,2,4,5,6 ✓
- §4（スプシ自動分割）/§5（マーキー）→ **スコープ外**（spec §8 の通り main 投入後の別タスク）。本計画では扱わない。

**2. プレースホルダ走査:** 各コード step に実コードを記載・TBD/「適切に」等なし ✓

**3. 型整合性:** `formatEventName(ev, lang, orConnector)` の引数順が Task 1 定義と Task 3 呼び出しで一致 ✓。`altName.ja/en/zh/ko` フィールドパスが Task 1（型）/ Task 4（EventForm）/ Task 5（updateCell・td）で一貫 ✓。`LocalizedString` を使い `import type`（verbatimModuleSyntax）を遵守 ✓。

**スコープ外メモ（v1 非対応・既知）:**
- `bulkUpdate`（管理画面の複数選択一括編集）は altName 非対応（単一セル編集のみ）。unknown field 素通りで無害。
- スプシ取り込みの "A or B" 自動分割（spec §4）、見切れ名ホバー・マーキー（spec §5）は別タスク。
