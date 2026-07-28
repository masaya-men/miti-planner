import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import ko from '../ko.json';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';

const PATHS = [
  'housing.login_prompt.register.lead',
  'housing.login.title',
  'housing.login.notice.intro',
  'housing.login.notice.item1',
  'housing.login.notice.item2',
  'housing.login.notice.item3',
  'housing.login.discordButton',
  'housing.login.closeLabel',
  'housing.account.title',
  'housing.account.avatarChange',
  'housing.account.avatarDelete',
  'housing.account.displayNameLabel',
  'housing.account.displayNameEdit',
  'housing.account.adminLink',
  'housing.account.signOut',
  'housing.account.deleteAccount',
  'housing.account.deleteConfirmTitle',
  'housing.account.deleteConfirmBody',
  'housing.account.deleteConfirmYes',
  'housing.account.deleteConfirmNo',
  'housing.account.closeLabel',
  'housing.topbar.login',
  'housing.topbar.account',
] as const;

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

describe('housing ログイン/アカウント文言の多言語対応 (2026-07-28 新規23件)', () => {
  it('ja に全パスの原文が存在する(前提確認)', () => {
    for (const path of PATHS) {
      expect(getByPath(ja, path), `ja.${path}`).toBeTruthy();
    }
  });

  const others: Record<string, unknown> = { en, ko, zh, 'zh-Hant': zhHant };
  for (const lang of Object.keys(others)) {
    it(`${lang} の全パスが非空文字列である`, () => {
      for (const path of PATHS) {
        const value = getByPath(others[lang], path);
        expect(typeof value, `${lang}.${path}`).toBe('string');
        expect(value, `${lang}.${path}`).toBeTruthy();
      }
    });
  }
});
