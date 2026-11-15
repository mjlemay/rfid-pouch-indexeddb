// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useTemplates } from './useTemplates';
import { createTemplate } from '../../utils/templates';

describe('useTemplates', () => {
  let db: PouchDB.Database;
  beforeEach(() => { db = makeTestDatabase(); });
  afterEach(async () => { await db.destroy(); });

  test('lists templates sorted by name', async () => {
    await db.put({ ...createTemplate('Zebra', 'now'), _id: 'template_z' });
    await db.put({ ...createTemplate('alpha', 'now'), _id: 'template_a' });
    const { result } = renderHook(() => useTemplates(), { wrapper: withPouch(db) });
    await waitFor(() => expect(result.current.templates.map((template) => template.name)).toEqual(['alpha', 'Zebra']));
  });

  test('saveTemplate writes and bumps updatedAt, deleteTemplate removes', async () => {
    const { result } = renderHook(() => useTemplates(), { wrapper: withPouch(db) });
    const template = createTemplate('Asset Tag', '2026-11-15T00:00:00.000Z');
    await result.current.saveTemplate(template);
    await waitFor(() => expect(result.current.templates).toHaveLength(1));
    expect(result.current.templates[0].updatedAt).not.toBe('2026-11-15T00:00:00.000Z');
    await result.current.deleteTemplate(template._id);
    await waitFor(() => expect(result.current.templates).toHaveLength(0));
  });
});
