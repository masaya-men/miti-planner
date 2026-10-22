// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PartyOps } from '../PartyOps';
import { useMitigationStore } from '../../../../store/useMitigationStore';
import { useThemeStore } from '../../../../store/useThemeStore';

const wip = vi.hoisted(() => ({ on: true }));
vi.mock('../../../../hooks/useCanPreviewWip', () => ({ useCanPreviewWip: () => wip.on }));
vi.mock('../../../../hooks/useSkillsData', async (orig) => ({ ...(await orig<object>()), useJobs: () => [] }));
vi.mock('../../../fx/engine', async (orig) => ({ ...(await orig<object>()), pulse: vi.fn(() => 0), isFxActive: vi.fn(() => false) }));

const props = {
  MW: 1189, partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(), statusOpen: false, setStatusOpen: vi.fn(),
};
const r = () => render(<MemoryRouter><div style={{ position: 'relative' }}><PartyOps {...props} /></div></MemoryRouter>);
/** 2 重 rAF を流す */
const flushRaf = async () => { await act(async () => { await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(null)))); }); };

beforeEach(() => {
  vi.clearAllMocks();
  wip.on = true;
  useMitigationStore.setState({ hiddenPartyMemberIds: [] } as never);
  useThemeStore.setState({ timelineView: 'lanes' } as never);
});

describe('PartyOps: 表示メンバー + 表の見た目(M1)', () => {
  it('ALL + 8 人のトグルキーと ふつう/スプシ の連動キーがあり、みんなの軽減表・歯車は無い', () => {
    const { container, getByRole, queryByText, queryByRole } = r();
    expect(container.querySelectorAll('[data-member-toggle]').length).toBe(8);
    expect(getByRole('button', { name: 'ALL' })).not.toBeNull();
    expect(getByRole('button', { name: 'ふつう' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'スプシ' }).getAttribute('aria-pressed')).toBe('false');
    expect(queryByText('みんなの軽減表')).toBeNull();
    expect(queryByRole('button', { name: '表示メンバー' })).toBeNull();
    expect(container.textContent).toContain('MEMBERS');
    expect(container.textContent).toContain('VIEW');
  });
  it('ALL は非表示が無いとき pressed、非表示の人がいるときは外れる', () => {
    const { getByRole } = r();
    expect(getByRole('button', { name: 'ALL' }).getAttribute('aria-pressed')).toBe('true');
    act(() => useMitigationStore.setState({ hiddenPartyMemberIds: ['D1'] } as never));
    expect(getByRole('button', { name: 'ALL' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-member-toggle="D1"]')!.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-member-toggle="MT"]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('D1 を押すと(2 重 rAF 後)hiddenPartyMemberIds に D1 が入り、ALL で空に戻る', async () => {
    const { container, getByRole } = r();
    fireEvent.click(container.querySelector('[data-member-toggle="D1"]')!);
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]); // まだ(rAF 前)
    await flushRaf();
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['D1']);
    fireEvent.click(getByRole('button', { name: 'ALL' }));
    await flushRaf();
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
  });
  it('スプシを押すと timelineView が sheet、ふつうで lanes に戻る', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: 'スプシ' }));
    expect(useThemeStore.getState().timelineView).toBe('sheet');
    fireEvent.click(getByRole('button', { name: 'ふつう' }));
    expect(useThemeStore.getState().timelineView).toBe('lanes');
  });
  it('canPreviewWip=false なら view キーと VIEW 刻印を描かない(メンバー列は残る)', () => {
    wip.on = false;
    const { container, queryByRole } = r();
    expect(queryByRole('button', { name: 'スプシ' })).toBeNull();
    expect(queryByRole('button', { name: 'ふつう' })).toBeNull();
    expect(container.textContent).not.toContain('VIEW');
    expect(container.querySelectorAll('[data-member-toggle]').length).toBe(8);
  });
});
