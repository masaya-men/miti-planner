// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalDataSafetyModal } from '../LocalDataSafetyModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

describe('LocalDataSafetyModal', () => {
  it('isOpen=false なら何も描画しない', () => {
    const { container } = render(
      <LocalDataSafetyModal isOpen={false} onClose={() => {}} onOpenBackup={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('isOpen=true で見出しを描画する', () => {
    render(<LocalDataSafetyModal isOpen onClose={() => {}} onOpenBackup={() => {}} />);
    expect(screen.getByText('local_safety.modal.title')).toBeTruthy();
  });

  it('バックアップ書き出しボタンで onOpenBackup を呼ぶ', () => {
    const onOpenBackup = vi.fn();
    render(<LocalDataSafetyModal isOpen onClose={() => {}} onOpenBackup={onOpenBackup} />);
    fireEvent.click(screen.getByText('local_safety.modal.backup_button'));
    expect(onOpenBackup).toHaveBeenCalled();
  });
});
