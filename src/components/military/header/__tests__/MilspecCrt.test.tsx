// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

vi.mock('../../../../hooks/useSkillsData', async (orig) => ({ ...(await orig<object>()), useMitigations: () => [] }));
vi.mock('../../../progress/ProgressRecordPanel', () => ({ ProgressRecordPanel: () => <i data-testid="panel" /> }));
vi.mock('../../../progress/ProgressCelebration', () => ({ ProgressCelebration: () => <i data-testid="celebration" /> }));

import i18n from '../../../../i18n';
import { MilspecCrt, toCrtVertices } from '../MilspecCrt';
import { powerOn, initPower, disposePower } from '../../power/power';
import { useMitigationStore } from '../../../../store/useMitigationStore';
import { usePlanStore } from '../../../../store/usePlanStore';
import { useProgressRecording } from '../../../progress/useProgressRecording';

const ev = (time: number) => ({ id: `e${time}`, time, name: '', damage: 0, type: 'physical', target: 'MT' } as any);
const pt = (reachedPos: number) => ({ id: `p${reachedPos}`, reachedPos, ts: 0 } as any);

const stubMatchMedia = (reduce: boolean) => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'), media: q,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  }));
};

describe('toCrtVertices', () => {
  it('x 0〜100 を 110〜306、y 0〜100 を 30〜4 に写す', () => {
    expect(toCrtVertices([{ x: 0, y: 0 }, { x: 100, y: 100 }])).toEqual([{ x: 110, y: 30 }, { x: 306, y: 4 }]);
    expect(toCrtVertices([{ x: 50, y: 50 }])).toEqual([{ x: 110, y: 30 }, { x: 208, y: 17 }]);
  });
  it('0 点なら空', () => {
    expect(toCrtVertices([])).toEqual([]);
  });
});

describe('MilspecCrt', () => {
  beforeEach(() => {
    stubMatchMedia(false);
    void i18n.changeLanguage('ja');
    usePlanStore.setState({ currentPlanId: 'plan-crt-test' } as any);
    useProgressRecording.setState({ panelOpen: false } as any);
    useMitigationStore.setState({ timelineEvents: [ev(200)], partyMembers: [], progress: { points: [], cleared: false } } as any);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('日数・時間と進捗 % を出す(5D 12H / 42%)', () => {
    useMitigationStore.setState({ progress: { points: [pt(84)], cleared: false, activeDays: 5, activeHours: 12 } } as any);
    const { container } = render(<MilspecCrt />);
    expect(container.textContent).toContain('5D 12H');
    expect(container.textContent).toContain('42%');
    expect(container.textContent).toContain('PFD-2');
    expect(container.textContent).not.toContain('▲CLR');
    expect(container.querySelector('button')!.hasAttribute('data-progress-hud-band')).toBe(true);
  });

  it('クリア済みは ▲CLR(% は出さない)', () => {
    useMitigationStore.setState({ progress: { points: [pt(100)], cleared: true, activeDays: 5, activeHours: 12 } } as any);
    const { container } = render(<MilspecCrt />);
    expect(container.textContent).toContain('▲CLR');
    expect(container.textContent).not.toContain('%');
  });

  it('軌跡は polyline と先端の点で描く', () => {
    useMitigationStore.setState({ progress: { points: [pt(50), pt(150)], cleared: false } } as any);
    const { container } = render(<MilspecCrt />);
    expect(container.querySelector('polyline')!.getAttribute('points')).toBe('110,23.5 306,10.5');
    expect(container.querySelector('circle.tdot.idle')).not.toBeNull();
  });

  it('空なら格子と誘導文言だけ(軌跡・点なし)', () => {
    const { container } = render(<MilspecCrt />);
    expect(container.textContent).toContain('クリックして攻略の軌跡を記録');
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.querySelector('circle')).toBeNull();
    expect(container.querySelectorAll('.grid path').length).toBe(2);
  });

  it('クリックで boot を付け直し、記録パネルを開く', () => {
    const { container } = render(<MilspecCrt />);
    const b = container.querySelector('button')!;
    fireEvent.click(b);
    expect(b.classList.contains('boot')).toBe(true);
    expect(useProgressRecording.getState().panelOpen).toBe(true);
  });

  it('動きを減らす設定では boot を付けないがパネルは開く', () => {
    stubMatchMedia(true);
    const { container } = render(<MilspecCrt />);
    const b = container.querySelector('button')!;
    fireEvent.click(b);
    expect(b.classList.contains('boot')).toBe(false);
    expect(useProgressRecording.getState().panelOpen).toBe(true);
  });

  it('値が増えると先端の点の idle を外して描き込みを始める', () => {
    vi.useFakeTimers();
    useMitigationStore.setState({ progress: { points: [pt(50)], cleared: false } } as any);
    const { container } = render(<MilspecCrt />);
    const pl = container.querySelector('polyline') as any;
    pl.getTotalLength = () => 100;
    pl.getPointAtLength = () => ({ x: 120, y: 20 });
    act(() => {
      useMitigationStore.setState({ progress: { points: [pt(50), pt(100)], cleared: false } } as any);
    });
    expect(container.querySelector('circle.tdot')!.classList.contains('idle')).toBe(false);
  });
});

describe('MilspecCrt 電源投入', () => {
  beforeEach(() => { stubMatchMedia(false); initPower(); });
  afterEach(() => { disposePower(); vi.unstubAllGlobals(); });

  it('電源が入ると boot が付く(動きを減らす場合は付かない)', () => {
    const { container } = render(<MilspecCrt />);
    const b = container.querySelector('.milspec-crt') as HTMLElement;
    expect(b.classList.contains('boot')).toBe(false);
    act(() => { powerOn({ reduced: true }); });
    expect(b.classList.contains('boot')).toBe(false);
    act(() => { powerOn({ reduced: false }); });
    expect(b.classList.contains('boot')).toBe(true);
  });
});
