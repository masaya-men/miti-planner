/**
 * テンプレート操作統合エンドポイント
 * ?action=auto-register        → テンプレート自動登録 (POST)
 * ?action=promote               → 人気プラン昇格 (POST/GET)
 * ?action=public-notifications  → 運営通知の公開読み (GET・匿名可・App Check 検証しない)
 * ?action=public-template       → テンプレ1件の公開読み (GET・匿名可・App Check 検証しない)
 *
 * 既存の template/auto-register, template/promote を統合。
 * public-notifications / public-template は P1-M (2026-07-14):
 * Vercel Hobby の Serverless Function 12 個上限を超えないため、独立関数を作らず
 * 本ルータに fold する (新規ロジックは _publicNotificationsHandler.ts / _publicTemplateHandler.ts)。
 */
import autoRegisterHandler from './_autoRegisterHandler.js';
import promoteHandler from './_promoteHandler.js';
import publicNotificationsHandler from './_publicNotificationsHandler.js';
import publicTemplateHandler from './_publicTemplateHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'auto-register':
      return autoRegisterHandler(req, res);
    case 'promote':
      return promoteHandler(req, res);
    case 'public-notifications':
      return publicNotificationsHandler(req, res);
    case 'public-template':
      return publicTemplateHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter. Use ?action=auto-register|promote|public-notifications|public-template',
      });
  }
}
