// @vitest-environment happy-dom
/**
 * Task 9: 登録フォーム、確認セクション直前の任意ブロック (spec §4.1)。
 * - 未ログイン → 何も描画しない (getDoc も呼ばない)
 * - ログイン済 + 未公開 (housing_profiles ドキュメント無し/isPublished!==true)
 *   → 見出し「ハウジンガーとして名乗りますか?(任意)」+ 説明 1 行 + [設定する] ボタン
 *     (押すと openAccount を呼ぶ)。 何も入力必須にしない。
 * - ログイン済 + 公開中 → 「{{name}} として公開中」の小さな表示のみ (ボタンは出ない)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { HousingerProfile } from '../../types/housing';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'housing.housinger.register.publishedAs') return `${opts?.name} として公開中`;
      const map: Record<string, string> = {
        'housing.housinger.register.ctaTitle': 'ハウジンガーとして名乗りますか?(任意)',
        'housing.housinger.account.description':
          '名前とアイコンを登録ハウジングに表示し、あなたのページを公開します',
        'housing.housinger.register.ctaButton': '設定する',
      };
      return map[key] ?? key;
    },
  }),
}));

// firebase/firestore: doc/getDoc をテストごとに制御する (本人プロフィールの直読み。
// HousingerProfileSection.tsx と同じ理由 — 本人は非公開状態でも rules 上 read 可)。
const mockDoc = vi.fn((...args: unknown[]) => args);
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
}));

let authState: { user: { uid: string } | null } = { user: null };
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

const mockOpenAccount = vi.fn();
vi.mock('../../store/useHousingModalStore', () => ({
  useHousingModalStore: { getState: () => ({ openAccount: mockOpenAccount }) },
}));

import { RegisterHousingerCta } from '../../components/housing/register/RegisterHousingerCta';

const basePublishedProfile: HousingerProfile = {
  displayName: 'たかし',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

function notPublishedSnap() {
  return { exists: () => false };
}
function publishedSnap(overrides: Partial<HousingerProfile> = {}) {
  return { exists: () => true, data: () => ({ ...basePublishedProfile, ...overrides }) };
}

beforeEach(() => {
  mockDoc.mockClear();
  mockGetDoc.mockReset();
  mockOpenAccount.mockReset();
});

describe('RegisterHousingerCta', () => {
  it('未ログインなら何も描画せず getDoc も呼ばない', () => {
    authState = { user: null };
    const { container } = render(<RegisterHousingerCta />);
    expect(container.firstChild).toBeNull();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('ログイン済 + 未公開 → 見出し+説明+設定するボタン (押すと openAccount)', async () => {
    authState = { user: { uid: 'uid-1' } };
    mockGetDoc.mockResolvedValueOnce(notPublishedSnap());

    render(<RegisterHousingerCta />);

    expect(
      await screen.findByText('ハウジンガーとして名乗りますか?(任意)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('名前とアイコンを登録ハウジングに表示し、あなたのページを公開します'),
    ).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '設定する' });
    fireEvent.click(button);
    expect(mockOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('ログイン済 + プロフィール未作成 (ドキュメント無し) → 未公開と同じ CTA を出す', async () => {
    authState = { user: { uid: 'uid-3' } };
    mockGetDoc.mockResolvedValueOnce(notPublishedSnap());

    render(<RegisterHousingerCta />);

    expect(
      await screen.findByRole('button', { name: '設定する' }),
    ).toBeInTheDocument();
  });

  it('ログイン済 + 公開中 → 名前で公開中と表示し、ボタンは出ない', async () => {
    authState = { user: { uid: 'uid-2' } };
    mockGetDoc.mockResolvedValueOnce(publishedSnap({ displayName: 'たかし' }));

    render(<RegisterHousingerCta />);

    expect(await screen.findByText('たかし として公開中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '設定する' })).not.toBeInTheDocument();
  });
});
