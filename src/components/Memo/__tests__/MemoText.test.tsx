// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoText } from '../MemoText';

describe('MemoText', () => {
  it('URL部分を新タブ・noopenerの<a>で描く', () => {
    const { container } = render(<MemoText text="見て https://a.com ここで" />);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a!.getAttribute('href')).toBe('https://a.com');
    expect(a!.getAttribute('target')).toBe('_blank');
    expect(a!.getAttribute('rel')).toBe('noopener noreferrer');
    // 文章部分はそのまま残る
    expect(container.textContent).toBe('見て https://a.com ここで');
  });

  it('javascript: はリンクにしない', () => {
    const { container } = render(<MemoText text="javascript:alert(1)" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('javascript:alert(1)');
  });
});
