# 軽減表 画面文言 繁体字(zh-Hant)対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoPo軽減表(本体機能)の画面文言(`src/locales/zh.json`、2,700キー)を繁体字(`zh-Hant`)化し、`ContentLanguage`として選択可能にする。

**Architecture:** 既存の簡体字(`zh.json`)をopencc-js(`from:'cn', to:'twp'`)で再帰的に機械変換し`zh-Hant.json`を生成する。ジョブ名・ロール名・スキル効果ラベル等の実ゲーム用語だけは機械変換値を使わず、公式繁体字ジョブガイド(台湾版)を情報源に個別の値へ差し替える。あわせて、既存コードにある「言語コードの先頭が`zh`なら簡体字」という誤判定(zh-Hantも引っかかってしまう)6箇所を完全一致判定に修正し、`ContentLanguage`型・`i18n.ts`・`LanguageSwitcher.tsx`にzh-Hantを配線する。

**Tech Stack:** React+TS+Vite / vitest / opencc-js(簡体字→繁体字の機械変換、フェーズ①で導入済み) / スクリプト実行は`npx tsx`

## Global Constraints

- 本プランは`worktree-housing-taiwan-region-support`ブランチ(フェーズ①実装済み、最新コミット`1d135e31`)を起点にworktreeを作って作業する。mainから新規に切らない(`opencc-js`依存が未導入のため)
- `housing.*`名前空間(34キー)は本プランの機械変換の対象に含めてよいが、品質担保(公式訳への差し替え等)はフェーズ③の責務であり本プランでは行わない
- ゲームデータ(Firestore管理の技名等、数千件規模)の翻訳はフェーズ④⑤のスコープであり本プランでは行わない
- vitestは対象ファイル指定で実行、フルはタスク5(最終ゲート)のみ。出力をパイプしない
- コミットは各タスク末尾で1回。pushはしない(全フェーズ完了後にユーザー承認を得てからまとめて)
- 既存の日本語・英語・韓国語・簡体字ユーザーの挙動は一切変えない(回帰テストで担保する)

---

### Task 1: JSON一括変換スクリプト + zh-Hant.json生成 + 完全性テスト

**Files:**
- Create: `scripts/convert-locale-json-to-hant.mjs`
- Create: `src/locales/zh-Hant.json`
- Test: `src/locales/__tests__/zh-hant-completeness.test.ts`

**Interfaces:**
- Produces: `src/locales/zh-Hant.json`(`zh.json`と同じキー構造、全リーフが非空文字列)

- [ ] **Step 1: プレースホルダーの zh-Hant.json を作成**

`src/locales/zh-Hant.json` を作成し、中身を `{}` のみにする(後続のテストがimportエラーで落ちないようにするため)。

- [ ] **Step 2: 失敗するテストを書く** — `src/locales/__tests__/zh-hant-completeness.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            paths.push(path);
        } else if (typeof value === 'object' && value !== null) {
            paths.push(...collectLeafPaths(value as Record<string, unknown>, path));
        }
    }
    return paths;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc == null || typeof acc !== 'object') return undefined;
        return (acc as Record<string, unknown>)[key];
    }, obj);
}

describe('zh-Hant.json の完全性 (zh.json とのキーパリティ)', () => {
    it('zh.json の全キーが zh-Hant.json にも存在し非空である', () => {
        const zhPaths = collectLeafPaths(zh);
        expect(zhPaths.length).toBeGreaterThan(0);
        for (const path of zhPaths) {
            const value = getByPath(zhHant as Record<string, unknown>, path);
            expect(value, `zh-Hant.${path} が存在しないか空`).toBeTruthy();
            expect(typeof value, `zh-Hant.${path} は文字列であるべき`).toBe('string');
        }
    });
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/locales/__tests__/zh-hant-completeness.test.ts` → Expected: FAIL(zh-Hant.jsonが空のため)

- [ ] **Step 4: 変換スクリプトを書く** — `scripts/convert-locale-json-to-hant.mjs`:

