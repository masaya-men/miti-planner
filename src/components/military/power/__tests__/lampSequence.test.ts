// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sequenceLamps } from '../lampSequence';

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
  it('NET 以外の点灯中を一旦消し、180 + i*45ms で is-on + is-flick', () => {
    sequenceLamps();
    expect(el('a').classList.contains('is-on')).toBe(false);
    expect(el('net').classList.contains('is-on')).toBe(true);
    vi.advanceTimersByTime(179);
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
