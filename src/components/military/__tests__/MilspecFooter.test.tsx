// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecFooter } from '../MilspecFooter';
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => useThemeStore.setState({ themeStyle: 'military' }));

describe('MilspecFooter(v11 の 22px の帯)', () => {
  it('著作権・免責・法的情報・Discord・X を描画', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.textContent).toMatch(/SQUARE ENIX/);
    expect(container.textContent).toMatch(/MIL-SPEC/);
    expect(container.querySelector('a[href="https://discord.gg/z7uypbJSnN"]')).not.toBeNull();
    expect(container.querySelector('a[href="https://x.com/lopoly_app"]')).not.toBeNull();
    expect(container.querySelector('button[aria-expanded]')).not.toBeNull();
  });
  it('一覧は閉じている間は無い', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('a[href="/privacy"]')).toBeNull();
    expect(container.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
  });
  it('法的情報で一覧が開閉し、4 項目のリンク先が正しい', () => {
    const { container } = render(<MilspecFooter />);
    const btn = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    for (const h of ['/privacy', '/terms', '/about', '/about#contact']) {
      expect(container.querySelector(`a[href="${h}"]`)).not.toBeNull();
    }
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('a[href="/terms"]')).toBeNull();
  });
  it('外側クリックで一覧が閉じる', () => {
    const { container } = render(<MilspecFooter />);
    fireEvent.click(container.querySelector('button[aria-expanded]') as HTMLButtonElement);
    fireEvent.click(container.querySelector('.milspec-ftr-backdrop') as HTMLElement);
    expect(container.querySelector('a[href="/terms"]')).toBeNull();
  });
  it('旧ハーネス・ファン・計器は無く、装甲がある', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('.milspec-fp-harness, .milspec-harness, .milspec-tb-cluster2, .milspec-rollbank')).toBeNull();
    expect(container.querySelector('[data-ms-armor="ftr"]')).not.toBeNull();
  });
});
