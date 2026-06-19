// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressHistoryRow from '../ProgressHistoryRow';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

const base = {
  point: { id: 'pt_test', ts: Date.parse('2026-06-19T12:34:00Z'), reachedPos: 150 },
  index: 0, isBest: true, totalSec: 300, phaseLabel: 'フェーズ2',
  onDelete: vi.fn(), onSetNote: vi.fn(),
};

describe('ProgressHistoryRow', () => {
  it('フェーズラベルと % を表示し、最高バッジを出す', () => {
    render(<ProgressHistoryRow {...base} />);
    expect(screen.getByText('フェーズ2')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();        // 150/300
    expect(screen.getByText('progress.best')).toBeTruthy();
  });

  it('isBest=false では最高バッジを出さない', () => {
    render(<ProgressHistoryRow {...base} isBest={false} />);
    expect(screen.queryByText('progress.best')).toBeNull();
  });

  it('ゴミ箱クリックで onDelete(index)', () => {
    const onDelete = vi.fn();
    render(<ProgressHistoryRow {...base} index={2} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('progress.delete_record'));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it('メモ click で入力欄、blur で onSetNote(id, 値)', () => {
    // Task 5 で id ベースに変更済み: onSetNote(point.id, note) を呼ぶ
    const onSetNote = vi.fn();
    render(<ProgressHistoryRow {...base} index={1} onSetNote={onSetNote} />);
    fireEvent.click(screen.getByText('progress.add_memo')); // 空なので追加プレースホルダ
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '初到達' } });
    fireEvent.blur(input);
    expect(onSetNote).toHaveBeenCalledWith('pt_test', '初到達');
  });

  it('既存メモを表示する', () => {
    render(<ProgressHistoryRow {...base} point={{ ...base.point, note: 'やった' }} />);
    expect(screen.getByText('やった')).toBeTruthy();
  });

  it('Esc で編集を取消（onSetNote を呼ばず、表示モードに戻る）', () => {
    const onSetNote = vi.fn();
    render(<ProgressHistoryRow {...base} index={1} onSetNote={onSetNote} />);
    fireEvent.click(screen.getByText('progress.add_memo'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'やめる' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSetNote).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
