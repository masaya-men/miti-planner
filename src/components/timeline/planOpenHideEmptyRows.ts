import { usePlanStore } from '../../store/usePlanStore';
import { useTutorialStore } from '../../store/useTutorialStore';

/**
 * プランを開いた(切り替えた)時に「空の行は隠す」をどちらにするか。null = 触らない。
 * 描く前(Timeline の描画中)と、描いた後のストア書き込み(useTimelinePlanScrollReset の effect)の両方で使う。
 * 両方が同じ答えを出すことで、開いた直後に全行を作って捨てない(2026-10-28)。
 */
export function planOpenHideEmptyRows(currentPlanId: string | null, joinerRoomToken: string | null): boolean | null {
    // 共同編集ルーム表示中(ジョイナー)は currentPlanId が参加者自身の無関係な個人プランを
    // 指したままになる(部屋を開いても更新されない)。その個人プランの空/非空を部屋の表示に
    // 持ち込まないよう、常にコンパクト表示から開始する。
    if (joinerRoomToken) return true;
    // チュートリアル中: NewPlanModal が hideEmptyRows を制御しているので触らない
    if (useTutorialStore.getState().isActive) return null;
    // 空プラン (新規作成直後・テンプレ未整備コンテンツ等): 軽減配置時刻を見せたいので強制的に展開状態へ
    const plan = usePlanStore.getState().plans.find(p => p.id === currentPlanId);
    const isEmptyPlan = plan ? (plan.data?.timelineEvents?.length ?? 0) === 0 : false;
    return !isEmptyPlan;
}
