/**
 * OAuth認証統合エンドポイント
 * ?provider=discord → Discord OAuth2 (POST=開始, GET=コールバック)
 * ?provider=twitter → Twitter OAuth2 + PKCE (POST=開始, GET=コールバック)
 *
 * 既存の auth/discord, auth/twitter を統合
 */
import discordHandler from './_discordHandler.js';
import twitterHandler from './_twitterHandler.js';

export default async function handler(req: any, res: any) {
  const provider = req.query?.provider;

  switch (provider) {
    case 'discord':
      return discordHandler(req, res);
    case 'twitter':
      return twitterHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid provider parameter. Use ?provider=discord|twitter' });
  }
}
