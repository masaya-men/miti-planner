import { describe, it, expect } from 'vitest';
import { applyTranslationsFromCsv } from '../apply-zh-hant-translations';

describe('applyTranslationsFromCsv', () => {
  const existingItems = [
    { id: 'pld', name: { ja: 'ナイト', en: 'Paladin', zh: '骑士', ko: '나이트' } },
    { id: 'war', name: { ja: '戦士', en: 'Warrior', zh: '战士', ko: '전사' } },
  ];

  it('CSVのzh-Hant列を該当idのnameオブジェクトに追加する', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedPld = result.updated.find(i => i.id === 'pld');
    expect(updatedPld?.name['zh-Hant']).toBe('騎士');
    expect(result.appliedCount).toBe(1);
  });

  it('既存のja/en/zh/koフィールドは一切変更しない', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedPld = result.updated.find(i => i.id === 'pld');
    expect(updatedPld?.name.ja).toBe('ナイト');
    expect(updatedPld?.name.en).toBe('Paladin');
    expect(updatedPld?.name.zh).toBe('骑士');
    expect(updatedPld?.name.ko).toBe('나이트');
  });

  it('zh-Hant列が空の行はスキップする(既存データを変更しない)', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\nwar,戦士,Warrior,战士,,전사';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedWar = result.updated.find(i => i.id === 'war');
    expect(updatedWar?.name['zh-Hant']).toBeUndefined();
    expect(result.appliedCount).toBe(0);
  });

  it('CSVに存在するがexistingItemsに無いidはskippedIdsに記録する', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\nunknown_id,x,x,x,テスト,x';
    const result = applyTranslationsFromCsv(csv, existingItems);
    expect(result.skippedIds).toContain('unknown_id');
    expect(result.appliedCount).toBe(0);
  });

  it('CSVに存在しない既存itemsはそのまま変更せず結果に含む', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    expect(result.updated.find(i => i.id === 'war')).toEqual(existingItems[1]);
  });
});
