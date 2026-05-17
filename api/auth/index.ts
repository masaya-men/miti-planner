/**
 * OAuth認証統合エンドポイント
 * ?provider=discord → Discord OAuth2 (POST=開始, GET=コールバック)
 *
 * Twitter (X) ログインは 2026-05-17 に廃止 (X API 仕様変更による pay-per-use 化のため)。
 */
import discordHandler from './_discordHandler.js';

export default async function handler(req: any, res: any) {
  const provider = req.query?.provider;

  switch (provider) {
    case 'discord':
      return discordHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid provider parameter. Use ?provider=discord' });
  }
}
