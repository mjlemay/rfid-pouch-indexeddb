// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import ImportExportView from './importExportView';
import { createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };
const STAMP = '\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}';

describe('ImportExportView', () => {
  let db: PouchDB.Database;
  let saved: { name: string; blob: Blob } | undefined;

  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: 'b2', type: 'record', Notes: 'spare', templateId: 'template_asset', data: { f_owner: 'Sam' } });
    saved = undefined;
    let pending: Blob | undefined;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => { pending = blob; return 'blob:records'; }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved = { name: this.download, blob: pending! };
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.destroy();
  });

  async function renderView() {
    render(<ImportExportView title="RFID Scans" />, { wrapper: withPouch(db) });
    await screen.findByRole('heading', { name: 'Import and Export' });
    // The file input stays disabled until templates have loaded, so an import never misses a stored template.
    await waitFor(() => expect((screen.getByLabelText('Import file') as HTMLInputElement).disabled).toBe(false));
  }

  test('Download saves JSON by default with a timestamped name', async () => {
    await renderView();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(saved?.name).toMatch(new RegExp(`^rfid-scans-records-${STAMP}\\.json$`));
    expect(saved?.blob.type).toBe('application/json');
    expect(JSON.parse(await saved!.blob.text())).toEqual([{ id: 'b2', template: 'Asset Tag', notes: 'spare', fields: { Owner: 'Sam' } }]);
  });

  test('choosing CSV saves a CSV with the field columns', async () => {
    await renderView();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Download' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Export format'), { target: { value: 'csv' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(saved?.name).toMatch(new RegExp(`^rfid-scans-records-${STAMP}\\.csv$`));
    expect(await saved!.blob.text()).toBe('ID,Template,Notes,Owner\r\nb2,Asset Tag,spare,Sam\r\n');
  });

  test('choosing a file imports it and shows the counts and problems', async () => {
    await renderView();
    const file = new File(['ID,Template,Notes,Owner\r\na1,Asset Tag,new,Alex\r\n,Asset Tag,,\r\n'], 'assets.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } }); });
    expect(await screen.findByText('1 added, 1 skipped')).toBeTruthy();
    expect(screen.getByText('Row 2: ID is missing')).toBeTruthy();
    expect(screen.getByText('Choose file')).toBeTruthy();
    const record = await db.get<RecordDoc>('a1');
    expect(record.data).toEqual({ f_owner: 'Alex' });
  });

  test('an unreadable file shows only its problem', async () => {
    await renderView();
    const file = new File(['[1,'], 'broken.json', { type: 'application/json' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } }); });
    expect(await screen.findByText('The file is not valid JSON')).toBeTruthy();
    expect(screen.queryByText('no changes')).toBeNull();
  });
});
