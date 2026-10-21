// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecLed, MilspecStencil, MilspecMark, MilspecScrew, MilspecRivet, MilspecMaintPlate, MilspecBarcode, barcodeRects } from '../MilspecDecor';
import { MsIcon } from '../milspecIcons';

describe('MilspecDecor', () => {
  it('MilspecLed は 3 層で aria-hidden、state と flick が class になる', () => {
    const { container } = render(<MilspecLed state="warn" flick size={5} />);
    const led = container.querySelector('span.milspec-led') as HTMLElement;
    expect(led.getAttribute('aria-hidden')).toBe('true');
    expect(led.classList.contains('is-warn')).toBe(true);
    expect(led.classList.contains('is-flick')).toBe(true);
    expect(led.style.getPropertyValue('--s')).toBe('5px');
    expect(led.querySelector('i.milspec-led-lens > i.milspec-led-src')).not.toBeNull();
  });

  it('MilspecLed は state 省略で消灯(on 系 class なし)', () => {
    const { container } = render(<MilspecLed />);
    const led = container.querySelector('.milspec-led') as HTMLElement;
    expect(led.className).toBe('milspec-led');
  });

  it('MilspecStencil は sub が空なら副題を出さない', () => {
    const a = render(<MilspecStencil en="SERVICE" />);
    expect(a.container.querySelector('.milspec-stencil-sub')).toBeNull();
    const b = render(<MilspecStencil en="SERVICE" sub="保守" hi />);
    expect(b.container.querySelector('.milspec-stencil-sub')?.textContent).toBe('保守');
    expect(b.container.querySelector('.milspec-stencil')?.classList.contains('is-hi')).toBe(true);
  });

  it('その他の部品は aria-hidden', () => {
    const { container } = render(<><MilspecMark text="S3" /><MilspecScrew rotate="35deg" /><MilspecRivet /><MilspecMaintPlate title="MAINT LOG · 07" bars={[88, 62, 76]} width={54} /><MilspecBarcode /></>);
    for (const sel of ['.milspec-mark', '.milspec-screw', '.milspec-rivet', '.milspec-maint', '.milspec-barcode']) {
      expect(container.querySelector(sel)?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(container.querySelectorAll('.milspec-maint i').length).toBe(3);
  });

  it('barcodeRects は見本 barH と同じ幅', () => {
    const r = barcodeRects(6);
    expect(r.w).toBeCloseTo(32.9, 1);
    expect(r.rects.length).toBe(9);
  });

  it('アイコン 10 種が svg を返す', () => {
    for (const k of ['plus', 'share', 'multi', 'imp', 'save', 'rest', 'dup', 'rename', 'close', 'fold'] as const) {
      const { container } = render(MsIcon[k]());
      expect(container.querySelector('svg')).not.toBeNull();
    }
  });
});
