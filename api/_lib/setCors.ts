/**
 * api 共通の CORS ヘッダー設定。許可 origin の一覧はここ 1 か所だけ。
 * 各ハンドラーとの違い(許可メソッド・許可ヘッダー・プレビュー origin の範囲)だけを引数で渡す。
 */
const ALLOWED_ORIGINS = [
  'https://lopoly.app',
  'https://lopo-miti.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const ANY_VERCEL_PREVIEW = /^https:\/\/.*\.vercel\.app$/;
const MITI_VERCEL_PREVIEW = /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;

const DEFAULT_METHODS = 'POST, OPTIONS';
const DEFAULT_HEADERS = 'Content-Type, Authorization, X-Firebase-AppCheck';

export interface CorsOptions {
  /** Access-Control-Allow-Methods の値(既定 'POST, OPTIONS') */
  methods?: string;
  /** Access-Control-Allow-Headers の値(既定 'Content-Type, Authorization, X-Firebase-AppCheck') */
  headers?: string;
  /** *.vercel.app のプレビュー許可範囲。'any'=全て(既定)/'lopo-miti'=lopo-miti 系のみ(管理系) */
  preview?: 'any' | 'lopo-miti';
}

interface CorsReq {
  headers?: Record<string, unknown>;
}
interface CorsRes {
  setHeader(name: string, value: string): unknown;
}

export function setCors(req: CorsReq, res: CorsRes, options: CorsOptions = {}): void {
  const origin = (req.headers?.origin as string | undefined) || '';
  const previewRe = options.preview === 'lopo-miti' ? MITI_VERCEL_PREVIEW : ANY_VERCEL_PREVIEW;
  const ok = ALLOWED_ORIGINS.includes(origin) || previewRe.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', options.methods ?? DEFAULT_METHODS);
  res.setHeader('Access-Control-Allow-Headers', options.headers ?? DEFAULT_HEADERS);
}