```js
// 使い方: node scripts/convert-locale-json-to-hant.mjs
// src/locales/zh.json (簡体字) を再帰的に繁体字へ機械変換し、
// src/locales/zh-Hant.json として書き出す。
// 出力はドラフト: ゲーム固有名詞(ジョブ名・スキル名等)はTask2で個別に手直しすること。
import { readFileSync, writeFileSync } from 'fs';
import * as OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
const SRC = 'src/locales/zh.json';
const DEST = 'src/locales/zh-Hant.json';

function convertDeep(value) {
    if (typeof value === 'string') return converter(value);
    if (typeof value === 'object' && value !== null) {
        const out = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = convertDeep(v);
        }
        return out;
    }
    return value;
}

const zh = JSON.parse(readFileSync(SRC, 'utf8'));
const zhHant = convertDeep(zh);
writeFileSync(DEST, JSON.stringify(zhHant, null, 4) + '\n', 'utf8');
console.log(`Wrote ${DEST}`);
```

- [ ] **Step 5: 変換実行** — Run: `node scripts/convert-locale-json-to-hant.mjs`(プレースホルダーの`{}`を実データで上書きする)

- [ ] **Step 6: パス確認** — Run: `rtk vitest run src/locales/__tests__/zh-hant-completeness.test.ts` → PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/convert-locale-json-to-hant.mjs src/locales/zh-Hant.json src/locales/__tests__/zh-hant-completeness.test.ts
git commit -m "feat: zh.jsonから機械変換したzh-Hant.jsonを追加(2700キー完全性テスト付き)"
```

---

### Task 2: ゲーム用語の総点検 + 公式訳への差し替え

**Files:**
- Create: `scripts/sweep-game-terms-in-locale.ts`
- Modify: `src/locales/zh-Hant.json`(ジョブ名22件・ロール名3件・スキル効果ラベル数件を公式訳に差し替え)
- Test: `src/locales/__tests__/zh-hant-completeness.test.ts`(Task1で作成済み、差し替え後も引き続きPASSすること)

**Interfaces:**
- Consumes: `src/data/mockData.ts`の`JOBS`(`{id, name: {ja,en,zh,ko}, role}[]`)・`MITIGATIONS`(`{id, name: {ja,en,zh,ko}, ...}[]`)
- Produces: `src/locales/zh-Hant.json`の`jobs.*`(22件)・`roles.*`(3件)・その他洗い出しで見つかった項目が公式繁体字訳に更新された状態

- [ ] **Step 1: 洗い出しスクリプトを書く** — `scripts/sweep-game-terms-in-locale.ts`:

```ts
// 使い方: npx tsx scripts/sweep-game-terms-in-locale.ts
// src/locales/zh.json の文言の中に、src/data/mockData.ts のスキル名(zh)が
// 部分一致で含まれている箇所を一覧表示する(jobs.*/roles.*は全件が対象と分かっているため除外)。
// 出力された項目は機械変換ではなく公式ソースで個別に訳し直す候補。
import { readFileSync } from 'fs';
import { MITIGATIONS } from '../src/data/mockData';

const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));

function collectLeaves(obj: Record<string, unknown>, prefix = ''): [string, string][] {
    const out: [string, string][] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (path.startsWith('jobs.') || path.startsWith('roles.')) continue;
        if (typeof value === 'string') {
            out.push([path, value]);
        } else if (typeof value === 'object' && value !== null) {
            out.push(...collectLeaves(value as Record<string, unknown>, path));
        }
    }
    return out;
}

const skillTerms = [...new Set(MITIGATIONS.map((m) => m.name.zh).filter((t) => t.length >= 2))];
const leaves = collectLeaves(zh);

