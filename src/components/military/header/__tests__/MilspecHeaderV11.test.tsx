// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecHeaderV11, DRW_PULSE } from '../MilspecHeaderV11';
import * as engine from '../../fx/engine';

vi.mock('../../fx/engine', async (orig) => {
  const m = await orig<typeof import('../../fx/engine')>();
  return { ...m, pulse: vi.fn(() => 0), isFxActive: vi.fn(() => true) };
});
import { useThemeStore } from '../../../../store/useThemeStore';
import { useMitigationStore } from '../../../../store/useMitigationStore';

const props = {
  theme: 'dark' as const, onToggleTheme: vi.fn(), partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(), statusOpen: false, setStatusOpen: vi.fn(),
};
const r = (p: Partial<typeof props> = {}) => render(<MemoryRouter><MilspecHeaderV11 {...props} {...p} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
  useMitigationStore.setState({ hiddenPartyMemberIds: [] } as never);
});

// ステータス設定は statusOpen が親の制御 prop。実クリックで開くことを見るには本物の state を持つラッパーが要る
function WithState() {
  const [statusOpen, setStatusOpen] = useState(false);
  return <MemoryRouter><MilspecHeaderV11 {...props} statusOpen={statusOpen} setStatusOpen={setStatusOpen} /></MemoryRouter>;
}

describe('MilspecHeaderV11(組み立て)', () => {
  it('装甲(hdr)・光の経路・H1〜H5 の型番・PARTY OPS / SORT の刻印を出す', () => {
    const { container } = r();
    expect(container.querySelector('[data-ms-armor="hdr"]')).not.toBeNull();
    expect(container.querySelector('.milspec-fx')).not.toBeNull();
    for (const s of ['H1', 'H3', 'H4', 'PARTY OPS', 'SORT', 'MIL-SPEC']) expect(container.textContent).toContain(s);
  });
  it('旧ヘッダー・旧ツールバー・ヘッダー内の折りたたみボタンは無い', () => {
    const { container } = r();
    expect(container.querySelector('.milspec-hdr')).toBeNull();
    expect(container.querySelector('.milspec-tb')).toBeNull();
    expect(container.querySelector('.milspec-hdr-collapse')).toBeNull();
  });
  it('MW 1189 でも CRT(攻略の軌跡)が出る', () => {
    const { container } = r();
    expect(container.querySelector('button.milspec-crt')).not.toBeNull();
  });
});

