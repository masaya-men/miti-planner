// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useListScrollRestore } from '../useListScrollRestore';
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
import type { HousingListKey } from '../../../store/useHousingListOrderStore';

function ScrollBox({ listKey }: { listKey: HousingListKey }) {
  const ref = useListScrollRestore(listKey);
  return (
    <div ref={ref} data-testid="scroll-box" style={{ height: '50px', overflow: 'auto' }}>
      <div style={{ height: '500px' }} />
    </div>
  );
}

describe('useListScrollRestore', () => {
  beforeEach(() => useHousingListOrderStore.getState().reset());
  afterEach(() => cleanup());

  it('マウント時、保存済み scrollTop が無ければ 0 のまま', () => {
    render(<ScrollBox listKey="browse" />);
    expect(screen.getByTestId('scroll-box').scrollTop).toBe(0);
  });

  it('アンマウント時に scrollTop をストアへ保存する', () => {
    const { unmount } = render(<ScrollBox listKey="browse" />);
    const el = screen.getByTestId('scroll-box');
    el.scrollTop = 120;
    unmount();
    expect(useHousingListOrderStore.getState().entries.browse.scrollTop).toBe(120);
  });

  it('再マウント時、保存済み scrollTop を復元する', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 240);
    render(<ScrollBox listKey="browse" />);
    expect(screen.getByTestId('scroll-box').scrollTop).toBe(240);
  });

  it('key ごとに独立して保存・復元する', () => {
    const browseRender = render(<ScrollBox listKey="browse" />);
    browseRender.getByTestId('scroll-box').scrollTop = 100;
    browseRender.unmount();

    const favRender = render(<ScrollBox listKey="favorites" />);
    expect(favRender.getByTestId('scroll-box').scrollTop).toBe(0);
    favRender.unmount();

    expect(useHousingListOrderStore.getState().entries.browse.scrollTop).toBe(100);
    expect(useHousingListOrderStore.getState().entries.favorites.scrollTop).toBe(0);
  });
});
