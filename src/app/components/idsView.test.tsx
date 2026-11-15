// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import IdsView from './idsView';
import { createField, createTemplate, RecordDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner', required: true };
const assetTag = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };

describe('IdsView', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: '5eef2a29', type: 'record', Notes: 'tagged' });
    await db.put({ _id: 'aaaa0001', type: 'record', Notes: 'untagged', templateId: 'template_asset', data: { f_owner: 'Sam' } });
  });
  afterEach(async () => { await db.destroy(); });

  test('choosing a template shows its fields, and Update saves the values', async () => {
    render(<IdsView selectedId="5eef2a29" limit={100} />, { wrapper: withPouch(db) });
    // Wait for the template list before grabbing the select, which remounts when its options arrive.
    await screen.findAllByRole('option', { name: 'Asset Tag' });
    const templateSelect = await screen.findByLabelText('Template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(templateSelect, { target: { value: 'template_asset' } }); });
    const ownerInput = await screen.findByLabelText('Owner') as HTMLInputElement;
    // Template fields come before Notes, which stays at the bottom of the form.
    const notesInput = screen.getByLabelText('Notes');
    expect(ownerInput.compareDocumentPosition(notesInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await act(async () => { fireEvent.change(ownerInput, { target: { value: 'Alex' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })); });
    await waitFor(async () => {
      const saved = await db.get<RecordDoc>('5eef2a29');
      expect(saved.templateId).toBe('template_asset');
      expect(saved.data).toEqual({ f_owner: 'Alex' });
    });
  });

  test('a blank required field blocks Update and shows a message', async () => {
    render(<IdsView selectedId="aaaa0001" limit={100} />, { wrapper: withPouch(db) });
    const ownerInput = await screen.findByLabelText('Owner') as HTMLInputElement;
    // The stored value lands one effect after the field renders; clearing an already empty input is not a change.
    await waitFor(() => expect(ownerInput.value).toBe('Sam'));
    await act(async () => { fireEvent.change(ownerInput, { target: { value: '' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })); });
    expect(await screen.findByText('Owner is required')).toBeTruthy();
    const saved = await db.get<RecordDoc>('aaaa0001');
    expect(saved.data).toEqual({ f_owner: 'Sam' });
  });

  test('the Recent Records filter narrows the table by template', async () => {
    render(<IdsView selectedId="" limit={100} />, { wrapper: withPouch(db) });
    await screen.findByText('tagged');
    await screen.findByText('untagged');
    const filter = screen.getByLabelText('Filter by template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(filter, { target: { value: 'template_asset' } }); });
    await waitFor(() => expect(screen.queryByText('tagged')).toBeNull());
    expect(screen.getByText('untagged')).toBeTruthy();
    await act(async () => { fireEvent.change(filter, { target: { value: 'none' } }); });
    await waitFor(() => expect(screen.queryByText('untagged')).toBeNull());
    expect(screen.getByText('tagged')).toBeTruthy();
  });

  test('filtering by a template adds a column per field with each record\'s value', async () => {
    render(<IdsView selectedId="" limit={100} />, { wrapper: withPouch(db) });
    await screen.findByText('untagged');
    expect(screen.queryByText('Owner')).toBeNull();
    const filter = screen.getByLabelText('Filter by template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(filter, { target: { value: 'template_asset' } }); });
    expect(await screen.findByText('Owner')).toBeTruthy();
    expect(await screen.findByText('Sam')).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.indexOf('Owner')).toBeLessThan(headers.indexOf('Notes'));
    await act(async () => { fireEvent.change(filter, { target: { value: 'all' } }); });
    await waitFor(() => expect(screen.queryByText('Owner')).toBeNull());
  });
});
