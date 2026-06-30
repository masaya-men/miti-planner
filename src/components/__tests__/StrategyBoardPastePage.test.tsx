// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// i18n モック（補間対応）
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'stgy.page_title': 'PS5 貼り付けアシスト',
        'stgy.heading': '貼り付けアシスト',
        'stgy.intro': '説明',
        'stgy.prep_title': '準備',
        'stgy.prep_body': '準備本文',
        'stgy.prep_ack': 'OK',
        'stgy.paste_label': 'コードを貼る',
        'stgy.paste_placeholder': '[stgy:...]',
        'stgy.chunks_heading': '順にコピー',
        'stgy.copied': 'コピー済み',
        'stgy.copied_toast': 'コピーしました',
        'stgy.copy_failed': '失敗',
        'stgy.done': '完了',
        'stgy.reset': 'やり直す',
        'stgy.advanced': '文字数を調整',
        'stgy.chunk_size_label': '1回の文字数',
      };
      if (key === 'stgy.copy_nth') return `${opts?.n}番目をコピー`;
      if (key === 'stgy.progress') return `${opts?.done} / ${opts?.total} コピー済`;
      return map[key] ?? key;
    },
    i18n: { language: 'ja' },
  }),
}));

import StrategyBoardPastePage from '../StrategyBoardPastePage';

describe('StrategyBoardPastePage', () => {
  beforeEach(() => {
    // clipboard モック（happy-dom では getter のみなので defineProperty で差し替え）
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    try { localStorage.clear(); } catch { /* noop */ }
  });

  it('コードを貼ると断片ボタンが生成される', () => {
    render(<StrategyBoardPastePage />, { wrapper: MemoryRouter });
    const textarea = screen.getByPlaceholderText('[stgy:...]');
    fireEvent.change(textarea, { target: { value: 'x'.repeat(360) } }); // 既定88区切り→5断片
    expect(screen.getByText('1番目をコピー')).toBeTruthy();
    expect(screen.getByText('2番目をコピー')).toBeTruthy();
    expect(screen.getByText('3番目をコピー')).toBeTruthy();
  });

  it('コピーボタン押下で clipboard に書き込み＋✅状態になる', async () => {
    render(<StrategyBoardPastePage />, { wrapper: MemoryRouter });
    const textarea = screen.getByPlaceholderText('[stgy:...]');
    fireEvent.change(textarea, { target: { value: 'x'.repeat(360) } });
    const btn = screen.getByText('1番目をコピー');
    fireEvent.click(btn);
    await Promise.resolve();
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('x'.repeat(88));
    // iOS 風の自前トーストに「コピーしました」が出る
    expect(await screen.findByText('コピーしました')).toBeTruthy();
    expect(await screen.findByText('コピー済み')).toBeTruthy();
  });

  it('空入力では断片リストが出ない', () => {
    render(<StrategyBoardPastePage />, { wrapper: MemoryRouter });
    expect(screen.queryByText('順にコピー')).toBeNull();
  });

  it('全画面スクロールシェル(stgy-page)でレンダリングされる（最上部に戻れる土台）', () => {
    // body 全体スクロール方式は iOS で不安定なため、専用シェル(.stgy-page=100dvh内部スクロール)を使う。
    render(<StrategyBoardPastePage />, { wrapper: MemoryRouter });
    const shell = screen.getByTestId('stgy-scroll');
    expect(shell.className).toContain('stgy-page');
  });
});
