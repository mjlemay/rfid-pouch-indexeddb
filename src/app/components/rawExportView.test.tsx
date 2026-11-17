// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import RawExportView from './rawExportView';
import { createField, createTemplate, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };
const STAMP = '\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}';

describe('RawExportView', () => {
  let db: PouchDB.Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: 'b2', type: 'record', Notes: 'spare', templateId: 'template_asset', data: { f_owner: 'Sam' } });
  });

  afterEach(async () => {
    document.title = '';
    await db.destroy();
  });

  test('shows the records as JSON and names the tab after the stored title', async () => {
    await db.put({ _id: 'app_settings', type: 'setting', TITLE: 'Lab Tags' });
    render(<RawExportView format="json" />, { wrapper: withPouch(db) });
    const pre = await screen.findByText(/"id": "b2"/);
    expect(pre.tagName).toBe('PRE');
    expect(JSON.parse(pre.textContent ?? '')).toEqual([{ id: 'b2', template: 'Asset Tag', notes: 'spare', fields: { Owner: 'Sam' } }]);
    await waitFor(() => expect(document.title).toMatch(new RegExp(`^lab-tags-records-${STAMP}\\.json$`)));
  });

  test('shows the records as CSV', async () => {
    render(<RawExportView format="csv" />, { wrapper: withPouch(db) });
    const pre = await screen.findByText(/^ID,Template,Notes,Owner/);
    expect(pre.textContent).toBe('ID,Template,Notes,Owner\r\nb2,Asset Tag,spare,Sam\r\n');
  });

  test('falls back to the default title when there are no settings', async () => {
    render(<RawExportView format="csv" />, { wrapper: withPouch(db) });
    await screen.findByText(/^ID,Template,Notes,Owner/);
    await waitFor(() => expect(document.title).toMatch(new RegExp(`^rfid-scans-records-${STAMP}\\.csv$`)));
  });
});
