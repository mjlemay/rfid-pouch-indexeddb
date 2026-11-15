// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useSaveRecord } from './useSaveRecord';
import { ChangeDoc, createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };

async function changeDocs(db: PouchDB.Database): Promise<ChangeDoc[]> {
  const result = await db.find({ selector: { type: 'change' } });
  return result.docs as unknown as ChangeDoc[];
}

describe('useSaveRecord', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
  });
  afterEach(async () => { await db.destroy(); });

  test('creates the record and logs the first values as changes', async () => {
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', Notes: 'first', templateId: 'template_asset', data: { f_owner: 'Sam' } }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved).toMatchObject({ type: 'record', Notes: 'first', templateId: 'template_asset', data: { f_owner: 'Sam' } });
    const changes = await changeDocs(db);
    expect(changes).toHaveLength(1);
    expect(changes[0].scanId).toBe('5eef2a29');
    expect(changes[0].changes).toEqual([
      { field: 'Notes', from: '', to: 'first' },
      { field: 'Template', from: 'No template', to: 'Asset Tag' },
      { field: 'Owner', from: '', to: 'Sam' },
    ]);
  });

  test('writes no change document when nothing differs', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', Notes: 'same' });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', Notes: 'same' }, [assetTag]);
    expect(await changeDocs(db)).toHaveLength(0);
  });

  test('keeps stored data for fields the current template does not define', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', data: { f_old: 'hidden' } });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', templateId: 'template_asset', data: { f_owner: 'Sam' } }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved.data).toEqual({ f_old: 'hidden', f_owner: 'Sam' });
  });

  test('clears the template when given an empty template id', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', templateId: 'template_asset' });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', templateId: '' }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved.templateId).toBeUndefined();
  });
});
