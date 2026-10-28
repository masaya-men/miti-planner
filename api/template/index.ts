/**
 * テンプレート操作統合エンドポイント
 * ?action=auto-register        → テンプレート自動登録 (POST)
 * ?action=public-notifications  → 運営通知の公開読み (GET・匿名可・App Check 検証しない)
 * ?action=public-template       → テンプレ1件の公開読み (GET・匿名可・App Check 検証しない)
 *
 * 既存の template/auto-register を統合(人気プラン昇格 promote は 2026-10-28 みんなの軽減表の撤去で削除)。
 * public-notifications / public-template は P1-M (2026-07-14):
 * Vercel Hobby の Serverless Function 12 個上限を超えないため、独立関数を作らず
 * 本ルータに fold する (新規ロジックは _publicNotificationsHandler.ts / _publicTemplateHandler.ts)。
 */
import autoRegisterHandler from './_autoRegisterHandler.js';
import publicNotificationsHandler from './_publicNotificationsHandler.js';
import publicTemplateHandler from './_publicTemplateHandler.js';
import { setPrivateNoStore } from '../../src/lib/privateNoStore.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const action = req.query?.action;

  switch (action) {
    case 'auto-register':
      setPrivateNoStore(res);
      return autoRegisterHandler(req, res);
    case 'public-notifications':
      return publicNotificationsHandler(req, res);
    case 'public-template':
      return publicTemplateHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter. Use ?action=auto-register|public-notifications|public-template',
      });
  }
}
