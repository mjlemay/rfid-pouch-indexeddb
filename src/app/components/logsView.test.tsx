// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import LogsView from './logsView';

describe('LogsView', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({ _id: 'scan_2026-11-15T10:00:00.000Z', type: 'scan', scanId: '5eef2a29', date: '2026-11-15T10:00:00.000Z' });
    await db.put({
      _id: 'change_2026-11-15T10:05:00.000Z_5eef2a29', type: 'change', scanId: '5eef2a29', date: '2026-11-15T10:05:00.000Z',
      changes: [{ field: 'Notes', from: '', to: 'Returned' }, { field: 'Owner', from: 'Sam', to: 'Alex' }],
    });
  });
  afterEach(async () => { await db.destroy(); });

  test('shows scans and changes in one feed with change details', async () => {
    render(<LogsView />, { wrapper: withPouch(db) });
    expect(await screen.findByText('Scan')).toBeTruthy();
    expect(await screen.findByText('Updated')).toBeTruthy();
    expect(screen.getByText('Notes: → Returned')).toBeTruthy();
    expect(screen.getByText('Owner: Sam → Alex')).toBeTruthy();
  });

  test('clicking a change row opens that record', async () => {
    const selectRowHandler = vi.fn();
    render(<LogsView selectRowHandler={selectRowHandler} />, { wrapper: withPouch(db) });
    fireEvent.click(await screen.findByText('Updated'));
    expect(selectRowHandler).toHaveBeenCalledWith('5eef2a29');
  });
});
