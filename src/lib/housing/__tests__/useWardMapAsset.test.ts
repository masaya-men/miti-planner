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
});
