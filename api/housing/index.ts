/**
 * ハウジング系統合エンドポイント
 *
 * ?action=can-register      → GET 登録可能か判定 (auth + housing_user_meta 読み)
 * ?action=register-listing  → POST 物件登録 (canRegister + listings 作成 + meta 更新)
 * ?action=check-duplicate   → POST 同住所重複検索
 */
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'can-register':
      return canRegisterHandler(req, res);
    case 'register-listing':
      return registerListingHandler(req, res);
    case 'check-duplicate':
      return checkDuplicateHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate',
      });
  }
}
