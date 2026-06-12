// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollabJoinerHeader } from '../CollabJoinerHeader';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../LanguageSwitcher', () => ({ LanguageSwitcher: () => <div data-testid="lang" /> }));

describe('CollabJoinerHeader', () => {
  it('LoPo ブランドと言語切替・テーマ切替を表示する(plan store 非依存)', () => {
    render(<CollabJoinerHeader />);
    expect(screen.getByText('LoPo')).toBeInTheDocument();
    expect(screen.getByTestId('lang')).toBeInTheDocument();
    expect(screen.getByLabelText('toggle-theme')).toBeInTheDocument();
  });
});
