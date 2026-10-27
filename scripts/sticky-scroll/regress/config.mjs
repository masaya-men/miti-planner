// ───────────────────────────── 引数 ─────────────────────────────
export const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);

export const BASE_URL = process.env.REGRESS_BASE_URL || 'http://localhost:5173';
export const OUT = typeof args.out === 'string' ? args.out : 'after';
export const COMPARE = typeof args.compare === 'string' ? args.compare : null;
export const ONLY = typeof args.only === 'string' ? args.only : null;
export const ALLOW = typeof args.allow === 'string' ? args.allow.split(',').map((s) => s.trim()).filter(Boolean) : [];
export const PROBE_FILTER = typeof args.probe === 'string' ? new Set(args.probe.split(',')) : null;
export const TOL = 0.5; // 位置・寸法の許容(px)
export const TOL_PRECISE = 0.01; // precise 配下(sheetWidth 実測など)の許容(px)
