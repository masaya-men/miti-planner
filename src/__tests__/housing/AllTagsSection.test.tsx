// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { AllTagsSection } from '../../components/housing/browse/tagpicker/AllTagsSection';

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

describe('AllTagsSection', () => {
  it('kindごとの区切りラベル (公式/季節/テーマ/初心者) を表示する', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText('公式')).toBeInTheDocument();
    expect(screen.getByText('季節')).toBeInTheDocument();
    expect(screen.getByText('テーマ')).toBeInTheDocument();
    expect(screen.getByText('初心者')).toBeInTheDocument();
  });

  it('48件のタグチップを表示する', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    const chips = document.querySelectorAll('.housing-tagpicker-chip');
    expect(chips.length).toBe(48);
  });

  it('selected に含まれるチップは data-selected=true', () => {
    wrap(<AllTagsSection selected={['theme_wafu']} onToggle={vi.fn()} />);
    const wafuChip = screen.getByText('和風').closest('button');
    expect(wafuChip).toHaveAttribute('data-selected', 'true');
  });

  it('チップクリックで onToggle が呼ばれる', () => {
    const onToggle = vi.fn();
    wrap(<AllTagsSection selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('和風'));
    expect(onToggle).toHaveBeenCalledWith('theme_wafu');
  });

  it('セクション見出しクリックで折りたたむ', () => {
    wrap(<AllTagsSection selected={[]} onToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'すべてのタグ' }));
    expect(screen.queryByText('和風')).toBeNull();
  });
});
