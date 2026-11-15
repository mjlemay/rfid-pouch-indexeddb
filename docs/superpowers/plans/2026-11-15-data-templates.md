# Data Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users define data templates (typed fields), assign one to each tag record, filter Recent Records by template, and see which fields changed on every save in the Logs feed.

**Architecture:** A pure module `src/utils/templates.ts` owns the document shapes, validation, defaults, diffing and filter selectors, and is unit tested without React. Two hooks wrap PouchDB: `useSaveDocument` (read, merge, write once, one conflict retry) and `useSaveRecord` (record merge plus change-document diff). The builder page, record page, filter and logs feed are React components that call those hooks and the pure functions.

**Tech Stack:** Next.js 15 static export, React 19, PouchDB (pouchdb-browser, pouchdb-find, use-pouchdb), Tailwind 3, react-data-table-component, vitest with jsdom, @testing-library/react and fake-indexeddb.

Spec: `docs/superpowers/specs/2026-11-15-data-templates-design.md`

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/utils/templates.ts` (create) | Types for template, record and change documents; id generation; validation; value parsing; defaults; diff; filter selector |
| `src/utils/templates.test.ts` (create) | Unit tests for every function above |
| `src/app/hooks/useSaveDocument.tsx` (create) | Generic read, merge, write with one conflict retry. Used by settings, record creation and templates |
| `src/app/hooks/useSaveRecord.tsx` (create) | Record save: merge Notes, templateId, data; diff; write change document |
| `src/app/hooks/useSaveRecord.test.tsx` (create) | PouchDB on fake IndexedDB tests for the record save |
| `src/app/hooks/useTemplates.tsx` (create) | List templates sorted by name, save and delete |
| `src/app/hooks/useUpdateRecordData.tsx` (delete) | Replaced by the two hooks above |
| `src/utils/types.ts` (modify) | `formField` gains `label` and the form payload type widens |
| `src/app/components/formViewer.tsx` (modify) | Boolean and number inputs, per-field error messages, change reporting |
| `src/app/components/formViewer.test.tsx` (modify) | Tests for the new inputs and errors |
| `src/app/components/templatesView.tsx` (create) | Two-pane builder page |
| `src/app/components/templatesView.test.tsx` (create) | Builder tests against PouchDB |
| `src/app/components/inputsView.tsx` (delete) | Stub replaced by templatesView |
| `src/app/components/idsView.tsx` (modify) | Template dropdown, typed fields, filter, new save path |
| `src/app/components/idsView.test.tsx` (create) | Record page tests against PouchDB |
| `src/app/components/logsView.tsx` (modify) | Combined scan and change feed |
| `src/app/components/logsView.test.tsx` (create) | Feed rendering tests |
| `src/app/components/settingsView.tsx` (modify) | Use `useSaveDocument` |
| `src/app/page.tsx` (modify) | Mount templatesView, use `useSaveDocument` for default settings |
| `src/app/page.test.tsx` (modify) | Integration: template to record to change log |

Test helper shared by the PouchDB-backed component tests lives in `src/test/pouch.tsx` (create): makes a fresh database per test and a `Provider` wrapper.

---

### Task 1: Pure template module

**Files:**
- Create: `src/utils/templates.ts`
- Test: `src/utils/templates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/utils/templates.test.ts
import { describe, expect, test } from 'vitest';
import {
  createField,
  createTemplate,
  diffRecord,
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/templates.test.ts`
Expected: FAIL with "Cannot find module './templates'"

- [ ] **Step 3: Write the module**

```ts
// src/utils/templates.ts

export type FieldType = 'text' | 'number' | 'boolean';
export type FieldValue = string | number | boolean;

export type TemplateField = {
  id: string;
  name: string;
  fieldType: FieldType;
  caption: string;
  required: boolean;
  defaultValue: FieldValue;
};

export type TemplateDoc = {
  _id: string;
  _rev?: string;
  type: 'template';
  name: string;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
};

export type RecordDoc = {
  _id: string;
  _rev?: string;
  type: 'record';
  Notes?: string;
  templateId?: string;
  data?: Record<string, FieldValue>;
};

export type RecordChange = { field: string; from: string; to: string };

export type ChangeDoc = {
  _id: string;
  type: 'change';
  scanId: string;
  date: string;
  changes: RecordChange[];
};

export type TemplateProblem = { fieldId?: string; message: string };
export type RecordProblem = { fieldId: string; message: string };

// 'all', 'none', or a template id.
export type RecordFilter = string;

export const FIELD_TYPE_OPTIONS: { name: string; value: FieldType }[] = [
  { name: 'Text', value: 'text' },
  { name: 'Number', value: 'number' },
  { name: 'Boolean', value: 'boolean' },
];

export const NO_TEMPLATE_LABEL = 'No template';

function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}

export function defaultValueFor(fieldType: FieldType): FieldValue {
  if (fieldType === 'number') return 0;
  if (fieldType === 'boolean') return false;
  return '';
}

export function createTemplate(name: string, now: string): TemplateDoc {
  return { _id: generateId('template'), type: 'template', name, fields: [], createdAt: now, updatedAt: now };
}

export function createField(name: string, fieldType: FieldType): TemplateField {
  return { id: generateId('f'), name, fieldType, caption: '', required: false, defaultValue: defaultValueFor(fieldType) };
}

export function validateTemplate(template: TemplateDoc): TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (template.name.trim() === '') {
    problems.push({ message: 'Template name is required' });
  }
  const seen = new Map<string, string>();
  for (const field of template.fields) {
    const trimmed = field.name.trim();
    if (trimmed === '') {
      problems.push({ fieldId: field.id, message: 'Field name is required' });
      continue;
    }
    const key = trimmed.toLowerCase();
    const existing = seen.get(key);
    if (existing !== undefined) {
      problems.push({ fieldId: field.id, message: `Another field is already named ${existing}` });
    } else {
      seen.set(key, trimmed);
    }
  }
  return problems;
}

