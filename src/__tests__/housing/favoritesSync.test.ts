import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- firebase/firestore モック (mock プレフィックス必須: vi.mock ファクトリから参照するため) ---
const mockDoc = vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') }));
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');

vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  onSnapshot: (...a: unknown[]) => mockOnSnapshot(...a),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../../lib/firebase', () => ({ db: {} }));

// --- useAuthStore の軽量フェイク (実物は firebase/auth 等の重い依存を連鎖 import するため) ---
type FakeUser = { uid: string } | null;
type AuthListener = (state: { user: FakeUser }, prev: { user: FakeUser }) => void;

const mockAuthState: { current: { user: FakeUser } } = { current: { user: null } };
const mockAuthListeners = new Set<AuthListener>();

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockAuthState.current,
    subscribe: (listener: AuthListener) => {
      mockAuthListeners.add(listener);
      return () => {
        mockAuthListeners.delete(listener);
      };
    },
  },
}));

function setAuthUser(uid: string | null) {
  const prev = mockAuthState.current;
  mockAuthState.current = { user: uid ? { uid } : null };
  mockAuthListeners.forEach((l) => l(mockAuthState.current, prev));
}

import { startFavoritesSync, mergeFavoriteIds } from '../../lib/housing/favoritesSync';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';

/** マイクロタスクを数回フラッシュし、attach() 内の await getDoc(...) の続きを進める。 */
async function flushAsync(times = 4) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

function makeSnap(exists: boolean, ids?: string[]) {
  return {
    exists: () => exists,
    data: () => (exists ? { ids } : undefined),
    metadata: { hasPendingWrites: false },
  };
}

