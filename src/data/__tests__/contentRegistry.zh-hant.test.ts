import { describe, it, expect } from 'vitest';
import { CATEGORY_LABELS, LEVEL_LABELS, PROJECT_LABELS, getContentDefinitions, CONTENT_SERIES } from '../contentRegistry';

describe('contentRegistry zh-Hant対応', () => {
  it('CATEGORY_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(CATEGORY_LABELS)) {
      expect(value['zh-Hant'], `category ${key}`).toBeTruthy();
    }
  });

  it('LEVEL_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(LEVEL_LABELS)) {
      expect(value['zh-Hant'], `level ${key}`).toBeTruthy();
    }
  });

  it('PROJECT_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(PROJECT_LABELS)) {
      expect(value['zh-Hant'], `project ${key}`).toBeTruthy();
    }
  });

  it('CONTENT_SERIESの全エントリのnameにzh-Hantがある(空文字許容の絶シリーズを除く)', () => {
    for (const series of CONTENT_SERIES) {
      if (series.name.zh === '') continue; // 絶シリーズ(1フロアのみ)はzh自体が空なので対象外
      expect(series.name['zh-Hant'], `series ${series.id}`).toBeTruthy();
    }
  });

  it('全コンテンツ定義のshortNameにzh-Hantがある', () => {
    const items = getContentDefinitions();
    for (const item of items) {
      expect(item.shortName?.['zh-Hant'], `content ${item.id} shortName`).toBeTruthy();
    }
  });
});
