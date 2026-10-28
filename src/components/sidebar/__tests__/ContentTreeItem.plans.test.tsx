// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ContentTreeItem } from '../ContentTreeItem';
import { TransitionContext } from '../../ui/transitionOverlayContext';
import { usePlanStore } from '../../../store/usePlanStore';
import type { ContentDefinition } from '../../../types';
import type { MultiSelectState } from '../../../types/sidebarTypes';

const content = {
  id: 'c1', name: { ja: 'テスト床', en: 'Test Floor' }, shortName: { ja: '床1', en: 'F1' },
  seriesId: 's', category: 'savage', level: 100, patch: '7.0', order: 1,
} as unknown as ContentDefinition;

const mkPlan = (id: string, title: string, extra: object = {}) =>
  ({ id, title, contentId: 'c1', ownerId: 'local', data: {}, ...extra });

const off: MultiSelectState = { isEnabled: false, selectedIds: [] };
const runTransition = vi.fn();

const r = (over: Partial<React.ComponentProps<typeof ContentTreeItem>> = {}) => {
  const props = {
    content, isActive: false, multiSelect: off, onToggleSelect: vi.fn(), onSelect: vi.fn(),
    lang: 'ja' as const, ...over,
  };
  const utils = render(
    <TransitionContext.Provider value={{ runTransition }}>
      <ContentTreeItem {...props} />
    </TransitionContext.Provider>
  );
  return { ...utils, props };
};

beforeEach(() => {
  runTransition.mockClear();
  usePlanStore.setState({ plans: [mkPlan('p1', 'A'), mkPlan('p2', 'B')] as never, currentPlanId: 'p1' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ContentTreeItem 動き', () => {
  it('プランありは最初から展開、コンテンツ行クリックで閉じて再クリックで開く', () => {
    const { container, queryByText } = r();
    expect(queryByText('A')).toBeTruthy();
    const head = container.querySelector('button.sidebar-item') as HTMLElement;
    fireEvent.click(head);
    expect(queryByText('A')).toBeNull();
    fireEvent.click(head);
    expect(queryByText('A')).toBeTruthy();
  });

  it('プラン0件でコンテンツ行を押すと onSelect(content) / 「+」は onSelect(content,true)', () => {
    usePlanStore.setState({ plans: [] as never, currentPlanId: null });
    const { container, props } = r();
    fireEvent.click(container.querySelector('button.sidebar-item') as HTMLElement);
    expect(props.onSelect).toHaveBeenCalledWith(content);
    const plus = container.querySelectorAll('button')[1];
    fireEvent.click(plus);
    expect(props.onSelect).toHaveBeenCalledWith(content, true);
  });

  it('プラン0→1件で自動展開される', async () => {
    usePlanStore.setState({ plans: [] as never, currentPlanId: null });
    const { queryByText, findByText } = r();
    expect(queryByText('A')).toBeNull();
    usePlanStore.setState({ plans: [mkPlan('p1', 'A')] as never });
    expect(await findByText('A')).toBeTruthy();
  });

  it('プラン行クリックで runTransition、現在プランのクリックは何もしない', () => {
    const { getByText } = r();
    fireEvent.click(getByText('A'));
    expect(runTransition).not.toHaveBeenCalled();
    fireEvent.click(getByText('B'));
    expect(runTransition).toHaveBeenCalledTimes(1);
    expect(runTransition.mock.calls[0][1]).toBe('plan');
  });

  it('Shift+クリックは onShiftSelect(planId)', () => {
    const onShiftSelect = vi.fn();
    const { getByText } = r({ onShiftSelect });
    fireEvent.click(getByText('B'), { shiftKey: true });
    expect(onShiftSelect).toHaveBeenCalledWith('p2');
    expect(runTransition).not.toHaveBeenCalled();
  });

  it('右クリックで onContextMenu(planId, title, contentId)', () => {
    const onContextMenu = vi.fn();
    const { getByText } = r({ onContextMenu });
    fireEvent.contextMenu(getByText('B'));
    expect(onContextMenu.mock.calls[0].slice(1)).toEqual(['p2', 'B', 'c1']);
  });

  it('複製ボタンで duplicatePlan(planId)', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'duplicatePlan').mockResolvedValue(null);
    const { container } = r();
    const row = container.querySelectorAll('.group\\/plan')[1];
    fireEvent.click(row.querySelectorAll('button')[0]);
    expect(spy).toHaveBeenCalledWith('p2');
  });

  it('名前変更: 鉛筆で入力欄、入力して Enter で updatePlan、Escape で取りやめ', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'updatePlan');
    const { container } = r();
    const row = container.querySelectorAll('.group\\/plan')[1];
    fireEvent.click(row.querySelectorAll('button')[1]);
    let input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('B');
    fireEvent.change(input, { target: { value: 'B2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spy).toHaveBeenCalledWith('p2', { title: 'B2' });
    expect(container.querySelector('input')).toBeNull();

    const row2 = container.querySelectorAll('.group\\/plan')[1];
    fireEvent.click(row2.querySelectorAll('button')[1]);
    input = container.querySelector('input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('input')).toBeNull();
  });

  it('削除は 2 段階確認: 1回目で確認表示、2回目で deletePlan', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'deletePlan');
    const { container } = r();
    const row = container.querySelectorAll('.group\\/plan')[1];
    fireEvent.click(row.querySelectorAll('button')[2]);
    expect(spy).not.toHaveBeenCalled();
    expect(row.querySelectorAll('button')[2].textContent).toContain('sidebar.delete_single');
    fireEvent.click(row.querySelectorAll('button')[2]);
    expect(spy).toHaveBeenCalledWith('p2');
  });

  it('共同編集中バッジは activeCollabRoomToken のあるプランだけ', () => {
    usePlanStore.setState({ plans: [mkPlan('p1', 'A', { activeCollabRoomToken: 'tok' }), mkPlan('p2', 'B')] as never });
    const { container } = r();
    const rows = container.querySelectorAll('.group\\/plan');
    expect(rows[0].querySelector('svg.lucide-users')).toBeTruthy();
    expect(rows[1].querySelector('svg.lucide-users')).toBeNull();
  });

  it('isActive のとき末尾に「プラン追加」行が出て onSelect(content,true)', () => {
    const { getByText, props } = r({ isActive: true });
    fireEvent.click(getByText('sidebar.add_plan'));
    expect(props.onSelect).toHaveBeenCalledWith(content, true);
  });

  it('複数選択モード: プラン行はチェック行になりクリックで onToggleSelect、件数表示', () => {
    const onToggleSelect = vi.fn();
    const { getByText } = r({ multiSelect: { isEnabled: true, selectedIds: ['p1'], mode: 'delete' }, onToggleSelect });
    expect(getByText('1/2')).toBeTruthy();
    fireEvent.click(getByText('B'));
    expect(onToggleSelect).toHaveBeenCalledWith('p2');
  });

  it('複数選択モードでコンテンツ行を押すと未選択プランが全部トグルされる', () => {
    const onToggleSelect = vi.fn();
    const { container } = r({ multiSelect: { isEnabled: true, selectedIds: ['p1'], mode: 'delete' }, onToggleSelect });
    fireEvent.click(container.querySelector('button.sidebar-item') as HTMLElement);
    expect(onToggleSelect.mock.calls).toEqual([['p2']]);
  });

  it('showFullName で正式名称が出る / 通常は shortName', () => {
    const a = r({ showFullName: true });
    expect(a.getByText('テスト床')).toBeTruthy();
    cleanup();
    const b = r();
    expect(b.getByText('床1')).toBeTruthy();
  });
});
