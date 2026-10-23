// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { backdropClose } from '../backdropClose';

function setup(onClose?: () => void) {
  const r = render(
    <div data-testid="bd" {...backdropClose(onClose)}>
      <div data-testid="inner">中身</div>
    </div>,
  );
  return { bd: r.getByTestId('bd'), inner: r.getByTestId('inner') };
}

describe('backdropClose(外側クリックで閉じる共通ハンドラ)', () => {
  it('押し始めも離しも背景なら閉じる', () => {
    const fn = vi.fn();
    const { bd } = setup(fn);
    fireEvent.pointerDown(bd);
    fireEvent.click(bd);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('中で押して外で離しても閉じない(クリックは背景に飛ぶが押し始めが中)', () => {
    const fn = vi.fn();
    const { bd, inner } = setup(fn);
    fireEvent.pointerDown(inner);
    fireEvent.click(bd);
    expect(fn).not.toHaveBeenCalled();
  });
  it('中のクリックでは閉じない', () => {
    const fn = vi.fn();
    const { inner } = setup(fn);
    fireEvent.pointerDown(inner);
    fireEvent.click(inner);
    expect(fn).not.toHaveBeenCalled();
  });
  it('onClose 未指定(入力途中の窓)では何も起きない', () => {
    const { bd } = setup(undefined);
    fireEvent.pointerDown(bd);
    expect(() => fireEvent.click(bd)).not.toThrow();
  });
});
