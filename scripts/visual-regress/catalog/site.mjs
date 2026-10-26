// @ts-check
// サイト共通ページ(LP・About・プライバシー・利用規約・stgy)のカタログ。
import { baseStorage, housingStorage } from '../fixtures/storage.mjs';

/** site-dark / site-light から明るさだけ取り出して、見本の localStorage を作る(style は標準固定) */
const siteStorage = (/** @type {{ theme: string, lang: string }} */ cond) =>
  ({
    ...baseStorage(),
    ...housingStorage({ theme: { mode: cond.theme === 'site-light' ? 'light' : 'dark', style: 'standard' }, lang: cond.lang }),
  });

const axes = { vp: ['1489', '390'], theme: ['site-dark', 'site-light'], lang: ['ja', 'en'] };

/** @type {(id: string, route: string, ready: string, covers: string[]) => any} */
const page = (id, route, ready, covers) => ({ id, route, storage: siteStorage, ready, axes, covers });

export default [
  page('site/lp', '/', 'section', ['LandingPage']),
  page('site/about', '/about', 'h1', ['AboutPage']),
  page('site/privacy', '/privacy', 'h1', ['PrivacyPolicyPage']),
  page('site/terms', '/terms', 'h1', ['TermsPage']),
  page('site/stgy', '/stgy', 'h1', ['StrategyBoardPastePage']),
];
