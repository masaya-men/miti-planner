/**
 * 一時的な診断ログユーティリティ (Phase B-1 Rev2 デバッグ用)
 *
 * console.log + localStorage の両方に時系列で書き出す。
 * ユーザーがいつでも `localStorage.getItem('lopo_debug_log')` で取り出せる。
 *
 * 真因特定後、関連 dlog 呼び出しと一緒にこのファイルごと削除する想定。
 */

const STORAGE_KEY = 'lopo_debug_log';
const MAX_BYTES = 256 * 1024; // 256KB を超えたら古い行から捨てる

let buffer: string[] = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? raw.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
})();

function flush() {
  try {
    let text = buffer.join('\n');
    while (text.length > MAX_BYTES && buffer.length > 0) {
      buffer.shift();
      text = buffer.join('\n');
    }
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // QuotaExceeded 等は無視 (console には出てる)
  }
}

function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) {
    return `Error: ${value.message} (${value.name})${value.stack ? '\n' + value.stack : ''}`;
  }
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Set) return [...val];
      if (val instanceof Map) return Object.fromEntries(val);
      return val;
    });
  } catch {
    return String(value);
  }
}

export function dlog(tag: string, message: string, payload?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const payloadStr = payload
    ? ' ' + Object.entries(payload).map(([k, v]) => `${k}=${safeStringify(v)}`).join(' ')
    : '';
  const line = `${ts} [${tag}] ${message}${payloadStr}`;
  buffer.push(line);
  flush();
  // eslint-disable-next-line no-console
  console.log(`[lopo:${tag}] ${message}`, payload ?? '');
}

export function dlogClear(): void {
  buffer = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
