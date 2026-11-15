import { describe, expect, test } from 'vitest';
import {
  createField,
  createTemplate,
  diffRecord,
  moveField,
  parseFieldValue,
  recordFilterSelector,
  recordFormValues,
  TemplateDoc,
  RecordDoc,
  validateRecordValues,
  validateTemplate,
} from './templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner', required: true };
const inService = { ...createField('In service', 'boolean'), id: 'f_service', defaultValue: true };
const qty = { ...createField('Qty', 'number'), id: 'f_qty', defaultValue: 1 };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', '2026-11-15T00:00:00.000Z'), _id: 'template_asset', fields: [owner, inService, qty] };
const badge: TemplateDoc = { ...createTemplate('Attendee Badge', '2026-11-15T00:00:00.000Z'), _id: 'template_badge', fields: [] };
const templates = [assetTag, badge];

describe('createTemplate and createField', () => {
  test('a new template has a generated id, the given name, no fields and timestamps', () => {
    const template = createTemplate('Loaner Laptop', '2026-11-15T10:00:00.000Z');
    expect(template._id).toMatch(/^template_[a-z0-9]+$/);
    expect(template.type).toBe('template');
    expect(template.name).toBe('Loaner Laptop');
    expect(template.fields).toEqual([]);
    expect(template.createdAt).toBe('2026-11-15T10:00:00.000Z');
    expect(template.updatedAt).toBe('2026-11-15T10:00:00.000Z');
  });

  test('two templates get different ids', () => {
    expect(createTemplate('A', 'now')._id).not.toBe(createTemplate('A', 'now')._id);
  });

  test('a new field gets an id and a type-appropriate default', () => {
    expect(createField('Owner', 'text')).toMatchObject({ name: 'Owner', fieldType: 'text', caption: '', required: false, defaultValue: '' });
    expect(createField('Qty', 'number').defaultValue).toBe(0);
    expect(createField('Done', 'boolean').defaultValue).toBe(false);
    expect(createField('Owner', 'text').id).toMatch(/^f_[a-z0-9]+$/);
  });
});

describe('validateTemplate', () => {
  test('a well-formed template has no problems', () => {
    expect(validateTemplate(assetTag)).toEqual([]);
  });

  test('reports a blank template name', () => {
    expect(validateTemplate({ ...assetTag, name: '  ' })).toEqual([{ message: 'Template name is required' }]);
  });

  test('reports a blank field name with the field id', () => {
    const blank = { ...owner, name: '' };
    expect(validateTemplate({ ...assetTag, fields: [blank] })).toEqual([{ fieldId: 'f_owner', message: 'Field name is required' }]);
  });

  test('reports duplicate field names, ignoring case and surrounding spaces', () => {
    const duplicate = { ...createField(' owner ', 'number'), id: 'f_dup' };
    expect(validateTemplate({ ...assetTag, fields: [owner, duplicate] })).toEqual([{ fieldId: 'f_dup', message: 'Another field is already named Owner' }]);
  });
});

describe('parseFieldValue', () => {
  test('text passes through as a string', () => {
    expect(parseFieldValue(owner, 'Sam')).toBe('Sam');
  });

  test('numbers parse from strings and reject non-numeric input', () => {
    expect(parseFieldValue(qty, '42')).toBe(42);
    expect(parseFieldValue(qty, '4.5')).toBe(4.5);
    expect(parseFieldValue(qty, '')).toBeUndefined();
    expect(parseFieldValue(qty, 'many')).toBeUndefined();
  });

  test('booleans come from checkbox state or the strings true and false', () => {
    expect(parseFieldValue(inService, true)).toBe(true);
    expect(parseFieldValue(inService, 'false')).toBe(false);
    expect(parseFieldValue(inService, 'on')).toBe(true);
  });
});

describe('recordFormValues', () => {
  test('uses stored data and falls back to field defaults', () => {
    const record: RecordDoc = { _id: '5eef2a29', type: 'record', templateId: 'template_asset', data: { f_owner: 'Sam' } };
    expect(recordFormValues(record, assetTag)).toEqual({ f_owner: 'Sam', f_service: true, f_qty: 1 });
  });

  test('ignores stored values for fields the template does not define', () => {
    const record: RecordDoc = { _id: '5eef2a29', type: 'record', data: { f_old: 'kept but hidden' } };
    expect(recordFormValues(record, assetTag)).toEqual({ f_owner: '', f_service: true, f_qty: 1 });
  });

  test('returns nothing when there is no template', () => {
    expect(recordFormValues({ _id: 'x', type: 'record', data: { f_owner: 'Sam' } }, undefined)).toEqual({});
  });
});

