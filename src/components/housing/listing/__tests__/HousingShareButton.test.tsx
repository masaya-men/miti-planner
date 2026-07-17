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

  // FB第6弾#4#5: 常時見える「Xでシェア」ボタン (follow-up改良1でアイコンのみボタンに変更)
  it('常時「Xでシェア」アイコンボタンが表示され、 sourceUrl が無ければ LoPo の url で intent を開く', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<HousingShareButton url="https://lopoly.app/housing/listing/lid1" title="My House" />);
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share_x' }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://twitter.com/intent/tweet?text=My%20House&url=https%3A%2F%2Flopoly.app%2Fhousing%2Flisting%2Flid1&hashtags=LoPo',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('sourceUrl があれば「Xでシェア」ボタンは投稿元 URL を優先し、 追跡クエリを剥がして intent を開く', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <HousingShareButton
        url="https://lopoly.app/housing/listing/lid1"
        title="My House"
        sourceUrl="https://twitter.com/someone/status/123?s=20&t=xxx"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share_x' }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://twitter.com/intent/tweet?text=My%20House&url=https%3A%2F%2Ftwitter.com%2Fsomeone%2Fstatus%2F123&hashtags=LoPo',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('ドロップダウン内の X 共有も sourceUrl があればそちらを優先する', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <HousingShareButton
        url="https://lopoly.app/housing/listing/lid1"
        title="My House"
        sourceUrl="https://twitter.com/someone/status/123"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share' }));
    fireEvent.click(screen.getByText('housing.detail.share_twitter'));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('https://twitter.com/someone/status/123')),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('リンクコピーは sourceUrl があっても LoPo の url をコピーする', () => {
    render(
      <HousingShareButton
        url="https://lopoly.app/housing/listing/lid1"
        title="My House"
        sourceUrl="https://twitter.com/someone/status/123"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.share' }));
    fireEvent.click(screen.getByText('housing.detail.share_copy_link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://lopoly.app/housing/listing/lid1');
  });
});
