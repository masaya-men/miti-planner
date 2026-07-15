// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterSectionIntro } from '../RegisterSectionIntro';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderIntro(props: Partial<React.ComponentProps<typeof RegisterSectionIntro>> = {}) {
  const onChange = props.onChange ?? vi.fn();
  return render(
    <I18nextProvider i18n={i18n}>
      <RegisterSectionIntro
        title={props.title ?? ''}
        description={props.description ?? ''}
        tags={props.tags ?? []}
        visibility={props.visibility ?? 'public'}
        onChange={onChange}
      />
    </I18nextProvider>,
  );
}

describe('RegisterSectionIntro', () => {
  it('タイトル入力で onChange が発火し残り文字数が出る', () => {
    const onChange = vi.fn();
    renderIntro({ onChange });
    const input = screen.getByTestId('housing-register-title-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'わが家' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'わが家' }));
  });

  it('タイトル入力欄は maxLength が MAX_TITLE_LENGTH', () => {
    renderIntro();
    const input = screen.getByTestId('housing-register-title-input') as HTMLInputElement;
    expect(input.maxLength).toBe(50);
  });

  it('未入力時は残り文字数として上限がそのまま表示される', () => {
    renderIntro({ title: '' });
    expect(screen.getByTestId('housing-register-title-remaining').textContent).toContain('50');
  });

  it('入力後は残り文字数が減る', () => {
    renderIntro({ title: 'わが家' });
    expect(screen.getByTestId('housing-register-title-remaining').textContent).toContain('47');
  });

  it('タイトル未入力は必須エラーでなく住所フォールバックのヒントを出す (任意化)', () => {
    renderIntro({ title: '' });
    expect(screen.queryByTestId('housing-register-title-required')).toBeNull();
    expect(screen.getByTestId('housing-register-title-optional-hint')).toBeTruthy();
  });

  // Task4: visibility='unlisted' のとき、未入力ヒントが「住所」でなく「非公開」文言になる。
  it('住所非公開 (unlisted) 選択時はヒントが field_title_optional_hint_unlisted になる', () => {
    renderIntro({ title: '', visibility: 'unlisted' });
    expect(screen.getByTestId('housing-register-title-optional-hint').textContent).toBe(
      jaTranslations.housing.register.field_title_optional_hint_unlisted,
    );
  });
});
