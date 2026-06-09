/**
 * 共同編集 統合エンドポイント
 *
 * Vercel Hobby の Serverless(Node) Functions 12個上限に収めるため、
 * load / save / room の 3 ハンドラを 1 関数に統合(housing/admin/template と同型)。
 * 各ハンドラは `_` 接頭辞で関数ルート化されない。URL は vercel.json の rewrite で
 * 旧パスを維持する(/api/collab/load → /api/collab?action=load 等)ため、
 * Cloudflare ワーカー(collabPersistence.ts)側の改修・再デプロイは不要。
 *
 * ?action=load   → GET  DO の onLoad が叩く seed 取得 (x-collab-secret 認証)
 * ?action=save   → POST DO の onSave が叩く書き戻し (x-collab-secret 認証)
 * ?action=room   → POST オーナーのルーム発行/失効/再発行/上限 (Firebase ID Token 認証)
 * ?action=verify → POST worker が接続者の ID Token を検証 (x-collab-secret 認証)
 *
 * メソッド検証・認証は各ハンドラ内に従来どおり実装されているため、
 * ここでは action による振り分けのみ行う(本体ロジックは一切変更していない)。
 */
import loadHandler from './_loadHandler.js';
import saveHandler from './_saveHandler.js';
import roomHandler from './_roomHandler.js';
import verifyHandler from './_verifyHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'load':
      return loadHandler(req, res);
    case 'save':
      return saveHandler(req, res);
    case 'room':
      return roomHandler(req, res);
    case 'verify':
      return verifyHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter. Use ?action=load|save|room',
      });
  }
}
