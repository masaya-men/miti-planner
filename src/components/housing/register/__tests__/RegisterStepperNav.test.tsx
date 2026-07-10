// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterStepperNav } from '../RegisterStepperNav';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('RegisterStepperNav', () => {
  const steps = [
    { id: 1, labelKey: 'housing.register.step.media', state: 'done' as const },
    { id: 2, labelKey: 'housing.register.step.address', state: 'active' as const },
    { id: 3, labelKey: 'housing.register.step.intro', state: 'idle' as const },
  ];

  it('done は is-done、active は is-active クラス', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('housing-register-step-1').className).toContain('is-done');
    expect(screen.getByTestId('housing-register-step-2').className).toContain('is-active');
  });

  it('idle は is-idle クラス', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('housing-register-step-3').className).toContain('is-idle');
  });

  it('クリックで onJump(id)', () => {
    const onJump = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={onJump} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('housing-register-step-3'));
    expect(onJump).toHaveBeenCalledWith(3);
  });

  // Task2: 各ステップの説明文 (housing.register.step_desc.*) が labelKey から導出される。
  it('各ステップに housing.register.step_desc.* の説明文が表示される (media/address/intro)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('housing-register-step-desc-1')).toHaveTextContent(
      jaTranslations.housing.register.step_desc.media,
    );
    expect(screen.getByTestId('housing-register-step-desc-2')).toHaveTextContent(
      jaTranslations.housing.register.step_desc.address,
    );
    expect(screen.getByTestId('housing-register-step-desc-3')).toHaveTextContent(
      jaTranslations.housing.register.step_desc.intro,
    );
  });

  // Task2: 中央カラムのスクロール進行度 (0..1) が接続線の CSS カスタムプロパティに反映される。
  it('progress prop が --stepper-progress カスタムプロパティに反映される', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} progress={0.42} />
      </I18nextProvider>,
    );
    const track = container.querySelector('.housing-register-stepper-track') as HTMLElement;
    expect(track.style.getPropertyValue('--stepper-progress')).toBe('0.42');
  });
});
