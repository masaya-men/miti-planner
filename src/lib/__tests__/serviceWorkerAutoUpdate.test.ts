// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installServiceWorkerAutoUpdate } from '../serviceWorkerAutoUpdate';

/**
 * controllerchange→reload の中核ロジックと「軽減表では絶対にリロードしない」安全ゲートの検証。
 * 実タイマーを残さないよう fake timers を使い、ready 経路の setInterval を無害化する。
 */
describe('installServiceWorkerAutoUpdate', () => {
  let listeners: Record<string, Array<() => void>>;
  let reloadSpy: ReturnType<typeof vi.spyOn>;
  let currentPath: string;

  function setupSW(hasController: boolean) {
    listeners = {};
    const sw = {
      controller: hasController ? {} : null,
      addEventListener: (type: string, cb: () => void) => {
        (listeners[type] ||= []).push(cb);
      },
      ready: Promise.resolve({ update: vi.fn().mockResolvedValue(undefined) }),
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
  }

  function fireControllerChange() {
    (listeners['controllerchange'] || []).forEach((cb) => cb());
  }

  beforeEach(() => {
    vi.useFakeTimers();
    currentPath = '/housing';
    Object.defineProperty(window.location, 'pathname', { configurable: true, get: () => currentPath });
    reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    reloadSpy.mockRestore();
    // @ts-expect-error テスト用に注入した serviceWorker を除去
    delete navigator.serviceWorker;
  });

  it('ハウジング配下 + 既存controllerが差し替わったら 1 回だけ reload する', () => {
    currentPath = '/housing';
    setupSW(true);
    installServiceWorkerAutoUpdate();
    fireControllerChange();
    fireControllerChange();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('★軽減表 (/) では controllerchange が来ても絶対に reload しない', () => {
    currentPath = '/';
    setupSW(true);
    installServiceWorkerAutoUpdate();
    fireControllerChange();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('★軽減表 (/miti) でも reload しない', () => {
    currentPath = '/miti';
    setupSW(true);
    installServiceWorkerAutoUpdate();
    fireControllerChange();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('初回登録 (controller 無し) ではハウジング配下でも reload しない', () => {
    currentPath = '/housing';
    setupSW(false);
    installServiceWorkerAutoUpdate();
    fireControllerChange();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ハウジング詳細 (/housing/listing/xxx) でも許可される', () => {
    currentPath = '/housing/listing/abc123';
    setupSW(true);
    installServiceWorkerAutoUpdate();
    fireControllerChange();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('serviceWorker 非対応環境では例外を投げず何もしない', () => {
    // @ts-expect-error 非対応環境の再現
    delete navigator.serviceWorker;
    expect(() => installServiceWorkerAutoUpdate()).not.toThrow();
  });
});
