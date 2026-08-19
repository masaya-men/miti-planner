// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { AllmarksImportProgress } from '../AllmarksImportProgress';
import type { AllmarksImportProgress as ProgressState } from '../../../../lib/housing/useAllmarksImport';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderWith(progress: ProgressState, onClose = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AllmarksImportProgress progress={progress} onClose={onClose} />
    </I18nextProvider>,
  );
}

describe('AllmarksImportProgress', () => {
  it('fetching-list: 取得中の文言 + やめるボタン', () => {
    const onClose = vi.fn();
    renderWith({ status: 'fetching-list', total: 0, processed: 0, added: 0, failed: 0, limitReached: false, shareNotFound: false }, onClose);
    expect(screen.getByText('Allmarksから受け取っています…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('importing: 進捗件数と追加できた件数を表示する', () => {
    renderWith({ status: 'importing', total: 50, processed: 23, added: 20, failed: 3, limitReached: false, shareNotFound: false });
    expect(screen.getByText('23/50件を確認中…')).toBeInTheDocument();
    expect(screen.getByText('20件追加できました')).toBeInTheDocument();
  });

  it('done + shareNotFound: 見つからなかった旨を表示する', () => {
    renderWith({ status: 'done', total: 0, processed: 0, added: 0, failed: 0, limitReached: false, shareNotFound: true });
    expect(screen.getByText('共有リンクが見つかりませんでした。期限切れか、URLが正しくない可能性があります。')).toBeInTheDocument();
  });

  it('done: 成功サマリーを表示し、失敗0件なら失敗文言は出さない', () => {
    renderWith({ status: 'done', total: 10, processed: 10, added: 10, failed: 0, limitReached: false, shareNotFound: false });
    expect(screen.getByText('10件中10件を追加できました')).toBeInTheDocument();
    expect(screen.queryByText(/件は住所を読み取れませんでした/)).not.toBeInTheDocument();
  });

  it('done: 失敗ありなら内訳を表示する', () => {
    renderWith({ status: 'done', total: 10, processed: 10, added: 7, failed: 3, limitReached: false, shareNotFound: false });
    expect(screen.getByText('10件中7件を追加できました')).toBeInTheDocument();
    expect(screen.getByText('3件は住所を読み取れませんでした')).toBeInTheDocument();
  });

  it('done: 上限到達なら注記を表示する', () => {
    renderWith({ status: 'done', total: 100, processed: 80, added: 80, failed: 0, limitReached: true, shareNotFound: false });
    expect(screen.getByText('一時ツアーの上限に達したため、途中で打ち切りました')).toBeInTheDocument();
  });
});
