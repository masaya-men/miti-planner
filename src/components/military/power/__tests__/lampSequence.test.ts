// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sequenceLamps, useLampSequence } from '../lampSequence';
import { powerOn, powerOff, initPower, disposePower } from '../power';
import { renderHook } from '@testing-library/react';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<div class="milspec-app">
    <span class="milspec-led is-on" id="a"></span>
    <span data-lamp="net"><span class="milspec-led is-on" id="net"></span></span>
    <span class="milspec-led is-on" id="b"></span>
    <span class="milspec-led is-warn" id="w"></span></div>`;
});
afterEach(() => vi.useRealTimers());

describe('sequenceLamps', () => {
  const el = (id: string) => document.getElementById(id)!;
  it('NET 以外の点灯中を一旦消し、650 + i*45ms で is-on + is-flick', () => {
    sequenceLamps();
    expect(el('a').classList.contains('is-on')).toBe(false);
    expect(el('net').classList.contains('is-on')).toBe(true);
    vi.advanceTimersByTime(649);
    expect(el('a').classList.contains('is-on')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el('a').classList.contains('is-on') && el('a').classList.contains('is-flick')).toBe(true);
    expect(el('b').classList.contains('is-on')).toBe(false);
    vi.advanceTimersByTime(45);
    expect(el('b').classList.contains('is-on')).toBe(true);
    expect(el('w').classList.contains('is-warn')).toBe(true);
  });
  it('戻り値で途中停止できる', () => {
    sequenceLamps()();
    vi.advanceTimersByTime(1000);
    expect(el('a').classList.contains('is-on')).toBe(false);
  });
});

describe('useLampSequence(電源断で順点灯を止める)', () => {
  it('off が来たら進行中の順点灯は is-on を付けない', () => {
    initPower();
    const { unmount } = renderHook(() => useLampSequence());
    powerOn({ reduced: false });
    vi.advanceTimersByTime(100);
    void powerOff({ reduced: false });
    vi.advanceTimersByTime(2000);
    expect(document.getElementById('a')!.classList.contains('is-on')).toBe(false);
    unmount();
    disposePower();
  });
});
