// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecChrome } from '../MilspecChrome';
import { useThemeStore } from '../../../store/useThemeStore';

describe('MilspecChrome', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
    window.innerWidth = 1440;
  });

  it('standard のとき何も描画しない', () => {
    const { container } = render(<MilspecChrome />);
    expect(container.firstChild).toBeNull();
  });

  it('military + PC のとき console-frame を描画する', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    const { container } = render(<MilspecChrome />);
    expect(container.querySelector('.milspec-console-frame')).not.toBeNull();
  });

  it('military + モバイル幅のとき console-frame を描画しない', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    window.innerWidth = 500;
    const { container } = render(<MilspecChrome />);
    expect(container.querySelector('.milspec-console-frame')).toBeNull();
  });
});
