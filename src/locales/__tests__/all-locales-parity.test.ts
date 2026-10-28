import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';
import ko from '../ko.json';

// ja を正として、他 4 言語にキーの欠けが無いかを見る(2026-10-26 設計監査で新設)。
// 欠けると fallbackLng='ja' により海外の利用者に日本語が出る。
// 下の許容リストは導入時点で既に欠けていたもの。新しく欠けたら落ちる。
// 許容リストのキーを翻訳したら、ここからも消すこと(消し忘れも落ちる)。

// 参照箇所が無い ja 専用キー(死にキー候補)
const UNUSED_JA_ONLY = ['party.composition', 'mitigation.fairy_dismissed_during_effect'];

// 管理画面の翻訳表(ja/en のみ)
const ADMIN_TRANSLATIONS = [
    'admin.translations',
    ...[
        'title', 'category_skills', 'category_contents', 'category_attacks', 'category_phases',
        'category_others', 'filter_untranslated', 'filter_job', 'filter_content', 'filter_all',
        'progress', 'export_csv', 'import_csv', 'import_paste', 'import_preview_title',
        'import_added', 'import_changed', 'import_unknown_ids', 'import_confirm', 'save',
        'save_confirm_jaen', 'saved', 'no_changes', 'csv_header_no_edit',
    ].map((k) => `admin.translations_${k}`),
];

const KNOWN_MISSING: Record<string, readonly string[]> = {
    en: [...UNUSED_JA_ONLY],
    zh: [...UNUSED_JA_ONLY, ...ADMIN_TRANSLATIONS],
    'zh-Hant': [...UNUSED_JA_ONLY, ...ADMIN_TRANSLATIONS],
    ko: [...UNUSED_JA_ONLY, ...ADMIN_TRANSLATIONS],
};

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
            paths.push(...collectLeafPaths(value as Record<string, unknown>, path));
        } else {
            paths.push(path);
        }
    }
    return paths;
}

const jaPaths = collectLeafPaths(ja);
const locales: Record<string, Record<string, unknown>> = { en, zh, 'zh-Hant': zhHant, ko };

describe('全ロケールのキーが ja と揃っている', () => {
    for (const [lang, data] of Object.entries(locales)) {
        const paths = new Set(collectLeafPaths(data));
        const known = new Set(KNOWN_MISSING[lang]);

        it(`${lang}: ja にあるキーが欠けていない(許容リスト除く)`, () => {
            const missing = jaPaths.filter((p) => !paths.has(p) && !known.has(p));
            expect(missing, `${lang}.json に足りないキー`).toEqual([]);
        });

        it(`${lang}: 許容リストに翻訳済みのキーが残っていない`, () => {
            const stale = [...known].filter((p) => paths.has(p));
            expect(stale, `${lang} の許容リストから消すべきキー`).toEqual([]);
        });

        it(`${lang}: ja に無いキーを持っていない`, () => {
            const jaSet = new Set(jaPaths);
            expect([...paths].filter((p) => !jaSet.has(p))).toEqual([]);
        });
    }
});