for (const [path, value] of leaves) {
    for (const term of skillTerms) {
        if (value.includes(term)) {
            console.log(`${path} = ${JSON.stringify(value)}  (一致: "${term}")`);
            break;
        }
    }
}
```

- [ ] **Step 2: 洗い出し実行** — Run: `npx tsx scripts/sweep-game-terms-in-locale.ts` → 出力された一覧を記録する(既知の`mechanic_modal.deployment_variants.plain/crit/crit_protraction`が出てくるはず。それ以外に新規の一致が無いか確認する)

- [ ] **Step 3: 対象キーの一覧を確定する**

以下を「公式訳への差し替え対象」として確定する:
- `jobs.*`(22キー、`src/locales/ja.json`の`jobs.*`と同じ22ジョブ)
- `roles.tank` / `roles.healer` / `roles.dps`
- Step 2の出力に含まれる全キー

- [ ] **Step 4: 公式ソースを調査して差し替える**

各ジョブについて `https://www.ffxiv.com.tw/web/intro/guide/battle/{job}/` (`{job}`は英語名を小文字化・スペース除去したスラッグ。例: Dark Knight→darkknight、White Mage→whitemage。404の場合は `https://www.ffxiv.com.tw/web/intro/guide/battle/` の一覧から探す)を調べ、正式な繁体字ジョブ名を`src/locales/zh-Hant.json`の`jobs.<id>`に反映する。ロール名(タンク/ヒーラー/DPS)はいずれかのジョブガイドページの共通UI表記から拾う。

Step2で見つかったスキル効果ラベルは、対応するジョブの公式ガイドページ内の技説明から該当する繁体字表記を探して反映する。見つからない場合は機械変換値のまま残し、その旨をコミットメッセージに明記する(フェーズ①のTask1 Step5と同じ扱い)。

- [ ] **Step 5: パス確認** — Run: `rtk vitest run src/locales/__tests__/zh-hant-completeness.test.ts` → PASS(差し替え後も全キー非空であること)

- [ ] **Step 6: Commit**

```bash
git add scripts/sweep-game-terms-in-locale.ts src/locales/zh-Hant.json
git commit -m "feat: zh-Hant.jsonのジョブ名・ロール名・スキル効果ラベルを公式繁体字訳へ差し替え"
```

---

### Task 3: ContentLanguage型・i18n.ts・LanguageSwitcher.tsxへのzh-Hant追加

**Files:**
- Modify: `src/store/useThemeStore.ts:5`
- Modify: `src/i18n.ts`
- Modify: `src/components/LanguageSwitcher.tsx:10-15`

**Interfaces:**
- Produces: `ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant'`。`i18n`に`zh-Hant`リソースが登録され`i18n.changeLanguage('zh-Hant')`で切替可能。`LanguageSwitcher`に「繁體中文」が選択肢として表示される

- [ ] **Step 1: ContentLanguage型を拡張** — `src/store/useThemeStore.ts:5`:

```ts
export type ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant';
```

`SUPPORTED_LANGS`相当のチェックがある場合(`i18n.ts`側)にも反映するため、この時点ではuseThemeStore.tsのみ変更する。

- [ ] **Step 2: i18n.ts にzh-Hantを追加** — `src/i18n.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import zhHant from './locales/zh-Hant.json';
import ko from './locales/ko.json';

const SUPPORTED_LANGS = ['ja', 'en', 'zh', 'ko', 'zh-Hant'] as const;
function getSavedLanguage(): typeof SUPPORTED_LANGS[number] {
    try {
        const raw = localStorage.getItem('theme-storage');
        if (raw) {
            const parsed = JSON.parse(raw);
            const lang = parsed?.state?.contentLanguage;
            if (SUPPORTED_LANGS.includes(lang)) return lang;
        }
    } catch { /* localStorageアクセス失敗時はデフォルト */ }
    return 'ja';
}

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        ja: { translation: ja },
        zh: { translation: zh },
        ko: { translation: ko },
        'zh-Hant': { translation: zhHant },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'ja',
    returnEmptyString: false,
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
```

- [ ] **Step 3: LanguageSwitcherに追加** — `src/components/LanguageSwitcher.tsx:10-15`:

```ts
const LANGUAGES: { code: ContentLanguage; label: string }[] = [
    { code: 'ja', label: '日本語' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'zh-Hant', label: '繁體中文' },
    { code: 'ko', label: '한국어' },
];
```

- [ ] **Step 4: ビルドで型エラーの見落としを確認** — Run: `rtk npm run build` → `ContentLanguage`を網羅的にswitchしている箇所があればTypeScriptエラーとして検出される。エラーが出た場合はそのファイルを開き、`zh-Hant`の分岐を追加する(該当箇所はビルドエラーメッセージのファイル・行番号に従う)

