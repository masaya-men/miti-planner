// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { useScrollFade } from '../useScrollFade';

it('初期状態: atStart/atEnd は true、 ref と onScroll を返す', () => {
  const { result } = renderHook(() => useScrollFade<HTMLDivElement>());
  expect(result.current.atStart).toBe(true);
  expect(result.current.atEnd).toBe(true);
  expect(result.current.ref).toBeDefined();
  expect(typeof result.current.onScroll).toBe('function');
});
