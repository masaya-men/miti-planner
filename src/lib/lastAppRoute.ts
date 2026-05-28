/**
 * 管理画面から「アプリに戻る」 ときの戻り先を覚えておくための仕組み。
 * 軽減表 (/miti) かハウジング (/housing*) のどちらから管理に入ったかを記録し、
 * 管理画面の「← アプリに戻る」 がその直前の画面へ返す。
 * 記録がない (URL 直アクセス等) ときは軽減表を既定にする。
 */
const STORAGE_KEY = 'lopo:lastAppRoute';
const DEFAULT_ROUTE = '/miti';

/** 戻り先として記録する価値のある「アプリ画面」 か (= 軽減表 / ハウジング)。 */
export function isAppRoute(pathname: string): boolean {
    return pathname === '/miti' || pathname.startsWith('/housing');
}

export function rememberAppRoute(route: string): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, route);
    } catch {
        // プライベートモード等で sessionStorage が使えない場合は既定にフォールバック
    }
}

export function getLastAppRoute(): string {
    try {
        return sessionStorage.getItem(STORAGE_KEY) || DEFAULT_ROUTE;
    } catch {
        return DEFAULT_ROUTE;
    }
}
