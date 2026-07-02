// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterDuplicatePanel } from '../RegisterDuplicatePanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (props: any) =>
  render(
    <I18nextProvider i18n={i18n}>
      <RegisterDuplicatePanel {...props} />
    </I18nextProvider>,
  );

describe('RegisterDuplicatePanel', () => {
  it('idle: 未照会の静かなプレースホルダ', () => {
    wrap({ state: 'idle', duplicates: [], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-idle')).toBeTruthy();
  });

  it('checking: スケルトン', () => {
    wrap({ state: 'checking', duplicates: [], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-checking')).toBeTruthy();
  });

  it('clear: 重複なしの安心メッセージ', () => {
    wrap({ state: 'clear', duplicates: [], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-clear')).toBeTruthy();
  });

  it('found: 公開重複はカード表示', () => {
    wrap({ state: 'found', duplicates: [{ id: '1', ownerUid: 'a', createdAt: 0, tags: [] }], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-public')).toBeTruthy();
  });

  it('found: 非公開重複は匿名件数のみ (中身なし)', () => {
    wrap({ state: 'found', duplicates: [], privateMatchCount: 2 });
    const anon = screen.getByTestId('housing-register-dup-private');
    expect(anon.textContent).not.toContain('ownerUid');
    expect(anon).toBeTruthy();
  });

  it('found: 非公開重複の中身 (ownerUid 等) が DOM のどこにも現れない', () => {
    const { container } = wrap({
      state: 'found',
      duplicates: [],
      privateMatchCount: 3,
    });
    // 非公開一致は件数のみが渡され、そもそも ownerUid 等の中身を props で受け取らない設計。
    // DOM 全体を見ても 'ownerUid' という文字列すら出ないことを確認する。
    expect(container.innerHTML).not.toContain('ownerUid');
  });
});
