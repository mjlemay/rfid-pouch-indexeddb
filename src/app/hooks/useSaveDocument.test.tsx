// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useSaveDocument } from './useSaveDocument';

describe('useSaveDocument', () => {
  let db: PouchDB.Database;
  beforeEach(() => { db = makeTestDatabase(); });
  afterEach(async () => { await db.destroy(); });

  test('creates a document that does not exist yet', async () => {
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', type: 'setting', WAIT: '300' });
    const saved = await db.get<{ WAIT: string }>('app_settings');
    expect(saved.WAIT).toBe('300');
  });

  test('merges onto the current document and keeps keys it was not given', async () => {
    await db.put({ _id: 'app_settings', type: 'setting', WAIT: '300', THEME: 'gold' });
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', WAIT: '500' });
    const saved = await db.get<{ WAIT: string; THEME: string }>('app_settings');
    expect(saved.WAIT).toBe('500');
    expect(saved.THEME).toBe('gold');
  });

  test('ignores a stale _rev from the caller', async () => {
    const first = await db.put({ _id: 'app_settings', type: 'setting', WAIT: '300' });
    await db.put({ _id: 'app_settings', _rev: first.rev, type: 'setting', WAIT: '400' });
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', _rev: first.rev, WAIT: '500' });
    const saved = await db.get<{ WAIT: string }>('app_settings');
    expect(saved.WAIT).toBe('500');
  });
});
