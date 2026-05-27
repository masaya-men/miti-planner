// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { HousingDuplicatePeersSection } from '../HousingDuplicatePeersSection';
import type { HousingListing } from '../../../../types/housing';

beforeEach(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      interpolation: { escapeValue: false },
      resources: {
        ja: {
          translation: {
            housing: {
              detail: {
                duplicates: {
                  title: 'この住所の他の登録 ({{count}})',
                  action_wrong: 'ちがった',
                  long_press_hint: '2 秒長押しで非表示',
                },
              },
            },
          },
        },
      },
    });
  }
});

const mkListing = (id: string, addressKey: string): HousingListing =>
  ({
    id,
    addressKey,
    dc: 'Mana',
    server: 'Pandaemonium',
    area: 'Mist',
    ward: 1,
    plot: 1,
    apartmentNumber: null,
    privateChamber: null,
    sourceImageUrls: [],
    photos: [],
    tags: [],
    description: `desc-${id}`,
    createdAt: 1000,
    updatedAt: 1000,
    lastConfirmedAt: 1000,
    isHidden: false,
    reportCount: 0,
    deletedAt: null,
    ownerUid: 'owner',
  }) as unknown as HousingListing;

describe('HousingDuplicatePeersSection', () => {
  it('peers=[] のとき何も描画しない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={[]} onReportPeer={vi.fn()} />
      </I18nextProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('peers=2 件のとき見出しと 2 つの mini カードを描画', () => {
    const peers = [mkListing('a', 'k'), mkListing('b', 'k')];
    render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={peers} onReportPeer={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.getByText('この住所の他の登録 (2)')).toBeInTheDocument();
    expect(screen.getByText('desc-a')).toBeInTheDocument();
    expect(screen.getByText('desc-b')).toBeInTheDocument();
  });

  it('長押し 2 秒で onReportPeer がその peer.id で呼ばれる', () => {
    vi.useFakeTimers();
    const onReportPeer = vi.fn();
    const peers = [mkListing('a', 'k')];
    render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={peers} onReportPeer={onReportPeer} />
      </I18nextProvider>,
    );
    const btn = screen.getByRole('button', { name: /ちがった/ });
    fireEvent.pointerDown(btn);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onReportPeer).toHaveBeenCalledWith('a');
    vi.useRealTimers();
  });
});
