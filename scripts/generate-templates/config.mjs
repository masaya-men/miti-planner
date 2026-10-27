// ─── Configuration ───
export const LOGS_PER_CONTENT = 3;          // Number of logs to merge per content
export const API_DELAY_MS = 1500;           // Delay between API calls to respect rate limits
export const XIVAPI_DELAY_MS = 200;         // XIVAPI rate limit delay
export const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';
export const TOKEN_ENDPOINT = 'https://www.fflogs.com/oauth/token';
export const XIVAPI_BASE = 'https://xivapi.com';

// ─── Auto-attack names to filter ───
export const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);