describe('validateRecordValues', () => {
  test('a required text field that is blank is a problem', () => {
    expect(validateRecordValues(assetTag, { f_owner: '  ', f_service: true, f_qty: 1 })).toEqual([{ fieldId: 'f_owner', message: 'Owner is required' }]);
  });

  test('a required number field that is undefined is a problem, zero is fine', () => {
    const requiredQty = { ...qty, required: true };
    const template = { ...assetTag, fields: [requiredQty] };
    expect(validateRecordValues(template, {})).toEqual([{ fieldId: 'f_qty', message: 'Qty is required' }]);
    expect(validateRecordValues(template, { f_qty: 0 })).toEqual([]);
  });

  test('a required boolean is never a problem', () => {
    const requiredService = { ...inService, required: true };
    expect(validateRecordValues({ ...assetTag, fields: [requiredService] }, { f_service: false })).toEqual([]);
  });
});

describe('diffRecord', () => {
  const before: RecordDoc = { _id: '5eef2a29', type: 'record', Notes: 'old note', templateId: 'template_asset', data: { f_owner: 'Sam', f_qty: 1 } };

  test('returns nothing when nothing changed', () => {
    expect(diffRecord(before, { ...before }, templates)).toEqual([]);
  });

  test('reports a Notes change', () => {
    expect(diffRecord(before, { ...before, Notes: 'new note' }, templates)).toEqual([{ field: 'Notes', from: 'old note', to: 'new note' }]);
  });

  test('reports a template change by name, with No template for none', () => {
    expect(diffRecord(before, { ...before, templateId: 'template_badge' }, templates)).toEqual([{ field: 'Template', from: 'Asset Tag', to: 'Attendee Badge' }]);
    expect(diffRecord(before, { ...before, templateId: undefined }, templates)).toEqual([{ field: 'Template', from: 'Asset Tag', to: 'No template' }]);
  });

  test('reports field value changes using the field display name', () => {
    const after = { ...before, data: { f_owner: 'Alex', f_qty: 1, f_service: false } };
    expect(diffRecord(before, after, templates)).toEqual([
      { field: 'Owner', from: 'Sam', to: 'Alex' },
      { field: 'In service', from: '', to: 'false' },
    ]);
  });

  test('falls back to the field id when no template names it', () => {
    const after = { ...before, data: { ...before.data, f_mystery: 7 } };
    expect(diffRecord(before, after, templates)).toEqual([{ field: 'f_mystery', from: '', to: '7' }]);
  });

  test('treats a missing before record as empty', () => {
    expect(diffRecord(undefined, { _id: 'x', type: 'record', Notes: 'first' }, templates)).toEqual([{ field: 'Notes', from: '', to: 'first' }]);
  });
});

describe('recordFilterSelector', () => {
  const known = ['template_asset', 'template_badge'];

  test('all records', () => {
    expect(recordFilterSelector('all', known)).toEqual({ type: 'record' });
  });

  test('one template', () => {
    expect(recordFilterSelector('template_asset', known)).toEqual({ type: 'record', templateId: 'template_asset' });
  });

  test('no template includes records whose template was deleted', () => {
    expect(recordFilterSelector('none', known)).toEqual({
      type: 'record',
      $or: [{ templateId: { $exists: false } }, { templateId: { $nin: known } }],
    });
  });
});

describe('moveField', () => {
  const fields = [owner, inService, qty];

  test('moves a field up one place', () => {
    expect(moveField(fields, 'f_qty', 'up').map((field) => field.id)).toEqual(['f_owner', 'f_qty', 'f_service']);
  });

  test('moves a field down one place', () => {
    expect(moveField(fields, 'f_owner', 'down').map((field) => field.id)).toEqual(['f_service', 'f_owner', 'f_qty']);
  });

  test('leaves the list alone at the ends or for an unknown id', () => {
    expect(moveField(fields, 'f_owner', 'up')).toEqual(fields);
    expect(moveField(fields, 'f_qty', 'down')).toEqual(fields);
    expect(moveField(fields, 'f_missing', 'up')).toEqual(fields);
  });
});
