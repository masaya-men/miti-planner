import { describe, it, expect } from 'vitest';
import { parseRoomManageRequest, ROOM_ACTIONS } from '../../../api/collab/_roomManageLogic';

describe('parseRoomManageRequest', () => {
  it('body が object でない → invalid_body', () => {
    expect(parseRoomManageRequest(null)).toEqual({ ok: false, error: 'invalid_body' });
    expect(parseRoomManageRequest('x')).toEqual({ ok: false, error: 'invalid_body' });
  });
  it('action 不正 → invalid_action', () => {
    expect(parseRoomManageRequest({ action: 'nope', planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_action' });
    expect(parseRoomManageRequest({ planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_action' });
  });
  it('planId 欠落/空 → invalid_planId', () => {
    expect(parseRoomManageRequest({ action: 'create' }))
      .toEqual({ ok: false, error: 'invalid_planId' });
    expect(parseRoomManageRequest({ action: 'create', planId: '' }))
      .toEqual({ ok: false, error: 'invalid_planId' });
  });
  it('create(maxParticipants 省略可) → ok', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'create', planId: 'p1' } });
  });
  it('create(maxParticipants 指定) → ok で素通し(clamp はハンドラ)', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', maxParticipants: 4 }))
      .toEqual({ ok: true, req: { action: 'create', planId: 'p1', maxParticipants: 4 } });
  });
  it('create で maxParticipants が数値でない → invalid_maxParticipants', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', maxParticipants: '4' }))
      .toEqual({ ok: false, error: 'invalid_maxParticipants' });
  });
  it('revoke / reissue は planId のみで ok', () => {
    expect(parseRoomManageRequest({ action: 'revoke', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'revoke', planId: 'p1' } });
    expect(parseRoomManageRequest({ action: 'reissue', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'reissue', planId: 'p1' } });
  });
  it('set-max は maxParticipants 必須(数値)', () => {
    expect(parseRoomManageRequest({ action: 'set-max', planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_maxParticipants' });
    expect(parseRoomManageRequest({ action: 'set-max', planId: 'p1', maxParticipants: 6 }))
      .toEqual({ ok: true, req: { action: 'set-max', planId: 'p1', maxParticipants: 6 } });
  });
  it('ROOM_ACTIONS は 4 アクション', () => {
    expect(ROOM_ACTIONS).toEqual(['create', 'revoke', 'reissue', 'set-max']);
  });
  it('create は任意の label を trim して受理する', () => {
    const r = parseRoomManageRequest({ action: 'create', planId: 'p1', label: '  土曜固定P  ' });
    expect(r).toEqual({ ok: true, req: { action: 'create', planId: 'p1', label: '土曜固定P' } });
  });
  it('reissue も label を受理する', () => {
    const r = parseRoomManageRequest({ action: 'reissue', planId: 'p1', label: '固定' });
    expect(r.ok && (r.req as any).label).toBe('固定');
  });
  it('label が文字列でなければ invalid_label', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', label: 123 })).toEqual({ ok: false, error: 'invalid_label' });
  });
  it('label が 40 文字超なら invalid_label', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', label: 'x'.repeat(41) })).toEqual({ ok: false, error: 'invalid_label' });
  });
  it('label 空文字/空白のみは未設定として受理（label を含めない）', () => {
    const r = parseRoomManageRequest({ action: 'create', planId: 'p1', label: '   ' });
    expect(r).toEqual({ ok: true, req: { action: 'create', planId: 'p1' } });
  });
});
