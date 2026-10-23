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

describe('入力途中の自動検知', () => {
  function modal(onClose: () => void, opts?: Parameters<typeof backdropClose>[1]) {
    return (
      <div data-testid="bd" {...backdropClose(onClose, opts)}>
        <div data-testid="frame"><input data-testid="in" /></div>
      </div>
    );
  }
  const outsideClick = (el: HTMLElement) => { fireEvent.pointerDown(el); fireEvent.click(el); };

  it('入力なしなら外側クリックで閉じる', () => {
    const fn = vi.fn();
    const r = render(modal(fn));
    outsideClick(r.getByTestId('bd'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('input を受けたら閉じず、枠に知らせのクラスが付く', () => {
    const fn = vi.fn();
    const r = render(modal(fn));
    fireEvent.input(r.getByTestId('in'), { target: { value: 'a' } });
    outsideClick(r.getByTestId('bd'));
    expect(fn).not.toHaveBeenCalled();
    expect(r.getByTestId('frame').classList.contains('backdrop-nudge')).toBe(true);
  });
  it('change でも変更ありになる', () => {
    const fn = vi.fn();
    const r = render(modal(fn));
    fireEvent.change(r.getByTestId('in'), { target: { value: 'b' } });
    outsideClick(r.getByTestId('bd'));
    expect(fn).not.toHaveBeenCalled();
  });
  it('開き直す(背景が作り直される)と変更なしに戻る', () => {
    const fn = vi.fn();
    const r = render(modal(fn));
    fireEvent.input(r.getByTestId('in'), { target: { value: 'a' } });
    r.unmount();
    const r2 = render(modal(fn));
    outsideClick(r2.getByTestId('bd'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('背景が中身の兄弟でも、同じ親の中の入力を検知する', () => {
    const fn = vi.fn();
    const r = render(
      <div>
        <div data-testid="bd" {...backdropClose(fn)} />
        <div data-testid="frame"><textarea data-testid="in" /></div>
      </div>,
    );
    fireEvent.input(r.getByTestId('in'), { target: { value: 'a' } });
    outsideClick(r.getByTestId('bd'));
    expect(fn).not.toHaveBeenCalled();
    expect(r.getByTestId('frame').classList.contains('backdrop-nudge')).toBe(true);
  });
  it('autoGuard:false なら入力があっても閉じる / dirty:true なら入力なしでも閉じない', () => {
    const fn = vi.fn();
    const r = render(modal(fn, { autoGuard: false }));
    fireEvent.input(r.getByTestId('in'), { target: { value: 'a' } });
    outsideClick(r.getByTestId('bd'));
    expect(fn).toHaveBeenCalledTimes(1);
    r.unmount();
    const fn2 = vi.fn();
    const r2 = render(modal(fn2, { dirty: true }));
    outsideClick(r2.getByTestId('bd'));
    expect(fn2).not.toHaveBeenCalled();
  });
});
