// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within, waitFor } from '@testing-library/react';
import { MilspecToolbar } from '../MilspecToolbar';

const props = {
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(), statusOpen: false, setStatusOpen: vi.fn(),
};
beforeEach(() => vi.clearAllMocks());

// Fix round 1: statusOpen は MilspecToolbar 内部 state ではなく親から渡される制御 prop のため、
// 実クリック→実際に PartyStatusPopover が開くことを検証するには本物の state を持つラッパーが要る
// (setStatusOpen が vi.fn() のままだと再レンダリングが起きず、見た目上「開かない」ため)。
function ToolbarWithRealState() {
  const [statusOpen, setStatusOpen] = useState(false);
  return <MilspecToolbar {...props} statusOpen={statusOpen} setStatusOpen={setStatusOpen} />;
}

// CREW クラスタ(1つ目の .milspec-tb-cluster)に絞って探す。brief記載のテストコードに対する
// 必要な補正(MilspecSidebar.test.tsx の MemoryRouter 追加と同種): VIEW クラスタの
// 「みんなの軽減表」ボタンの英語ラベル(popular.open_popular)に "party" の語が偶然含まれ、
// PartyVisibilityMenu(標準コンポーネント本体・aria-label="表示メンバー設定")には "設定" の語が
// 含まれるため、絞り込み無しの getByRole だと Found multiple elements で落ちる。
const crewOf = (container: HTMLElement) => within(container.querySelectorAll('.milspec-tb-cluster')[0] as HTMLElement);

describe('MilspecToolbar', () => {
  it('パーティ編成ボタンで timeline:party-settings を dispatch', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    const { container } = render(<MilspecToolbar {...props} />);
    fireEvent.click(crewOf(container).getByRole('button', { name: /パーティ編成|party/i }));
    expect(spy.mock.calls.some(c => (c[0] as CustomEvent).type === 'timeline:party-settings')).toBe(true);
  });
  it('設定ボタンで setStatusOpen(true)', () => {
    const { container } = render(<MilspecToolbar {...props} />);
    fireEvent.click(crewOf(container).getByRole('button', { name: /設定|config/i }));
    expect(props.setStatusOpen).toHaveBeenCalledWith(true);
  });
  it('SORT セグメントで setPartySortOrder', () => {
    const { getByText } = render(<MilspecToolbar {...props} />);
    fireEvent.click(getByText(/ロール/));
    expect(props.setPartySortOrder).toHaveBeenCalledWith('role');
  });
  it('【Fix round 1】設定ボタンクリックで PartyStatusPopover が実際に開く', async () => {
    const { container } = render(<ToolbarWithRealState />);
    expect(document.body.textContent).not.toContain('コンテンツ挑戦当時のステータス');
    fireEvent.click(crewOf(container).getByRole('button', { name: /設定|config/i }));
    await waitFor(() => {
      expect(document.body.textContent).toContain('コンテンツ挑戦当時のステータス');
    });
  });
});
