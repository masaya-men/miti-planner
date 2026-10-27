// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecLed, MilspecStencil, MilspecMark, MilspecScrew, MilspecRivet, MilspecMaintPlate, MilspecBarcode, MilspecDecal, MilspecHazard } from '../MilspecDecor';
import { barcodeRects } from '../milspecDecorGeometry';
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
  it('MilspecLed blink は is-blink class になる', () => {
    const { container } = render(<MilspecLed state="warn" blink />);
    expect(container.querySelector('.milspec-led')!.classList.contains('is-blink')).toBe(true);
    const { container: c2 } = render(<MilspecLed state="warn" />);
    expect(c2.querySelector('.milspec-led')!.classList.contains('is-blink')).toBe(false);
  });

  it('MilspecDecal は文字を出し aria-hidden、style を受ける', () => {
    const { container } = render(<MilspecDecal text="SN 0001" style={{ left: 3 }} />);
    const e = container.querySelector('.milspec-decal') as HTMLElement;
    expect(e.textContent).toBe('SN 0001');
    expect(e.getAttribute('aria-hidden')).toBe('true');
    expect(e.style.left).toBe('3px');
  });

  it('MilspecHazard は幅・高さを style に持つ', () => {
    const { container } = render(<MilspecHazard w={30} h={5} />);
    const e = container.querySelector('.milspec-hz') as HTMLElement;
    expect(e.style.width).toBe('30px');
    expect(e.style.height).toBe('5px');
    expect(e.getAttribute('aria-hidden')).toBe('true');
  });

  it('barcodeRects は係数 k で幅が変わる(ヘッダー SN: k=0.8・20 本・合計 32)', () => {
    const bars20 = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2];
    const r = barcodeRects(8, bars20, 0.8);
    expect(r.w).toBeCloseTo(41.6, 1);
    expect(r.rects.length).toBe(10);
    expect(r.rects[0].w).toBeCloseTo(1.6, 5);
  });

  it('アイコン party stat more gear tut globe login sync が svg(viewBox 16)', () => {
    for (const k of ['party', 'stat', 'more', 'gear', 'tut', 'globe', 'login', 'sync'] as const) {
      const { container } = render(MsIcon[k]());
      expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 16 16');
    }
  });

  it('MilspecBarcode は bars と k を渡せる(ヘッダー SN: bars 20・k0.8・高さ 8)', () => {
    const bars = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2];
    const { container } = render(<MilspecBarcode h={8} bars={bars} k={0.8} />);
    const svg = container.querySelector('svg.milspec-barcode') as SVGElement;
    const exp = barcodeRects(8, bars, 0.8);
    expect(svg.getAttribute('height')).toBe('8');
    expect(svg.getAttribute('width')).toBe(exp.w.toFixed(1));
    expect(svg.querySelectorAll('rect').length).toBe(10);
  });
});
