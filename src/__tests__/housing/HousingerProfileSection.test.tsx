// @vitest-environment happy-dom
/**
 * Task 6: アカウントモーダル「ハウジンガー公開」セクションのテスト。
 * - 自分のプロフィールは getDoc(doc(db,'housing_profiles', uid)) 直読み (rules 上 本人は常に read 可)。
 * - 未公開時: 表示名が空なら公開ボタン disabled + 注記。表示名があれば公開可能。
 * - 公開中: ひとこと(bio) / SNSリンク 入力を表示。SNS はクライアント側 validateHousingerSnsUrl で
 *   保存前チェックし、不正なら inline エラーを出して upsertHousingerProfile を呼ばない。
 * - 保存/公開/公開停止はすべて upsertHousingerProfile 経由 → 成功 showToast / 失敗 showToast(error)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { HousingerProfile } from '../../types/housing';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// firebase/firestore: doc/getDoc をテストごとに制御する (本人プロフィールの直読み)
const mockDoc = vi.fn((...args: unknown[]) => args);
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

// useAuthStore: uid / profileDisplayName をテストごとに差し替える
let authState: { user: { uid: string } | null; profileDisplayName: string | null } = {
  user: { uid: 'uid-1' },
  profileDisplayName: 'たかし',
};
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

// upsertHousingerProfile はモックし、呼び出し引数と戻り値をテストごとに検証・制御する
const mockUpsert = vi.fn();
vi.mock('../../lib/housing/housingerProfileService', () => ({
  upsertHousingerProfile: (...args: unknown[]) => mockUpsert(...args),
}));

// showToast はモックして呼び出しを検証する (ConfirmDialog は実物を使い統合的に検証する)
const mockShowToast = vi.fn();
vi.mock('../../components/Toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

import { HousingerProfileSection } from '../../components/housing/login/HousingerProfileSection';

const basePublishedProfile: HousingerProfile = {
  displayName: 'たかし',
  avatarUrl: null,
  bio: '',
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
  return {
    exists: () => true,
    data: () => ({ ...basePublishedProfile, ...overrides }),
  };
}

beforeEach(() => {
  mockDoc.mockClear();
  mockGetDoc.mockReset();
  mockUpsert.mockReset();
  mockShowToast.mockReset();
});

describe('HousingerProfileSection', () => {
  it('未公開 + 表示名が空 → 公開ボタンが disabled になり注記が出る', async () => {
    authState = { user: { uid: 'uid-1' }, profileDisplayName: '' };
    mockGetDoc.mockResolvedValueOnce(notPublishedSnap());

    render(<HousingerProfileSection />);

    const button = await screen.findByRole('button', {
      name: 'housing.housinger.account.publish',
    });
    expect(button).toBeDisabled();
    expect(screen.getByText('housing.housinger.account.nameRequired')).toBeInTheDocument();
  });

  it('未公開 + 表示名あり → 公開ボタンは有効', async () => {
    authState = { user: { uid: 'uid-2' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(notPublishedSnap());

    render(<HousingerProfileSection />);

    const button = await screen.findByRole('button', {
      name: 'housing.housinger.account.publish',
    });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText('housing.housinger.account.nameRequired')).not.toBeInTheDocument();
  });

  it('公開ボタン押下で upsertHousingerProfile({ isPublished: true }) を呼ぶ', async () => {
    authState = { user: { uid: 'uid-3' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(notPublishedSnap());
    mockUpsert.mockResolvedValueOnce({ ok: true, profile: basePublishedProfile });

    render(<HousingerProfileSection />);
    const button = await screen.findByRole('button', {
      name: 'housing.housinger.account.publish',
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({ isPublished: true });
    });
    expect(mockShowToast).toHaveBeenCalledWith('housing.housinger.account.toastSaved');
  });

  it('公開中 → ひとこと(bio) と SNSリンク の入力欄が表示される', async () => {
    authState = { user: { uid: 'uid-4' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(
      publishedSnap({ bio: 'S字改築が好きです', snsUrl: 'https://x.com/lopo_ff14' }),
    );

    render(<HousingerProfileSection />);

    expect(await screen.findByText('housing.housinger.account.published')).toBeInTheDocument();
    expect(screen.getByLabelText('housing.housinger.account.bioLabel')).toHaveValue(
      'S字改築が好きです',
    );
    expect(screen.getByLabelText('housing.housinger.account.snsLabel')).toHaveValue(
      'https://x.com/lopo_ff14',
    );
  });

  it('SNS 不正 URL で保存を押すと inline エラーが出て upsertHousingerProfile は呼ばれない', async () => {
    authState = { user: { uid: 'uid-5' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(publishedSnap());

    render(<HousingerProfileSection />);
    const snsInput = await screen.findByLabelText('housing.housinger.account.snsLabel');
    fireEvent.change(snsInput, { target: { value: 'https://evil.com/a' } });
    fireEvent.click(screen.getByRole('button', { name: 'housing.housinger.account.save' }));

    expect(
      await screen.findByText('housing.housinger.account.snsInvalid'),
    ).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('有効な入力で保存を押すと upsertHousingerProfile が呼ばれ成功トーストが出る', async () => {
    authState = { user: { uid: 'uid-6' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(publishedSnap());
    mockUpsert.mockResolvedValueOnce({
      ok: true,
      profile: { ...basePublishedProfile, bio: 'こんにちは', snsUrl: 'https://x.com/a' },
    });

    render(<HousingerProfileSection />);
    const bioInput = await screen.findByLabelText('housing.housinger.account.bioLabel');
    const snsInput = screen.getByLabelText('housing.housinger.account.snsLabel');
    fireEvent.change(bioInput, { target: { value: 'こんにちは' } });
    fireEvent.change(snsInput, { target: { value: 'https://x.com/a' } });
    fireEvent.click(screen.getByRole('button', { name: 'housing.housinger.account.save' }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({ bio: 'こんにちは', snsUrl: 'https://x.com/a' });
    });
    expect(mockShowToast).toHaveBeenCalledWith('housing.housinger.account.toastSaved');
  });

  it('保存失敗時はエラートーストが出る', async () => {
    authState = { user: { uid: 'uid-7' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(publishedSnap());
    mockUpsert.mockResolvedValueOnce({ ok: false, error: 'invalid_bio' });

    render(<HousingerProfileSection />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'housing.housinger.account.save' }),
    );

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'housing.housinger.account.toastError',
        'error',
      );
    });
  });

  it('公開をやめる → 確認ダイアログで確定すると upsertHousingerProfile({ isPublished: false }) を呼ぶ', async () => {
    authState = { user: { uid: 'uid-8' }, profileDisplayName: 'たかし' };
    mockGetDoc.mockResolvedValueOnce(publishedSnap());
    mockUpsert.mockResolvedValueOnce({
      ok: true,
      profile: { ...basePublishedProfile, isPublished: false },
    });

    render(<HousingerProfileSection />);
    const unpublishButton = await screen.findByRole('button', {
      name: 'housing.housinger.account.unpublish',
    });
    fireEvent.click(unpublishButton);

    expect(
      screen.getByText('housing.housinger.account.unpublishConfirmBody'),
    ).toBeInTheDocument();

    // ConfirmDialog のフッター内にある確定ボタン (confirmLabel = unpublish キー) をクリック
    const confirmButtons = screen.getAllByText('housing.housinger.account.unpublish');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({ isPublished: false });
    });
  });
});
