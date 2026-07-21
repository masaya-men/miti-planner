// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';

// 復元 (initialUrl) 回帰テスト用: HousingRegisterSnsUrlField が実際に握る useTweetFetch をモックし、
// マウント時の initialUrl → handleChange → fetchTweet 発火を、実ネットワークなしで検証できるようにする
// (RegisterSectionMedia.test.tsx / HousingRegisterSnsUrlField.test.tsx と同じ手法)。
const mockFetchTweet = vi.fn();
vi.mock('../../../../lib/housing/useTweetFetch', () => ({
  useTweetFetch: () => ({
    status: 'idle',
    data: null,
    errorCode: null,
    fetchTweet: mockFetchTweet,
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { HousingRegisterMultiUrlField } from '../HousingRegisterMultiUrlField';

function renderField(props: Partial<React.ComponentProps<typeof HousingRegisterMultiUrlField>> = {}) {
  const onAddSlot = vi.fn();
  const onRemoveSlot = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <HousingRegisterMultiUrlField
        slotCount={1}
        onAddSlot={onAddSlot}
        onRemoveSlot={onRemoveSlot}
        onTweetFetched={vi.fn()}
        onYoutubeFetched={vi.fn()}
        onOgpFetched={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onAddSlot, onRemoveSlot };
}

describe('HousingRegisterMultiUrlField', () => {
  beforeEach(() => {
    mockFetchTweet.mockClear();
  });

  it('slotCount=1 のとき URL入力欄が1個だけ表示される', () => {
    renderField({ slotCount: 1 });
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('slotCount=3 のとき URL入力欄が3個表示される', () => {
    renderField({ slotCount: 3 });
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('「URLを追加」ボタン押下で onAddSlot が呼ばれる', () => {
    const { onAddSlot } = renderField({ slotCount: 1 });
    fireEvent.click(screen.getByTestId('housing-multi-url-add'));
    expect(onAddSlot).toHaveBeenCalledTimes(1);
  });

  it('slotCount が maxSlots (既定5) のとき「URLを追加」ボタンが出ない', () => {
    renderField({ slotCount: 5 });
    expect(screen.queryByTestId('housing-multi-url-add')).toBeNull();
  });

  it('slotCount=1 のときは削除ボタンが出ない(最低1欄は残す)', () => {
    renderField({ slotCount: 1 });
    expect(screen.queryByTestId('housing-multi-url-remove-0')).toBeNull();
  });

  it('slotCount=2 のとき各欄に削除ボタンが出て押すと onRemoveSlot(index) が呼ばれる', () => {
    const { onRemoveSlot } = renderField({ slotCount: 2 });
    fireEvent.click(screen.getByTestId('housing-multi-url-remove-1'));
    expect(onRemoveSlot).toHaveBeenCalledWith(1);
  });

  it('中間の欄を削除しても他欄の入力内容が入れ替わらない (key={index}再利用バグの回帰テスト)', () => {
    // 実際の親 (RegisterPage 等) と同じ契約 (slotCount を state で持ち、onRemoveSlot で -1 する) を
    // 再現する簡易ラッパー。onAddSlot/onRemoveSlot の index 引数は本番同様「個数を1減らす」だけの
    // 実装で、slotCount の増減判断そのものは HousingRegisterMultiUrlField の外側にある。
    function Harness() {
      const [slotCount, setSlotCount] = useState(3);
      return (
        <I18nextProvider i18n={i18n}>
          <HousingRegisterMultiUrlField
            slotCount={slotCount}
            onAddSlot={() => setSlotCount((c) => c + 1)}
            onRemoveSlot={() => setSlotCount((c) => c - 1)}
            onTweetFetched={vi.fn()}
            onYoutubeFetched={vi.fn()}
            onOgpFetched={vi.fn()}
          />
        </I18nextProvider>
      );
    }
    render(<Harness />);

    const inputsBefore = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputsBefore).toHaveLength(3);
    fireEvent.change(inputsBefore[0], { target: { value: 'SLOT-A' } });
    fireEvent.change(inputsBefore[1], { target: { value: 'SLOT-B' } });
    fireEvent.change(inputsBefore[2], { target: { value: 'SLOT-C' } });

    // 中間 (index=1, 'SLOT-B' を入力した欄) の「✕」を押す。
    fireEvent.click(screen.getByTestId('housing-multi-url-remove-1'));

    const inputsAfter = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputsAfter).toHaveLength(2);
    // 生き残るべきは元 slot0 ('SLOT-A') と元 slot2 ('SLOT-C')。
    // key={index} のバグ版は key=1 のインスタンスがそのまま使い回され 'SLOT-B' が残り、
    // 本来生き残るべき 'SLOT-C' (旧 key=2) が黙って消える。
    expect(inputsAfter[0].value).toBe('SLOT-A');
    expect(inputsAfter[1].value).toBe('SLOT-C');
  });

  // 回帰テスト (2026-07-22): Task5/Task7 で initialUrl/onUrlUserEdit の転送が抜け落ち、オートセーブ
  // 復元後の「SNS 画像を再取得します」通知が偽の約束になっていたバグの修正確認。
  // 計画書の意図 (2026-07-21 設計書:1605) どおり、1本目 (index 0) の欄にのみ転送される。
  describe('initialUrl/onUrlUserEdit の1本目限定転送 (オートセーブ復元回帰)', () => {
    it('initialUrl (復元済み X URL) を渡すと1本目の欄がマウント時に実再取得(fetchTweet)を発火する', () => {
      renderField({
        slotCount: 2,
        initialUrl: 'https://x.com/user/status/1842217368673759498',
      });
      // 2本目にも転送されていれば2回呼ばれてしまう。1本目だけの契約を検証する。
      expect(mockFetchTweet).toHaveBeenCalledTimes(1);
      expect(mockFetchTweet).toHaveBeenCalledWith('1842217368673759498');
    });

    it('initialUrl は1本目の URL 入力欄の見た目にも復元される', () => {
      renderField({
        slotCount: 1,
        initialUrl: 'https://x.com/user/status/1842217368673759498',
      });
      const input = screen.getAllByRole('textbox')[0] as HTMLInputElement;
      expect(input.value).toBe('https://x.com/user/status/1842217368673759498');
    });

    it('onUrlUserEdit は1本目の手入力時のみ発火し、2本目以降の手入力では発火しない', () => {
      const onUrlUserEdit = vi.fn();
      renderField({ slotCount: 2, onUrlUserEdit });
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      fireEvent.change(inputs[1], { target: { value: 'https://example.com/foo' } });
      expect(onUrlUserEdit).not.toHaveBeenCalled();
      fireEvent.change(inputs[0], { target: { value: 'https://example.com/foo' } });
      expect(onUrlUserEdit).toHaveBeenCalledTimes(1);
    });
  });
});
