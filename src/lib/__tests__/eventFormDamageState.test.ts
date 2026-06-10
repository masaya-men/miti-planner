import { describe, it, expect } from 'vitest';
import { computeInitialDamageState } from '../eventFormDamageState';

/**
 * イベント編集フォームの初期ダメージ状態判定 (バグ修正の回帰テスト)。
 *
 * バグ: 既存ダメージ (>0) を持つイベントを「イベントを編集」で開くと、
 * inputMode 初期値が 'reverse' のままマウント直後に自動再計算 effect が走り、
 * 復元したダメージを 0 で上書きしてしまう (秒数・対象は残るがダメージだけ 0)。
 * 対策: 開いた時点で inputMode/damageAmount を確定させる純関数を lazy init に使う。
 */
describe('computeInitialDamageState', () => {
    it('既存ダメージ>0 は直接入力モードで値を保持する', () => {
        expect(computeInitialDamageState({ damageAmount: 50000 }, false)).toEqual({
            damageAmount: 50000,
            inputMode: 'direct',
        });
    });

    it('ダメージ 0 / 未設定 は逆算モードで開く', () => {
        expect(computeInitialDamageState({ damageAmount: 0 }, false)).toEqual({
            damageAmount: 0,
            inputMode: 'reverse',
        });
        expect(computeInitialDamageState({}, false)).toEqual({
            damageAmount: 0,
            inputMode: 'reverse',
        });
        expect(computeInitialDamageState(null, false)).toEqual({
            damageAmount: 0,
            inputMode: 'reverse',
        });
        expect(computeInitialDamageState(undefined, false)).toEqual({
            damageAmount: 0,
            inputMode: 'reverse',
        });
    });

    it('reverseOnly はダメージがあっても逆算モードを強制する', () => {
        expect(computeInitialDamageState({ damageAmount: 50000 }, true)).toEqual({
            damageAmount: 50000,
            inputMode: 'reverse',
        });
    });
});
