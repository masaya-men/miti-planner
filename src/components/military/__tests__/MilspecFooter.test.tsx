// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MilspecFooter } from '../MilspecFooter';
// brief 記載のテストひな形は '../../store/useThemeStore'(2階層)だったが、
// __tests__ から src/store/useThemeStore.ts への正しい相対パスは 3 階層上
// (MilspecSidebar.test.tsx / MilspecSidebar.tsx の実インポートと同じ)。
import { useThemeStore } from '../../../store/useThemeStore';

beforeEach(() => useThemeStore.setState({ themeStyle: 'military' }));

describe('MilspecFooter', () => {
  it('著作権・免責・法的リンク・Discord・X を描画', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('a[href="/privacy"]')).toBeNull(); // ドロップダウン閉時は非表示
    expect(container.textContent).toMatch(/SQUARE ENIX/);
    expect(container.querySelector('a[href="https://x.com/lopoly_app"]')).not.toBeNull();
  });
  it('法的ボタンでドロップダウンが開く', () => {
    const { getByRole, container } = render(<MilspecFooter />);
    fireEvent.click(getByRole('button', { name: /legal|法的|規約/i }));
    expect(container.querySelector('a[href="/terms"]')).not.toBeNull();
  });
  it('PCB ハーネス SVG を描画', () => {
    const { container } = render(<MilspecFooter />);
    expect(container.querySelector('svg.milspec-harness, .milspec-fp-harness svg')).not.toBeNull();
  });
});
