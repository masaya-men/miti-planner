// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingDuplicateWarningDialog } from '../../components/housing/HousingDuplicateWarningDialog';

const dup = [{ id: 'l1', ownerUid: 'u1', createdAt: Date.now() - 86400000, tags: ['modern', 'cafe'] }];

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
});
