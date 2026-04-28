/**
 * 野良主流ページ掲載に関する同意フラグ（端末ローカル）。
 *
 * ログイン状態に関わらず localStorage 単位で同意を保持する。
 * 端末を変えれば再度ダイアログが出るが、同意自体は規約合意済みの
 * 範囲を確認するものなので「再表示で困る人はいない」設計。
 */

export const CONSENT_KEY = 'lopo.popularDisplayConsent';

export function hasPopularConsent(): boolean {
    try {
        return localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
        return false;
    }
}

export function setPopularConsent(): void {
    try {
        localStorage.setItem(CONSENT_KEY, '1');
    } catch {
        // Storage 不可時はサイレント無視（次回再表示される）
    }
}
