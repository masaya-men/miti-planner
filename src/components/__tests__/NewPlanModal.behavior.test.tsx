// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
vi.mock('../LoginModal', () => ({
  LoginModal: (p: { isOpen: boolean }) => (p.isOpen ? <div data-testid="login-modal" /> : null),
}));
const commitSpy = vi.fn();
vi.mock('../../lib/commitNewPlan', () => ({ commitNewPlan: (p: unknown) => commitSpy(p) }));

import { NewPlanModal } from '../NewPlanModal';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getContentDefinitions } from '../../data/contentRegistry';

describe('NewPlanModal の動き', () => {
  beforeEach(() => {
    cleanup();
    commitSpy.mockClear();
    usePlanStore.setState({ plans: [], currentPlanId: null } as never);
    useAuthStore.setState({ user: null } as never);
  });

  it('閉じている間は何も描かない', () => {
    const { container } = render(<NewPlanModal isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText('new_plan.modal_title')).toBeNull();
  });

  it('開くとレベル未選択の案内が出て、作成ボタンは押せない', () => {
    render(<NewPlanModal isOpen onClose={() => {}} />);
    expect(screen.getByText('new_plan.modal_title')).toBeTruthy();
    expect(screen.getByText('new_plan.select_level')).toBeTruthy();
    expect((screen.getByText('new_plan.create_button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('キャンセル・閉じるで onClose が引数なしで呼ばれる', () => {
    const onClose = vi.fn();
    render(<NewPlanModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('new_plan.cancel_button'));
    expect(onClose).toHaveBeenCalledWith();
    fireEvent.click(screen.getByLabelText('common.close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('レベル→カテゴリの順に案内が進み、その他カテゴリは名前入力で作成できる', () => {
    const onClose = vi.fn();
    render(<NewPlanModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('100'));
    expect(screen.getByText('new_plan.select_category')).toBeTruthy();
    fireEvent.click(screen.getByText('その他'));
    expect(screen.getByText('new_plan.enter_name')).toBeTruthy();
    const input = screen.getByPlaceholderText('new_plan.free_name_placeholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  テスト表  ' } });
    const create = screen.getByText('new_plan.create_button') as HTMLButtonElement;
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const plan = commitSpy.mock.calls[0][0];
    expect(plan.title).toBe('テスト表');
    expect(plan.category).toBe('custom');
    expect(plan.level).toBe(100);
    expect(onClose).toHaveBeenCalledWith({ contentId: plan.contentId, level: 100, category: 'custom' });
  });

  it('Enter キーで作成できる', () => {
    render(<NewPlanModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('100'));
    fireEvent.click(screen.getByText('その他'));
    const input = screen.getByPlaceholderText('new_plan.free_name_placeholder');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(commitSpy).toHaveBeenCalledTimes(1);
  });

  it('零式を選ぶとコンテンツ一覧が出て、選ぶと名前が入り作成できる', () => {
    const savage = getContentDefinitions().find((c) => c.category === 'savage')!;
    render(<NewPlanModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText(String(savage.level)));
    fireEvent.click(screen.getByText('零式'));
    expect(screen.getByText('new_plan.select_content')).toBeTruthy();
    fireEvent.click(screen.getByText(savage.name.ja));
    const input = screen.getByPlaceholderText('new_plan.plan_name_placeholder') as HTMLInputElement;
    expect(input.value).toBe(savage.shortName.en || savage.shortName.ja);
    fireEvent.click(screen.getByText('new_plan.create_button'));
    expect(commitSpy.mock.calls[0][0].contentId).toBe(savage.id);
  });

  it('initialContentId で開くとレベル・カテゴリ・ボス・名前が選択済みになる', () => {
    const savage = getContentDefinitions().find((c) => c.category === 'savage')!;
    const { rerender } = render(<NewPlanModal isOpen={false} onClose={() => {}} initialContentId={savage.id} />);
    rerender(<NewPlanModal isOpen onClose={() => {}} initialContentId={savage.id} />);
    const input = screen.getByPlaceholderText('new_plan.plan_name_placeholder') as HTMLInputElement;
    expect(input.value).toBe(savage.shortName.en || savage.shortName.ja);
    expect((screen.getByText('new_plan.create_button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('カテゴリを変えるとボスと名前がリセットされる', () => {
    const savage = getContentDefinitions().find((c) => c.category === 'savage')!;
    const { rerender } = render(<NewPlanModal isOpen={false} onClose={() => {}} initialContentId={savage.id} />);
    rerender(<NewPlanModal isOpen onClose={() => {}} initialContentId={savage.id} />);
    fireEvent.click(screen.getByText('その他'));
    const input = screen.getByPlaceholderText('new_plan.free_name_placeholder') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('未ログインならゲスト案内が出て、ログイン済みなら出ない', () => {
    const { unmount } = render(<NewPlanModal isOpen onClose={() => {}} />);
    expect(screen.getByText('new_plan.guest_hint')).toBeTruthy();
    unmount();
    act(() => { useAuthStore.setState({ user: { uid: 'u' } } as never); });
    render(<NewPlanModal isOpen onClose={() => {}} />);
    expect(screen.queryByText('new_plan.guest_hint')).toBeNull();
  });

  it('総数上限に達していると警告が出て作成できない', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, contentId: 'x' }));
    usePlanStore.setState({ plans: many } as never);
    render(<NewPlanModal isOpen onClose={() => {}} />);
    expect(screen.getByText('new_plan.plan_limit_total')).toBeTruthy();
    fireEvent.click(screen.getByText('100'));
    fireEvent.click(screen.getByText('その他'));
    fireEvent.change(screen.getByPlaceholderText('new_plan.free_name_placeholder'), { target: { value: 'a' } });
    expect((screen.getByText('new_plan.create_button') as HTMLButtonElement).disabled).toBe(true);
  });
});
