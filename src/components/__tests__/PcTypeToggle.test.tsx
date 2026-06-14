// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const updateEvent = vi.fn();
vi.mock('../../store/useMitigationStore', () => ({
  useMitigationStore: (sel: any) => sel({ updateEvent }),
}));

import { PcTypeToggle } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const baseEvent = {
  id: 'e1',
  name: { ja: 'x', en: 'x' },
  time: 0,
  damageType: 'physical',
  ignoresDebuffMitigation: false,
} as TimelineEvent;

describe('PcTypeToggle', () => {
  beforeEach(() => updateEvent.mockClear());

  it('右クリックで ignoresDebuffMitigation を false→true にトグルする', () => {
    const { container } = render(<PcTypeToggle event={baseEvent} />);
    fireEvent.contextMenu(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { ignoresDebuffMitigation: true });
  });

  it('右クリックで ON→OFF にトグルする', () => {
    const { container } = render(
      <PcTypeToggle event={{ ...baseEvent, ignoresDebuffMitigation: true }} />
    );
    fireEvent.contextMenu(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { ignoresDebuffMitigation: false });
  });

  it('左クリックは従来どおり種別を循環する(physical→magical)', () => {
    const { container } = render(<PcTypeToggle event={baseEvent} />);
    fireEvent.click(container.querySelector('button')!);
    expect(updateEvent).toHaveBeenCalledWith('e1', { damageType: 'magical' });
  });
});
