// @ts-check
// 仮置き: LP 1 項目だけ(Task 6 で正式なカタログにする)
import { baseStorage } from '../fixtures/storage.mjs';

export default [
  {
    id: 'site/lp-placeholder',
    route: '/',
    storage: () => baseStorage(),
    ready: 'body',
    axes: { vp: ['1489'], theme: ['site-dark'], lang: ['ja'] },
  },
];
