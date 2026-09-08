// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MilspecToolbar } from '../MilspecToolbar';

const props = {
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(), statusOpen: false, setStatusOpen: vi.fn(),
};
beforeEach(() => vi.clearAllMocks());

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
});