// Converts raw form input into the field's type. Returns undefined when a
// number field holds something that is not a number.
export function parseFieldValue(field: TemplateField, raw: string | boolean): FieldValue | undefined {
  if (field.fieldType === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    return raw === 'true' || raw === 'on';
  }
  if (field.fieldType === 'number') {
    const text = String(raw).trim();
    if (text === '') return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return String(raw);
}

// Values to show in the record form: stored data for the template's fields,
// falling back to each field's default. Stored values for fields the template
// does not define are left alone and not returned.
export function recordFormValues(record: RecordDoc, template: TemplateDoc | undefined): Record<string, FieldValue> {
  if (!template) return {};
  const data = record.data || {};
  const values: Record<string, FieldValue> = {};
  for (const field of template.fields) {
    values[field.id] = field.id in data ? data[field.id] : field.defaultValue;
  }
  return values;
}

export function validateRecordValues(template: TemplateDoc, values: Record<string, FieldValue | undefined>): RecordProblem[] {
  const problems: RecordProblem[] = [];
  for (const field of template.fields) {
    if (!field.required || field.fieldType === 'boolean') continue;
    const value = values[field.id];
    const blank = value === undefined || (typeof value === 'string' && value.trim() === '');
    if (blank) {
      problems.push({ fieldId: field.id, message: `${field.name} is required` });
    }
  }
  return problems;
}

function displayValue(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function templateName(templateId: string | undefined, templates: TemplateDoc[]): string {
  if (!templateId) return NO_TEMPLATE_LABEL;
  return templates.find((template) => template._id === templateId)?.name ?? NO_TEMPLATE_LABEL;
}

function fieldName(fieldId: string, templateIds: (string | undefined)[], templates: TemplateDoc[]): string {
  for (const templateId of templateIds) {
    const template = templates.find((candidate) => candidate._id === templateId);
    const field = template?.fields.find((candidate) => candidate.id === fieldId);
    if (field) return field.name;
  }
  return fieldId;
}

// The list of changes to record when a save turns before into after.
export function diffRecord(before: RecordDoc | undefined, after: RecordDoc, templates: TemplateDoc[]): RecordChange[] {
  const changes: RecordChange[] = [];
  const previous: RecordDoc = before ?? { _id: after._id, type: 'record' };

  const notesBefore = previous.Notes ?? '';
  const notesAfter = after.Notes ?? '';
  if (notesBefore !== notesAfter) {
    changes.push({ field: 'Notes', from: notesBefore, to: notesAfter });
  }

  if ((previous.templateId ?? '') !== (after.templateId ?? '')) {
    changes.push({ field: 'Template', from: templateName(previous.templateId, templates), to: templateName(after.templateId, templates) });
  }

  const dataBefore = previous.data ?? {};
  const dataAfter = after.data ?? {};
  const fieldIds = Array.from(new Set([...Object.keys(dataBefore), ...Object.keys(dataAfter)]));
  for (const fieldId of fieldIds) {
    const from = displayValue(dataBefore[fieldId]);
    const to = displayValue(dataAfter[fieldId]);
    if (from !== to) {
      changes.push({ field: fieldName(fieldId, [after.templateId, previous.templateId], templates), from, to });
    }
  }
  return changes;
}

// PouchDB find selector for the Recent Records filter.
export function recordFilterSelector(filter: RecordFilter, knownTemplateIds: string[]): PouchDB.Find.Selector {
  if (filter === 'all') return { type: 'record' };
  if (filter === 'none') {
    return { type: 'record', $or: [{ templateId: { $exists: false } }, { templateId: { $nin: knownTemplateIds } }] };
  }
  return { type: 'record', templateId: filter };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/templates.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/templates.ts src/utils/templates.test.ts
git commit -m "Add template document model with validation, defaults, diff and filter"
```

---

### Task 2: Test helper for PouchDB-backed component tests

**Files:**
- Create: `src/test/pouch.tsx`

- [ ] **Step 1: Write the helper**

```tsx
// src/test/pouch.tsx
import 'fake-indexeddb/auto';
import React from 'react';
import PouchDB from 'pouchdb-browser';
import find from 'pouchdb-find';
import { Provider } from 'use-pouchdb';

PouchDB.plugin(find);

// A fresh database per call so tests never share state.
export function makeTestDatabase(): PouchDB.Database {
  return new PouchDB(`test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

export function withPouch(db: PouchDB.Database) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider pouchdb={db}>{children}</Provider>;
  };
}
```

- [ ] **Step 2: Point the existing page test at it**

In `src/app/page.test.tsx`, replace the imports of `fake-indexeddb/auto`, `pouchdb-browser`, `pouchdb-find`, the `PouchDB.plugin(find)` line and the `Provider` import with:

```tsx
import { makeTestDatabase, withPouch } from '../test/pouch';
```

Replace `db = new PouchDB(...)` with `db = makeTestDatabase()`, and `render(<Provider pouchdb={db}><Home /></Provider>)` with `render(<Home />, { wrapper: withPouch(db) })`.

- [ ] **Step 3: Run the page test**

Run: `npx vitest run src/app/page.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/test/pouch.tsx src/app/page.test.tsx
git commit -m "Share the PouchDB test database helper"
```

---

### Task 3: Generic document save hook

**Files:**
- Create: `src/app/hooks/useSaveDocument.tsx`
- Create: `src/app/hooks/useSaveDocument.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/hooks/useSaveDocument.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useSaveDocument } from './useSaveDocument';

describe('useSaveDocument', () => {
  let db: PouchDB.Database;
  beforeEach(() => { db = makeTestDatabase(); });
  afterEach(async () => { await db.destroy(); });

  test('creates a document that does not exist yet', async () => {
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', type: 'setting', WAIT: '300' });
    const saved = await db.get<{ WAIT: string }>('app_settings');
    expect(saved.WAIT).toBe('300');
  });

  test('merges onto the current document and keeps keys it was not given', async () => {
    await db.put({ _id: 'app_settings', type: 'setting', WAIT: '300', THEME: 'gold' });
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', WAIT: '500' });
    const saved = await db.get<{ WAIT: string; THEME: string }>('app_settings');
    expect(saved.WAIT).toBe('500');
    expect(saved.THEME).toBe('gold');
  });

  test('ignores a stale _rev from the caller', async () => {
    const first = await db.put({ _id: 'app_settings', type: 'setting', WAIT: '300' });
    await db.put({ _id: 'app_settings', _rev: first.rev, type: 'setting', WAIT: '400' });
    const { result } = renderHook(() => useSaveDocument(), { wrapper: withPouch(db) });
    await result.current({ _id: 'app_settings', _rev: first.rev, WAIT: '500' });
    const saved = await db.get<{ WAIT: string }>('app_settings');
    expect(saved.WAIT).toBe('500');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/hooks/useSaveDocument.test.tsx`
Expected: FAIL, cannot resolve `./useSaveDocument`

- [ ] **Step 3: Write the hook**

```tsx
// src/app/hooks/useSaveDocument.tsx
import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';

type AnyDoc = { _id: string; _rev?: string } & Record<string, unknown>;

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'conflict';
}

// Reads the current document, merges the given fields over it, and writes
// once. The caller's _rev is ignored in favor of the stored one. On a write
// conflict it re-reads and retries once, then throws.
export function useSaveDocument() {
  const db = usePouch();

  return useCallback(async (patch: AnyDoc) => {
    const write = async () => {
      let current: AnyDoc = { _id: patch._id };
      try {
        current = await db.get<AnyDoc>(patch._id);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
      const { _rev: ignoredRev, ...fields } = patch;
      void ignoredRev;
      const next = { ...current, ...fields, _id: patch._id, _rev: current._rev };
      if (!next._rev) delete next._rev;
      return db.put(next);
    };

    try {
      return await write();
    } catch (error) {
      if (!isConflict(error)) throw error;
      return write();
    }
  }, [db]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/hooks/useSaveDocument.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 5: Switch settings and the page to it, delete the old helper**

In `src/app/components/settingsView.tsx`:
- Replace `import { useAddUpdateRecordData } from '../hooks/useUpdateRecordData';` with `import { useSaveDocument } from '../hooks/useSaveDocument';`
- Replace `const addUpdateRecordData = useAddUpdateRecordData();` with `const saveDocument = useSaveDocument();`
- In `handleRecordUpdate`, replace `addUpdateRecordData(payload, 'setting');` with `saveDocument({ ...payload, type: 'setting' });`

In `src/app/page.tsx`:
- Replace `import { useAddUpdateRecordData } from './hooks/useUpdateRecordData';` with `import { useSaveDocument } from './hooks/useSaveDocument';`
- Replace `const addUpdateRecordData = useAddUpdateRecordData();` with `const saveDocument = useSaveDocument();`
- Replace `addUpdateRecordData(defaultSettings, 'setting');` with `saveDocument({ ...defaultSettings, type: 'setting' });`
- Update the effect dependency list from `[addUpdateRecordData, settingsError, settingsState]` to `[saveDocument, settingsError, settingsState]`

`src/app/components/idsView.tsx` still imports the old helper; Task 7 replaces it. For now change its import to `useSaveDocument` and its two calls to `saveDocument({ ...payload, type: 'record' })` and `saveDocument({ _id: selectedId, type: 'record' })`, and the effect dependency to `saveDocument`.

Delete `src/app/hooks/useUpdateRecordData.tsx`.

- [ ] **Step 6: Run everything**

Run: `npm test && npx tsc --noEmit && npx next lint`
Expected: all PASS, no type errors, no lint warnings

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Replace the record update helper with a read-merge-write save hook"
```

---

### Task 4: Record save hook with change log

**Files:**
- Create: `src/app/hooks/useSaveRecord.tsx`
- Create: `src/app/hooks/useSaveRecord.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/hooks/useSaveRecord.test.tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useSaveRecord } from './useSaveRecord';
import { ChangeDoc, createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };

async function changeDocs(db: PouchDB.Database): Promise<ChangeDoc[]> {
  const result = await db.find({ selector: { type: 'change' } });
  return result.docs as unknown as ChangeDoc[];
}

describe('useSaveRecord', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
  });
  afterEach(async () => { await db.destroy(); });

  test('creates the record and logs the first values as changes', async () => {
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', Notes: 'first', templateId: 'template_asset', data: { f_owner: 'Sam' } }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved).toMatchObject({ type: 'record', Notes: 'first', templateId: 'template_asset', data: { f_owner: 'Sam' } });
    const changes = await changeDocs(db);
    expect(changes).toHaveLength(1);
    expect(changes[0].scanId).toBe('5eef2a29');
    expect(changes[0].changes).toEqual([
      { field: 'Notes', from: '', to: 'first' },
      { field: 'Template', from: 'No template', to: 'Asset Tag' },
      { field: 'Owner', from: '', to: 'Sam' },
    ]);
  });

  test('writes no change document when nothing differs', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', Notes: 'same' });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', Notes: 'same' }, [assetTag]);
    expect(await changeDocs(db)).toHaveLength(0);
  });

  test('keeps stored data for fields the current template does not define', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', data: { f_old: 'hidden' } });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', templateId: 'template_asset', data: { f_owner: 'Sam' } }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved.data).toEqual({ f_old: 'hidden', f_owner: 'Sam' });
  });

  test('clears the template when given an empty template id', async () => {
    await db.put({ _id: '5eef2a29', type: 'record', templateId: 'template_asset' });
    const { result } = renderHook(() => useSaveRecord(), { wrapper: withPouch(db) });
    await result.current({ _id: '5eef2a29', templateId: '' }, [assetTag]);
    const saved = await db.get<RecordDoc>('5eef2a29');
    expect(saved.templateId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/hooks/useSaveRecord.test.tsx`
Expected: FAIL, cannot resolve `./useSaveRecord`

- [ ] **Step 3: Write the hook**

```tsx
// src/app/hooks/useSaveRecord.tsx
import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';
import { ChangeDoc, diffRecord, FieldValue, RecordDoc, TemplateDoc } from '../../utils/templates';

export type RecordPatch = {
  _id: string;
  Notes?: string;
  templateId?: string;
  data?: Record<string, FieldValue>;
};

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'conflict';
}

// Saves a record's Notes, template and field values, and writes one change
// document listing what differed. Stored data for fields not in the patch is
// kept. An empty templateId clears the template.
export function useSaveRecord() {
  const db = usePouch();

  return useCallback(async (patch: RecordPatch, templates: TemplateDoc[]) => {
    const write = async () => {
      let before: RecordDoc | undefined;
      try {
        before = await db.get<RecordDoc>(patch._id);
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }

      const after: RecordDoc = {
        ...(before ?? { _id: patch._id, type: 'record' }),
        _id: patch._id,
        type: 'record',
      };
      if (patch.Notes !== undefined) after.Notes = patch.Notes;
      if (patch.templateId !== undefined) {
        if (patch.templateId === '') delete after.templateId;
        else after.templateId = patch.templateId;
      }
      if (patch.data) after.data = { ...(before?.data ?? {}), ...patch.data };

      const changes = diffRecord(before, after, templates);
      await db.put(after);
      if (changes.length > 0) {
        const date = new Date().toJSON();
        const change: ChangeDoc = { _id: `change_${date}_${patch._id}`, type: 'change', scanId: patch._id, date, changes };
        await db.put(change);
      }
      return changes;
    };

    try {
      return await write();
    } catch (error) {
      if (!isConflict(error)) throw error;
      return write();
    }
  }, [db]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/hooks/useSaveRecord.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/hooks/useSaveRecord.tsx src/app/hooks/useSaveRecord.test.tsx
git commit -m "Add record save hook that writes a change document per save"
```

---

### Task 5: Templates hook

**Files:**
- Create: `src/app/hooks/useTemplates.tsx`
- Create: `src/app/hooks/useTemplates.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/hooks/useTemplates.test.tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/hooks/useTemplates.test.tsx`
Expected: FAIL, cannot resolve `./useTemplates`

- [ ] **Step 3: Write the hook**

```tsx
// src/app/hooks/useTemplates.tsx
import { useCallback, useMemo } from 'react';
import { useFind, usePouch } from 'use-pouchdb';
import { TemplateDoc } from '../../utils/templates';
import { useSaveDocument } from './useSaveDocument';

export function useTemplates() {
  const db = usePouch();
  const saveDocument = useSaveDocument();
  const { docs, loading } = useFind({
    index: { fields: ['type'] },
    selector: { type: 'template' },
  });

  const templates = useMemo(
    () => [...(docs as unknown as TemplateDoc[])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [docs],
  );

  const saveTemplate = useCallback(async (template: TemplateDoc) => {
    await saveDocument({ ...template, updatedAt: new Date().toJSON() });
  }, [saveDocument]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    const current = await db.get(templateId);
    await db.remove(current);
  }, [db]);

  return { templates, loading, saveTemplate, deleteTemplate };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/hooks/useTemplates.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/hooks/useTemplates.tsx src/app/hooks/useTemplates.test.tsx
git commit -m "Add templates hook for listing, saving and deleting templates"
```

---

### Task 6: Typed inputs and errors in FormViewer

**Files:**
- Modify: `src/utils/types.ts`
- Modify: `src/app/components/formViewer.tsx`
- Modify: `src/app/components/formViewer.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append to `src/app/components/formViewer.test.tsx` inside a new describe block:

```tsx
describe('FormViewer typed fields', () => {
  test('a boolean field renders a checkbox reflecting the stored value and reports changes', () => {
    const onValuesChange = vi.fn();
    const booleanFields: formField[] = [{ name: 'f_service', label: 'In service', inputType: 'checkbox', fieldType: 'boolean' }];
    render(<FormViewer fields={booleanFields} formDoc={{ f_service: true } as never} onValuesChange={onValuesChange} />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(onValuesChange).toHaveBeenLastCalledWith(expect.objectContaining({ f_service: false }));
  });

  test('a number field renders a numeric input and keeps the typed text', () => {
    const numberFields: formField[] = [{ name: 'f_qty', label: 'Qty', inputType: 'number', fieldType: 'number' }];
    render(<FormViewer fields={numberFields} formDoc={{ f_qty: 3 } as never} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('3');
    fireEvent.change(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
  });

  test('shows the label instead of the name when given, and an error under the field', () => {
    const labeled: formField[] = [{ name: 'f_owner', label: 'Owner', inputType: 'text', fieldType: 'input' }];
    render(<FormViewer fields={labeled} formDoc={{} as never} errors={{ f_owner: 'Owner is required' }} />);
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.queryByText('f_owner')).toBeNull();
    expect(screen.getByText('Owner is required')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/formViewer.test.tsx`
Expected: the three new tests FAIL (no checkbox, no spinbutton, label text missing)

- [ ] **Step 3: Extend the types**

In `src/utils/types.ts`, change `formField` to:

```ts
export type formField = {
    name: string;
    label?: string;
    inputType: string;
    fieldType: string;
    caption?: string;
    tailwind?: string;
    options?: formFieldOption[];
}

export type formValues = { [key: string]: unknown };
```

- [ ] **Step 4: Extend FormViewer**

Replace the props interface and the top of the component in `src/app/components/formViewer.tsx`:

```tsx
interface FormViewerProps {
    children?: React.ReactNode;
    formDoc?: pouchDoc;
    inputFocusHandler?: (arg0?:boolean) => void;
    formActionHandler?: (arg0: formValues, arg1: (arg0:boolean) => void) => void;
    onValuesChange?: (values: formValues) => void;
    errors?: { [key: string]: string };
    fields?: formField[];
}

export default function FormViewer(props:FormViewerProps):JSX.Element {
    const { children, formActionHandler = ()=>{}, inputFocusHandler = ()=>{}, onValuesChange, errors = {}, fields, formDoc = {}} = props;
    const [ formdata, setFormData ] = useState<formValues>(formDoc || {});
    const [ updating, setUpdating ] = useState(false);
    const templateFields:formField[] = fields || [];

    const fieldChangeHandler = (event:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = event.target;
        const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
        const changeFormData = { ...formdata, [target.name]: value };
        setFormData(changeFormData);
        onValuesChange?.(changeFormData);
        return false;
    }
```

Change `fieldValue` so numbers display:

```tsx
    const fieldValue = (key:string) => {
        const value = formdata[key];
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        return '';
    }
```

Add two cases to the `switch(fieldType)` before `case 'header':`:

```tsx
            case 'boolean':
                element = <input
                    name={name}
                    type="checkbox"
                    checked={Boolean(formdata[name])}
                    onChange={(event) => fieldChangeHandler(event)}
                    className="h-6 w-6 accent-control self-center"
                    />;
                break;
            case 'number':
                element = <input
                    name={name}
                    type="number"
                    step="any"
                    value={fieldValue(name)}
                    onBlur={() => inputFocusHandler(true)}
                    onFocus={() => inputFocusHandler(false)}
                    onChange={(event) => fieldChangeHandler(event)}
                    className={`bg-raised border border-line text-text text-xl rounded-lg focus:ring-accent focus:border-accent block w-60 p-2.5 ${tailwind}`}
                    />;
                break;
```

In the `Form.Field` branch, use the label and show the error. Replace `<Form.Label className="text-xl font-bold">{name}</Form.Label>` with `<Form.Label className="text-xl font-bold">{label ?? name}</Form.Label>`, destructure `label` from `fieldItem` alongside `name`, and replace the control cell:

```tsx
                    <div className={`self-center ${fieldType === 'textarea' ? 'grow' : ''}`}>
                        <Form.Control asChild className="text-lg">
                            {element}
                        </Form.Control>
                        {errors[name] && (<p className="text-sm pt-1 text-accent">{errors[name]}</p>)}
                    </div>
```

In `submitForm`, replace `const payload = formdata as { [key: string]: string };` with `const payload = formdata;`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/formViewer.test.tsx && npx tsc --noEmit`
Expected: all PASS. If `tsc` complains in `settingsView.tsx` about the handler type, change its `handleRecordUpdate` parameter to `payload: formValues` and the save call to `saveDocument({ ...(payload as Record<string, unknown>), _id: 'app_settings', type: 'setting' })`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/types.ts src/app/components/formViewer.tsx src/app/components/formViewer.test.tsx src/app/components/settingsView.tsx
git commit -m "Add boolean and number inputs, labels and error messages to FormViewer"
```

---

### Task 7: Record page with template dropdown, typed fields and filter

**Files:**
- Modify: `src/app/components/idsView.tsx` (rewrite)
- Create: `src/app/components/idsView.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/components/idsView.test.tsx
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
    const templateSelect = await screen.findByLabelText('Template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(templateSelect, { target: { value: 'template_asset' } }); });
    const ownerInput = await screen.findByLabelText('Owner') as HTMLInputElement;
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/idsView.test.tsx`
Expected: FAIL, no element labeled Template, no Filter by template

- [ ] **Step 3: Rewrite the component**

```tsx
// src/app/components/idsView.tsx
import React, { JSX, useEffect, useMemo, useState } from 'react';
import { useDoc, useFind } from 'use-pouchdb';
import DataTable, { TableColumn } from 'react-data-table-component';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import FormViewer from './formViewer';
import { DATA_TABLE_THEME } from '../../utils/dataTableTheme';
import { formField, formValues } from '../../utils/types';
import { useSaveDocument } from '../hooks/useSaveDocument';
import { useSaveRecord } from '../hooks/useSaveRecord';
import { useTemplates } from '../hooks/useTemplates';
import {
  FieldValue,
  NO_TEMPLATE_LABEL,
  parseFieldValue,
  RecordDoc,
  recordFilterSelector,
  recordFormValues,
  TemplateDoc,
  validateRecordValues,
} from '../../utils/templates';

interface IdsViewProps {
  children?: React.ReactNode;
  limit?: number;
  selectRowHandler?:(arg0: string) => void;
  inputFocusHandler?:(arg0?:boolean) => void;
  selectedId: string;
}

interface DataRow {
  [key: string]: string
}

const TEMPLATE_FIELD = 'templateId';

function inputTypeFor(fieldType: string): string {
  if (fieldType === 'number') return 'number';
  if (fieldType === 'boolean') return 'checkbox';
  return 'text';
}

// Form fields for a record: the template picker, Notes, then the template's fields.
function recordFields(templates: TemplateDoc[], template: TemplateDoc | undefined): formField[] {
  const picker: formField = {
    name: TEMPLATE_FIELD, label: 'Template', inputType: 'select', fieldType: 'select',
    options: [{ name: NO_TEMPLATE_LABEL, value: '' }, ...templates.map((candidate) => ({ name: candidate.name, value: candidate._id }))],
  };
  const notes: formField = { name: 'Notes', inputType: 'text', fieldType: 'textarea' };
  const fields: formField[] = (template?.fields ?? []).map((field) => ({
    name: field.id, label: field.name, caption: field.caption || undefined,
    inputType: inputTypeFor(field.fieldType), fieldType: field.fieldType === 'text' ? 'input' : field.fieldType,
  }));
  return [picker, notes, ...fields];
}

export default function IdsView(props:IdsViewProps):JSX.Element {
  const { children, selectedId = '', limit, inputFocusHandler = ()=>{}, selectRowHandler = ()=>{} } = props;
  const saveDocument = useSaveDocument();
  const saveRecord = useSaveRecord();
  const { templates } = useTemplates();
  const hasSelectedId = selectedId !== '';
  const { doc, loading, state, error } = useDoc(selectedId);
  const record = doc as RecordDoc | null;

  // The template whose fields the form shows follows the dropdown, not the saved value.
  const [draftTemplateId, setDraftTemplateId] = useState<string>('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  useEffect(() => {
    setDraftTemplateId(record?.templateId ?? '');
    setErrors({});
  }, [record]);

  const knownTemplateIds = useMemo(() => templates.map((template) => template._id), [templates]);
  const storedTemplate = templates.find((template) => template._id === record?.templateId);
  const draftTemplate = templates.find((template) => template._id === draftTemplateId);
  const fields = useMemo(() => recordFields(templates, draftTemplate), [templates, draftTemplate]);

  // The form document: the record's own keys plus the template field values keyed by field id.
  const formDoc = useMemo(() => {
    if (!record) return undefined;
    return {
      ...record,
      [TEMPLATE_FIELD]: knownTemplateIds.includes(record.templateId ?? '') ? record.templateId : '',
      ...recordFormValues(record, storedTemplate ?? draftTemplate),
    };
  }, [record, storedTemplate, draftTemplate, knownTemplateIds]);

  const [filter, setFilter] = useState<string>('all');
  const selector = useMemo(() => recordFilterSelector(filter, knownTemplateIds), [filter, knownTemplateIds]);
  const { docs, loading:docsLoading, error:docsError } = useFind({
    index: { fields: ['type'] },
    selector,
    fields: ['_id', 'Notes'],
    limit,
  });

  const columns: TableColumn<DataRow>[] = [
    { name: 'ID', selector: row => row._id || '', sortable: true, style: {'cursor':'pointer'} },
    { name: 'Notes', selector: row => row.Notes || '', grow: 12 },
  ];

  const handleValuesChange = (values: formValues) => {
    const picked = values[TEMPLATE_FIELD];
    setDraftTemplateId(typeof picked === 'string' ? picked : '');
  };

  const handleRecordUpdate = async (payload: formValues, callback: (arg0: boolean) => void) => {
    const templateId = typeof payload[TEMPLATE_FIELD] === 'string' ? payload[TEMPLATE_FIELD] as string : '';
    const template = templates.find((candidate) => candidate._id === templateId);
    const data: Record<string, FieldValue> = {};
    const values: Record<string, FieldValue | undefined> = {};
    for (const field of template?.fields ?? []) {
      const raw = payload[field.id];
      const parsed = parseFieldValue(field, typeof raw === 'boolean' ? raw : String(raw ?? ''));
      values[field.id] = parsed;
      if (parsed !== undefined) data[field.id] = parsed;
    }
    const problems = template ? validateRecordValues(template, values) : [];
    if (problems.length > 0) {
      setErrors(Object.fromEntries(problems.map((problem) => [problem.fieldId, problem.message])));
      callback(false);
      return;
    }
    setErrors({});
    await saveRecord({ _id: selectedId, Notes: typeof payload.Notes === 'string' ? payload.Notes : '', templateId, data }, templates);
    callback(false);
  };

  useEffect(()=>{
    if (error && JSON.stringify(error).includes('404')) {
      // create a new record if one does not exist
      saveDocument({ _id: selectedId, type: 'record' });
    }
  },[saveDocument, error, selectedId, state]);

  return (
    <div className='flex flex-col h-full w-full'>
      <div className='border border-line bg-surface grow rounded-lg p-4 m-10 h-full'>
        {!loading && record && formDoc && (
          <>
            <h1 className="font-medium text-3xl">Details for {record._id}</h1>
            <FormViewer
              formDoc={formDoc as never}
              fields={fields}
              errors={errors}
              inputFocusHandler={inputFocusHandler}
              onValuesChange={handleValuesChange}
              formActionHandler={handleRecordUpdate}
              />
          </>
        )}
        {!hasSelectedId && (
          <div className={`flex flex-1 items-center justify-center`}>
            <p>No ID selected.</p>
          </div>
        )}
      </div>
      <div className='grow p-4 m-10'>
        <div className="flex items-center gap-6 pb-2">
          <h1 className="font-medium text-4xl">Recent Records</h1>
          <label className="flex items-center gap-2 text-lg">
            <span>Filter by template</span>
            <span className="relative w-60">
              <select
                aria-label="Filter by template"
                defaultValue="all"
                onChange={(event) => setFilter(event.target.value)}
                className="appearance-none bg-raised border border-line text-text text-lg rounded-lg block w-full p-2 pr-10"
              >
                <option value="all">All</option>
                <option value="none">{NO_TEMPLATE_LABEL}</option>
                {templates.map((template) => (<option key={template._id} value={template._id}>{template.name}</option>))}
              </select>
              <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-text" />
            </span>
          </label>
        </div>
        {docsLoading && docs.length === 0 && <p>loading...</p>}
        {docsError && JSON.stringify(docsError)}
        {docs.length >= 1 && (<DataTable
          columns={columns}
          data={docs as unknown as DataRow[]}
          keyField="_id"
          theme={DATA_TABLE_THEME}
          pagination
          onRowClicked={(row:DataRow)=>{selectRowHandler(row._id)}}
        />)}
        {docs.length === 0 && !docsLoading && <p>No records match.</p>}
        {children}
      </div>
    </div>
  )
}
```

Note the `<label>` wrapping the filter select uses both the visible text and `aria-label`; testing-library's `getByLabelText('Filter by template')` resolves through `aria-label`. In the form, Radix `Form.Label` associates with the control through `Form.Field`'s `name`, which is what `findByLabelText('Owner')` relies on.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/idsView.test.tsx && npx tsc --noEmit`
Expected: 3 tests PASS. If `findByLabelText` cannot find the Radix-labelled control, add `id={name}` to each input, select and textarea in FormViewer and `htmlFor={name}` to the `Form.Label`.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/idsView.tsx src/app/components/idsView.test.tsx src/app/components/formViewer.tsx
git commit -m "Assign templates on the record page, edit typed fields, filter Recent Records"
```

---

### Task 8: Templates builder page

**Files:**
- Create: `src/app/components/templatesView.tsx`
- Create: `src/app/components/templatesView.test.tsx`
- Delete: `src/app/components/inputsView.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/components/templatesView.test.tsx
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
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'New template' })); });
    const nameInput = await screen.findByLabelText('Template name') as HTMLInputElement;
    expect(nameInput.value).toBe('Untitled template');
  });

  test('renaming, adding a field and saving writes the template', async () => {
    render(<TemplatesView />, { wrapper: withPouch(db) });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'New template' })); });
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
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'New template' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add field' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    expect(await screen.findByText('Field name is required')).toBeTruthy();
    expect(await templatesInDb()).toHaveLength(0);
  });

  test('removing a field drops it from the draft', async () => {
    const template = { ...createTemplate('Asset Tag', 'now'), fields: [createField('Owner', 'text'), createField('Qty', 'number')] };
    await db.put(template);
    render(<TemplatesView />, { wrapper: withPouch(db) });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Asset Tag' })); });
    await screen.findByLabelText('Field 2 name');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove field 1' })); });
    expect(screen.queryByLabelText('Field 2 name')).toBeNull();
    expect((screen.getByLabelText('Field 1 name') as HTMLInputElement).value).toBe('Qty');
  });

  test('Delete asks for confirmation and then removes the template', async () => {
    await db.put(createTemplate('Asset Tag', 'now'));
    render(<TemplatesView />, { wrapper: withPouch(db) });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Asset Tag' })); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Delete template' })); });
    expect(await templatesInDb()).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' })); });
    await waitFor(async () => expect(await templatesInDb()).toHaveLength(0));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/templatesView.test.tsx`
Expected: FAIL, cannot resolve `./templatesView`

- [ ] **Step 3: Write the component**

```tsx
// src/app/components/templatesView.tsx
import React, { JSX, useEffect, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useTemplates } from '../hooks/useTemplates';
import {
  createField,
  createTemplate,
  defaultValueFor,
  FIELD_TYPE_OPTIONS,
  FieldType,
  TemplateDoc,
  TemplateField,
  TemplateProblem,
  validateTemplate,
} from '../../utils/templates';

