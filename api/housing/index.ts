/**
 * ハウジング系統合エンドポイント
 *
 * ?action=can-register              → GET 登録可能か判定 (auth + housing_user_meta 読み)
 * ?action=register-listing          → POST 物件登録 (canRegister + listings 作成 + meta 更新)
 * ?action=check-duplicate           → POST 同住所重複検索
 * ?action=update-listing            → POST 物件編集 (ownerUid 認可)
 * ?action=delete-listing            → POST 物件 soft delete (ownerUid 認可)
 * ?action=report-listing            → POST 物件通報 (reports + reportCount + 通知 doc)
 * ?action=list-notifications        → GET 自分の通知一覧
 * ?action=mark-notification-read    → POST 通知既読化 (1 件 or 全件)
 * ?action=delete-notification       → POST 通知削除 (1 件 or listingId 単位、 解決時に消す)
 * ?action=resolve-report            → POST 通報対処+自己復帰 (非表示解除、 ownerUid 認可)
 */
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';
import updateListingHandler from './_updateListingHandler.js';
import deleteListingHandler from './_deleteListingHandler.js';
import reportListingHandler from './_reportListingHandler.js';
import listNotificationsHandler from './_listNotificationsHandler.js';
import markNotificationReadHandler from './_markNotificationReadHandler.js';
import deleteNotificationHandler from './_deleteNotificationHandler.js';
import resolveReportHandler from './_resolveReportHandler.js';

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
    case 'report-listing':
      return reportListingHandler(req, res);
    case 'list-notifications':
      return listNotificationsHandler(req, res);
    case 'mark-notification-read':
      return markNotificationReadHandler(req, res);
    case 'delete-notification':
      return deleteNotificationHandler(req, res);
    case 'resolve-report':
      return resolveReportHandler(req, res);
    default:
      return res.status(400).json({
        error:
          'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate|update-listing|delete-listing|report-listing|list-notifications|mark-notification-read|delete-notification|resolve-report',
      });
  }
}
