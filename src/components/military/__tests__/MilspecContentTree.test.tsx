// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecContentTree } from '../MilspecContentTree';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';
import * as planLoadModule from '../../../lib/planLoad';

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

const r = (tab: 'savage' | 'ultimate' | 'other' | 'archive' = 'ultimate') =>
  render(<MemoryRouter><MilspecContentTree tab={tab} /></MemoryRouter>);

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
    // 行内アクション: [rename, duplicate, delete]
    const rows = document.querySelectorAll('.milspec-tree-plans .milspec-pi:not(.add)');
    const acts = rows[1].querySelectorAll('.ac button');
    expect(acts.length).toBe(3);
    fireEvent.click(acts[1]);
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
    const rows = document.querySelectorAll('.milspec-tree-plans .milspec-pi:not(.add)');
    r();
    const freshRows = document.querySelectorAll('.milspec-tree-plans .milspec-pi:not(.add)');
    const delBtn = freshRows[1].querySelectorAll('.ac button')[2];
    fireEvent.click(delBtn);
    expect(spy).not.toHaveBeenCalled(); // 武装のみ
    fireEvent.click(delBtn);
    expect(spy).toHaveBeenCalledWith('p2');
    void rows;
  });
});
