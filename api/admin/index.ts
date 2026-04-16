/**
 * 管理API統合エンドポイント
 * ?resource=contents  → コンテンツ管理 (GET/POST/PUT/DELETE)
 * ?resource=role      → ロール管理 (GET/POST)
 * ?resource=templates → テンプレート管理 (GET/POST/PUT/DELETE)
 * ?resource=sync      → データ同期 (POST)
 * ?resource=dashboard → ダッシュボード統計 (GET)
 * ?resource=ugc       → UGC管理 (GET/DELETE)
 */
import contentsHandler from './_contentsHandler.js';
import roleHandler from './_roleHandler.js';
import templatesHandler from './_templatesHandler.js';
import syncHandler from './_syncHandler.js';
import dashboardHandler from './_dashboardHandler.js';
import ugcHandler from './_ugcHandler.js';

export default async function handler(req: any, res: any) {
  const resource = req.query?.resource;

  switch (resource) {
    case 'contents':
      return contentsHandler(req, res);
    case 'role':
      return roleHandler(req, res);
    case 'templates':
      return templatesHandler(req, res);
    case 'sync':
      return syncHandler(req, res);
    case 'dashboard':
      return dashboardHandler(req, res);
    case 'ugc':
      return ugcHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid resource parameter. Use ?resource=contents|role|templates|sync|dashboard|ugc' });
  }
}
