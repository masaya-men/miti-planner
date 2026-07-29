import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('housing-terms.csv の zh-Hant列', () => {
  it('ヘッダーに zh-Hant 列がある', () => {
    const header = readFileSync('src/data/housing/terms-src/housing-terms.csv', 'utf8').split(/\r?\n/)[0];
    const cols = header.split(',');
    expect(cols).toContain('zh-Hant');
  });
  it('全行で zh-Hant 列が非空 (備考行・空行を除く)', () => {
    const lines = readFileSync('src/data/housing/terms-src/housing-terms.csv', 'utf8')
      .split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(',');
    const zhHantIdx = header.indexOf('zh-Hant');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      expect(cols[zhHantIdx], `line ${i + 1}: ${lines[i]}`).toBeTruthy();
    }
  });
});
