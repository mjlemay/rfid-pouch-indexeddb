// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import TemplatesView from './templatesView';
import { createField, createTemplate, TemplateDoc } from '../../utils/templates';

describe('TemplatesView', () => {
  let db: PouchDB.Database;
  beforeEach(() => { db = makeTestDatabase(); });
  afterEach(async () => { await db.destroy(); });

  async function templatesInDb(): Promise<TemplateDoc[]> {
    const result = await db.find({ selector: { type: 'template' } });
    return result.docs as unknown as TemplateDoc[];
  }

  test('New creates an untitled template and selects it for editing', async () => {
    render(<TemplatesView />, { wrapper: withPouch(db) });
    const newButton = await screen.findByRole('button', { name: 'New template' });
    await act(async () => { fireEvent.click(newButton); });
    const nameInput = await screen.findByLabelText('Template name') as HTMLInputElement;
    expect(nameInput.value).toBe('Untitled template');
  });

  test('renaming, adding a field and saving writes the template', async () => {
    render(<TemplatesView />, { wrapper: withPouch(db) });
    const newButton = await screen.findByRole('button', { name: 'New template' });
    await act(async () => { fireEvent.click(newButton); });
    const nameInput = await screen.findByLabelText('Template name');
    await act(async () => { fireEvent.change(nameInput, { target: { value: 'Asset Tag' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add field' })); });
    const fieldName = screen.getByLabelText('Field 1 name');
    await act(async () => { fireEvent.change(fieldName, { target: { value: 'Owner' } }); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Field 1 type'), { target: { value: 'number' } }); });
    await act(async () => { fireEvent.click(screen.getByLabelText('Field 1 required')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    await waitFor(async () => {
      const saved = await templatesInDb();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Asset Tag');
      expect(saved[0].fields).toHaveLength(1);
      expect(saved[0].fields[0]).toMatchObject({ name: 'Owner', fieldType: 'number', required: true });
    });
  });

  test('a blank field name shows a problem and does not save', async () => {
    render(<TemplatesView />, { wrapper: withPouch(db) });
    const newButton = await screen.findByRole('button', { name: 'New template' });
    await act(async () => { fireEvent.click(newButton); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add field' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    expect(await screen.findByText('Field name is required')).toBeTruthy();
    expect(await templatesInDb()).toHaveLength(0);
  });

  test('removing a field drops it from the draft', async () => {
    const template = { ...createTemplate('Asset Tag', 'now'), fields: [createField('Owner', 'text'), createField('Qty', 'number')] };
    await db.put(template);
    render(<TemplatesView />, { wrapper: withPouch(db) });
    const templateButton = await screen.findByRole('button', { name: 'Asset Tag' });
    await act(async () => { fireEvent.click(templateButton); });
    await screen.findByLabelText('Field 2 name');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove field 1' })); });
    expect(screen.queryByLabelText('Field 2 name')).toBeNull();
    expect((screen.getByLabelText('Field 1 name') as HTMLInputElement).value).toBe('Qty');
  });

  test('Delete asks for confirmation and then removes the template', async () => {
    await db.put(createTemplate('Asset Tag', 'now'));
    render(<TemplatesView />, { wrapper: withPouch(db) });
    const templateButton = await screen.findByRole('button', { name: 'Asset Tag' });
    await act(async () => { fireEvent.click(templateButton); });
    const deleteButton = await screen.findByRole('button', { name: 'Delete template' });
    await act(async () => { fireEvent.click(deleteButton); });
    expect(await templatesInDb()).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' })); });
    await waitFor(async () => expect(await templatesInDb()).toHaveLength(0));
  });
});
