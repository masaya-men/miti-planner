const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** YouTube の各種 URL から動画 ID(11文字)を抽出する。抽出不可は null。 */
export function parseYouTubeId(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (ID_RE.test(trimmed)) return trimmed;
    try {
        const u = new URL(trimmed);
        const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
        if (host === 'youtu.be') {
            const id = u.pathname.slice(1).split('/')[0];
            return ID_RE.test(id) ? id : null;
        }
        if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            if (u.pathname === '/watch') {
                const v = u.searchParams.get('v');
                return v && ID_RE.test(v) ? v : null;
            }
            const m = u.pathname.match(/^\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
            if (m) return m[2];
        }
        return null;
    } catch {
        return null;
    }
}