interface TemplatesViewProps {
  children?: React.ReactNode;
  inputFocusHandler?: (arg0?: boolean) => void;
}

const inputClass = 'bg-raised border border-line text-text text-lg rounded-lg focus:ring-accent focus:border-accent p-2';
const buttonClass = 'bg-control border border-line text-control-text text-lg rounded-lg px-4 py-2';
const ghostButtonClass = 'border border-line text-text text-lg rounded-lg px-4 py-2 hover:bg-raised';

function FieldDefaultInput({ field, index, onChange }: { field: TemplateField; index: number; onChange: (value: TemplateField['defaultValue']) => void }): JSX.Element {
  const label = `Field ${index + 1} default`;
  if (field.fieldType === 'boolean') {
    return <input aria-label={label} type="checkbox" checked={Boolean(field.defaultValue)} onChange={(event) => onChange(event.target.checked)} className="h-6 w-6 accent-control" />;
  }
  if (field.fieldType === 'number') {
    return <input aria-label={label} type="number" step="any" value={String(field.defaultValue)} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} className={`${inputClass} w-full`} />;
  }
  return <input aria-label={label} type="text" value={String(field.defaultValue)} onChange={(event) => onChange(event.target.value)} className={`${inputClass} w-full`} />;
}

export default function TemplatesView(props: TemplatesViewProps): JSX.Element {
  const { children, inputFocusHandler = () => {} } = props;
  const { templates, loading, saveTemplate, deleteTemplate } = useTemplates();
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<TemplateDoc | null>(null);
  const [problems, setProblems] = useState<TemplateProblem[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Load a fresh draft whenever a different template is selected or the stored one changes.
  const selected = templates.find((template) => template._id === selectedId);
  useEffect(() => {
    if (selected) {
      setDraft({ ...selected, fields: selected.fields.map((field) => ({ ...field })) });
    } else if (selectedId !== '' && !templates.some((template) => template._id === selectedId) && draft?._id !== selectedId) {
      setDraft(null);
    }
    setProblems([]);
    setConfirmingDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedId]);

  const startNew = () => {
    const template = createTemplate('Untitled template', new Date().toJSON());
    setSelectedId(template._id);
    setDraft(template);
    setProblems([]);
    setConfirmingDelete(false);
  };

  const updateField = (fieldId: string, patch: Partial<TemplateField>) => {
    if (!draft) return;
    setDraft({ ...draft, fields: draft.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)) });
  };

  const changeFieldType = (fieldId: string, fieldType: FieldType) => {
    updateField(fieldId, { fieldType, defaultValue: defaultValueFor(fieldType) });
  };

  const addField = () => {
    if (!draft) return;
    setDraft({ ...draft, fields: [...draft.fields, createField('', 'text')] });
  };

  const removeField = (fieldId: string) => {
    if (!draft) return;
    setDraft({ ...draft, fields: draft.fields.filter((field) => field.id !== fieldId) });
  };

  const save = async () => {
    if (!draft) return;
    const found = validateTemplate(draft);
    setProblems(found);
    if (found.length > 0) return;
    await saveTemplate({ ...draft, name: draft.name.trim(), fields: draft.fields.map((field) => ({ ...field, name: field.name.trim() })) });
  };

  const confirmDelete = async () => {
    if (!draft) return;
    if (templates.some((template) => template._id === draft._id)) {
      await deleteTemplate(draft._id);
    }
    setSelectedId('');
    setDraft(null);
    setConfirmingDelete(false);
  };

  const problemFor = (fieldId?: string) => problems.find((problem) => problem.fieldId === fieldId)?.message;
  const focusProps = { onFocus: () => inputFocusHandler(false), onBlur: () => inputFocusHandler(true) };

  return (
    <div className="flex h-full w-full gap-6 p-4 m-10">
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <h1 className="font-medium text-4xl pb-2">Templates</h1>
        {templates.map((template) => (
          <button
            key={template._id}
            type="button"
            onClick={() => setSelectedId(template._id)}
            className={`text-left text-lg rounded-lg px-3 py-2 ${template._id === selectedId ? 'bg-control text-control-text' : 'bg-raised hover:bg-surface'}`}
          >
            {template.name}
          </button>
        ))}
        {!loading && templates.length === 0 && <p className="text-sm opacity-70">No templates yet.</p>}
        <button type="button" onClick={startNew} className={`${buttonClass} mt-2`}>New template</button>
      </div>

      <div className="flex-1 min-w-0 border border-line bg-surface rounded-lg p-6 flex flex-col gap-4">
        {!draft && (
          <p className="text-lg opacity-70">Pick a template on the left, or create a new one.</p>
        )}
        {draft && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium text-3xl truncate">{draft.name || 'Untitled template'}</h2>
              {!confirmingDelete && (
                <button type="button" onClick={() => setConfirmingDelete(true)} className={ghostButtonClass}>Delete template</button>
              )}
              {confirmingDelete && (
                <span className="flex items-center gap-2">
                  <span>Delete this template?</span>
                  <button type="button" onClick={confirmDelete} className={buttonClass}>Yes, delete</button>
                  <button type="button" onClick={() => setConfirmingDelete(false)} className={ghostButtonClass}>No</button>
                </span>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xl font-bold">Template name</span>
              <input
                aria-label="Template name"
                type="text"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={`${inputClass} w-96`}
                {...focusProps}
              />
              {problemFor(undefined) && <span className="text-sm text-accent">{problemFor(undefined)}</span>}
            </label>

            <div className="grid grid-cols-[1.4fr_1fr_1.4fr_auto_1fr_auto] gap-3 items-center">
              <span className="text-sm uppercase tracking-wide opacity-70">Field</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Type</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Caption</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Required</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Default</span>
              <span></span>
              {draft.fields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <div className="flex flex-col gap-1">
                    <input aria-label={`Field ${index + 1} name`} type="text" value={field.name} onChange={(event) => updateField(field.id, { name: event.target.value })} className={`${inputClass} w-full`} {...focusProps} />
                    {problemFor(field.id) && <span className="text-sm text-accent">{problemFor(field.id)}</span>}
                  </div>
                  <span className="relative">
                    <select
                      aria-label={`Field ${index + 1} type`}
                      key={`${field.id}_${field.fieldType}`}
                      defaultValue={field.fieldType}
                      onChange={(event) => changeFieldType(field.id, event.target.value as FieldType)}
                      className={`${inputClass} appearance-none w-full pr-10`}
                    >
                      {FIELD_TYPE_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.name}</option>))}
                    </select>
                    <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-text" />
                  </span>
                  <input aria-label={`Field ${index + 1} caption`} type="text" value={field.caption} onChange={(event) => updateField(field.id, { caption: event.target.value })} className={`${inputClass} w-full`} {...focusProps} />
                  <input aria-label={`Field ${index + 1} required`} type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} className="h-6 w-6 accent-control justify-self-center" />
                  <FieldDefaultInput field={field} index={index} onChange={(value) => updateField(field.id, { defaultValue: value })} />
                  <button type="button" aria-label={`Remove field ${index + 1}`} onClick={() => removeField(field.id)} className={`${ghostButtonClass} px-3`}>✕</button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={addField} className={ghostButtonClass}>Add field</button>
              <button type="button" onClick={save} className={buttonClass}>Save template</button>
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
```

The type select is uncontrolled and keyed on the current type, for the same macOS reason as the Settings dropdown. Text inputs are controlled; they have no popup.

- [ ] **Step 4: Mount it in the page and remove the stub**

In `src/app/page.tsx`:
- Replace `import InputsView from './components/inputsView';` with `import TemplatesView from './components/templatesView';`
- Replace `{view == 'inputs' && <InputsView actionHandler={handleAction} />}` with `{view == 'inputs' && <TemplatesView inputFocusHandler={handleFocusChange} />}`

Delete `src/app/components/inputsView.tsx`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/templatesView.test.tsx && npx tsc --noEmit && npx next lint`
Expected: 5 tests PASS, no type errors, no lint warnings

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the two-pane data templates builder page"
```

---

### Task 9: Combined scan and change feed on the Logs page

**Files:**
- Modify: `src/app/components/logsView.tsx` (rewrite)
- Create: `src/app/components/logsView.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/components/logsView.test.tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/logsView.test.tsx`
Expected: FAIL, "Updated" not found

- [ ] **Step 3: Rewrite the component**

```tsx
// src/app/components/logsView.tsx
import React, { JSX, useMemo } from 'react';
import { useFind } from 'use-pouchdb';
import DataTable, { TableColumn } from 'react-data-table-component';
import { DATA_TABLE_THEME } from '../../utils/dataTableTheme';
import { RecordChange } from '../../utils/templates';

interface LogsViewProps {
  children?: React.ReactNode;
  limit?: number;
  actionHandler?: (arg0: string) => void;
  selectRowHandler?: (arg0: string) => void;
}

interface FeedRow {
  _id: string;
  type: 'scan' | 'change';
  scanId: string;
  date: string;
  changes?: RecordChange[];
}

function describeChange(change: RecordChange): string {
  return `${change.field}: ${change.from} → ${change.to}`;
}

export default function LogsView(props:LogsViewProps):JSX.Element {
  const { children, limit = 1000, selectRowHandler = ()=>{} } = props;

  const { docs, loading } = useFind({
    index: { fields: ['type'] },
    selector: { type: { $in: ['scan', 'change'] } },
    fields: ['_id', 'type', 'scanId', 'date', 'changes'],
    limit,
  });

  const rows = useMemo(
    () => [...(docs as unknown as FeedRow[])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [docs],
  );

  const columns: TableColumn<FeedRow>[] = [
    { name: 'Tag', selector: row => row.scanId || '', sortable: true, style: {'cursor':'pointer'}, maxWidth: '160px' },
    { name: 'Event', selector: row => (row.type === 'scan' ? 'Scan' : 'Updated'), maxWidth: '120px' },
    {
      name: 'Details',
      cell: row => (
        <div className="py-1">
          {(row.changes ?? []).map((change, index) => (<div key={index}>{describeChange(change)}</div>))}
        </div>
      ),
      grow: 12,
    },
    {
      name: 'Date',
      selector: row => row.date || '',
      sortable: true,
      format: row => row.date && new Date(row.date).toLocaleString(),
      right: true,
      maxWidth: '240px',
    }
  ];

  return (
    <div className="flex flex-col h-full w-full">
      <div className="grow p-4 m-10">
        <h1 className="font-medium text-4xl">Activity</h1>
        {loading && rows.length === 0 && <p>loading...</p>}
        {rows.length >= 1 && (<DataTable
          columns={columns}
          data={rows}
          onRowClicked={(row:FeedRow)=>{selectRowHandler(row.scanId)}}
          keyField="_id"
          theme={DATA_TABLE_THEME}
          pagination
        />)}
        {!loading && rows.length === 0 && <p>No activity yet.</p>}
        {children}
      </div>
    </div>
  )
}
```

In `src/app/page.tsx`, pass the stored limit: change `<LogsView` to include `limit={parseInt(pouchSettingsDoc.LOG_LIMIT as string) || 1000}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/logsView.test.tsx && npx tsc --noEmit`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/logsView.tsx src/app/components/logsView.test.tsx src/app/page.tsx
git commit -m "Show scans and record changes together on the Logs page"
```

---

### Task 10: End-to-end integration test and build

**Files:**
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Add the integration test**

Append a new describe block to `src/app/page.test.tsx`:

```tsx
describe('Templates end to end', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({ _id: 'app_settings', type: 'setting', RECORD_LIMIT: '1000', LOG_LIMIT: '1000', WAIT: '300', CPS_MIN: '0', CPS_MAX: '30', ID_LENGTH: '8' });
    await db.put({ _id: '5eef2a29', type: 'record', Notes: '' });
  });
  afterEach(async () => { await db.destroy(); });

  function clickNav(indexFromEnd: number) {
    const navButtons = document.querySelectorAll('svg');
    fireEvent.click(navButtons[navButtons.length - indexFromEnd].parentElement!);
  }

  test('create a template, assign it to a record, save a value, and see the change in the log', async () => {
    render(<Home />, { wrapper: withPouch(db) });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'RFID Scans' })).toBeTruthy());

    // Data Templates is the second icon from the end (inputs), Settings is last.
    await act(async () => { clickNav(2); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'New template' })); });
    await act(async () => { fireEvent.change(await screen.findByLabelText('Template name'), { target: { value: 'Asset Tag' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add field' })); });
    await act(async () => { fireEvent.change(screen.getByLabelText('Field 1 name'), { target: { value: 'Owner' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save template' })); });
    await waitFor(async () => expect((await db.find({ selector: { type: 'template' } })).docs).toHaveLength(1));

    // Open the record from the Activity feed is not possible without a scan, so go to the records view via the first icon.
    await act(async () => { clickNav(4); });
    await act(async () => { fireEvent.click(await screen.findByText('5eef2a29')); });
    const templateSelect = await screen.findByLabelText('Template') as HTMLSelectElement;
    await act(async () => { fireEvent.change(templateSelect, { target: { value: (await db.find({ selector: { type: 'template' } })).docs[0]._id } }); });
    await act(async () => { fireEvent.change(await screen.findByLabelText('Owner'), { target: { value: 'Alex' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Update' })); });
    await waitFor(async () => expect((await db.find({ selector: { type: 'change' } })).docs).toHaveLength(1));

    await act(async () => { clickNav(3); });
    expect(await screen.findByText('Owner:  → Alex')).toBeTruthy();
  });
});
```

The nav order in `SideMenuBar` is ids, logs, inputs, settings, so counting from the end: settings 1, inputs 2, logs 3, ids 4. The ready light has no svg.

- [ ] **Step 2: Run the whole suite, type-check, lint and build**

Run: `npm test && npx tsc --noEmit && npx next lint && npm run build`
Expected: all tests PASS, no type errors, no lint warnings, export succeeds. If the Details text in the last assertion has different spacing, match it to `describeChange` output exactly: `Owner:  → Alex` has two spaces because `from` is empty.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.test.tsx
git commit -m "Cover the template to record to change log flow end to end"
```

---

## Self-review against the spec

- Template documents, field ids, record `templateId` and `data`, change documents: Task 1 and Task 4.
- Nothing destroyed by template edits: Task 4 merges `data` and keeps unknown keys; Task 1 `recordFormValues` hides them.
- Field types text, number, boolean with caption, required, default: Task 1 types, Task 6 inputs, Task 8 builder.
- Notes on every record: Task 7 `recordFields` always includes Notes.
- Combined feed with from and to values: Task 9.
- Filter with All, No template, each template: Task 7, selector in Task 1.
- Two-pane builder with inline delete confirm and validation: Task 8.
- Save path rewrite and old helper removal: Tasks 3 and 4.
- Settings use the simplified save: Task 3.
- Tests listed in the spec: Tasks 1, 4, 6, 7, 8, 9, 10. The `useTemplates` test in Task 5 is additional.
