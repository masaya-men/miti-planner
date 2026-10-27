import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createSharedTour } from '../../../lib/housingApiClient';
import { buildTourSnapshots, snapshotContainsHiddenAddress } from '../../../lib/sharedTour/snapshot';
import { pushHostState } from '../../../lib/sharedTour/hostSync';
import { showToast } from '../../toastBus';
import type { MockListing } from '../../../data/housing/mockListings';
import type { TourSnapshot } from '../../../types/sharedTour';

interface UseHostInviteArgs {
  isLoggedIn: boolean;
  openLogin: () => void;
  listingIds: string[];
  pool: MockListing[];
  ephemeral: MockListing[];
  currentIndex: number;
  phase: 'moving' | 'viewing';
  viewStartAt: number | null;
  crossingAckIndex: number | null;
}

/**
 * ツアー中ページ(TourNavPage)の幹事の招待: 招待リンクの発行・コピーと、幹事の操作の live 同期。
 */
export function useHostInvite({
  isLoggedIn, openLogin, listingIds, pool, ephemeral, currentIndex, phase, viewStartAt, crossingAckIndex,
}: UseHostInviteArgs) {
  const { t } = useTranslation();

  // 共有ツアー同期 (Task 2.1): 幹事が発行した招待の token。null=未発行。
  // mount 時の自動復帰 (localStorage からの token 復帰) は今回スコープ外
  // (設計§7 の同端末復帰は別タスク・stale token 誤表示を避ける)。
  const [tourToken, setTourToken] = useState<string | null>(null);
  // 招待発行前にホストが書ける短い文章(OGPカードにも使う)。
  const [tourName, setTourName] = useState('');
  // 招待リンク発行中 (create-shared-tour API 応答待ち)。ボタンを「作成中…」にして二重発行も防ぐ。
  const [creatingInvite, setCreatingInvite] = useState(false);
  // 住所露出警告ダイアログの表示に使う「発行待ち」の中身 (非公開/一時追加を含む場合のみ立つ)。
  // alsoCopy: スマホ下部バー由来の発行(発行直後に自動でリンクをコピーまで行う)かどうか。
  const [pendingInvite, setPendingInvite] = useState<{
    snaps: TourSnapshot[];
    hasEphemeral: boolean;
    alsoCopy: boolean;
  } | null>(null);

  // 共有ツアー同期 (Task 2.1): 幹事の「みんなを招待」発行フロー。
  // 実際の Firestore 書き込み (create-shared-tour) を行う共通処理。
  // alsoCopy=true のときは発行直後にそのままリンクをクリップボードへコピーする
  // (スマホ下部バーは「発行」と「コピー」を1タップに統合しているため)。
  const doCreate = useCallback(
    async (snaps: TourSnapshot[], alsoCopy = false) => {
      setCreatingInvite(true);
      try {
        const { tourToken: token } = await createSharedTour(snaps, tourName);
        setTourToken(token);
        localStorage.setItem('lopo_shared_tour_token', token);
        if (alsoCopy) {
          const url = `${location.origin}/housing/tour/${token}`;
          void navigator.clipboard?.writeText(url);
          showToast(t('housing.tour.nav.invite.copied'), 'success');
        }
      } catch {
        showToast(t('housing.tour.nav.invite.error'), 'error');
      } finally {
        setCreatingInvite(false);
      }
    },
    [t, tourName],
  );

  // 「みんなを招待」の共通処理。非公開/一時追加の家を含む場合は警告ダイアログを挟み、
  // それ以外は確認なしで即発行する。
  // 招待の発行(create-shared-tour)はログイン必須(housingApiClient 参照)。デスクトップは
  // パネルごとログイン案内に差し替えるため通常ここに来ないが、スマホ下部バーはボタンが
  // 常設のため、未ログイン時はここでログインモーダルを開いて終わる(サイレント失敗の防止)。
  const startInvite = useCallback(
    (alsoCopy: boolean) => {
      if (!isLoggedIn) {
        openLogin();
        return;
      }
      const snaps = buildTourSnapshots(listingIds, pool);
      const hasEphemeral = listingIds.some((id) => ephemeral.some((e) => e.id === id));
      const containsHidden = snapshotContainsHiddenAddress(snaps);
      if (hasEphemeral || containsHidden) {
        setPendingInvite({ snaps, hasEphemeral, alsoCopy });
      } else {
        void doCreate(snaps, alsoCopy);
      }
    },
    [isLoggedIn, openLogin, listingIds, pool, ephemeral, doCreate],
  );

  // デスクトップ(TourInvitePanel)の「みんなを招待」ボタン。発行のみ、コピーは別ボタン。
  const onInvite = useCallback(() => startInvite(false), [startInvite]);

  // 警告ダイアログの「このまま招待する」。
  const onConfirmExpose = useCallback(() => {
    if (pendingInvite) void doCreate(pendingInvite.snaps, pendingInvite.alsoCopy);
    setPendingInvite(null);
  }, [pendingInvite, doCreate]);

  // 招待リンクをクリップボードへコピー。
  const onCopyInvite = useCallback(() => {
    if (!tourToken) return;
    const url = `${location.origin}/housing/tour/${tourToken}`;
    void navigator.clipboard?.writeText(url);
    showToast(t('housing.tour.nav.invite.copied'), 'success');
  }, [tourToken, t]);

  // スマホ下部バーの招待アイコン。発行済みならコピーのみ、未発行なら発行して自動コピー(1タップ統合)。
  const onMobileInviteTap = useCallback(() => {
    if (tourToken) {
      onCopyInvite();
      return;
    }
    startInvite(true);
  }, [tourToken, onCopyInvite, startInvite]);

  // 幹事の操作 (前へ/見学/次へ) を live state に反映する (孤児 live 防止は onFinish 側で別途)。
  useEffect(() => {
    if (!tourToken) return;
    // #A: crossingAckIndex(幹事の「移動しました」)も同期し、参加者の跨ぎ overlay を主催者操作でだけ解除する。
    void pushHostState(tourToken, { currentIndex, phase, viewStartAt, crossingAckedIndex: crossingAckIndex, order: listingIds });
  }, [tourToken, currentIndex, phase, viewStartAt, crossingAckIndex, listingIds]);

  return {
    tourToken, tourName, setTourName, creatingInvite, pendingInvite, setPendingInvite,
    onInvite, onConfirmExpose, onCopyInvite, onMobileInviteTap,
  };
}
