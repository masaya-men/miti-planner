import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndMapFflogs } from '../fetchAndMapFflogs';
import * as fflogsApi from '../../../api/fflogs';
import * as mapper from '../../../utils/fflogsMapper';

vi.mock('../../../api/fflogs');
vi.mock('../../../utils/fflogsMapper');

const fight = { id: 7, startTime: 0, endTime: 1000, name: 'Boss' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fflogsApi.resolveFight).mockResolvedValue(fight as any);
  vi.mocked(fflogsApi.fetchPlayerDetails).mockResolvedValue({ tanks: [], healers: [], dps: [] } as any);
  vi.mocked(fflogsApi.fetchFightEvents).mockImplementation(async (_r, _f, translate) =>
    (translate ? [{ marker: 'EN' }] : [{ marker: 'JP' }]) as any);
  vi.mocked(fflogsApi.fetchDeathEvents).mockResolvedValue([{ marker: 'DEATH' }] as any);
  vi.mocked(fflogsApi.fetchCastEvents).mockImplementation(async (_r, _f, translate) =>
    (translate ? [{ marker: 'CAST_EN' }] : [{ marker: 'CAST_JP' }]) as any);
  vi.mocked(mapper.mapFFLogsToTimeline).mockReturnValue(
    { events: [], phases: [], labels: [], stats: { isEnglishOnly: false } } as any,
  );
});

describe('fetchAndMapFflogs', () => {
  it('resolveFight に (reportId, fightId) を渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    expect(fflogsApi.resolveFight).toHaveBeenCalledWith('rep', '3');
  });
  it('fetchPlayerDetails には resolveFight の fight.id(number) を渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    expect(fflogsApi.fetchPlayerDetails).toHaveBeenCalledWith('rep', 7);
  });
  it('mapFFLogsToTimeline へ (eventsEn, eventsJp, fight, deaths, castEn, castJp, players) の順で渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    const args = vi.mocked(mapper.mapFFLogsToTimeline).mock.calls[0];
    expect(args[0]).toEqual([{ marker: 'EN' }]);    // eventsEn (translate=true)
    expect(args[1]).toEqual([{ marker: 'JP' }]);    // eventsJp (translate=false)
    expect(args[2]).toBe(fight);
    expect(args[3]).toEqual([{ marker: 'DEATH' }]);
    expect(args[4]).toEqual([{ marker: 'CAST_EN' }]); // castEn (translate=true)
    expect(args[5]).toEqual([{ marker: 'CAST_JP' }]); // castJp (translate=false)
  });
  it('戻り値 events は eventsEn', async () => {
    const { events } = await fetchAndMapFflogs('rep', '3');
    expect(events).toEqual([{ marker: 'EN' }]);
  });
  it('onProgress が resolving→fetching_players→fetching(name)→mapping の順で発火', async () => {
    const calls: Array<[string, unknown]> = [];
    await fetchAndMapFflogs('rep', '3', (p, ctx) => calls.push([p, ctx]));
    expect(calls).toEqual([
      ['resolving', undefined],
      ['fetching_players', undefined],
      ['fetching', { name: 'Boss' }],
      ['mapping', undefined],
    ]);
  });
  it('throw を透過する（内部で握らない）', async () => {
    vi.mocked(fflogsApi.resolveFight).mockRejectedValue(new Error('boom'));
    await expect(fetchAndMapFflogs('rep', '3')).rejects.toThrow('boom');
  });
});
