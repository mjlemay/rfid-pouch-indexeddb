// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../test/pouch';
import Home from './page';

// Drives the real page against a real PouchDB on a fake IndexedDB, so the
// settings form, the document round trip, and the appearance hook all run.
describe('Settings appearance round trip', () => {
  let db: PouchDB.Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({
      _id: 'app_settings',
      type: 'setting',
      RECORD_LIMIT: '1000', LOG_LIMIT: '1000',
      WAIT: '300', CPS_MIN: '0', CPS_MAX: '30', ID_LENGTH: '8',
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function openSettings() {
    render(<Home />, { wrapper: withPouch(db) });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'RFID Scans' })).toBeTruthy());
    const navButtons = document.querySelector('.bg-sidebar')!.querySelectorAll('svg');
    await act(async () => { fireEvent.click(navButtons[navButtons.length - 1].parentElement!); });
    return await screen.findByRole('combobox') as HTMLSelectElement;
  }

  test('a chosen theme stays selected after the select loses focus', async () => {
    const select = await openSettings();
    expect(select.value).toBe('dark');
    await act(async () => {
      fireEvent.focus(select);
      fireEvent.change(select, { target: { value: 'gold' } });
      fireEvent.blur(select);
    });
    expect(select.value).toBe('gold');
  });

  test('pressing Update saves the chosen theme and applies it', async () => {
    const select = await openSettings();
    await act(async () => {
      fireEvent.focus(select);
      fireEvent.change(select, { target: { value: 'gold' } });
      fireEvent.blur(select);
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })); });
    await waitFor(async () => {
      const saved = await db.get<{ THEME?: string }>('app_settings');
      expect(saved.THEME).toBe('gold');
    });
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('gold'));
  });
});

describe('Templates end to end', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({ _id: 'app_settings', type: 'setting', RECORD_LIMIT: '1000', LOG_LIMIT: '1000', WAIT: '300', CPS_MIN: '0', CPS_MAX: '30', ID_LENGTH: '8' });
    await db.put({ _id: '5eef2a29', type: 'record', Notes: '' });
  });
  afterEach(async () => { await db.destroy(); });

  // Nav order is ids, logs, inputs (templates), settings; the ready light has no svg.
  // Scoped to the sidebar because views render their own icons too.
  function clickNav(indexFromEnd: number) {
    const navButtons = document.querySelector('.bg-sidebar')!.querySelectorAll('svg');
    fireEvent.click(navButtons[navButtons.length - indexFromEnd].parentElement!);
  }

  test('create a template, assign it to a record, save a value, and see the change in the log', async () => {
    render(<Home />, { wrapper: withPouch(db) });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'RFID Scans' })).toBeTruthy());

    await act(async () => { clickNav(2); });
    const newButton = await screen.findByRole('button', { name: 'New template' });
    await act(async () => { fireEvent.click(newButton); });
    await act(async () => { fireEvent.change(await screen.findByLabelText('Template name'), { target: { value: 'Asset Tag' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add field' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Field 1 name'), { target: { value: 'Owner' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    await waitFor(async () => expect((await db.find({ selector: { type: 'template' } })).docs).toHaveLength(1));
    const templateId = (await db.find({ selector: { type: 'template' } })).docs[0]._id;

    await act(async () => { clickNav(4); });
    const recordRow = await screen.findByText('5eef2a29');
    await act(async () => { fireEvent.click(recordRow); });
    await screen.findAllByRole('option', { name: 'Asset Tag' });
    const templateSelect = await screen.findByLabelText('Template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(templateSelect, { target: { value: templateId } }); });
    const ownerInput = await screen.findByLabelText('Owner');
    await act(async () => { fireEvent.change(ownerInput, { target: { value: 'Alex' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })); });
    await waitFor(async () => expect((await db.find({ selector: { type: 'change' } })).docs).toHaveLength(1));

    await act(async () => { clickNav(3); });
    expect(await screen.findByText('Owner: → Alex')).toBeTruthy();
    expect(await screen.findByText('Template: No template → Asset Tag')).toBeTruthy();
  });

  test('opens on Recent Records and the title brings you back to it', async () => {
    render(<Home />, { wrapper: withPouch(db) });
    expect(await screen.findByRole('heading', { name: 'Recent Records' })).toBeTruthy();
    await act(async () => { clickNav(1); });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'RFID Scans' })); });
    expect(await screen.findByRole('heading', { name: 'Recent Records' })).toBeTruthy();
  });
});
