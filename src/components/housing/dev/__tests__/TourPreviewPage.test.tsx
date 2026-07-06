// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TourPreviewPage } from '../TourPreviewPage';

describe('TourPreviewPage (DEV)', () => {
  it('全住所を読み込み、件数カウンタと住所ジャンプを表示する', async () => {
    render(
      <MemoryRouter>
        <TourPreviewPage />
      </MemoryRouter>,
    );
    // 10 マップの遅延ロード完了後にバーが出る
    await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(200);
  });
});
