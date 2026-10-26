import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// @ts-expect-error mjs の共通部品(型定義なし)
import { validateCatalog, expandConditions } from '../lib/catalog.mjs';

const mk = (over: Record<string, unknown> = {}) => ({
  id: 'a/b', route: '/', storage: () => ({}), ready: 'body',
  axes: { vp: ['1489'], theme: ['site-dark'], lang: ['ja'] }, ...over,
});

describe('validateCatalog', () => {
  it('正しい項目はエラー 0', () => {
    expect(validateCatalog([mk()])).toEqual([]);
  });
  it('id 重複を検出', () => {
    const errs = validateCatalog([mk(), mk()]);
    expect(errs.some((e: string) => e.includes('重複'))).toBe(true);
  });
  it('axes に未知のテーマがあると検出', () => {
    const errs = validateCatalog([mk({ axes: { vp: ['1489'], theme: ['neon'], lang: ['ja'] } })]);
    expect(errs.some((e: string) => e.includes('neon'))).toBe(true);
  });
  it("clip:'ready' で ready 無しを検出", () => {
    const errs = validateCatalog([mk({ clip: 'ready', ready: undefined })]);
    expect(errs.some((e: string) => e.includes('clip'))).toBe(true);
  });
});

describe('expandConditions', () => {
  const entries = [
    mk({ axes: { vp: ['1489', '390'], theme: ['site-dark', 'site-light'], lang: ['ja', 'en'] } }),
    mk({ id: 'c/d' }),
  ];
  it('vp×theme×lang の直積を作り key が一意', () => {
    const conds = expandConditions(entries);
    expect(conds.length).toBe(8 + 1);
    expect(new Set(conds.map((c: { key: string }) => c.key)).size).toBe(conds.length);
    expect(conds[0].key).toBe('a/b@1489-site-dark-ja');
  });
  it("only='390' で 390 の条件だけ残る", () => {
    const conds = expandConditions(entries, { only: '390' });
    expect(conds.length).toBe(4);
    expect(conds.every((c: { vp: string }) => c.vp === '390')).toBe(true);
  });
});

describe('本物のカタログ', () => {
  it('catalog/*.mjs(先頭 _ を除く)が validateCatalog でエラー 0', async () => {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'catalog');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')) : [];
    const all: unknown[] = [];
    for (const f of files) all.push(...(await import(pathToFileURL(path.join(dir, f)).href)).default);
    expect(validateCatalog(all)).toEqual([]);
  });
});
