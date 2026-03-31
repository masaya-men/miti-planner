/**
 * テンプレート操作統合エンドポイント
 * ?action=auto-register → テンプレート自動登録 (POST)
 * ?action=promote       → 人気プラン昇格 (POST/GET)
 *
 * 既存の template/auto-register, template/promote を統合
 */
import autoRegisterHandler from './_autoRegisterHandler.js';
import promoteHandler from './_promoteHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'auto-register':
      return autoRegisterHandler(req, res);
    case 'promote':
      return promoteHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid action parameter. Use ?action=auto-register|promote' });
  }
}
