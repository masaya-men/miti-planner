// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../../../i18n';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../../data/housing/mistWard.generated.json';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';
const mistWard = mistWardRaw as unknown as WardMapJson;
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', routeJumpPath: null, origin: { x: 10, y: 10 }, targetElId: 'plot_6' };

describe('TourNavMap', () => {
  it('ready で host/ゴージャス経路/起点マーカーを描く（番号ノード・LIVE・凡例は撤去済み）', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
    // 改善4: 地図上の番号マーカー(①②③/✓)は撤去
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(0);
    // 改善6: LIVEピルと凡例は撤去
    expect(container.querySelector('.housing-tour-map-live')).toBeNull();
    expect(container.querySelector('.housing-tour-map-legend')).toBeNull();
  });
  it('目的地の放射リング(波紋)は撤去済み: r アニメ from="60" が存在しない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    // 波紋 circle は r: 60→170 のアニメが目印(origin脈動は r: 14→30 で別物)
    expect(container.querySelectorAll('animate[attributeName="r"][from="60"]').length).toBe(0);
    // 波紋を包んでいた aria-hidden の <g> ラッパーごと消えていること
    expect(container.querySelectorAll('.housing-map-overlay > g[aria-hidden="true"]').length).toBe(0);
  });
  it('エーテライトの脈動(origin)は波紋撤去後も残る', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    const originGroup = container.querySelector('[data-testid="tour-map-origin"]');
    expect(originGroup).not.toBeNull();
    expect(originGroup?.querySelector('animate[attributeName="r"][from="14"]')).not.toBeNull();
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
  it('routeJumpPath があれば破線ジャンプを描く', () => {
    const jm: TourMapModel = { ...model, routeJumpPath: 'M100 100 L140 160' };
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={jm} />);
    const jump = container.querySelector('[data-testid="tour-map-route-jump"]');
    expect(jump).toBeTruthy();
    expect(jump?.getAttribute('d')).toBe('M100 100 L140 160');
  });
  it('routeJumpPath が null なら破線ジャンプは描かない', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('[data-testid="tour-map-route-jump"]')).toBeNull();
  });
  it('none はプレースホルダ・loading はスケルトン', () => {
    const none = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} />);
    expect(none.container.querySelector('[data-testid="tour-map-none"]')).toBeTruthy();
    const load = render(<TourNavMap status="loading" svg={null} viewBox={null} model={null} />);
    expect(load.container.querySelector('[data-testid="tour-map-skeleton"]')).toBeTruthy();
  });
  it('ready でパン/ズーム用の .housing-map-zoom と「全体に戻す」ボタンを持つ', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-zoom')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-reset"]')).toBeTruthy();
  });
});
