# vitest導入 + OGP多言語対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テスト基盤（vitest）を導入し、OGP画像・メタタグの多言語対応をテスト付きで実装する

**Architecture:** OGP生成の純粋ロジック（コンテンツ名取得・シリーズ判定等）を `src/lib/ogpHelpers.ts` に切り出し、vitestでテスト。API側（Edge Function / Serverless）はこのヘルパーを呼ぶだけにする。共有データにlangフィールドを追加し、OGP画像・メタタグの両方で言語を切り替える。

**Tech Stack:** vitest, TypeScript, Vercel Edge Functions, Vercel Serverless Functions

---

## ファイルマップ

| ファイル | 操作 | 責務 |
|---------|------|------|
| `package.json` | 修正 | vitest追加、testスクリプト追加 |
| `vite.config.ts` | 修正 | vitest設定追加（/// reference） |
| `vitest.config.ts` | 新規 | vitest専用設定ファイル |
| `src/lib/ogpHelpers.ts` | 新規 | OGPの純粋ロジック（getContentName, parseTier, trySeriesSummary, CONTENT_META） |
| `src/lib/__tests__/ogpHelpers.test.ts` | 新規 | ogpHelpersのテスト |
| `src/lib/__tests__/planService.test.ts` | 新規 | planServiceのマージロジックのテスト（将来拡張用の起点） |
| `api/og/index.ts` | 修正 | ロジックをogpHelpersからimport、langパラメータ対応 |
| `api/share/index.ts` | 修正 | POST時にlangフィールド保存 |
| `api/share-page/index.ts` | 修正 | CONTENT_NAMESをogpHelpersに統一、lang対応 |
| `src/components/ShareModal.tsx` | 修正 | POST bodyとOG URLにlang含める |

---

## Task 1: vitest導入

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: vitestをインストール**

```bash
npm install -D vitest
```

- [ ] **Step 2: vitest.config.tsを作成**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
    },
});
```

- [ ] **Step 3: package.jsonにtestスクリプト追加**

`package.json` の `scripts` セクションに追加:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 動作確認**

```bash
npx vitest run
```

Expected: テストファイルがないので「No test files found」的なメッセージ。エラーなく終了すればOK。

- [ ] **Step 5: コミット**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: vitest導入"
```

---

## Task 2: OGPロジックを切り出し（ogpHelpers.ts）

**Files:**
- Create: `src/lib/ogpHelpers.ts`
- Modify: `api/og/index.ts` — CONTENT_META・getContentName・getCategoryTag・parseTier・trySeriesSummaryを削除し、ogpHelpersからimport

**重要:** このTaskではまだ多言語対応しない。現在の日本語固定ロジックをそのまま移動するだけ。

- [ ] **Step 1: `src/lib/ogpHelpers.ts` を作成**

`api/og/index.ts` から以下を移動:
- `CONTENT_META` 定数（型: `Record<string, { ja: string; category: string; level: number }>`）
- `CATEGORY_LABELS` 定数
- `getCategoryTag()` 関数
- `getContentName()` 関数
- `ParsedTier` インターフェース
- `parseTier()` 関数
- `trySeriesSummary()` 関数

すべて `export` する。関数のシグネチャは変えない。

