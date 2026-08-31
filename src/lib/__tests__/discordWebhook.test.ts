import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendHousingNewListingNotification', () => {
  const OLD_ENV = process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('環境変数が設定されていれば content を JSON で POST する', async () => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = 'https://discord.test/webhook/xyz';
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 204, statusText: 'No Content' }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await sendHousingNewListingNotification('こんにちは');

    expect(fetchMock).toHaveBeenCalledWith('https://discord.test/webhook/xyz', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'こんにちは', allowed_mentions: { parse: [] } }),
    }));
  });

  it('レスポンスが ok でない場合も throw せず error を出す', async () => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = 'https://discord.test/webhook/xyz';
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 500, statusText: 'err' }));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await expect(sendHousingNewListingNotification('x')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('環境変数が未設定なら fetch を呼ばず warn だけ', async () => {
    delete process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await sendHousingNewListingNotification('x');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fetch が reject しても throw しない', async () => {
    process.env.DISCORD_HOUSING_NEW_WEBHOOK_URL = 'https://discord.test/webhook/xyz';
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendHousingNewListingNotification } = await import('../discordWebhook');

    await expect(sendHousingNewListingNotification('x')).resolves.toBeUndefined();
  });
});
