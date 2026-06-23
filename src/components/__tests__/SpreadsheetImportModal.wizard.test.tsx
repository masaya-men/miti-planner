// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : k),
    i18n: { language: 'ja' },
  }),
}));

// framer-motion を素通し（アニメの非同期 exit を排除して同期描画）
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: {
    div: ({ children, initial, animate, exit, transition, ...dom }: any) => (
      <div {...dom}>{children}</div>
    ),
  },
}));

import { SpreadsheetImportModal } from '../SpreadsheetImportModal';

const defaultSelection = { contentId: null, level: null, category: null, title: '' };

function renderModal() {
  return render(
    <SpreadsheetImportModal
      isOpen
      onClose={() => {}}
      onImport={async () => true}
      defaultSelection={defaultSelection}
    />,
  );
}

describe('SpreadsheetImportModal ウィザード遷移', () => {
  it('Step1: 取込先ラベルと「次へ（貼り付け）」が出る', () => {
    renderModal();
    expect(screen.getByText('sheetImport.target_content_label')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sheetImport.next_to_paste' })).toBeTruthy();
  });

  it('Step1→Step2: 貼り方ガイドが出て、entries 0 件なので次へは disabled', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    expect(screen.getByText('sheetImport.howto_title')).toBeTruthy();
    // 軽減も=true だが entries 0 → 検出ジョブ 0 → party無し → 次の行先は確認
    const next = screen.getByRole('button', { name: 'sheetImport.next_to_confirm' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('Step2→戻る でStep1に戻れる', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.wizard_back' }));
    expect(screen.getByText('sheetImport.target_content_label')).toBeTruthy();
  });

  it('フェーズ名任意: Step2 でフェーズ名空でも貼り付けがあれば「追加」が活性', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    const addBtn = screen.getByRole('button', { name: 'sheetImport.add_phase' }) as HTMLButtonElement;
    // 貼り付け空 → disabled
    expect(addBtn.disabled).toBe(true);
    // textarea に何か入力（フェーズ名は空のまま）→ 活性化（= 名前任意）
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A1\tB1' } });
    expect(addBtn.disabled).toBe(false);
  });
});