```typescript
// src/lib/ogpHelpers.ts
// OGP画像・メタタグ生成で使う純粋ロジック
// Edge Function (api/og) と Serverless Function (api/share-page) の両方から使う

export const CONTENT_META: Record<string, { ja: string; category: string; level: number }> = {
    // ... 現在のapi/og/index.tsから全行コピー
};

export const CATEGORY_LABELS: Record<string, string> = {
    savage: 'Savage',
    ultimate: 'Ultimate',
    dungeon: 'Dungeon',
    raid: 'Raid',
    custom: 'Misc',
};

export function getCategoryTag(contentId: string | null): string {
    if (!contentId) return '';
    const meta = CONTENT_META[contentId];
    if (!meta) return '';
    return `${CATEGORY_LABELS[meta.category] || meta.category} — Lv.${meta.level}`;
}

export function getContentName(contentId: string | null): string {
    if (!contentId) return '';
    return CONTENT_META[contentId]?.ja || '';
}

export interface ParsedTier {
    seriesName: string;
    tierName: string;
    label: string;
}

export function parseTier(ja: string): ParsedTier | null {
    const m = ja.match(/^(.+?)：(.+?)(\d+)(?:（(.+?)）)?$/);
    if (!m) return null;
    const suffix = m[4] || '';
    return { seriesName: m[1], tierName: m[2], label: m[3] + suffix };
}

export function trySeriesSummary(plans: { contentId: string | null; title: string }[]): {
    seriesName: string;
    tierName: string;
    summary: string;
    categoryTag: string;
} | null {
    if (plans.length < 2) return null;
    const parsed: ParsedTier[] = [];
    for (const plan of plans) {
        const name = getContentName(plan.contentId);
        if (!name) return null;
        const p = parseTier(name);
        if (!p) return null;
        parsed.push(p);
    }
    const first = parsed[0];
    if (!parsed.every(p => p.seriesName === first.seriesName && p.tierName === first.tierName)) {
        return null;
    }
    const summary = first.tierName + ' ' + parsed.map(p => p.label).join(' ｜ ');
    const categoryTag = plans[0].contentId ? getCategoryTag(plans[0].contentId) : '';
    return { seriesName: first.seriesName, tierName: first.tierName, summary, categoryTag };
}
```

- [ ] **Step 2: `api/og/index.ts` を修正**

ファイル冒頭のimportに追加:
```typescript
import { CONTENT_META, CATEGORY_LABELS, getCategoryTag, getContentName, parseTier, trySeriesSummary } from '../../src/lib/ogpHelpers';
import type { ParsedTier } from '../../src/lib/ogpHelpers';
```

削除する箇所:
- `CONTENT_META` 定数全体（18〜82行目）
- `CATEGORY_LABELS` 定数（84〜90行目）
- `getCategoryTag` 関数（92〜97行目）
- `getContentName` 関数（99〜102行目）
- `ParsedTier` インターフェース（111〜115行目）
- `parseTier` 関数（119〜124行目）
- `trySeriesSummary` 関数（127〜154行目）

残りのコード（LEFT_PANEL_WIDTH以降）はそのまま。

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。切り出し前と同じ動作。

- [ ] **Step 4: コミット**

```bash
git add src/lib/ogpHelpers.ts api/og/index.ts
git commit -m "refactor: OGPロジックをogpHelpers.tsに切り出し"
```

---

## Task 3: 切り出したロジックのテストを書く（現行動作を保証）

**Files:**
- Create: `src/lib/__tests__/ogpHelpers.test.ts`

多言語対応を入れる **前に**、現在の動作をテストで固める。

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/lib/__tests__/ogpHelpers.test.ts
import { describe, it, expect } from 'vitest';
import {
    CONTENT_META,
    getContentName,
    getCategoryTag,
    parseTier,
    trySeriesSummary,
} from '../ogpHelpers';

// ========================================
// CONTENT_META の網羅性テスト
// ========================================
describe('CONTENT_META', () => {
    it('全エントリにja, category, levelが存在する', () => {
        for (const [id, meta] of Object.entries(CONTENT_META)) {
            expect(meta.ja, `${id}.ja が空`).toBeTruthy();
            expect(meta.category, `${id}.category が空`).toBeTruthy();
            expect(typeof meta.level, `${id}.level が数値でない`).toBe('number');
        }
    });

    it('主要なコンテンツIDが存在する', () => {
        const requiredIds = ['m9s', 'm12s_p1', 'fru', 'dsr', 'top', 'tea', 'ucob', 'uwu', 'p9s', 'e9s', 'o9s'];
        for (const id of requiredIds) {
            expect(CONTENT_META[id], `${id} が存在しない`).toBeDefined();
        }
    });
});

