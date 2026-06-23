import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import ko from '../ko.json';
import zh from '../zh.json';

const locales: Record<string, any> = { ja, en, ko, zh };

const NEW_KEYS = [
  'howto_title', 'howto_step1', 'howto_step2', 'howto_step3', 'howto_step4', 'howto_mac_note',
  'wizard_next', 'wizard_back', 'next_to_paste', 'next_to_party', 'next_to_confirm',
  'add_more_or_next', 'step_title_setup', 'step_title_paste', 'step_title_party', 'step_title_confirm',
];

describe('sheetImport ウィザード i18n パリティ', () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}: 新キーが全て存在`, () => {
      for (const k of NEW_KEYS) {
        expect(dict.sheetImport?.[k], `${lang}.sheetImport.${k}`).toBeTruthy();
      }
    });
    it(`${lang}: 既存キー paste_label / phase_name_label が存在`, () => {
      expect(dict.sheetImport?.paste_label).toBeTruthy();
      expect(dict.sheetImport?.phase_name_label).toBeTruthy();
    });
  }
});