- [ ] **Step 5: 既存言語の動作確認** — Run: `rtk vitest run src/locales/__tests__` → 既存の`event-i18n-parity.test.ts`・`sheet-import-wizard-i18n-parity.test.ts`・Task1で作った`zh-hant-completeness.test.ts`が全てPASSすること

- [ ] **Step 6: Commit**

```bash
git add src/store/useThemeStore.ts src/i18n.ts src/components/LanguageSwitcher.tsx
git commit -m "feat: ContentLanguage/i18n/LanguageSwitcherにzh-Hantを追加"
```

---

### Task 4: 既存"zh"判定誤り8ファイルの是正 + 回帰テスト

**Files:**
- Modify: `src/types/index.ts:13`
- Modify: `src/components/MobileContextMenu.tsx:24`
- Modify: `src/components/LimitResolutionSheet.tsx:145-152`
- Modify: `src/components/MitigationSheetPreview.tsx:27`
- Modify: `src/types/systemNotification.ts:7-12`
- Modify: `src/lib/localizedText.ts`
- Modify: `src/components/SystemNotificationModal.tsx:13,17-24`
- Modify: `src/components/SystemNotificationBar.tsx:13,14-19`
- Test: `src/components/__tests__/SystemNotificationBar.test.tsx`(既存ファイルに追記)
- Test: `src/lib/__tests__/localizedText.test.ts`(既存ファイルに追記)

**Interfaces:**
- Consumes: Task3で追加した`ContentLanguage`の`'zh-Hant'`
- Produces: 上記ファイルすべてで`'zh-hant'`系の言語コードを`'zh'`(簡体字)と誤判定しなくなる。`resolveLocalized`が`'zh-Hant'`を受け付け、値があれば優先・無ければ`en`にフォールバックする

- [ ] **Step 1: 対象2関数をexportする(挙動は変えない)**

`src/components/SystemNotificationBar.tsx:13-19`の`normalizeLang`と、`src/components/SystemNotificationModal.tsx:17-24`の`normalizeLang`の両方に`export`を付ける(ロジックはまだ変更しない)。

- [ ] **Step 2: 失敗するテストを書く** — `src/components/__tests__/SystemNotificationBar.test.tsx` に追記:

```ts
import { normalizeLang } from '../SystemNotificationBar';
import { normalizeLang as normalizeLangModal } from '../SystemNotificationModal';

describe('normalizeLang: zh-Hant は zh(簡体字)と区別される', () => {
    it.each([
        ['SystemNotificationBar', normalizeLang],
        ['SystemNotificationModal', normalizeLangModal],
    ] as const)('%s: zh-Hant を渡すと zh ではない値になる', (_name, fn) => {
        expect(fn('zh-Hant')).not.toBe('zh');
    });
});
```

(このテストファイルは`SystemNotificationBar`用だが、同じバグパターンを持つ`SystemNotificationModal`の関数もあわせて検証する)

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/components/__tests__/SystemNotificationBar.test.tsx` → Expected: FAIL(現状`normalizeLang('zh-Hant')`は`startsWith('zh')`により`'zh'`を返すため)

- [ ] **Step 4: LocalizedText型・SupportedLang型にzh-Hantを追加**

`src/types/systemNotification.ts:7-12`:
```ts
export interface LocalizedText {
  ja: string;
  en: string;
  ko?: string;
  zh?: string;
  'zh-Hant'?: string;
}
```

`src/lib/localizedText.ts`(全文):
```ts
import type { LocalizedText } from '../types/systemNotification';

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

/**
 * 多言語テキストから指定 lang の文字列を取り出す。 順序: lang → en → ja。
 * en が空文字列 ('') の場合は ja にフォールバック。
 */
