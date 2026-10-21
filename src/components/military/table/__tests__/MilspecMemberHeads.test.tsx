// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { PartyMember } from '../../../../types';
import { MilspecMemberHeads } from '../MilspecMemberHeads';

const mk = (id: string, jobId: string | null, role: PartyMember['role']): PartyMember =>
  ({ id, jobId, role, stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 }, computedValues: {} });
const jobs = [{ id: 'pld', role: 'tank' }, { id: 'whm', role: 'healer' }] as any;

describe('MilspecMemberHeads(表の見出しのメンバー列)', () => {
  const members = [mk('MT', 'pld', 'tank'), mk('H1', 'whm', 'healer'), mk('D1', null, 'dps')];
  const layout = new Map([['MT', { left: 100, width: 50 }], ['H1', { left: 150, width: 60 }]]);
  it('実測のある列だけ、列の中心に、ジョブ略号(ジョブ id の大文字)とロールを付けて出す', () => {
    const { container } = render(<MilspecMemberHeads members={members} jobs={jobs} memberLayout={layout} />);
    const items = container.querySelectorAll('[data-member-head]');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('data-member-head')).toBe('MT');
    expect(items[0].getAttribute('data-role')).toBe('tank');
    expect((items[0] as HTMLElement).style.left).toBe('125px');
    expect(items[0].textContent).toBe('PLD');
    expect((items[1] as HTMLElement).style.left).toBe('180px');
    expect(items[1].textContent).toBe('WHM');
  });
  it('ジョブ未選択の列は略号が空で、ロール色の線だけ出る', () => {
    const l2 = new Map([['D1', { left: 0, width: 40 }]]);
    const { container } = render(<MilspecMemberHeads members={members} jobs={jobs} memberLayout={l2} />);
    const it = container.querySelector('[data-member-head="D1"]')!;
    expect(it.textContent).toBe('');
    expect(it.getAttribute('data-role')).toBe('dps');
  });
});
