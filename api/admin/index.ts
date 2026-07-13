/**
 * 管理API統合エンドポイント
 * ?resource=contents             → コンテンツ管理 (GET/POST/PUT/DELETE)
 * ?resource=role                 → ロール管理 (GET/POST)
 * ?resource=templates            → テンプレート管理 (GET/POST/PUT/DELETE)
 * ?resource=sync                 → データ同期 (POST)
 * ?resource=dashboard            → ダッシュボード統計 (GET)
 * ?resource=ugc                  → UGC管理 (GET/DELETE)
 * ?resource=popular              → 野良主流ランキング (GET)
 * ?resource=system_notifications → 運営通知 (POST/PATCH/DELETE)
 * ?resource=housing_reports      → ハウジング通報管理 (GET/PATCH)
 * ?resource=personal_tags        → 個人タグ通報管理 (GET/PATCH)
 * ?resource=housinger_reports    → ハウジンガープロフィール通報管理 (GET/PATCH)
 */
import contentsHandler from './_contentsHandler.js';
import roleHandler from './_roleHandler.js';
import templatesHandler from './_templatesHandler.js';
import syncHandler from './_syncHandler.js';
import dashboardHandler from './_dashboardHandler.js';
import ugcHandler from './_ugcHandler.js';
import popularHandler from './_popularHandler.js';
import systemNotificationsHandler from './_systemNotificationsHandler.js';
import housingReportsHandler from './_housingReportsHandler.js';
import personalTagsHandler from './_personalTagsHandler.js';
import housingerReportsHandler from './_housingerReportsHandler.js';

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
    case 'popular':
      return popularHandler(req, res);
    case 'system_notifications':
      return systemNotificationsHandler(req, res);
    case 'housing_reports':
      return housingReportsHandler(req, res);
    case 'personal_tags':
      return personalTagsHandler(req, res);
    case 'housinger_reports':
      return housingerReportsHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid resource parameter. Use ?resource=contents|role|templates|sync|dashboard|ugc|popular|system_notifications|housing_reports|personal_tags|housinger_reports' });
  }
}
