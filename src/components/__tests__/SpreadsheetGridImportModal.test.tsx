// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';

// i18n: キー→日本語テキストの最小マップ（テスト対象キーのみ）
const JA: Record<string, string> = {
  'gridImport.title': 'スプレッドシートから取り込む',
  'gridImport.paste_whole': 'まるごと貼り付け（Ctrl+A → Ctrl+C → 貼り付け）',
  'gridImport.paste_by_column': '列ごとに貼り付け',
  'gridImport.help': '',
  'gridImport.create': 'この内容で作成',
  'gridImport.status_ok': 'OK',
  'gridImport.status_partial': '一部読めない',
  'gridImport.status_empty': '空 / 任意',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => JA[k] ?? k,
    i18n: { language: 'ja' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../hooks/useSkillsData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSkillsData')>();
  return {
    ...actual,
    getJobsFromStore: () => [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' }],
    getMitigationsFromStore: () => [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 0, type: 'all', value: 0 }],
  };
});

describe('SpreadsheetGridImportModal', () => {
  it('開いているとタイトルと2つの貼り付けボタンを表示', () => {
    render(
      <SpreadsheetGridImportModal
        isOpen
        onClose={vi.fn()}
        onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never}
      />,
    );
    expect(screen.getByText('スプレッドシートから取り込む')).toBeInTheDocument();
    expect(screen.getByText(/まるごと貼り付け/)).toBeInTheDocument();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
  });
  it('閉じていると何も描画しない', () => {
    const { container } = render(
      <SpreadsheetGridImportModal isOpen={false} onClose={vi.fn()} onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
