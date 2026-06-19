// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressHistoryRow from '../ProgressHistoryRow';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

const base = {
  point: { ts: Date.parse('2026-06-19T12:34:00Z'), reachedPos: 150 },
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

  it('メモ click で入力欄、blur で onSetNote(index, 値)', () => {
    const onSetNote = vi.fn();
    render(<ProgressHistoryRow {...base} index={1} onSetNote={onSetNote} />);
    fireEvent.click(screen.getByText('progress.add_memo')); // 空なので追加プレースホルダ
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '初到達' } });
    fireEvent.blur(input);
    expect(onSetNote).toHaveBeenCalledWith(1, '初到達');
  });

  it('既存メモを表示する', () => {
    render(<ProgressHistoryRow {...base} point={{ ...base.point, note: 'やった' }} />);
    expect(screen.getByText('やった')).toBeTruthy();
  });
});
