// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecWorkspace } from '../MilspecWorkspace';

/** 表の区画(見本 v11 js:963-984 の zb)。装甲・画面の窪み・四隅の印・縁の暗がり・刻印 */
describe('MilspecWorkspace(表の区画)', () => {
  it('子(Timeline)を表の器に入れる', () => {
    const { container } = render(<MilspecWorkspace><div data-testid="tl">TL</div></MilspecWorkspace>);
    const wrap = container.querySelector('.milspec-tbl-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap!.querySelector('[data-testid="tl"]')).not.toBeNull();
  });

  it('表の装甲を持つ(操作列の下端 + 4px より下に敷く器の中)', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    const host = container.querySelector('.milspec-tbl-armor');
    expect(host).not.toBeNull();
    expect(host!.querySelector('[data-ms-armor="tbl"]')).not.toBeNull();
  });

  it('画面の窪みの上に 四隅の印 3 個・縁の暗がり・刻印 T-DISP / SCOPE 1 · TL-FEED を持つ', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelectorAll('.milspec-scr-mark').length).toBe(3);
    expect(container.querySelector('.milspec-vig')).not.toBeNull();
    expect(container.querySelector('.milspec-mark')!.textContent).toBe('T-DISP');
    expect(container.querySelector('.milspec-dc')!.textContent).toBe('SCOPE 1 · TL-FEED');
  });

  it('旧 SP1 の装甲板・ビス・ROSTER 表示は無い', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelector('.milspec-ws')).toBeNull();
    expect(container.querySelector('.milspec-bolt')).toBeNull();
    expect(container.querySelector('.milspec-ws-note')).toBeNull();
    expect(container.querySelector('.milspec-ws-cap')).toBeNull();
  });
});
