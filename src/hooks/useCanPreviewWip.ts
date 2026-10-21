import { useAuthStore } from '../store/useAuthStore';

/** 作り直し中(WIP)の UI を見せてよいか(非 React 用)。
 *  開発(DEV)は誰でも可。本番は管理者アカウント(Firebase ID トークンの claims.role === 'admin' 由来の
 *  isAdmin。クライアントから改ざん不可)でログインしているときだけ可。 */
export function getCanPreviewWip(): boolean {
    return import.meta.env.DEV || useAuthStore.getState().isAdmin;
}

/** 作り直し中(WIP)の UI を見せてよいか。今後の作り直し中 UI 全般のゲートに使う。
 *  完成して一般公開するときは、このフックの呼び出しを外す。 */
export function useCanPreviewWip(): boolean {
    const isAdmin = useAuthStore((s) => s.isAdmin);
    return import.meta.env.DEV || isAdmin;
}
