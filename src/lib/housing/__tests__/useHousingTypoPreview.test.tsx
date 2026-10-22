// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHousingTypoPreview, TYPO_STORAGE_KEY } from '../useHousingTypoPreview';

const html = () => document.documentElement;
const setUrl = (q: string) => window.history.replaceState(null, '', '/housing' + q);

describe('useHousingTypoPreview', () => {
  beforeEach(() => {
    sessionStorage.clear();
    html().removeAttribute('data-housing-typo');
    setUrl('');
  });

  it('?typo=b で data 属性が付き、離れると外れる', () => {
    setUrl('?typo=b');
    const { unmount } = renderHook(() => useHousingTypoPreview());
    expect(html().getAttribute('data-housing-typo')).toBe('b');
    unmount();
    expect(html().hasAttribute('data-housing-typo')).toBe(false);
  });

  it('?typo=c は 保存され URL 無しでも維持される', () => {
    setUrl('?typo=c');
    renderHook(() => useHousingTypoPreview()).unmount();
    expect(sessionStorage.getItem(TYPO_STORAGE_KEY)).toBe('c');
    setUrl('');
    renderHook(() => useHousingTypoPreview());
    expect(html().getAttribute('data-housing-typo')).toBe('c');
  });

  it('?typo=a で解除 (属性 a・zoom 無し・保存削除)', () => {
    sessionStorage.setItem(TYPO_STORAGE_KEY, 'b');
    setUrl('?typo=a');
    renderHook(() => useHousingTypoPreview());
    expect(html().getAttribute('data-housing-typo')).toBe('a');
    expect(sessionStorage.getItem(TYPO_STORAGE_KEY)).toBeNull();
  });

  it('何も付けない時は何もしない', () => {
    const { result } = renderHook(() => useHousingTypoPreview());
    expect(result.current.mode).toBeNull();
    expect(html().hasAttribute('data-housing-typo')).toBe(false);
  });

  it('setMode で即切替し URL も書き換わる', () => {
    setUrl('?typo=b');
    const { result } = renderHook(() => useHousingTypoPreview());
    act(() => result.current.setMode('c'));
    expect(html().getAttribute('data-housing-typo')).toBe('c');
    expect(window.location.search).toBe('?typo=c');
  });
});
