// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecContentTree } from '../MilspecContentTree';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';
import * as planLoadModule from '../../../lib/planLoad';
import { getSavageForCurrentExpansion } from '../../../data/contentRegistry';
import { energy } from '../fx/engine';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

vi.mock('../fx/engine', () => ({ energy: vi.fn() }));
vi.mock('../../../lib/housing/useReducedMotion', () => ({ useReducedMotion: vi.fn(() => false) }));

const mkData = () => ({
  currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
  partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
});

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military', contentLanguage: 'ja' });
  // 同じ絶(dmu)に 2 プラン。currentPlan=p1 なので絶タブが選択済み・dmu グループが自動展開。
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: 'dmu', data: mkData(), ownerId: 'local' },
    { id: 'p2', title: 'B', contentId: 'dmu', data: mkData(), ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
});
afterEach(() => { vi.restoreAllMocks(); });

const r = (tab: 'savage' | 'ultimate' | 'other' | 'archive' = 'ultimate', select?: React.ComponentProps<typeof MilspecContentTree>['select']) =>
  render(<MemoryRouter><MilspecContentTree tab={tab} select={select} /></MemoryRouter>);

describe('MilspecContentTree', () => {
  it('現在プランのコンテンツグループが展開されてプランが並ぶ', () => {
    const { getByText } = r('ultimate');
    expect(getByText('A')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });

  it('プラン行クリックで setCurrentPlanId(非圧縮プランは即時)', async () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    spy.mockClear();
    const { getByText } = r();
    fireEvent.click(getByText('B'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p2'));
  });

  it('複製アイコンで duplicatePlan が呼ばれる', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'duplicatePlan').mockResolvedValue(null);
    spy.mockClear();
    const { getAllByRole } = r();
    // 行内アクション(見本の並び): [duplicate, rename, delete]
    const rows = document.querySelectorAll('.milspec-tr-plan');
    const acts = rows[1].querySelectorAll('.milspec-tr-ops button');
    expect(acts.length).toBe(3);
    fireEvent.click(acts[0]);
    expect(spy).toHaveBeenCalledWith('p2');
    void getAllByRole;
  });

  it('データ安全: 圧縮プランは loadPlanDataIntoStore の完了まで setCurrentPlanId を呼ばない', async () => {
    usePlanStore.setState({ plans: [
      { id: 'p1', title: 'A', contentId: 'dmu', data: mkData(), ownerId: 'local' },
      { id: 'p2', title: 'B', contentId: 'dmu', data: {}, compressedData: 'FAKE', ownerId: 'local' },
    ] as never, currentPlanId: 'p1' });

    let resolveLoad!: (v: unknown) => void;
    const loadSpy = vi.spyOn(planLoadModule, 'loadPlanDataIntoStore').mockReturnValue(
      new Promise((resolve) => { resolveLoad = resolve; }) as never,
    );
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    spy.mockClear();

    const { getByText } = r();
    fireEvent.click(getByText('B'));

    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(loadSpy).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();

    resolveLoad(mkData());
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p2'));
  });

  it('削除は 2 段階(1 回目は武装のみ、2 回目で削除)', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'deletePlan');
    spy.mockClear();
    const rows = document.querySelectorAll('.milspec-tr-plan');
    r();
    const freshRows = document.querySelectorAll('.milspec-tr-plan');
    const delBtn = freshRows[1].querySelectorAll('.milspec-tr-ops button')[2];
    fireEvent.click(delBtn);
    expect(spy).not.toHaveBeenCalled(); // 武装のみ
    fireEvent.click(delBtn);
    expect(spy).toHaveBeenCalledWith('p2');
    void rows;
  });

  // ── v11 ツリー ──────────────────────────────────────────
  const savagePlans = () => {
    const list = getSavageForCurrentExpansion();
    const cur = list[list.length - 1];
    usePlanStore.setState({ plans: [
      { id: 's1', title: 'S', contentId: cur.id, data: mkData(), ownerId: 'local' },
    ] as never, currentPlanId: 's1' });
    return { list, cur };
  };

  it('シリーズの開閉ボタンで一覧が開閉し aria-expanded が変わる', () => {
    // animate は終了を即座に通知する偽物にする(閉じる動きの終わりで hidden になるため)
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = vi.fn(() => ({ set onfinish(f: () => void) { f(); } }));
    savagePlans();
    r('savage');
    const folds = document.querySelectorAll<HTMLButtonElement>('.milspec-tr-fold');
    expect(folds.length).toBeGreaterThan(0);
    const f = folds[0];
    const list = f.closest('.milspec-tr-hd')!.nextElementSibling as HTMLElement;
    const before = f.getAttribute('aria-expanded');
    fireEvent.click(f);
    expect(f.getAttribute('aria-expanded')).toBe(before === 'true' ? 'false' : 'true');
    expect(list.hidden).toBe(before === 'true');
    // 見出しの文字でも開閉する
    fireEvent.click(f.parentElement!.querySelector('span')!);
    expect(f.getAttribute('aria-expanded')).toBe(before);
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });

  it('現在のプランのシリーズだけ最初から開いている', () => {
    const { list, cur } = savagePlans();
    r('savage');
    const open = [...document.querySelectorAll<HTMLElement>('.milspec-tr-list')].filter((l) => !l.hidden);
    expect(open.length).toBe(1);
    const curSeries = list.filter((c) => c.seriesId === cur.seriesId).length;
    expect(open[0].querySelectorAll('.milspec-tr-it').length).toBe(curSeries);
  });

  it('層の行に番号と、現在のコンテンツならランプ点灯', () => {
    r('ultimate');
    const its = document.querySelectorAll('.milspec-tr-it');
    expect(its[0].querySelector('.milspec-tr-n')!.textContent).toBe('01');
    const lit = document.querySelectorAll('.milspec-tr-it .milspec-led.is-on');
    expect(lit.length).toBe(1);
  });

  it('層の行を押すと energy が呼ばれ、ランプに flick が付く', () => {
    r('ultimate');
    const it = document.querySelector('.milspec-tr-it') as HTMLElement;
    (energy as ReturnType<typeof vi.fn>).mockClear();
    expect(it.querySelector('.is-flick')).toBeNull();
    fireEvent.click(it);
    expect(energy).toHaveBeenCalledWith(it);
    expect(it.querySelector('.milspec-led.is-flick')).not.toBeNull();
  });

  it('選択モードではプラン行を押すとプランを切り替えず onToggle が呼ばれる', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    spy.mockClear();
    const onToggle = vi.fn();
    r('ultimate', { mode: 'share', selectedIds: ['p1'], onToggle });
    const rows = document.querySelectorAll('.milspec-tr-plan');
    expect(rows[0].getAttribute('role')).toBe('checkbox');
    expect(rows[0].getAttribute('aria-checked')).toBe('true');
    expect(rows[1].getAttribute('aria-checked')).toBe('false');
    expect(rows[0].querySelector('.milspec-tr-ops')).toBeNull();
    fireEvent.click(rows[1]);
    expect(onToggle).toHaveBeenCalledWith('p2');
    expect(spy).not.toHaveBeenCalled();
  });

  it('動きを減らす設定では開閉で animate を呼ばない', () => {
    (useReducedMotion as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const anim = vi.fn(() => ({}));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = anim;
    savagePlans();
    r('savage');
    fireEvent.click(document.querySelector('.milspec-tr-fold')!);
    fireEvent.click(document.querySelector('.milspec-tr-it')!);
    expect(anim).not.toHaveBeenCalled();
    (useReducedMotion as ReturnType<typeof vi.fn>).mockReturnValue(false);
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });
});