// ========================================
// getContentName
// ========================================
describe('getContentName', () => {
    it('存在するcontentIdで日本語名を返す', () => {
        expect(getContentName('m9s')).toBe('至天の座アルカディア零式：ヘビー級1');
    });

    it('nullで空文字を返す', () => {
        expect(getContentName(null)).toBe('');
    });

    it('存在しないIDで空文字を返す', () => {
        expect(getContentName('nonexistent')).toBe('');
    });

    it('絶コンテンツの名前を正しく返す', () => {
        expect(getContentName('fru')).toBe('絶もうひとつの未来');
        expect(getContentName('tea')).toBe('絶アレキサンダー討滅戦');
    });
});

// ========================================
// getCategoryTag
// ========================================
describe('getCategoryTag', () => {
    it('零式コンテンツでSavageタグを返す', () => {
        expect(getCategoryTag('m9s')).toBe('Savage — Lv.100');
    });

    it('絶コンテンツでUltimateタグを返す', () => {
        expect(getCategoryTag('fru')).toBe('Ultimate — Lv.100');
        expect(getCategoryTag('ucob')).toBe('Ultimate — Lv.70');
    });

    it('nullで空文字を返す', () => {
        expect(getCategoryTag(null)).toBe('');
    });

    it('存在しないIDで空文字を返す', () => {
        expect(getCategoryTag('nonexistent')).toBe('');
    });
});

// ========================================
// parseTier
// ========================================
describe('parseTier', () => {
    it('標準的な零式名をパースできる', () => {
        const result = parseTier('至天の座アルカディア零式：ヘビー級1');
        expect(result).toEqual({
            seriesName: '至天の座アルカディア零式',
            tierName: 'ヘビー級',
            label: '1',
        });
    });

    it('前半/後半付きをパースできる', () => {
        const result = parseTier('至天の座アルカディア零式：ヘビー級4（前半）');
        expect(result).toEqual({
            seriesName: '至天の座アルカディア零式',
            tierName: 'ヘビー級',
            label: '4前半',
        });
    });

    it('パンデモニウムをパースできる', () => {
        const result = parseTier('万魔殿パンデモニウム零式：天獄編1');
        expect(result).toEqual({
            seriesName: '万魔殿パンデモニウム零式',
            tierName: '天獄編',
            label: '1',
        });
    });

    it('絶コンテンツ名はパースできない（null）', () => {
        expect(parseTier('絶もうひとつの未来')).toBeNull();
    });

    it('空文字はパースできない（null）', () => {
        expect(parseTier('')).toBeNull();
    });
});

