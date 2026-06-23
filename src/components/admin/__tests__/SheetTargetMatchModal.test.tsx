// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o && typeof o === 'object' ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'ja' } }),
}));

import { SheetTargetMatchModal } from '../SheetTargetMatchModal';
import type { TimelineEvent } from '../../../types';

const tpl: TimelineEvent[] = [
  { id: 't1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical', target: 'MT' },
];

describe('SheetTargetMatchModal', () => {
  it('isOpen=false は何も描画しない', () => {
    const { container } = render(
      <SheetTargetMatchModal isOpen={false} onClose={() => {}} templateEvents={tpl} />,
    );
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('isOpen=true でタイトルと貼付欄が出る', () => {
    render(<SheetTargetMatchModal isOpen onClose={() => {}} templateEvents={tpl} />);
    expect(screen.getByText('admin.tpl_sheet_match_title')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeTruthy();
  });

  it('ESC で閉じた後に再表示するとテキストがリセットされる', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SheetTargetMatchModal isOpen onClose={onClose} templateEvents={tpl} />,
    );
    // テキストを入力
    const textarea = document.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: '時間\t攻撃名\n0:50\tアクモーン' } });
    expect(textarea.value).toBe('時間\t攻撃名\n0:50\tアクモーン');

    // ESC キーでモーダルを閉じる
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // 再表示: isOpen を false→true にトグル
    rerender(<SheetTargetMatchModal isOpen={false} onClose={onClose} templateEvents={tpl} />);
    rerender(<SheetTargetMatchModal isOpen onClose={onClose} templateEvents={tpl} />);

    // テキストがリセットされていることを確認
    const resetTextarea = document.querySelector('textarea')!;
    expect(resetTextarea.value).toBe('');
  });
});
