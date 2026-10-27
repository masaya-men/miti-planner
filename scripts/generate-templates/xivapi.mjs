import { XIVAPI_BASE, XIVAPI_DELAY_MS } from './config.mjs';
import { sleep } from './api.mjs';

// ─── XIVAPI: Fetch official JP/EN ability names by game ID ───
const _xivApiCache = new Map();

async function fetchXivApiName(guid) {
    if (_xivApiCache.has(guid)) return _xivApiCache.get(guid);
    try {
        const resp = await fetch(`${XIVAPI_BASE}/Action/${guid}?columns=Name_ja,Name_en,ID`);
        if (!resp.ok) {
            _xivApiCache.set(guid, null);
            return null;
        }
        const json = await resp.json();
        const result = { ja: json.Name_ja || '', en: json.Name_en || '' };
        _xivApiCache.set(guid, result);
        return result;
    } catch {
        _xivApiCache.set(guid, null);
        return null;
    }
}

export async function buildXivApiDict(guids) {
    const dict = new Map();
    const unique = [...new Set(guids)].filter(g => g > 0 && !_xivApiCache.has(g));
    if (unique.length > 0) {
        console.log(`   🌐 XIVAPI: Looking up ${unique.length} ability names...`);
        for (const guid of unique) {
            await fetchXivApiName(guid);
            await sleep(XIVAPI_DELAY_MS);
        }
    }
    // Build dict from cache
    for (const g of guids) {
        if (g > 0) {
            const cached = _xivApiCache.get(g);
            if (cached && cached.ja) dict.set(g, cached);
        }
    }
    return dict;
}
