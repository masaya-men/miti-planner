// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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

/** 構造化フォーム (RegisterSectionAddress variant='tour') に一軒家の住所を入れるヘルパ。 */
const fillHouse = (area: string, ward: string, plot: string) => {
  fireEvent.change(screen.getByLabelText('エリア'), { target: { value: area } });
  fireEvent.change(screen.getByLabelText('区'), { target: { value: ward } });
  fireEvent.change(screen.getByLabelText('番地'), { target: { value: plot } });
};

const addButton = () => screen.getByRole('button', { name: 'ツアーに追加' }) as HTMLButtonElement;

describe('EphemeralAddPanel', () => {
  beforeEach(() => {
    useEphemeralListingsStore.getState().clear();
  });

  it('① エリア/区/番地を選ぶと「ツアーに追加」が活性 (未入力では不活性)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    expect(addButton().disabled).toBe(true);
    fillHouse('Mist', '3', '15');
    expect(addButton().disabled).toBe(false);
  });

  it('② エリア未選択だと不活性のまま (推測で埋めない)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    fireEvent.change(screen.getByLabelText('区'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('番地'), { target: { value: '15' } });
    expect(addButton().disabled).toBe(true);
  });

  it('③ フル版: データセンター/サーバーのセレクトがある (DC 跨ぎツアー用)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    expect(screen.getByLabelText('データセンター')).toBeTruthy();
    expect(screen.getByLabelText('サーバー')).toBeTruthy();
  });

  it('④ 追加で onAdd が ephemeral- id で呼ばれ store に入る。入力はクリアされモーダルは開いたまま', () => {
    const onAdd = vi.fn();
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={onAdd} />);
    fillHouse('Mist', '3', '15');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    const id = onAdd.mock.calls[0][0] as string;
    expect(id).toMatch(/^ephemeral-/);
    const stored = useEphemeralListingsStore.getState().ephemeralListings;
    expect(stored.some((l) => l.id === id)).toBe(true);
    expect(stored[0]?.area).toBe('Mist');
    expect(stored[0]?.ward).toBe(3);
    expect(stored[0]?.plot).toBe(15);

    // 連続追加: 入力だけクリアしてモーダルは開いたまま
    expect((screen.getByLabelText('区') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('追加しました')).toBeTruthy();
    expect(screen.getByLabelText('番地')).toBeTruthy();
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
    fillHouse('Mist', '3', '15');
    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    // メッセージは max を補間する (定数を上げてもテストがズレない)。
    expect(screen.getByText(`一時の家は最大 ${EPHEMERAL_POOL_LIMIT} 件までです`)).toBeTruthy();
  });

  it('⑥ モーダル (role=dialog) として portal 描画される (トレイ直置きの overflow バグ回避)', () => {
    wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    // 構造化フォーム (エリアセレクト) もモーダル内に在る。
    expect(screen.getByLabelText('エリア')).toBeTruthy();
  });

  it('⑦ open=false ではモーダルを描画しない', () => {
    wrap(<EphemeralAddPanel open={false} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('エリア')).toBeNull();
  });
});
