// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import type { PartyMember, PlayerStats } from '../../../../types';
import { JobPickerRow } from '../../../JobPickerRow';
import { useMitigationStore } from '../../../../store/useMitigationStore';
import { lightPartyGap } from '../milspecJackBoardModel';
import * as engine from '../../fx/engine';

const S: PlayerStats = { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 };
const mk = (id: string, jobId: string | null, role: PartyMember['role']): PartyMember => ({ id, jobId, role, stats: { ...S }, computedValues: {} });
const ROLE = [mk('MT', 'WAR', 'tank'), mk('ST', 'PLD', 'tank'), mk('H1', 'SCH', 'healer'), mk('H2', null, 'healer'), mk('D1', 'MNK', 'dps'), mk('D2', 'RPR', 'dps'), mk('D3', 'BLM', 'dps'), mk('D4', 'BRD', 'dps')];
const LP = ['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4'].map((id) => ROLE.find((m) => m.id === id)!);
const tStub: any = (k: string, f?: string) => f ?? k;
const mm = (matches: boolean) => (q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} });

let anim: ReturnType<typeof vi.fn>;
const protoDesc = (k: string) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k);
let saved: Record<string, PropertyDescriptor | undefined>;
beforeEach(() => {
  saved = { offsetLeft: protoDesc('offsetLeft'), offsetWidth: protoDesc('offsetWidth'), animate: protoDesc('animate') };
  anim = vi.fn();
  (HTMLElement.prototype as any).animate = anim;
  // 列の中心: 並びの何番目か x 100(offsetLeft は兄弟の位置から)
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get() { return this.hasAttribute('data-member-id') ? Array.from(this.parentElement.children).indexOf(this) * 100 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.hasAttribute('data-member-id') ? 100 : 0; } });
  vi.stubGlobal('matchMedia', mm(false));
});
afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  // 上書きした prototype を元に戻す
  for (const [k, desc] of Object.entries(saved)) {
    if (desc) Object.defineProperty(HTMLElement.prototype, k, desc); else delete (HTMLElement.prototype as any)[k];
  }
});

const ui = (members: PartyMember[], sort: 'role' | 'light_party', onClick: (id: string, e: unknown) => void = () => {}) => (
  <JobPickerRow variant="socket" partyMembers={members} partySortOrder={sort} getJobIcon={(j) => (j ? `/i/${j}.png` : null)} jobs={[]}
    handleJobIconClick={onClick as never} getMemberRefCallback={() => () => {}} t={tStub} />
);

// MilspecJackRow は React.lazy で読むので、最初に一度だけ描いて解決させておく(以降のテストは同期で描ける)
beforeAll(async () => {
  let r!: ReturnType<typeof render>;
  vi.stubGlobal('matchMedia', mm(false));
  await act(async () => { r = render(ui(ROLE.slice(0, 1), 'role')); });
  await waitFor(() => { if (!r.container.querySelector('.milspec-jack')) throw new Error('lazy 未解決'); });
  r.unmount();
  vi.unstubAllGlobals();
});

describe('JobPickerRow variant=socket', () => {
  it('data 属性つきの外側 div が表示メンバー数だけ・差込口の中身', () => {
    const { container } = render(ui(ROLE.slice(0, 6), 'role'));
    const cells = container.querySelectorAll('[data-member-id]');
    expect(cells.length).toBe(6);
    expect(cells[0].getAttribute('data-member-role')).toBe('tank');
    expect(container.querySelectorAll('.milspec-jack').length).toBe(6);
    expect(container.querySelector('.milspec-jack img')?.getAttribute('src')).toBe('/i/WAR.png');
  });
  it('クリックで handleJobIconClick・右クリックでジョブ解除', () => {
    const click = vi.fn();
    const setJob = vi.spyOn(useMitigationStore.getState(), 'setMemberJob').mockImplementation(() => {});
    const { container } = render(ui(ROLE, 'role', click));
    fireEvent.click(container.querySelector('[data-member-id="MT"] .milspec-jack')!);
    expect(click).toHaveBeenCalledWith('MT', expect.anything());
    fireEvent.contextMenu(container.querySelector('[data-member-id="MT"] .milspec-jack')!);
    expect(setJob).toHaveBeenCalledWith('MT', null);
  });
  it('並び替えで差込口が animate(880ms)・同じ並びの再描画では呼ばれない', () => {
    const { rerender } = render(ui(ROLE, 'role'));
    rerender(ui(ROLE, 'role'));
    expect(anim).not.toHaveBeenCalled();
    rerender(ui(LP, 'light_party'));
    expect(anim).toHaveBeenCalled();
    expect(anim.mock.calls[0][1]).toMatchObject({ duration: 880, fill: 'backwards' });
  });
  it('動きを減らす設定では animate しない', () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { rerender } = render(ui(ROLE, 'role'));
    rerender(ui(LP, 'light_party'));
    expect(anim).not.toHaveBeenCalled();
  });
  it('ホバーで扇の光 burst(bp:f{j}r / l)', () => {
    const b = vi.spyOn(engine, 'burst').mockImplementation(() => {});
    const { container } = render(ui(ROLE, 'role'));
    fireEvent.pointerEnter(container.querySelectorAll('.milspec-jack')[2]);
    expect(b).toHaveBeenCalledWith('bp:f2r', expect.objectContaining({ n: 6, stagger: 16, len: 6 }));
    expect(b).toHaveBeenCalledWith('bp:f2l', expect.objectContaining({ rev: true }));
  });
  it('並び替えの 760ms 後に burst', () => {
    vi.useFakeTimers();
    const b = vi.spyOn(engine, 'burst').mockImplementation(() => {});
    const { rerender } = render(ui(ROLE, 'role'));
    rerender(ui(LP, 'light_party'));
    expect(b).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(b).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('アニメ途中の再並び替え', () => {
  it('再生中の前のアニメを cancel してから新しく始める', () => {
    const cancel = vi.fn();
    anim.mockReturnValue({ playState: 'running', cancel });
    const { rerender } = render(ui(ROLE, 'role'));
    rerender(ui(LP, 'light_party'));
    const first = anim.mock.calls.length;
    rerender(ui(ROLE, 'role'));
    expect(cancel).toHaveBeenCalled();
    expect(anim.mock.calls.length).toBeGreaterThan(first);
  });
});

describe('標準(variant なし)は差込口にならない', () => {
  it('milspec-jack を含まない', () => {
    const { container } = render(<JobPickerRow partyMembers={ROLE} partySortOrder="role" getJobIcon={() => null} jobs={[]} handleJobIconClick={() => {}} getMemberRefCallback={() => () => {}} t={tStub} />);
    expect(container.querySelector('.milspec-jack')).toBeNull();
  });
});

describe('lightPartyGap', () => {
  it('ライトパーティ順 8 人 = 3 / ロール別 = null / 隠して 7 人でも LP の境目', () => {
    expect(lightPartyGap(LP, 'light_party')).toBe(3);
    expect(lightPartyGap(ROLE, 'role')).toBeNull();
    expect(lightPartyGap(LP.filter((m) => m.id !== 'D3'), 'light_party')).toBe(2);
  });
});
