// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressDetailPanel from '../ProgressDetailPanel';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('../../../store/useThemeStore', () => ({
  useThemeStore: (sel?: any) => { const s = { contentLanguage: 'ja' }; return sel ? sel(s) : s; },
}));

const actions = {
  removeProgressPoint: vi.fn(),
  clearAllProgressPoints: vi.fn(),
  setProgressPointNote: vi.fn(),
  insertProgressPointAt: vi.fn(),
};
let state: any;
vi.mock('../../../store/useMitigationStore', () => ({
  useMitigationStore: (sel: (s: any) => unknown) => sel(state),
}));

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  state = {
    ...actions,
    phases: [],
    timelineEvents: [{ id: 'e', time: 300 }],
    progress: { points: [
      { id: 'pt_a', ts: 1, reachedPos: 60 },
      { id: 'pt_b', ts: 2, reachedPos: 240 },
    ], cleared: false },
  };
});

describe('ProgressDetailPanel', () => {
  it('件数見出しと行を表示（新しい順）', () => {
    render(<ProgressDetailPanel open={true} />);
    expect(screen.getByText('progress.detail_title')).toBeTruthy();
    // 2点ぶんの % が出る（60/300=20, 240/300=80）
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('全消去 → ConfirmDialog → 確定で clearAllProgressPoints', () => {
    render(<ProgressDetailPanel open={true} />);
    fireEvent.click(screen.getByText('progress.clear_all'));
    // ConfirmDialog の確定ボタン（confirmLabel=progress.clear_all_confirm_ok）
    fireEvent.click(screen.getByText('progress.clear_all_confirm_ok'));
    expect(actions.clearAllProgressPoints).toHaveBeenCalled();
  });

  it('点が無いと空状態を表示し全消去を出さない', () => {
    state.progress = { points: [], cleared: false };
    render(<ProgressDetailPanel open={true} />);
    expect(screen.getByText('progress.empty_title')).toBeTruthy();
    expect(screen.queryByText('progress.clear_all')).toBeNull();
  });

  it('個別削除で removeProgressPoint(id) を呼ぶ', () => {
    render(<ProgressDetailPanel open={true} />);
    // 先頭行（表示は新しい順なので reachedPos=240=id pt_b）の削除
    const delButtons = screen.getAllByLabelText('progress.delete_record');
    fireEvent.click(delButtons[0]);
    expect(actions.removeProgressPoint).toHaveBeenCalledWith('pt_b');
  });
});
