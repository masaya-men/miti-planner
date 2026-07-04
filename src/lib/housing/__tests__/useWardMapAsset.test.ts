// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWardMapAsset } from '../useWardMapAsset';

describe('useWardMapAsset', () => {
  it('mapKey=null は idle', () => { const { result } = renderHook(() => useWardMapAsset(null)); expect(result.current.status).toBe('idle'); });
  it('既知 mapKey は最終的に ready で json/svg を持つ', async () => {
    const { result } = renderHook(() => useWardMapAsset('mist'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') { expect(result.current.json.viewBox.w).toBeGreaterThan(0); expect(typeof result.current.svg).toBe('string'); }
  });
  it('mapKey が別ワードに変わったら旧地図の ready を描画せず即 loading に落ちる', async () => {
    const { result, rerender } = renderHook(
      ({ mapKey }: { mapKey: string }) => useWardMapAsset(mapKey),
      { initialProps: { mapKey: 'mist' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ mapKey: 'goblet' });
    // rerender 直後 (次の effect/microtask が走る前) は旧 mist の ready ではなく loading であること
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status === 'ready') { expect(result.current.json.area).toBe('Goblet'); }
  });
});
