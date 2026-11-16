// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useImportRecords } from './useImportRecords';
import { ChangeDoc, createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';
import { ImportDoc } from '../../utils/importExport';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const qty = { ...createField('Qty', 'number'), id: 'f_qty' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner, qty] };

async function docsOfType<T>(db: PouchDB.Database, type: string): Promise<T[]> {
  const result = await db.find({ selector: { type } });
  return result.docs as unknown as T[];
}

describe('useImportRecords', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: 'b2', type: 'record', Notes: 'old', templateId: 'template_asset', data: { f_owner: 'Sam', f_qty: 1 } });
  });
  afterEach(async () => { await db.destroy(); });

  function importer() {
    return renderHook(() => useImportRecords(), { wrapper: withPouch(db) }).result.current;
  }

  test('adds new records, updates changed ones, skips bad rows, and writes the summary', async () => {
    const csv = 'ID,Template,Notes,Owner,Qty\r\na1,Asset Tag,new,Alex,5\r\nb2,Asset Tag,old,Sam,2\r\nc3,Asset Tag,,,many\r\n';
    const result = await importer()('assets.csv', csv, [assetTag]);
    expect(result).toEqual({ added: 1, updated: 1, skipped: 1, problems: [{ row: 3, message: 'Qty must be a number' }] });

    const added = await db.get<RecordDoc>('a1');
    expect(added).toMatchObject({ type: 'record', Notes: 'new', templateId: 'template_asset', data: { f_owner: 'Alex', f_qty: 5 } });
    const updated = await db.get<RecordDoc>('b2');
    expect(updated.data).toEqual({ f_owner: 'Sam', f_qty: 2 });

    const changes = await docsOfType<ChangeDoc>(db, 'change');
    expect(changes.map((change) => change.scanId).sort()).toEqual(['a1', 'b2']);
    expect(changes.find((change) => change.scanId === 'b2')?.changes).toEqual([{ field: 'Qty', from: '1', to: '2' }]);

    const imports = await docsOfType<ImportDoc>(db, 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({ type: 'import', fileName: 'assets.csv', added: 1, updated: 1, skipped: 1 });
    expect(imports[0]._id).toMatch(/^import_\d{4}-/);
  });

  test('a row identical to the stored record counts as neither added nor updated', async () => {
    const result = await importer()('assets.csv', 'ID,Template,Notes,Owner,Qty\r\nb2,Asset Tag,old,Sam,1\r\n', [assetTag]);
    expect(result).toEqual({ added: 0, updated: 0, skipped: 0, problems: [] });
    expect(await docsOfType<ChangeDoc>(db, 'change')).toHaveLength(0);
  });

  test('creates a missing template and uses it for the new records', async () => {
    const json = JSON.stringify([{ id: 'd4', template: 'Loaner', notes: '', fields: { Returned: true } }]);
    const result = await importer()('loaners.json', json, [assetTag]);
    expect(result.added).toBe(1);
    const templates = await docsOfType<TemplateDoc>(db, 'template');
    const loaner = templates.find((template) => template.name === 'Loaner');
    expect(loaner?.fields.map((field) => [field.name, field.fieldType])).toEqual([['Returned', 'boolean']]);
    const record = await db.get<RecordDoc>('d4');
    expect(record.templateId).toBe(loaner?._id);
    expect(record.data).toEqual({ [loaner!.fields[0].id]: true });
    const changes = await docsOfType<ChangeDoc>(db, 'change');
    expect(changes[0].changes).toContainEqual({ field: 'Template', from: 'No template', to: 'Loaner' });
  });

  test('writes nothing for an unreadable file', async () => {
    const result = await importer()('broken.json', '[1,', [assetTag]);
    expect(result).toEqual({ added: 0, updated: 0, skipped: 0, problems: [{ message: 'The file is not valid JSON' }] });
    expect(await docsOfType<ImportDoc>(db, 'import')).toHaveLength(0);
  });

  test('a failed save skips that row and the rest but still writes the summary', async () => {
    // PouchDB's put has several overloads, so the spy goes through a one-signature view of the database.
    const realPut = db.put.bind(db) as (doc: unknown) => Promise<unknown>;
    const putTarget = db as unknown as { put: (doc: unknown) => Promise<unknown> };
    vi.spyOn(putTarget, 'put').mockImplementation((doc) => {
      if ((doc as { _id?: string })._id === 'e5') return Promise.reject(new Error('disk full'));
      return realPut(doc);
    });
    const csv = 'ID,Notes\r\na1,one\r\ne5,two\r\nf6,three\r\n';
    const result = await importer()('assets.csv', csv, [assetTag]);
    vi.restoreAllMocks();
    expect(result).toEqual({
      added: 1, updated: 0, skipped: 2,
      problems: [{ row: 2, message: 'could not save' }, { row: 3, message: 'could not save' }],
    });
    const imports = await docsOfType<ImportDoc>(db, 'import');
    expect(imports[0]).toMatchObject({ added: 1, skipped: 2 });
  });
});