export function resolveLocalized(text: LocalizedText, lang: SupportedLang): string {
  const candidate = text[lang];
  if (candidate) return candidate;
  if (text.en) return text.en;
  return text.ja;
}
```

- [ ] **Step 5: 8ファイルを完全一致判定に修正する**

`src/types/index.ts:13`(念のためzh-Hant分岐を明示):
```ts
if (lang === 'zh-Hant' && name['zh-Hant']) return name['zh-Hant'];
if (lang === 'zh' && name.zh) return name.zh;
```

`src/components/MobileContextMenu.tsx:24`:
```ts
if (lang === 'zh-Hant' && loc['zh-Hant']) return loc['zh-Hant'] ?? loc.en ?? loc.ja ?? '';
if (lang === 'zh' && loc.zh) return loc.zh ?? loc.en ?? loc.ja ?? '';
```

`src/components/LimitResolutionSheet.tsx:145-152`(既存の`langSrc.startsWith(...)`三項連鎖にzh-Hant分岐を追加):
```ts
const langSrc = i18n?.language ?? 'en';
const lang = langSrc.startsWith('ja')
    ? 'ja'
    : (langSrc === 'zh-Hant' || langSrc.toLowerCase().startsWith('zh-hant'))
        ? 'zh-Hant'
        : langSrc.startsWith('zh')
            ? 'zh'
            : langSrc.startsWith('ko')
                ? 'ko'
                : 'en';
```

`src/components/MitigationSheetPreview.tsx:27`:
```ts
const lang = contentLanguage || (
    i18n.language.startsWith('ja') ? 'ja'
    : (i18n.language === 'zh-Hant' || i18n.language.toLowerCase().startsWith('zh-hant')) ? 'zh-Hant'
    : i18n.language.startsWith('zh') ? 'zh'
    : i18n.language.startsWith('ko') ? 'ko'
    : 'en'
);
```

`src/components/SystemNotificationModal.tsx:17-24`(Step1でexport済みの`normalizeLang`を修正):
```ts
export type SupportedLang = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';
export function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang === 'zh-Hant' || lang.toLowerCase().startsWith('zh-hant')) return 'zh-Hant';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}
```

`src/components/SystemNotificationBar.tsx:13-19`: `SystemNotificationModal.tsx`と全く同じ`normalizeLang`修正を適用する。

- [ ] **Step 6: パス確認(バグ修正分)** — Run: `rtk vitest run src/components/__tests__/SystemNotificationBar.test.tsx` → PASS

- [ ] **Step 7: localizedText.test.ts にzh-Hantのテストを追記**

`src/lib/__tests__/localizedText.test.ts`に追記:
```ts
it('zh-Hant が指定されていれば優先し、未指定なら en にフォールバックする', () => {
  const withHant: LocalizedText = { ja: 'こんにちは', en: 'Hello', 'zh-Hant': '你好(繁體)' };
  expect(resolveLocalized(withHant, 'zh-Hant')).toBe('你好(繁體)');
  const noHant: LocalizedText = { ja: 'こんにちは', en: 'Hello' };
  expect(resolveLocalized(noHant, 'zh-Hant')).toBe('Hello');
});
```

- [ ] **Step 8: 回帰確認** — Run: `rtk vitest run src/lib/__tests__/localizedText.test.ts src/components/__tests__/SystemNotificationBar.test.tsx src/components/__tests__/SystemNotificationModal.test.tsx` → PASS(既存の`zh`/`ja`/`en`/`ko`分岐のテストも全部通ること)

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/types/systemNotification.ts src/lib/localizedText.ts src/lib/__tests__/localizedText.test.ts src/components/MobileContextMenu.tsx src/components/LimitResolutionSheet.tsx src/components/MitigationSheetPreview.tsx src/components/SystemNotificationModal.tsx src/components/SystemNotificationBar.tsx src/components/__tests__/SystemNotificationBar.test.tsx
git commit -m "fix: 軽減表・通知まわりのzh-Hant誤判定(startsWith('zh'))を完全一致判定に修正"
```

---

### Task 5: フルゲート実行

**Files:** なし(検証のみ)

- [ ] **Step 1: フルビルド** — Run: `rtk npm run build` → exit 0

- [ ] **Step 2: フルテスト** — Run: `rtk vitest run` → 既知のEphemeralAddPanel失敗(7件、フェーズ①のTask10で確認済み・本フェーズと無関係)以外は全てPASSすること

- [ ] **Step 3: ユーザーへ結果報告** — ビルド・テスト結果と、Task2で公式訳に差し替えた項目一覧(差し替えできず機械変換値のまま残った項目があればそれも)を報告する。pushはしない(全フェーズ完了後にユーザー承認を得てから)
