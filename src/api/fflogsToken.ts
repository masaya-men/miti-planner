import { apiFetch } from '../lib/apiClient';

// ─────────────────────────────────────────────────────────────
// Token Cache (session-level, not persisted)
// ─────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenExpiresAt: number = 0;

/**
 * Obtain an OAuth2 access token using the client_credentials flow.
 *
 * - Production: calls /api/fflogs/token (Vercel serverless proxy) so the
 *   client_secret is never exposed in the browser bundle.
 * - Development: falls back to VITE_FFLOGS_CLIENT_ID / VITE_FFLOGS_CLIENT_SECRET
 *   from .env.local for local testing convenience.
 */
export async function getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (subtract 60s for safety margin)
    if (_cachedToken && now < _tokenExpiresAt - 60_000) {
        return _cachedToken;
    }

    // ── Production: use server-side proxy ──
    if (import.meta.env.PROD) {
        const response = await apiFetch('/api/fflogs/token', { method: 'POST' });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`FFLogs token proxy failed (${response.status}): ${body}`);
        }

        const json = await response.json() as { access_token: string; expires_in: number };
        _cachedToken = json.access_token;
        _tokenExpiresAt = now + json.expires_in * 1000;

        return _cachedToken;
    }

    // ── Development: サーバーサイドプロキシ経由（シークレットをクライアントに露出しない）──
    const devResponse = await fetch('/api/fflogs/token', { method: 'POST' });

    if (!devResponse.ok) {
        throw new Error(`FFLogs token proxy failed (${devResponse.status})`);
    }

    const json = await devResponse.json() as { access_token: string; expires_in: number };
    _cachedToken = json.access_token;
    _tokenExpiresAt = now + json.expires_in * 1000;

    return _cachedToken;
}
