/**
 * iOS 非ログインユーザーへローカルデータ安全性の警告モーダルを自動表示すべきか。
 * iOS かつ 非ログイン かつ 表1件以上 かつ 未読 かつ チュートリアル中でない、で true。
 */
export function shouldAutoPromptLocalSafety(p: {
    isIOS: boolean;
    isLoggedIn: boolean;
    planCount: number;
    seen: boolean;
    tutorialActive: boolean;
}): boolean {
    return p.isIOS && !p.isLoggedIn && p.planCount > 0 && !p.seen && !p.tutorialActive;
}
