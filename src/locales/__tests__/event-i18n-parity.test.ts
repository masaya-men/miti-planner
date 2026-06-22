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
