// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterSectionConfirm, type RegisterConfirmSummary } from '../RegisterSectionConfirm';

/**
 * round2 D (確認ゲート強調): リード文言のキーを `address_gate_lead` から
 * 明示誘導の `gate_lead_prompt` に差し替えた回帰テスト。
 * 統合担当が locale (ja/en/ko/zh) に実文言を追加する前提のため、
 * 本テストは実 ja.json をベースに `gate_lead_prompt` だけをテスト用文言で
 * 上書きした複製リソースを使う (実 locale 未着地でも本コンポーネント側の
 * 配線 = 正しいキーを参照しているかを検証できる)。
 */
const TEST_PROMPT_TEXT = 'テスト: 住所を確認して、下のボタンを押してください';

beforeAll(() => {
  const merged = JSON.parse(JSON.stringify(jaTranslations));
  merged.housing.register.confirm.gate_lead_prompt = TEST_PROMPT_TEXT;

  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: merged } },
    interpolation: { escapeValue: false },
  });
});

const baseSummary: RegisterConfirmSummary = {
  address: 'Elemental / Kugane / 森林 6区 12番地 M',
  title: 'わが家',
  imageCount: 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(overrides: Partial<any> = {}) {
  const props = {
    summary: baseSummary,
    canSubmit: true,
    visibility: 'public' as const,
    checklistItems: [],
    addressConfirmed: false,
    onConfirmAddress: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return render(
    <I18nextProvider i18n={i18n}>
      <RegisterSectionConfirm {...props} />
    </I18nextProvider>,
  );
}

describe('RegisterSectionConfirm', () => {
  it('確認ゲートのリードが新キー gate_lead_prompt の明示誘導文言を表示する', () => {
    wrap();
    expect(screen.getByText(TEST_PROMPT_TEXT)).toBeInTheDocument();
  });

  it('未確認 (addressConfirmed=false) のとき確認ボタンは data-confirmed="false"', () => {
    wrap({ addressConfirmed: false });
    const btn = screen.getByTestId('housing-register-confirm-address-btn');
    expect(btn.getAttribute('data-confirmed')).toBe('false');
    expect(btn).not.toBeDisabled();
  });

  it('確認済み (addressConfirmed=true) のとき確認ボタンは data-confirmed="true" かつ disabled', () => {
    wrap({ addressConfirmed: true });
    const btn = screen.getByTestId('housing-register-confirm-address-btn');
    expect(btn.getAttribute('data-confirmed')).toBe('true');
    expect(btn).toBeDisabled();
  });

  it('確認ボタン押下で onConfirmAddress が呼ばれる (既存機能は不変)', () => {
    const onConfirmAddress = vi.fn();
    wrap({ addressConfirmed: false, onConfirmAddress });
    screen.getByTestId('housing-register-confirm-address-btn').click();
    expect(onConfirmAddress).toHaveBeenCalledTimes(1);
  });

  // Task4: 3択 (public/unlisted/private) の submit ラベルと要約表示。
  it('visibility=unlisted のとき送信ボタンが save_unlisted 文言になる', () => {
    wrap({ visibility: 'unlisted' });
    expect(screen.getByTestId('housing-register-confirm-submit').textContent).toBe(
      jaTranslations.housing.register.confirm.save_unlisted,
    );
  });

  it('visibility=unlisted のとき要約が「住所非公開」表示になる', () => {
    wrap({ visibility: 'unlisted' });
    expect(screen.getByText(jaTranslations.housing.register.visibility.unlisted)).toBeInTheDocument();
  });

  it('visibility=private のとき送信ボタンが save_private 文言になる (回帰)', () => {
    wrap({ visibility: 'private' });
    expect(screen.getByTestId('housing-register-confirm-submit').textContent).toBe(
      jaTranslations.housing.register.confirm.save_private,
    );
  });
});
