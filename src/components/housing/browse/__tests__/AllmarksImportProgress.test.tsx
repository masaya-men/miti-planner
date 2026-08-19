// @vitest-environment happy-dom
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { AllmarksImportProgress as ProgressState } from '../../../../lib/housing/useAllmarksImport';

// importing 表示は AllmarksMapRoadDraw (実タイマーで無限ループするデコレーション、実際の
// ワードマップを動的importする) をマウントするため、vmThreads が実タイマー/実importを
// 残すテストを終了できない事故を避けるため、軽量な固定マップにモックし fake timers で
// 駆動する ([[reference_vitest_vmthreads_hang]])。
vi.mock('../../../../data/housing/wardMapManifest', () => ({
  WARD_MAP_LOADERS: {
    testmap: async () => ({
      json: {
        area: 'Test',
        viewBox: { w: 1000, h: 800 },
        nodes: [{ id: 'n', x: 0.5, y: 0.5 }],
        edges: [],
        houses: [],
        roadPath: 'M400 400L440 440',
        visibleRoadPath: null,
      },
      svg: '',
    }),
  },
}));

import { AllmarksImportProgress } from '../AllmarksImportProgress';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function renderWith(progress: ProgressState, onClose = vi.fn(), onChooseRegion = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AllmarksImportProgress progress={progress} onClose={onClose} onChooseRegion={onChooseRegion} />
    </I18nextProvider>,
  );
}

describe('AllmarksImportProgress', () => {
  it('fetching-list: 取得中の文言 + やめるボタン', () => {
    const onClose = vi.fn();
    renderWith(
      { status: 'fetching-list', total: 0, processed: 0, added: 0, failed: 0, limitReached: false, shareNotFound: false, regionChoices: [], regionExcluded: 0 },
      onClose,
    );
    expect(screen.getByText('Allmarksから受け取っています…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('importing: 進捗件数と追加できた件数を表示する', async () => {
    renderWith({ status: 'importing', total: 50, processed: 23, added: 20, failed: 3, limitReached: false, shareNotFound: false, regionChoices: [], regionExcluded: 0 });
    expect(screen.getByText('23/50件を確認中…')).toBeInTheDocument();
    expect(screen.getByText('20件追加できました')).toBeInTheDocument();
    // AllmarksMapRoadDraw 内部のマップ読み込み(モック済み非同期)を act() 内で解決しておく
    // (未解決のままだと後続テストへ act() 外の state 更新が漏れ、vmThreads ハングの誘因になる)。
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('done + shareNotFound: 見つからなかった旨を表示する', () => {
    renderWith({ status: 'done', total: 0, processed: 0, added: 0, failed: 0, limitReached: false, shareNotFound: true, regionChoices: [], regionExcluded: 0 });
    expect(screen.getByText('共有リンクが見つかりませんでした。期限切れか、URLが正しくない可能性があります。')).toBeInTheDocument();
  });

  it('done: 成功サマリーを表示し、失敗0件なら失敗文言は出さない', () => {
    renderWith({ status: 'done', total: 10, processed: 10, added: 10, failed: 0, limitReached: false, shareNotFound: false, regionChoices: [], regionExcluded: 0 });
    expect(screen.getByText('10件中10件を追加できました')).toBeInTheDocument();
    expect(screen.queryByText(/件は住所を読み取れませんでした/)).not.toBeInTheDocument();
  });

  it('done: 失敗ありなら内訳を表示する', () => {
    renderWith({ status: 'done', total: 10, processed: 10, added: 7, failed: 3, limitReached: false, shareNotFound: false, regionChoices: [], regionExcluded: 0 });
    expect(screen.getByText('10件中7件を追加できました')).toBeInTheDocument();
    expect(screen.getByText('3件は住所を読み取れませんでした')).toBeInTheDocument();
  });

  it('done: 上限到達なら注記を表示する', () => {
    renderWith({ status: 'done', total: 100, processed: 80, added: 80, failed: 0, limitReached: true, shareNotFound: false, regionChoices: [], regionExcluded: 0 });
    expect(screen.getByText('一時ツアーの上限に達したため、途中で打ち切りました')).toBeInTheDocument();
  });

  it('done: リージョン除外ありなら内訳を表示する', () => {
    renderWith({ status: 'done', total: 10, processed: 10, added: 7, failed: 0, limitReached: false, shareNotFound: false, regionChoices: [], regionExcluded: 3 });
    expect(screen.getByText('3件は選ばなかったリージョンのため除外しました')).toBeInTheDocument();
  });

  it('choosing-region: 選択肢ボタンを表示し、押すとonChooseRegionが呼ばれる (日本語ロケールでは日本がデフォルト強調)', () => {
    const onChooseRegion = vi.fn();
    renderWith(
      {
        status: 'choosing-region',
        total: 10,
        processed: 10,
        added: 7,
        failed: 0,
        limitReached: false,
        shareNotFound: false,
        regionChoices: [
          { region: 'NA', count: 2 },
          { region: 'JP', count: 5 },
        ],
        regionExcluded: 0,
      },
      vi.fn(),
      onChooseRegion,
    );
    expect(screen.getByText('複数リージョンの家が含まれていました。どちらをツアーにしますか？')).toBeInTheDocument();
    const jpButton = screen.getByRole('button', { name: '日本（5件）' });
    const naButton = screen.getByRole('button', { name: '北米（2件）' });
    expect(jpButton.className).toContain('housing-btn-primary'); // ja ロケール既定 = JP
    expect(naButton.className).not.toContain('housing-btn-primary');
    fireEvent.click(naButton);
    expect(onChooseRegion).toHaveBeenCalledWith('NA');
  });
});