// ========================================
// trySeriesSummary
// ========================================
describe('trySeriesSummary', () => {
    it('同シリーズ・同階級のバンドルでまとめ表記を返す', () => {
        const plans = [
            { contentId: 'm9s', title: 'Plan A' },
            { contentId: 'm10s', title: 'Plan B' },
            { contentId: 'm11s', title: 'Plan C' },
        ];
        const result = trySeriesSummary(plans);
        expect(result).not.toBeNull();
        expect(result!.seriesName).toBe('至天の座アルカディア零式');
        expect(result!.tierName).toBe('ヘビー級');
        expect(result!.summary).toBe('ヘビー級 1 ｜ 2 ｜ 3');
        expect(result!.categoryTag).toBe('Savage — Lv.100');
    });

    it('前半/後半混在でもまとめ表記を返す', () => {
        const plans = [
            { contentId: 'm12s_p1', title: '' },
            { contentId: 'm12s_p2', title: '' },
        ];
        const result = trySeriesSummary(plans);
        expect(result).not.toBeNull();
        expect(result!.summary).toBe('ヘビー級 4前半 ｜ 4後半');
    });

    it('異なるシリーズのバンドルでnullを返す', () => {
        const plans = [
            { contentId: 'm9s', title: '' },
            { contentId: 'p9s', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });

    it('絶コンテンツのバンドルでnullを返す（parseTierが失敗）', () => {
        const plans = [
            { contentId: 'fru', title: '' },
            { contentId: 'tea', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });

    it('1件のプランでnullを返す', () => {
        expect(trySeriesSummary([{ contentId: 'm9s', title: '' }])).toBeNull();
    });

    it('contentIdがnullのプランを含むとnullを返す', () => {
        const plans = [
            { contentId: null, title: 'Custom' },
            { contentId: 'm9s', title: '' },
        ];
        expect(trySeriesSummary(plans)).toBeNull();
    });
});
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run
```

Expected: 全テストPASS。

- [ ] **Step 3: コミット**

```bash
git add src/lib/__tests__/ogpHelpers.test.ts
git commit -m "test: ogpHelpersの現行動作テスト追加"
```

---

## Task 4: CONTENT_METAにenフィールド追加 + getContentName多言語対応

**Files:**
- Modify: `src/lib/ogpHelpers.ts`
- Modify: `src/lib/__tests__/ogpHelpers.test.ts`

- [ ] **Step 1: テストを先に更新（失敗するテストを追加）**

`ogpHelpers.test.ts` に追加:

```typescript
// CONTENT_META のenフィールドテスト
describe('CONTENT_META（多言語）', () => {
    it('全エントリにenフィールドが存在する', () => {
        for (const [id, meta] of Object.entries(CONTENT_META)) {
            expect(meta.en, `${id}.en が空`).toBeTruthy();
        }
    });
});

// getContentName の多言語テスト
describe('getContentName（多言語）', () => {
    it('lang="ja"で日本語名を返す', () => {
        expect(getContentName('m9s', 'ja')).toBe('至天の座アルカディア零式：ヘビー級1');
    });

    it('lang="en"で英語名を返す', () => {
        expect(getContentName('m9s', 'en')).toBe('AAC Heavyweight M1 (Savage)');
    });

    it('langを省略するとjaを返す（後方互換）', () => {
        expect(getContentName('m9s')).toBe('至天の座アルカディア零式：ヘビー級1');
    });

    it('絶コンテンツの英語名を正しく返す', () => {
        expect(getContentName('fru', 'en')).toBe('Futures Rewritten (Ultimate)');
        expect(getContentName('tea', 'en')).toBe('The Epic of Alexander (Ultimate)');
        expect(getContentName('ucob', 'en')).toBe('The Unending Coil of Bahamut (Ultimate)');
        expect(getContentName('uwu', 'en')).toBe("The Weapon's Refrain (Ultimate)");
        expect(getContentName('top', 'en')).toBe('The Omega Protocol (Ultimate)');
        expect(getContentName('dsr', 'en')).toBe("Dragonsong's Reprise (Ultimate)");
    });

    it('パンデモニウムの英語名を正しく返す', () => {
        expect(getContentName('p9s', 'en')).toBe('Anabaseios: The Ninth Circle (Savage)');
        expect(getContentName('p12s_p1', 'en')).toBe('Anabaseios: The Twelfth Circle (Savage) Phase 1');
    });

    it('エデンの英語名を正しく返す', () => {
        expect(getContentName('e9s', 'en')).toBe("Eden's Promise: Umbra (Savage)");
        expect(getContentName('e5s', 'en')).toBe("Eden's Verse: Fulmination (Savage)");
        expect(getContentName('e1s', 'en')).toBe("Eden's Gate: Resurrection (Savage)");
    });

    it('オメガの英語名を正しく返す', () => {
        expect(getContentName('o9s', 'en')).toBe('Omega: Alphascape V1.0 (Savage)');
        expect(getContentName('o5s', 'en')).toBe('Omega: Sigmascape V1.0 (Savage)');
        expect(getContentName('o1s', 'en')).toBe('Omega: Deltascape V1.0 (Savage)');
    });
});
```

- [ ] **Step 2: テスト実行（失敗を確認）**

```bash
npx vitest run
```

Expected: 新しいテストがFAIL（enフィールドがない、lang引数がない）

- [ ] **Step 3: ogpHelpers.tsを修正**

3a. `CONTENT_META` の型を `{ ja: string; en: string; category: string; level: number }` に変更し、全エントリに `en` フィールドを追加。英語名は `src/data/contents.json` と一致させること。

3b. `getContentName` のシグネチャを変更:

```typescript
export type OgpLang = 'ja' | 'en';

export function getContentName(contentId: string | null, lang: OgpLang = 'ja'): string {
    if (!contentId) return '';
    const meta = CONTENT_META[contentId];
    if (!meta) return '';
    return meta[lang] || meta.ja || '';
}
```

- [ ] **Step 4: テスト実行（全パス確認）**

```bash
npx vitest run
```

Expected: 全テストPASS。

- [ ] **Step 5: コミット**

```bash
git add src/lib/ogpHelpers.ts src/lib/__tests__/ogpHelpers.test.ts
git commit -m "feat: CONTENT_METAにenフィールド追加、getContentName多言語対応"
```

---

## Task 5: trySeriesSummaryを多言語対応

**Files:**
- Modify: `src/lib/ogpHelpers.ts`
- Modify: `src/lib/__tests__/ogpHelpers.test.ts`

`trySeriesSummary` は日本語名の構造（`：` `（）`）に依存している。英語名は構造が異なるため、英語モードでは「まとめ表記」を使わず混在リストにフォールバックする方針（`parseTier` は日本語専用のまま）。

- [ ] **Step 1: テストを追加**

```typescript
describe('trySeriesSummary（多言語）', () => {
    it('lang="ja"で従来通りまとめ表記を返す', () => {
        const plans = [
            { contentId: 'm9s', title: '' },
            { contentId: 'm10s', title: '' },
        ];
        const result = trySeriesSummary(plans, 'ja');
        expect(result).not.toBeNull();
        expect(result!.seriesName).toBe('至天の座アルカディア零式');
        expect(result!.summary).toBe('ヘビー級 1 ｜ 2');
    });

    it('lang="en"ではnullを返す（英語名はparseTier非対応）', () => {
        const plans = [
            { contentId: 'm9s', title: '' },
            { contentId: 'm10s', title: '' },
        ];
        expect(trySeriesSummary(plans, 'en')).toBeNull();
    });

    it('langを省略すると従来通り日本語で処理', () => {
        const plans = [
            { contentId: 'm9s', title: '' },
            { contentId: 'm10s', title: '' },
        ];
        expect(trySeriesSummary(plans)).not.toBeNull();
    });
});
```

- [ ] **Step 2: ogpHelpers.tsを修正**

`trySeriesSummary` に `lang` 引数を追加:

```typescript
export function trySeriesSummary(
    plans: { contentId: string | null; title: string }[],
    lang: OgpLang = 'ja',
): { seriesName: string; tierName: string; summary: string; categoryTag: string } | null {
    if (plans.length < 2) return null;

    // parseTierは日本語名の構造に依存するため、英語モードではまとめ表記を使わない
    if (lang !== 'ja') return null;

    const parsed: ParsedTier[] = [];
    for (const plan of plans) {
        const name = getContentName(plan.contentId, 'ja');
        if (!name) return null;
        const p = parseTier(name);
        if (!p) return null;
        parsed.push(p);
    }

    const first = parsed[0];
    if (!parsed.every(p => p.seriesName === first.seriesName && p.tierName === first.tierName)) {
        return null;
    }

    const summary = first.tierName + ' ' + parsed.map(p => p.label).join(' ｜ ');
    const categoryTag = plans[0].contentId ? getCategoryTag(plans[0].contentId) : '';
    return { seriesName: first.seriesName, tierName: first.tierName, summary, categoryTag };
}
```

- [ ] **Step 3: テスト実行**

```bash
npx vitest run
```

Expected: 全テストPASS。

- [ ] **Step 4: コミット**

```bash
git add src/lib/ogpHelpers.ts src/lib/__tests__/ogpHelpers.test.ts
git commit -m "feat: trySeriesSummary多言語対応（英語は混在リストフォールバック）"
```

---

## Task 6: api/share/index.ts — langフィールド保存

**Files:**
- Modify: `api/share/index.ts`

- [ ] **Step 1: POST処理にlangフィールドを追加**

`req.body` から `lang` を取得し、Firestoreドキュメントに保存する。

`api/share/index.ts` 56行目付近、POST処理の先頭:

```typescript
const { planData, title, contentId, plans, logoStoragePath, lang } = req.body;
```

単一プラン共有のdoc構築（98行目付近）に追加:
```typescript
const doc: any = {
    shareId,
    title: title || '',
    contentId: contentId || null,
    planData,
    copyCount: 0,
    viewCount: 0,
    createdAt: Date.now(),
    lang: lang === 'en' ? 'en' : 'ja',  // 不正値はjaにフォールバック
};
```

バンドル共有のdoc構築（76行目付近）に同様追加:
```typescript
const doc: any = {
    shareId,
    type: 'bundle',
    plans: plans.map((p: any) => ({ ... })),
    copyCount: 0,
    viewCount: 0,
    createdAt: Date.now(),
    lang: lang === 'en' ? 'en' : 'ja',
};
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add api/share/index.ts
git commit -m "feat: 共有データにlangフィールド保存"
```

---

## Task 7: api/og/index.ts — langパラメータ対応

**Files:**
- Modify: `api/og/index.ts`

- [ ] **Step 1: importを更新**

ogpHelpersから `OgpLang` 型もimport:

```typescript
import {
    getContentName,
    getCategoryTag,
    trySeriesSummary,
    type OgpLang,
} from '../../src/lib/ogpHelpers';
```

- [ ] **Step 2: ハンドラでlangパラメータを取得**

`handler` 関数の先頭（searchParamsから取得する箇所）:

```typescript
const lang: OgpLang = searchParams.get('lang') === 'en' ? 'en' : 'ja';
```

- [ ] **Step 3: getContentNameの呼び出しにlangを渡す**

`contentName = getContentName(contentId)` → `contentName = getContentName(contentId, lang)`

フォント取得のallText構築:
`getContentName(p.contentId)` → `getContentName(p.contentId, lang)`

buildMixedLayout内:
`getContentName(plan.contentId)` → `getContentName(plan.contentId, lang)`

- [ ] **Step 4: trySeriesSummaryの呼び出しにlangを渡す**

`trySeriesSummary(bundlePlans)` → `trySeriesSummary(bundlePlans, lang)`

- [ ] **Step 5: buildBundleLayout / buildMixedLayoutにlangを渡す**

関数シグネチャに`lang: OgpLang`を追加し、内部の`getContentName`呼び出しに伝播:

```typescript
function buildBundleLayout(plans, faviconBase64, teamLogoSrc, lang: OgpLang) { ... }
function buildSeriesLayout(series, faviconBase64, teamLogoSrc) { ... }  // 変更不要（seriesは既にja固定）
function buildMixedLayout(plans, faviconBase64, teamLogoSrc, lang: OgpLang) { ... }
```

ハンドラの呼び出し:
```typescript
: isBundle
    ? buildBundleLayout(bundlePlans, faviconBase64, teamLogoSrc, lang)
    : buildSingleLayout(contentName, ...)
```

`buildMixedLayout`内の`getContentName`呼び出し:
```typescript
const name = getContentName(plan.contentId, lang) || plan.title || '';
```

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add api/og/index.ts
git commit -m "feat: OGP画像生成のlangパラメータ対応"
```

---

## Task 8: api/share-page/index.ts — CONTENT_NAMES廃止 + lang対応

**Files:**
- Modify: `api/share-page/index.ts`

- [ ] **Step 1: CONTENT_NAMESをogpHelpersに置き換え**

importを追加:
```typescript
import { getContentName, type OgpLang } from '../../src/lib/ogpHelpers';
```

`CONTENT_NAMES` 定数（15〜36行目）を削除。

- [ ] **Step 2: 共有データからlangを取得**

ハンドラ内、`snap.data()` 取得後:

```typescript
const data = snap.data()!;
const lang: OgpLang = data.lang === 'en' ? 'en' : 'ja';
```

- [ ] **Step 3: コンテンツ名取得をgetContentNameに変更**

バンドル共有（76行目付近）:
```typescript
const names = data.plans
    .map((p: any) => getContentName(p.contentId, lang) || p.title || '')
    .filter(Boolean);
```

説明文もlang対応:
```typescript
if (names.length > 0) {
    ogTitle = `${names.join(' / ')} - LoPo`;
    ogDescription = lang === 'en'
        ? `${names.length} mitigation plans`
        : `${names.length}件の軽減プラン`;
}
```

単一プラン（84行目付近）:
```typescript
const contentName = getContentName(data.contentId, lang);
const planTitle = data.title || '';

if (contentName) {
    ogTitle = `${contentName} - LoPo`;
    ogDescription = lang === 'en'
        ? (planTitle ? `${planTitle} | Mitigation plan for ${contentName}` : `Mitigation plan for ${contentName}`)
        : (planTitle ? `${planTitle} | ${contentName} の軽減プラン` : `${contentName} の軽減プラン`);
} else if (planTitle) {
    ogTitle = `${planTitle} - LoPo`;
    ogDescription = lang === 'en'
        ? `Mitigation plan: ${planTitle}`
        : `${planTitle} の軽減プラン`;
}
```

- [ ] **Step 4: OGP画像URLにlangパラメータを追加**

```typescript
ogImageUrl = `${protocol}://${host}/api/og?id=${encodeURIComponent(shareId)}&lang=${lang}`;
```

- [ ] **Step 5: フォールバックHTMLのlang属性を動的に**

```typescript
return res.send(`<!doctype html>
<html lang="${lang}">
...
```

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add api/share-page/index.ts
git commit -m "feat: 共有ページのメタタグ多言語対応（CONTENT_NAMES廃止→ogpHelpers統一）"
```

---

## Task 9: ShareModal.tsx — langをPOST + OG URLに含める

**Files:**
- Modify: `src/components/ShareModal.tsx`

- [ ] **Step 1: i18nからlangを取得**

`useTranslation` の `i18n` オブジェクトからlangを取得:

```typescript
const { t, i18n } = useTranslation();
```

- [ ] **Step 2: buildOgUrlにlangパラメータ追加**

```typescript
const buildOgUrl = (id: string, planTitle: boolean, logo: boolean) => {
    let url = `${window.location.origin}/api/og?id=${id}`;
    if (!planTitle) url += '&showTitle=false';
    if (logo) url += '&showLogo=true';
    url += `&lang=${i18n.language === 'en' ? 'en' : 'ja'}`;
    return url;
};
```

- [ ] **Step 3: generateShareUrl内のbodyにlangを追加**

```typescript
body.lang = i18n.language === 'en' ? 'en' : 'ja';
```

これを `body` 構築の最後（logoStoragePath設定の後）に追加。

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 5: テスト全実行**

```bash
npx vitest run
```

Expected: 全テストPASS。

- [ ] **Step 6: コミット**

```bash
git add src/components/ShareModal.tsx
git commit -m "feat: 共有時にlangパラメータをPOST・OG URLに含める"
```

---

## Task 10: 最終確認

- [ ] **Step 1: フルビルド**

```bash
npm run build
```

- [ ] **Step 2: 全テスト実行**

```bash
npx vitest run
```

- [ ] **Step 3: dev起動して手動確認**

```bash
npm run dev
```

確認項目:
1. 日本語モードで共有 → OGPプレビュー画像のコンテンツ名が日本語
2. 英語モードで共有 → OGPプレビュー画像のコンテンツ名が英語
3. バンドル共有（日本語モード）→ まとめ表記が日本語
4. バンドル共有（英語モード）→ 混在リストが英語名で表示
5. ロゴ表示ON/OFF → 従来通り動作

- [ ] **Step 4: 最終コミット（必要な場合のみ）**
