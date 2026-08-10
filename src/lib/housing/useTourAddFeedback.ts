import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourTrayStore } from '../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../store/useEphemeralListingsStore';
import { canAddToTour, tourAnchorRegion } from './tourCrossing';

export type TourAddAnimState = 'idle' | 'success' | 'error';
export type TourAddOutcome = 'added' | 'removed' | 'blocked';

/** 成功フラーリッシュ(bounce+glow+ring)の表示時間。housing-check-ripple(600ms)より少し長め。 */
const SUCCESS_ANIM_MS = 700;
/** 失敗の吹き出し+シェイクの表示時間。 */
const ERROR_ANIM_MS = 2500;

export interface UseTourAddFeedbackResult {
  /** このlistingが現在ツアートレイに入っているか(ストア直読み・常に最新)。 */
  isAdded: boolean;
  /** 'idle'以外の間だけ演出クラス/属性を出す。時間経過で自動的に'idle'へ戻る。 */
  animState: TourAddAnimState;
  /** 直近の失敗理由(翻訳済み文字列)。'error'の間だけ非null。 */
  errorMessage: string | null;
  /**
   * 追加済みなら外す(トグルOFF・演出なし)。未追加なら地域チェックのうえ追加する。
   * 戻り値で呼び出し側が結果を判定できる('added'のときだけ従来の外部通知コールバックを
   * 呼ぶ、といった呼び出し側の分岐に使う)。
   */
  attemptToggle: () => TourAddOutcome;
}

/**
 * 「ツアーに追加」ボタン共通の状態管理(探すページのカード/詳細ページの操作バーで共用)。
 * 地域跨ぎチェックは元々 HousingActionBar が単体で行っていたのと同じ pool 解決方法
 * (公開一覧+自分の登録+一時listingの3ストアを都度 .getState() で読む)を引き継ぐ。
 */
export function useTourAddFeedback(
  listingId: string,
  region: string | null | undefined,
): UseTourAddFeedbackResult {
  const { t } = useTranslation();
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const isAdded = trayIds.includes(listingId);

  const [animState, setAnimState] = useState<TourAddAnimState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const attemptToggle = useCallback((): TourAddOutcome => {
    if (isAdded) {
      setTrayIds((prev) => prev.filter((id) => id !== listingId));
      return 'removed';
    }

    const pool = [
      ...useHousingListingsStore.getState().listings,
      ...useHousingListingsStore.getState().myListings,
      ...useEphemeralListingsStore.getState().ephemeralListings,
    ];
    const trayRegion = tourAnchorRegion(
      trayIds.map((id) => pool.find((l) => l.id === id)?.region ?? null),
    );

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!canAddToTour(trayRegion, region ?? '')) {
      setErrorMessage(t('housing.tour.region_block'));
      setAnimState('error');
      timeoutRef.current = setTimeout(() => {
        setAnimState('idle');
        setErrorMessage(null);
      }, ERROR_ANIM_MS);
      return 'blocked';
    }

    setTrayIds((prev) => (prev.includes(listingId) ? prev : [...prev, listingId]));
    setAnimState('success');
    timeoutRef.current = setTimeout(() => setAnimState('idle'), SUCCESS_ANIM_MS);
    return 'added';
  }, [isAdded, trayIds, region, listingId, setTrayIds, t]);

  return { isAdded, animState, errorMessage, attemptToggle };
}
