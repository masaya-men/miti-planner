import type { TimelineEvent } from '../types';

export interface InitialDamageState {
    damageAmount: number;
    inputMode: 'direct' | 'reverse';
}

/**
 * イベント編集フォームを開いたときの初期ダメージ状態を決める純関数。
 *
 * 既存ダメージ (>0) があり reverseOnly でなければ「直接入力 (direct)」モードで開く。
 * これを useState の lazy initializer に使うことで、マウント直後に自動再計算 effect が
 * 古い inputMode ('reverse') を見てダメージを 0 で上書きしてしまう競合を防ぐ。
 * (EventForm の inputMode/damageAmount の初期化と、initialData 変化時の再初期化で共用する。)
 */
export function computeInitialDamageState(
    initialData: Pick<TimelineEvent, 'damageAmount'> | null | undefined,
    reverseOnly: boolean,
): InitialDamageState {
    const damageAmount = initialData?.damageAmount ?? 0;
    const inputMode: 'direct' | 'reverse' =
        !reverseOnly && damageAmount > 0 ? 'direct' : 'reverse';
    return { damageAmount, inputMode };
}
