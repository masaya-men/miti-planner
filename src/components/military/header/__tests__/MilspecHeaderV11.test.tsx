// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecHeaderV11 } from '../MilspecHeaderV11';
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
  it('取り込み・その他・表示メンバーは名前つきのボタンで出る', () => {
    const { getAllByRole } = r();
    const names = getAllByRole('button').map((b) => b.textContent + '|' + (b.getAttribute('aria-label') ?? ''));
    expect(names.some((n) => /取り込み|インポート/.test(n))).toBe(true);
    expect(names.some((n) => /表示メンバー/.test(n))).toBe(true);
    expect(names.some((n) => /その他/.test(n))).toBe(true);
  });
  it('表示メンバー: 非表示の人がいるときだけ active(緑のランプ)', () => {
    const { container, rerender } = r();
    expect(container.querySelector('.milspec-key-active')).toBeNull();
    useMitigationStore.setState({ hiddenPartyMemberIds: ['MT'] } as never);
    rerender(<MemoryRouter><MilspecHeaderV11 {...props} /></MemoryRouter>);
    expect(container.querySelector('.milspec-key-active')).not.toBeNull();
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
