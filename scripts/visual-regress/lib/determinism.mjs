// @ts-check
/**
 * 決定性の層: 通信の振り分け・時刻の固定・乱数の固定(visual-regress 共通部品)。
 * 撮影のたびに画面が変わる原因(実サーバーの応答・現在時刻・Math.random)をここで潰す。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** 1x1 透明 PNG(見本画像が無いときの代替) */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const IMAGE_HOSTS = ['pbs.twimg.com', 'i.ytimg.com', 'img.youtube.com', 'firebasestorage.googleapis.com', 'media.lopoly.app'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const BLOCK_SUFFIXES = ['.googleapis.com', '.firebaseio.com', '.firebaseapp.com', '.workers.dev'];
const BLOCK_HOSTS = ['www.googletagmanager.com', 'google-analytics.com', 'youtube-nocookie.com', 'youtube.com'];

/** host が name そのもの、またはそのサブドメインか */
const hostIs = (host, name) => host === name || host.endsWith('.' + name);

/**
 * リクエスト URL を種類に分ける。順序は 画像 → フォント → 遮断 → アプリ/API → 不明。
 * @param {string} url
 * @param {string} appOrigin
 * @returns {'app'|'api'|'block'|'image'|'font'|'unknown'}
 */
export function classifyRequest(url, appOrigin) {
  let u;
  try { u = new URL(url); } catch { return 'unknown'; }
  const host = u.hostname;
  if (IMAGE_HOSTS.includes(host) || (hostIs(host, 'lopoly.app') && u.pathname.startsWith('/housing-media'))) return 'image';
  if (FONT_HOSTS.includes(host)) return 'font';
  if (
    BLOCK_SUFFIXES.some((s) => host.endsWith(s)) ||
    BLOCK_HOSTS.some((h) => hostIs(host, h)) ||
    (host === 'www.google.com' && u.pathname.startsWith('/recaptcha'))
  ) return 'block';
  // アプリ自身(ws は http に読み替えて origin 比較)
  const app = new URL(appOrigin);
  // /api/ 配下でもソースファイル(Vite が配る .ts など。src から相対 import される)はアプリ扱い
  if (u.host === app.host) return u.pathname.startsWith('/api/') && !/\.tsx?$/.test(u.pathname) ? 'api' : 'app';
  return 'unknown';
}

/**
 * API の URL から fixture ファイル名(拡張子なし)を作る。v・時刻系のクエリは無視。
 * 例: /api/housing/public?action=gallery&v=1 → housing-public.gallery
 * @param {string} url
 */
export function apiFixtureKey(url) {
  const u = new URL(url, 'http://x.invalid');
  const base = u.pathname.replace(/^\/api\//, '').replace(/\/+$/, '').split('/').join('-');
  const parts = [base];
  const action = u.searchParams.get('action');
  const id = u.searchParams.get('id') ?? u.searchParams.get('uid');
  if (action) parts.push(action);
  if (id) parts.push(id);
  return parts.join('.');
}

/** 種付きの乱数(mulberry32)。0 以上 1 未満を返す関数を作る。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

/** URL がアバター画像らしいか(パスに avatar を含む) */
export function isAvatarUrl(url) {
  try { return /avatar/i.test(new URL(url).pathname); } catch { return /avatar/i.test(url); }
}

/**
 * 画像 URL から見本ファイルを決める(純関数)。アバターらしい URL はアバター群、それ以外は写真群だけから選ぶ。
 * 群が空なら null。同じ URL なら常に同じファイル。
 * @param {string} url
 * @param {string[]} photos
 * @param {string[]} avatars
 * @returns {string|null} 'avatars/x.png' のように images/ からの相対パス
 */
export function pickImage(url, photos, avatars) {
  const pool = isAvatarUrl(url) ? avatars.map((f) => `avatars/${f}`) : photos;
  if (!pool.length) return null;
  return pool[parseInt(sha1(url).slice(0, 8), 16) % pool.length];
}

/**
 * BrowserContext に決定性の層を入れる(context ごとに 1 回、ページを開く前に呼ぶ)。
 * @param {import('playwright').BrowserContext} context
 * @param {{ appOrigin: string, fixturesDir: string, fontCacheDir: string, now: number|string|Date, seed: number }} opts
 * @returns {Promise<{ unmocked: string[] }>}
 */
export async function installDeterminism(context, { appOrigin, fixturesDir, fontCacheDir, now, seed }) {
  /** @type {string[]} */
  const unmocked = [];
  const imagesDir = path.join(fixturesDir, 'images');
  const apiDir = path.join(fixturesDir, 'api');

  // 見本画像の一覧(無ければ空 → 1x1 透明 PNG)
  const list = (dir) => { try { return fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort(); } catch { return []; } };
  const photos = list(imagesDir);
  const avatars = list(path.join(imagesDir, 'avatars'));
  const mime = (f) => (/\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg');

  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (!/^https?:/.test(url)) return route.fallback(); // data: blob: などはそのまま
    const kind = classifyRequest(url, appOrigin);
    switch (kind) {
      case 'app':
        return route.fallback();
      case 'api': {
        const key = apiFixtureKey(url);
        const file = path.join(apiDir, `${key}.json`);
        if (fs.existsSync(file)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(file) });
        }
        unmocked.push(url);
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no fixture"}' });
      }
      case 'image': {
        const pick = pickImage(url, photos, avatars);
        if (!pick) return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
        return route.fulfill({ status: 200, contentType: mime(pick), body: fs.readFileSync(path.join(imagesDir, pick)) });
      }
      case 'font': {
        const cache = path.join(fontCacheDir, sha1(url));
        const meta = cache + '.type';
        try {
          if (fs.existsSync(cache)) {
            return route.fulfill({ status: 200, contentType: fs.existsSync(meta) ? fs.readFileSync(meta, 'utf8') : 'application/octet-stream', body: fs.readFileSync(cache) });
          }
          // 初回だけ実ネットワークから取得して保存(唯一の例外)
          const res = await fetch(url, { headers: { 'user-agent': route.request().headers()['user-agent'] ?? '' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = Buffer.from(await res.arrayBuffer());
          const type = res.headers.get('content-type') ?? 'application/octet-stream';
          fs.mkdirSync(fontCacheDir, { recursive: true });
          fs.writeFileSync(cache, body);
          fs.writeFileSync(meta, type);
          return route.fulfill({ status: 200, contentType: type, body });
        } catch {
          unmocked.push(url);
          return route.abort();
        }
      }
      case 'block':
        return route.abort();
      default:
        unmocked.push(url);
        return route.abort();
    }
  });

  // WebSocket(共同編集など)は全部閉じる
  await context.routeWebSocket(/.*/, (ws) => { ws.close(); });

  // 時刻: 固定値を起点に、そこから通常速度で進める(install 後に resume)
  await context.clock.install({ time: now });
  await context.clock.resume();

  // 乱数: 種付き mulberry32 に差し替え
  // 注入するのはテスト済みの mulberry32 そのもの(実装を 1 つに保つ)
  await context.addInitScript(`Math.random = (${mulberry32.toString()})(${Number(seed)});`);

  return { unmocked };
}
