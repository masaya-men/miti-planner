// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecWorkspace } from '../MilspecWorkspace';

describe('MilspecWorkspace', () => {
  it('装甲板の枠 + .milspec-ws-screen に children を入れる', () => {
    const { container } = render(<MilspecWorkspace><div data-testid="tl">TL</div></MilspecWorkspace>);
    const screen = container.querySelector('.milspec-ws-screen');
    expect(screen).not.toBeNull();
    expect(screen!.querySelector('[data-testid="tl"]')).not.toBeNull();
  });
  it('四隅ビス + 刻印を持つ', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelectorAll('.milspec-bolt').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.milspec-sc')).not.toBeNull();
  });
});
