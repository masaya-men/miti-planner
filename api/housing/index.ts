/**
 * ハウジング系統合エンドポイント
 *
 * ?action=can-register      → GET 登録可能か判定 (auth + housing_user_meta 読み)
 * ?action=register-listing  → POST 物件登録 (canRegister + listings 作成 + meta 更新)
 * ?action=check-duplicate   → POST 同住所重複検索
 * ?action=update-listing    → POST 物件編集 (ownerUid 認可)
 * ?action=delete-listing    → POST 物件 soft delete (ownerUid 認可)
 */
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';
import updateListingHandler from './_updateListingHandler.js';
import deleteListingHandler from './_deleteListingHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'can-register':
      return canRegisterHandler(req, res);
    case 'register-listing':
      return registerListingHandler(req, res);
    case 'check-duplicate':
      return checkDuplicateHandler(req, res);
    case 'update-listing':
      return updateListingHandler(req, res);
    case 'delete-listing':
      return deleteListingHandler(req, res);
    default:
      return res.status(400).json({
        error:
          'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate|update-listing|delete-listing',
      });
  }
}
