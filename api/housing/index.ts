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
 * ?action=purge-if-tweet-gone       → POST SNS 物件のツイート削除を再確認し 404 なら soft delete
 * ?action=upload-thumbnail          → POST 物件のサムネ画像を base64 で受領 → Firebase Storage に保存
 * ?action=confirm-listing           → POST 家主が「今もあります」 で lastConfirmedAt を更新 (Phase 2-2)
 * ?action=create-personal-tag       → POST 個人タグ作成 (1 ユーザー 1 個、 Phase B)
 * ?action=my-personal-tag           → GET 自分の個人タグ取得 (未作成なら null)
 * ?action=search-personal-tags      → GET 個人タグ検索 (探すページのフィルタ用オートコンプリート)
 * ?action=report-personal-tag       → POST 個人タグ通報
 * ?action=upsert-housinger-profile  → POST ハウジンガープロフィール 公開/更新/非公開/同期 (冪等)
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
import purgeIfTweetGoneHandler from './_purgeIfTweetGoneHandler.js';
import uploadThumbnailHandler from './_uploadThumbnailHandler.js';
import confirmListingHandler from './_confirmListingHandler.js';
import createPersonalTagHandler from './_createPersonalTagHandler.js';
import myPersonalTagHandler from './_myPersonalTagHandler.js';
import searchPersonalTagsHandler from './_searchPersonalTagsHandler.js';
import reportPersonalTagHandler from './_reportPersonalTagHandler.js';
import upsertHousingerProfileHandler from './_upsertHousingerProfileHandler.js';

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
    case 'purge-if-tweet-gone':
      return purgeIfTweetGoneHandler(req, res);
    case 'upload-thumbnail':
      return uploadThumbnailHandler(req, res);
    case 'confirm-listing':
      return confirmListingHandler(req, res);
    case 'create-personal-tag':
      return createPersonalTagHandler(req, res);
    case 'my-personal-tag':
      return myPersonalTagHandler(req, res);
    case 'search-personal-tags':
      return searchPersonalTagsHandler(req, res);
    case 'report-personal-tag':
      return reportPersonalTagHandler(req, res);
    case 'upsert-housinger-profile':
      return upsertHousingerProfileHandler(req, res);
    default:
      return res.status(400).json({
        error:
          'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate|update-listing|delete-listing|report-listing|list-notifications|mark-notification-read|delete-notification|resolve-report|purge-if-tweet-gone|upload-thumbnail|confirm-listing|create-personal-tag|my-personal-tag|search-personal-tags|report-personal-tag|upsert-housinger-profile',
      });
  }
}
