// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HousingShareButton } from '../HousingShareButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('HousingShareButton', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    // navigator.share を毎テスト前に undefined に戻す
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
  });

  it('シェアボタンをクリックでドロップダウンが開き、 リンクコピー / X 共有ボタンが出る', () => {
    render(<HousingShareButton url="https://lopoly.app/housing/listing/lid1" title="X" />);
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share' }));
    expect(screen.getByText('housing.detail.share_copy_link')).toBeInTheDocument();
    expect(screen.getByText('housing.detail.share_twitter')).toBeInTheDocument();
  });

  it('リンクコピー押下で clipboard.writeText が呼ばれる', () => {
    render(<HousingShareButton url="https://example.com/lid1" title="X" />);
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share' }));
    fireEvent.click(screen.getByText('housing.detail.share_copy_link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/lid1');
  });

  it('navigator.share がある場合は直接呼ばれる', async () => {
    const shareSpy = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareSpy,
    });
    render(<HousingShareButton url="https://example.com/lid1" title="My House" />);
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share' }));
    // share が呼ばれるまで microtask 待ち
    await Promise.resolve();
    expect(shareSpy).toHaveBeenCalledWith({ title: 'My House', url: 'https://example.com/lid1' });
  });
});
