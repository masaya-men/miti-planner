// @vitest-environment happy-dom
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

import { EphemeralAddPanel } from '../../components/housing/browse/EphemeralAddPanel';
import { useEphemeralListingsStore } from '../../store/useEphemeralListingsStore';
import {
  createEphemeralListing,
  EPHEMERAL_POOL_LIMIT,
} from '../../lib/housing/ephemeralListing';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

/**
 * テキスト欄に入力し、debounce (300ms) を進めて parse を発火させるヘルパ。
 * 実タイマーを残さない (vmThreads ハング対策): vi.useFakeTimers 前提。
 */
const typeText = (value: string) => {
  fireEvent.change(screen.getByLabelText('住所を入力'), { target: { value } });
  act(() => {
    vi.advanceTimersByTime(300);
  });
};

describe('EphemeralAddPanel', () => {
  beforeEach(() => {
    useEphemeralListingsStore.getState().clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('① テキスト「ミスト 3区 15番地」→ チップ3つ + 追加ボタン活性', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    typeText('ミスト 3区 15番地');

    const chips = screen.getAllByTestId('ephemeral-chip');
    expect(chips).toHaveLength(3);
    const joined = chips.map((c) => c.textContent).join('|');
    expect(joined).toContain('ミスト・ヴィレッジ');
    expect(joined).toContain('3');
    expect(joined).toContain('15');

    // 全項目充足 → 追加活性 (欠け項目セレクトは出ない)
    expect(
      (screen.getByRole('button', { name: 'ツアーに追加' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.queryByLabelText('エリア')).toBeNull();
  });

  it('② 「3区 15番地」(住宅街欠け) → 住宅街セレクトが出て追加は不活性', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    typeText('3区 15番地');

    // 欠けている住宅街だけセレクトが出る
    expect(screen.getByLabelText('エリア')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'ツアーに追加' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('③ ambiguity のあるテキスト → parse_error を表示 (推測で埋めない)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    // Mana(DC) と Bismarck(別DCサーバー) の矛盾 → dcServerMismatch
    typeText('Mana Bismarck シロガネ 6-6 S');

    expect(
      screen.getByText('住所を読み取れませんでした。下の欄で選択してください'),
    ).toBeTruthy();
    // 推測で埋めない = チップは出さない
    expect(screen.queryAllByTestId('ephemeral-chip')).toHaveLength(0);
  });

  it('④ 追加で onAdd が ephemeral- id で呼ばれ、store にも入る。入力はクリアされパネルは開いたまま', () => {
    const onAdd = vi.fn();
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={onAdd} />);
    typeText('ミスト 3区 15番地');

    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const id = onAdd.mock.calls[0][0] as string;
    expect(id).toMatch(/^ephemeral-/);
    const stored = useEphemeralListingsStore.getState().ephemeralListings;
    expect(stored.some((l) => l.id === id)).toBe(true);
    expect(stored[0]?.area).toBe('Mist');
    expect(stored[0]?.ward).toBe(3);
    expect(stored[0]?.plot).toBe(15);

    // 連続追加: 入力だけクリアしてパネルは開いたまま
    expect((screen.getByLabelText('住所を入力') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('追加しました')).toBeTruthy();
    expect(screen.getByLabelText('住所を入力')).toBeTruthy();
  });

  it('⑤ 上限 (50件) で limit_note を表示し onAdd は呼ばれない', () => {
    // 事前に上限まで積む
    for (let i = 0; i < EPHEMERAL_POOL_LIMIT; i++) {
      useEphemeralListingsStore.getState().add(
        createEphemeralListing({
          area: 'Mist', ward: 1, buildingType: 'house', plot: (i % 60) + 1,
        }),
      );
    }
    const onAdd = vi.fn();
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={onAdd} />);
    typeText('ミスト 3区 15番地');
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));

    expect(onAdd).not.toHaveBeenCalled();
    // メッセージは max を補間する (定数を上げてもテストがズレない)。
    expect(screen.getByText(`一時の家は最大 ${EPHEMERAL_POOL_LIMIT} 件までです`)).toBeTruthy();
  });

  it('⑥ モーダル (role=dialog) として portal 描画される (トレイ直置きの overflow バグ回避)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    // HousingPanelModal が body 直下へ portal し role=dialog を張る。
    expect(screen.getByRole('dialog')).toBeTruthy();
    // フォーム中身 (住所入力) もモーダル内に在る。
    expect(screen.getByLabelText('住所を入力')).toBeTruthy();
  });

  it('⑦ open=false ではモーダルを描画しない', () => {
    wrap(<EphemeralAddPanel open={false} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('住所を入力')).toBeNull();
  });
});
