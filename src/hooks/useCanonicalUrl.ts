import { useEffect } from 'react';

const SITE_ORIGIN = 'https://lopoly.app';

/**
 * <link rel="canonical" href="..."> を <head> に動的設定する。
 * SPA で同一 index.html を返すため、各ページで正規 URL を Google に明示する。
 */
export function useCanonicalUrl(path: string): void {
    useEffect(() => {
        const url = `${SITE_ORIGIN}${path}`;
        let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = url;
    }, [path]);
}
