// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDeleteConfirm } from '../HousingDeleteConfirm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('HousingDeleteConfirm', () => {
  it('open=false なら何も描画しない', () => {
    const { container } = render(
      <HousingDeleteConfirm
        open={false}
        listingTitle="X"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('物件タイトルが表示される', () => {
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="和風の隠れ家"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/和風の隠れ家/)).toBeInTheDocument();
  });

  it('「削除する」 クリックで onConfirm が呼ばれる', () => {
    const onConfirm = vi.fn();
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="X"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'housing.delete.confirm' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('「キャンセル」 クリックで onCancel が呼ばれる', () => {
    const onCancel = vi.fn();
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="X"
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'housing.delete.cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('loading=true で両ボタン disabled になる', () => {
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="X"
        onCancel={() => {}}
        onConfirm={() => {}}
        loading
      />,
    );
    expect(screen.getByRole('button', { name: 'housing.delete.confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'housing.delete.cancel' })).toBeDisabled();
  });
});
