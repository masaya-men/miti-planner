// @vitest-environment happy-dom
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
});
