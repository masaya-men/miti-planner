import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error mjs の共通部品(型定義なし)
import { mitiStorage, baseStorage, housingStorage } from '../fixtures/storage.mjs';

const API_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'api');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(API_DIR, `${name}.json`), 'utf8'));
const files = () => fs.readdirSync(API_DIR).filter((f) => f.endsWith('.json'));

describe('API 見本', () => {
  const gallery = read('housing-public.gallery').listings as { id: string }[];

  it('gallery の各 id に listing 見本がある', () => {
    expect(gallery).toHaveLength(24);
    for (const l of gallery) {
      expect(fs.existsSync(path.join(API_DIR, `housing-public.listing.${l.id}.json`)), l.id).toBe(true);
    }
  });

  it('housinger 見本が参照する listing id は全部 gallery にある', () => {
    const ids = new Set(gallery.map((l) => l.id));
    const housingers = files().filter((f) => f.startsWith('housing-public.housinger.'));
    expect(housingers.length).toBeGreaterThanOrEqual(2);
    for (const f of housingers) {
      const body = read(f.replace(/\.json$/, ''));
      for (const l of [...body.listings, ...body.hiddenListings]) {
        // 非表示の家(hiddenListings)は gallery に出ない前提なので公開分だけ確認する
        if (body.listings.includes(l)) expect(ids.has(l.id), `${f}:${l.id}`).toBe(true);
      }
    }
  });

  it('全 JSON に実在の lopoly ユーザーらしき値が無い', () => {
    const walk = (v: unknown, file: string, key = '') => {
      if (typeof v === 'string') {
        expect(v.includes('@'), `${file}:${key}`).toBe(false);
        if (/uid$/i.test(key)) expect(v.startsWith('vr-'), `${file}:${key}=${v}`).toBe(true);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, file, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, file, k);
    };
    for (const f of files()) walk(read(f.replace(/\.json$/, '')), f);
  });
});

describe('localStorage 見本', () => {
  it('mitiStorage の theme-storage.state.contentLanguage は lang になる', () => {
    const s = mitiStorage({ view: 'sheet', party: 4, theme: { mode: 'dark', style: 'standard' }, lang: 'en' });
    expect(s['theme-storage'].state.contentLanguage).toBe('en');
    expect(s['theme-storage'].state.timelineView).toBe('sheet');
  });
  it('baseStorage は初回窓の抑止 3 キー', () => {
    expect(Object.keys(baseStorage()).sort()).toEqual(['housing-onboarding-seen', 'lopo_mobile_guide_completed', 'tutorial-storage']);
  });
  it('housingStorage は favorites と theme を持つ', () => {
    const s = housingStorage({ theme: { mode: 'light', style: 'standard' }, favorites: ['vr-l01'] });
    expect(s['housing-favorites'].state.ids).toEqual(['vr-l01']);
    expect(s['theme-storage'].state.theme).toBe('light');
  });
});
