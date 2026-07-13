// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingDuplicateWarningDialog } from '../../components/housing/HousingDuplicateWarningDialog';

const dup = [{ id: 'l1', ownerUid: 'u1', createdAt: Date.now() - 86400000, tags: ['theme_modern', 'official_cafe'] }];

describe('HousingDuplicateWarningDialog', () => {
  it('既存登録の件数を表示する', () => {
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/housing\.duplicate\.title/i)).toBeInTheDocument();
  });
  it('「住所を訂正する」で onCorrect 呼ばれる', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={onCorrect} onProceed={() => {}} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /housing\.duplicate\.correct/i }));
    expect(onCorrect).toHaveBeenCalled();
  });
  it('「私のも登録する」で onProceed 呼ばれる', async () => {
    const user = userEvent.setup();
    const onProceed = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={onProceed} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /housing\.duplicate\.proceed/i }));
    expect(onProceed).toHaveBeenCalled();
  });
  it('Esc で onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={() => {}} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  // 派生バグ: 個人タグ (personal_<hex>) は i18n キーが無く、 t() すると生キー
  // (housing.tag.personal_xxx) が露出する。 静的タグだけ表示し個人タグは除外することを担保する。
  it('個人タグは除外し、 静的タグだけ表示する (生キーを露出しない)', () => {
    const dupWithPersonal = [
      { id: 'l2', ownerUid: 'u2', createdAt: Date.now(), tags: ['theme_modern', 'personal_neko1'] },
    ];
    const { container } = render(
      <HousingDuplicateWarningDialog duplicates={dupWithPersonal} onCorrect={() => {}} onProceed={() => {}} onClose={() => {}} />,
    );
    // i18n 未初期化のため t はキーを返す。 静的タグはキー、 個人タグは一切出ない。
    expect(screen.getByText('housing.tag.theme_modern')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('personal_neko1');
    expect(container.innerHTML).not.toContain('housing.tag.personal');
  });
});
