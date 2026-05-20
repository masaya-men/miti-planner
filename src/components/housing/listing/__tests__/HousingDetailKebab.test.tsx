// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDetailKebab } from '../HousingDetailKebab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('HousingDetailKebab', () => {
  it('初期状態ではメニューは閉じている', () => {
    render(<HousingDetailKebab onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('トリガーをクリックでメニューが開き、 編集 / 削除項目が表示される', () => {
    render(<HousingDetailKebab onEdit={() => {}} onDelete={() => {}} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'housing.detail.kebab.edit' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'housing.detail.kebab.delete' }),
    ).toBeInTheDocument();
  });

  it('編集クリックで onEdit が呼ばれ、 メニューが閉じる', () => {
    const onEdit = vi.fn();
    render(<HousingDetailKebab onEdit={onEdit} onDelete={() => {}} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'housing.detail.kebab.edit' }),
    );
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('削除クリックで onDelete が呼ばれ、 メニューが閉じる', () => {
    const onDelete = vi.fn();
    render(<HousingDetailKebab onEdit={() => {}} onDelete={onDelete} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'housing.detail.kebab.delete' }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape キーでメニューが閉じる', () => {
    render(<HousingDetailKebab onEdit={() => {}} onDelete={() => {}} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
