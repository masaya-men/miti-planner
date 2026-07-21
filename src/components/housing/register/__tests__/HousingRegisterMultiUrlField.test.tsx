// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
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
});
