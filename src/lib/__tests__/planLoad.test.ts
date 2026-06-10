import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPlanDataIntoStore } from '../planLoad';
import { useMitigationStore } from '../../store/useMitigationStore';

vi.mock('../../utils/compression', () => ({
  decompressPlanData: vi.fn(async () => ({ marker: 'decompressed' })),
}));

beforeEach(() => useMitigationStore.setState({ _collabActive: false }));

describe('loadPlanDataIntoStore', () => {
  it('data があればそのまま loadSnapshot に渡し、その data を返す', async () => {
    const spy = vi.spyOn(useMitigationStore.getState(), 'loadSnapshot').mockImplementation(() => {});
    const ret = await loadPlanDataIntoStore({ id: 'p1', data: { marker: 'plain' } } as any);
    expect(spy).toHaveBeenCalledWith({ marker: 'plain' });
    expect(ret).toEqual({ marker: 'plain' });
    spy.mockRestore();
  });

  it('data が空 + compressedData があれば解凍して loadSnapshot に渡し、解凍結果を返す', async () => {
    const spy = vi.spyOn(useMitigationStore.getState(), 'loadSnapshot').mockImplementation(() => {});
    const ret = await loadPlanDataIntoStore({ id: 'p1', data: {}, compressedData: 'xxx' } as any);
    expect(spy).toHaveBeenCalledWith({ marker: 'decompressed' });
    expect(ret).toEqual({ marker: 'decompressed' });
    spy.mockRestore();
  });
});
