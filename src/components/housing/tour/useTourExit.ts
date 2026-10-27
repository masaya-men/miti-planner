import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { endHostTour } from '../../../lib/sharedTour/hostSync';

/**
 * ツアー中ページ(TourNavPage)の終わり方: 途中終了と、完了後に探す/お気に入りへ戻る。
 */
export function useTourExit(tourToken: string | null, setCompleted: (v: boolean) => void) {
  const navigate = useNavigate();
  const stop = useHousingTourStore((s) => s.stop);
  const reset = useHousingTourStore((s) => s.reset);
  const exitTourMode = useHousingViewStore((s) => s.exitTourMode);

  const onFinish = useCallback(() => {
    // ツアー終了時、共有中なら live state を ended にして参加者側を追従させる (孤児 live 防止)。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    navigate('/housing');
  }, [tourToken, stop, exitTourMode, reset, navigate]);

  const backToBrowse = useCallback(() => {
    // 完了後にツアーを離れる＝共有中なら live を ended にして参加者を追従させる（孤児 live 防止・onFinish と同型）。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing');
  }, [tourToken, stop, exitTourMode, reset, setCompleted, navigate]);

  const backToFavorites = useCallback(() => {
    // 完了後にツアーを離れる＝共有中なら live を ended にして参加者を追従させる（孤児 live 防止・onFinish と同型）。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing/favorites');
  }, [tourToken, stop, exitTourMode, reset, setCompleted, navigate]);

  return { onFinish, backToBrowse, backToFavorites };
}
