// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TranslationTable } from '../TranslationTable';
import type { TranslationRow } from '../../../lib/translationDataLoaders';

const baseRow: TranslationRow = {
  id: 'pld_reprisal',
  ja: 'リプライザル',
  en: 'Reprisal',
  zh: '减伤',
  zhHant: '減傷',
  ko: '리프라이잘',
};

describe('TranslationTable', () => {
  it('繁體中文(zh-Hant)列のヘッダーを表示する', () => {
    render(<TranslationTable rows={[baseRow]} originalRows={[baseRow]} onChange={() => {}} />);
    expect(screen.getByText('繁體中文')).toBeInTheDocument();
  });

  it('zh-Hant セルをクリックすると編集でき、変更が onChange に伝わる', () => {
    const onChange = vi.fn();
    render(<TranslationTable rows={[baseRow]} originalRows={[baseRow]} onChange={onChange} />);

    // zh-Hant セルの表示テキストをクリックして編集モードに入る
    fireEvent.click(screen.getByText('減傷'));

    const input = screen.getByDisplayValue('減傷') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '減傷(修正)' } });

    expect(onChange).toHaveBeenCalledWith(0, 'zhHant', '減傷(修正)');
  });
});
