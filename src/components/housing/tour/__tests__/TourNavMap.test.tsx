// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../../../i18n';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../../data/housing/mistWard.generated.json';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';
const mistWard = mistWardRaw as unknown as WardMapJson;
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', origin: { x: 10, y: 10 }, targetElId: 'plot_6' };

describe('TourNavMap', () => {
  it('ready で host/番号ノード/ゴージャス経路/起点マーカー/放射リングを描く', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(2);
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
    // 放射リングは circle で残す
    expect(container.querySelectorAll('.housing-map-overlay circle').length).toBeGreaterThan(0);
  });
  it('被せ矩形は撤去 (overlay に rect が無い)', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelectorAll('.housing-map-overlay rect').length).toBe(0);
  });
  it('targetElId に一致する実箱パスに housing-tour-target-box クラスが付く', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /><path id="plot_7" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('#plot_6')?.classList.contains('housing-tour-target-box')).toBe(true);
    expect(container.querySelector('#plot_7')?.classList.contains('housing-tour-target-box')).toBe(false);
  });
  it('none はプレースホルダ・loading はスケルトン', () => {
    const none = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} />);
    expect(none.container.querySelector('[data-testid="tour-map-none"]')).toBeTruthy();
    const load = render(<TourNavMap status="loading" svg={null} viewBox={null} model={null} />);
    expect(load.container.querySelector('[data-testid="tour-map-skeleton"]')).toBeTruthy();
  });
});
