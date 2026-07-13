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

  // Task3: progress (0..1) が SVG リングの stroke-dashoffset に反映される (旧 --stepper-progress track は廃止)。
  it('progress を上げると先頭の円の stroke-dashoffset が減る (塗りが増える)', () => {
    // happy-dom は実レイアウト非対応 → num の矩形をスタブして中心 y を与える。
    const rects = new Map<Element, DOMRect>();
    const orig = Element.prototype.getBoundingClientRect;
    let yCursor = 0;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('housing-register-stepper-num')) {
        const y = (yCursor += 40);
        return { top: y, height: 22, bottom: y + 22, left: 0, right: 22, width: 22, x: 0, y, toJSON: () => ({}) } as DOMRect;
      }
      if (this.classList.contains('housing-register-stepper-body')) {
        return { top: 0, height: 200, bottom: 200, left: 0, right: 40, width: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      }
      return rects.get(this) ?? ({ top: 0, height: 0, bottom: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    });

    const renderAt = (p: number) =>
      render(
        <I18nextProvider i18n={i18n}>
          <RegisterStepperNav steps={steps} onJump={() => {}} progress={p} />
        </I18nextProvider>,
      );

    const { container: c0 } = renderAt(0);
    const ring0 = c0.querySelector('.housing-register-stepper-ring') as SVGCircleElement;
    const off0 = parseFloat(ring0.style.strokeDashoffset);

    const { container: c1 } = renderAt(0.5);
    const ring1 = c1.querySelector('.housing-register-stepper-ring') as SVGCircleElement;
    const off1 = parseFloat(ring1.style.strokeDashoffset);

    expect(off1).toBeLessThan(off0); // 塗りが増える = dashoffset が減る
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(orig);
  });

  // Task2: SVG 進捗レイヤー (円周リング + 接続線) を丸バッジに重ねて描画する。座標測定は Task3。
  it('SVG レイヤーに円 (ステップ数) と接続線 (ステップ数-1) を描く', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} progress={0} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('housing-register-stepper-svg')).toBeInTheDocument();
    expect(container.querySelectorAll('.housing-register-stepper-ring').length).toBe(3);
    expect(container.querySelectorAll('.housing-register-stepper-connector').length).toBe(2);
  });
});