beforeEach(() => {
  localStorage.clear();
  useHousingFavoritesStore.getState().reset();
  mockAuthState.current = { user: null };
  mockAuthListeners.clear();
  mockDoc.mockClear();
  mockGetDoc.mockReset();
  mockSetDoc.mockReset().mockResolvedValue(undefined);
  mockOnSnapshot.mockReset();
  mockServerTimestamp.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startFavoritesSync', () => {
  it('未ログイン時は getDoc/onSnapshot を呼ばず、ローカル操作でも setDoc しない', async () => {
    const stop = startFavoritesSync();
    useHousingFavoritesStore.getState().add('local-only');
    await flushAsync();

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();

    stop();
  });

  it('初回マージ: サーバー ids を先頭 + ローカルのみの id を末尾に追加してストアと書き戻す', async () => {
    useHousingFavoritesStore.getState().add('shared');
    useHousingFavoritesStore.getState().add('local-only');
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['server-a', 'shared']));
    mockOnSnapshot.mockReturnValue(vi.fn());

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();

    expect(useHousingFavoritesStore.getState().ids).toEqual(['server-a', 'shared', 'local-only']);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual({
      ids: ['server-a', 'shared', 'local-only'],
      updatedAt: 'SERVER_TIMESTAMP',
    });

    stop();
  });

  it('サーバー doc が無い場合はローカル ids で新規作成する (空なら作らない)', async () => {
    // ケース1: ローカルが空 → 作らない
    mockGetDoc.mockResolvedValueOnce(makeSnap(false));
    mockOnSnapshot.mockReturnValue(vi.fn());
    const stop1 = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();
    expect(mockSetDoc).not.toHaveBeenCalled();
    stop1();
    setAuthUser(null);
    // ケース1 で uid1 が同期済みと記録されるので、独立シナリオとして扱うためリセット
    // (残すと ケース2 は共有端末ガードで union されなくなる)。
    localStorage.clear();

    // ケース2: ローカルにデータあり → 新規作成
    useHousingFavoritesStore.getState().add('a');
    mockGetDoc.mockResolvedValueOnce(makeSnap(false));
    mockOnSnapshot.mockReturnValue(vi.fn());
    const stop2 = startFavoritesSync();
    setAuthUser('uid2');
    await flushAsync();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual({ ids: ['a'], updatedAt: 'SERVER_TIMESTAMP' });
    stop2();
  });

  it('マージ済みでサーバーと差分が無ければ書き戻さない', async () => {
    useHousingFavoritesStore.getState().add('same');
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['same']));
    mockOnSnapshot.mockReturnValue(vi.fn());

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(useHousingFavoritesStore.getState().ids).toEqual(['same']);

    stop();
  });

  it('リモート変更を onSnapshot 経由でストアへ反映する (内容一致ならスキップ)', async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, []));
    let capturedCallback: ((snap: unknown) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();

    expect(capturedCallback).not.toBeNull();

    // 別端末で追加された変更が飛んでくる想定
    capturedCallback!(makeSnap(true, ['remote-added']));
    expect(useHousingFavoritesStore.getState().ids).toEqual(['remote-added']);

    // 同一内容の snapshot (自分の書き込みが確定しただけ) では余計な setAll が起きない
    // (再代入されても内容は同じなので実質観測不能だが、配列の同一性を軽く確認する)
    const before = useHousingFavoritesStore.getState().ids;
    capturedCallback!(makeSnap(true, ['remote-added']));
    expect(useHousingFavoritesStore.getState().ids).toBe(before);

    stop();
  });

  it('hasPendingWrites=true の snapshot は無視する (自分の書き込みのローカルエコー)', async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['x']));
    let capturedCallback: ((snap: unknown) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();

    capturedCallback!({
      exists: () => true,
      data: () => ({ ids: ['should-be-ignored'] }),
      metadata: { hasPendingWrites: true },
    });

    expect(useHousingFavoritesStore.getState().ids).toEqual(['x']);

    stop();
  });

  it('ストアの変更を 1.5 秒デバウンスしてまとめて setDoc する', async () => {
    vi.useFakeTimers();
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, []));
    mockOnSnapshot.mockReturnValue(vi.fn());

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();
    mockSetDoc.mockClear(); // 初回マージ分の書き込みはこのテストの対象外

    useHousingFavoritesStore.getState().add('one');
    await vi.advanceTimersByTimeAsync(500);
    useHousingFavoritesStore.getState().add('two');
    // 追加のたびにデバウンスがリセットされるので、まだ書き込まれていない
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockSetDoc).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][1]).toEqual({
      ids: ['one', 'two'],
      updatedAt: 'SERVER_TIMESTAMP',
    });

    stop();
  });

  it('stop() でリスナー購読解除とデバウンスタイマー解除の両方が効く', async () => {
    vi.useFakeTimers();
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, []));
    const unsubRemote = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubRemote);

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();
    mockSetDoc.mockClear();

    useHousingFavoritesStore.getState().add('pending-write');
    stop();
    expect(unsubRemote).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('ログアウトで購読を止め、再ログインで別ユーザーとして再アタッチする', async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['u1-id']));
    const unsub1 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub1);

    const stop = startFavoritesSync();
    setAuthUser('uid1');
    await flushAsync();
    expect(useHousingFavoritesStore.getState().ids).toEqual(['u1-id']);

    setAuthUser(null);
    expect(unsub1).toHaveBeenCalledTimes(1);

    // 共有端末対策: ローカル ids は uid1 と同期済みと記録されているので、次のログイン (uid2)
    // では union せず uid2 のサーバー ids をそのまま採用する (前ユーザーの持ち込み防止)。
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['u2-id']));
    mockOnSnapshot.mockReturnValueOnce(vi.fn());
    setAuthUser('uid2');
    await flushAsync();
    expect(useHousingFavoritesStore.getState().ids).toEqual(['u2-id']);

    stop();
  });

  describe('共有端末対策 (housing-favorites-synced-uid)', () => {
    it('別 uid の同期記録があるときは union せずサーバー ids で置き換え、書き戻さない', async () => {
      localStorage.setItem('housing-favorites-synced-uid', 'prev-user');
      useHousingFavoritesStore.getState().add('prev-local');
      mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['server-a']));
      mockOnSnapshot.mockReturnValue(vi.fn());

      const stop = startFavoritesSync();
      setAuthUser('new-user');
      await flushAsync();

      // 前ユーザーのローカル分は持ち込まれず、サーバー値そのまま。
      expect(useHousingFavoritesStore.getState().ids).toEqual(['server-a']);
      // サーバーと同一内容なので書き戻しも発生しない。
      expect(mockSetDoc).not.toHaveBeenCalled();
      // 採用完了で現 uid が記録される。
      expect(localStorage.getItem('housing-favorites-synced-uid')).toBe('new-user');

      stop();
    });

    it('記録が null (未ログインで貯めたローカル) なら従来どおり union する', async () => {
      expect(localStorage.getItem('housing-favorites-synced-uid')).toBeNull();
      useHousingFavoritesStore.getState().add('local-only');
      mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['server-a']));
      mockOnSnapshot.mockReturnValue(vi.fn());

      const stop = startFavoritesSync();
      setAuthUser('uid1');
      await flushAsync();

      expect(useHousingFavoritesStore.getState().ids).toEqual(['server-a', 'local-only']);
      expect(localStorage.getItem('housing-favorites-synced-uid')).toBe('uid1');

      stop();
    });

    it('記録が現 uid と一致するなら従来どおり union する', async () => {
      localStorage.setItem('housing-favorites-synced-uid', 'uid1');
      useHousingFavoritesStore.getState().add('local-only');
      mockGetDoc.mockResolvedValueOnce(makeSnap(true, ['server-a']));
      mockOnSnapshot.mockReturnValue(vi.fn());

      const stop = startFavoritesSync();
      setAuthUser('uid1');
      await flushAsync();

      expect(useHousingFavoritesStore.getState().ids).toEqual(['server-a', 'local-only']);

      stop();
    });
  });
});

describe('mergeFavoriteIds', () => {
  it('サーバー ids を先頭にローカルのみの id を末尾へ追加する (dedupe込み)', () => {
    expect(mergeFavoriteIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('サーバーが空ならローカルの順序をそのまま使う', () => {
    expect(mergeFavoriteIds([], ['x', 'y'])).toEqual(['x', 'y']);
  });

  it('ローカルが空ならサーバーの順序をそのまま使う', () => {
    expect(mergeFavoriteIds(['x', 'y'], [])).toEqual(['x', 'y']);
  });
});
