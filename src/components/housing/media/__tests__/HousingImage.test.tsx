// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { HousingImage } from '../HousingImage';

const YT = (q: string) => `https://img.youtube.com/vi/abcdefghijk/${q}.jpg`;

function setNatural(img: HTMLImageElement, w: number, h: number) {
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
}

describe('HousingImage', () => {
  it('YouTube maxres が灰色(120x90)なら hq -> mq と下がる', () => {
    const { container } = render(<HousingImage src={YT('maxresdefault')} variant="original" />);
    const img = container.querySelector('img')!;
    setNatural(img, 120, 90);
    fireEvent.load(img);
    expect(img.src).toBe(YT('hqdefault'));
    fireEvent.load(img);
    expect(img.src).toBe(YT('mqdefault'));
  });

  it('thumb は img.youtube.com の maxres も mqdefault にする', () => {
    const { container } = render(<HousingImage src={YT('maxresdefault')} variant="thumb" />);
    expect(container.querySelector('img')!.src).toBe(YT('mqdefault'));
  });

  it('全部読めなければ代替表示 (img は消える)', () => {
    const { container } = render(<HousingImage src={YT('maxresdefault')} variant="original" />);
    const img = container.querySelector('img')!;
    for (let i = 0; i < 4; i++) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-housing-image-failed]')).not.toBeNull();
  });

  it('fallback=none は失敗時に何も描画しない / onError true で代替を出さない', () => {
    const a = render(<HousingImage src="https://example.com/a.jpg" fallback="none" />);
    fireEvent.error(a.container.querySelector('img')!);
    expect(a.container.firstChild).toBeNull();
    const b = render(<HousingImage src="https://example.com/b.jpg" onError={() => true} />);
    fireEvent.error(b.container.querySelector('img')!);
    expect(b.container.querySelector('img')).not.toBeNull();
  });

  it('X は用途に応じた name', () => {
    const u = 'https://pbs.twimg.com/media/abc.jpg';
    const t = render(<HousingImage src={u} variant="thumb" />).container.querySelector('img')!;
    const c = render(<HousingImage src={u} variant="card" />).container.querySelector('img')!;
    expect(t.src).toContain('name=thumb');
    expect(c.src).toContain('name=small');
  });

  it('housing-media は srcset を持ち lazy/async 既定', () => {
    const u = 'https://lopoly.app/housing-media/x.webp';
    const img = render(<HousingImage src={u} variant="card" />).container.querySelector('img')!;
    expect(img.getAttribute('srcset')).toContain('480w');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });
});