describe('H5 の機能', () => {
  it('パーティ編成キーで timeline:party-settings を dispatch', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: 'パーティ編成' }));
    expect(spy.mock.calls.some((c) => (c[0] as CustomEvent).type === 'timeline:party-settings')).toBe(true);
  });
  it('パーティ編成キーに標準と同じチュートリアルの目印 data-tutorial="party-comp" が付く', () => {
    const { getByRole } = r();
    expect(getByRole('button', { name: 'パーティ編成' }).getAttribute('data-tutorial')).toBe('party-comp');
  });
  it('ステータス設定キーで setStatusOpen(true)', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: 'ステータス設定' }));
    expect(props.setStatusOpen).toHaveBeenCalledWith(true);
  });
  it('ステータス設定キーでポップオーバーが実際に開く', async () => {
    const { getByRole } = render(<WithState />);
    expect(document.body.textContent).not.toContain('コンテンツ挑戦当時のステータス');
    fireEvent.click(getByRole('button', { name: 'ステータス設定' }));
    await waitFor(() => expect(document.body.textContent).toContain('コンテンツ挑戦当時のステータス'));
  });
  it('SORT: 押したほうで setPartySortOrder・今の並びが aria-pressed', () => {
    const { getByRole } = r();
    expect(getByRole('button', { name: 'ライトパーティ' }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: 'ロール別' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(getByRole('button', { name: 'ロール別' }));
    expect(props.setPartySortOrder).toHaveBeenCalledWith('role');
  });
  it('取り込み・その他は名前つきのボタンで出る', () => {
    const { getAllByRole } = r();
    const names = getAllByRole('button').map((b) => b.textContent + '|' + (b.getAttribute('aria-label') ?? ''));
    expect(names.some((n) => /取り込み|インポート/.test(n))).toBe(true);
    expect(names.some((n) => /その他/.test(n))).toBe(true);
  });
  it('表示メンバー: ALL + 8 人のキー。非表示の人がいると ALL が外れ、その人のキーも外れる(歯車・みんなの軽減表は無い)', () => {
    const { container, getByRole, queryByText } = r();
    expect(container.querySelectorAll('[data-member-toggle]').length).toBe(8);
    expect(getByRole('button', { name: 'ALL' }).getAttribute('aria-pressed')).toBe('true');
    expect(queryByText('みんなの軽減表')).toBeNull();
    act(() => useMitigationStore.setState({ hiddenPartyMemberIds: ['MT'] } as never));
    expect(getByRole('button', { name: 'ALL' }).getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-member-toggle="MT"]')!.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('H3 / H4 の既存機能', () => {
  it('昼夜ロッカーで onToggleTheme が呼ばれる(走査線ワイプのあと)', () => {
    vi.useFakeTimers();
    try {
      const { getByRole } = r();
      fireEvent.click(getByRole('button', { name: /テーマ/ }));
      vi.advanceTimersByTime(500);
      expect(props.onToggleTheme).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('タービンスイッチはローカル state(ストアを触らない)', () => {
    const spy = vi.spyOn(useThemeStore.getState(), 'setThemeStyle');
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /タービン|turbine|TRB/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('下の板・基板の配線', () => {
  const stubZone = (w: number) => {
    vi.stubGlobal('ResizeObserver', class { constructor(_cb: unknown) {} observe() {} unobserve() {} disconnect() {} });
    return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: w, height: 102, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 102, toJSON: () => ({}) });
  };
  const inZone = () => <MemoryRouter><div data-ms-zone="header"><MilspecHeaderV11 {...props} /></div></MemoryRouter>;
  const drwCalls = () => vi.mocked(engine.pulse).mock.calls.filter((c) => /^drw:/.test(c[0]));

  it('装甲に 下の板(id *-mesh)と 基板(data-trace="drw:1")が入る', () => {
    const { container } = r();
    expect(container.querySelector('[data-ms-armor="hdr"] [data-trace="drw:1"]')).not.toBeNull();
    expect(container.querySelector('[data-ms-armor="hdr"] [id$="-mesh"]')).not.toBeNull();
  });
  it('MW 1189 では粒を出さない', () => {
    vi.useFakeTimers();
    const spy = stubZone(1189);
    try {
      render(inZone());
      vi.advanceTimersByTime(5000);
      expect(drwCalls()).toHaveLength(0);
    } finally { spy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('MW 1465 では 0.9〜2.2 秒おきに drw:n を pulse する', () => {
    vi.useFakeTimers();
    const spy = stubZone(1465);
    try {
      render(inZone());
      vi.advanceTimersByTime(899);
      expect(drwCalls()).toHaveLength(0);
      vi.advanceTimersByTime(1401);
      expect(drwCalls().length).toBeGreaterThanOrEqual(1);
      expect(engine.pulse).toHaveBeenCalledWith(expect.stringMatching(/^drw:[1-6]$/), expect.objectContaining({ len: DRW_PULSE.len, speed: DRW_PULSE.speed }));
      expect(DRW_PULSE).toMatchObject({ minMs: 900, maxMs: 2200, len: 9, speed: 3.4 });
    } finally { spy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('動きを減らす設定(isFxActive=false)では pulse を呼ばない', () => {
    vi.useFakeTimers();
    vi.mocked(engine.isFxActive).mockReturnValue(false);
    const spy = stubZone(1465);
    try {
      render(inZone());
      vi.advanceTimersByTime(5000);
      expect(drwCalls()).toHaveLength(0);
    } finally { spy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.mocked(engine.isFxActive).mockReturnValue(true); }
  });
  it('アンマウントで粒のタイマーが止まる', () => {
    vi.useFakeTimers();
    const spy = stubZone(1465);
    try {
      const { unmount } = render(inZone());
      unmount();
      vi.advanceTimersByTime(5000);
      expect(drwCalls()).toHaveLength(0);
    } finally { spy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('CRT の箱は幅 324', () => {
    const { container } = r();
    const box = (container.querySelector('button.milspec-crt') as HTMLElement).parentElement as HTMLElement;
    expect(box.style.width).toBe('324px');
  });
});

describe('幅(MW)への追従', () => {
  it('区画が 1465 幅だと、SORT の刻印が右へ寄る(MW-222 = 1243)', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: unknown) {}
      observe() {} unobserve() {} disconnect() {}
    });
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1465, height: 102, x: 0, y: 0, top: 0, left: 0, right: 1465, bottom: 102, toJSON: () => ({}) });
    try {
      const { container } = render(<MemoryRouter><div data-ms-zone="header"><MilspecHeaderV11 {...props} /></div></MemoryRouter>);
      const sort = [...container.querySelectorAll('.milspec-stencil')].find((e) => e.textContent?.includes('SORT')) as HTMLElement;
      expect(sort.style.left).toBe('1243px');
      // H4(COM の刻印)も区画の右端に追従して右へ寄る(MW-99 = 1366)
      const com = [...container.querySelectorAll('.milspec-stencil')].find((e) => e.textContent?.trim() === 'COM') as HTMLElement;
      expect(com.style.left).toBe('1366px');
    } finally { spy.mockRestore(); vi.unstubAllGlobals(); }
  });
});
