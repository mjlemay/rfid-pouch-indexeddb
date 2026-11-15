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
    const navButtons = document.querySelectorAll('svg');
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
