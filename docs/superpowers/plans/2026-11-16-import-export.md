# Import and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Import and Export page that downloads every record as JSON or CSV and imports such a file by adding and updating records, creating missing templates, and logging a summary in the Activity feed.

**Architecture:** All format logic lives in a pure module `src/utils/importExport.ts` with no browser or database dependency. A hook `useImportRecords` runs the plan against PouchDB through the existing `useSaveRecord`, so updates are diffed and logged like manual saves, then writes one `import` summary document. The view is a thin page with a format dropdown, a Download button, a file picker and a result panel. The Activity feed learns to show `import` documents.

**Tech Stack:** Next.js 15 static export, React 19, TypeScript, Tailwind 3, PouchDB via use-pouchdb, vitest 5 with jsdom, @testing-library/react, fake-indexeddb, @radix-ui/react-icons.

**Spec:** `docs/superpowers/specs/2026-11-16-import-export-design.md`

**Branch:** `feat/import-export` off `main` (already created).

**Conventions:** Run tests with `npx vitest run <path>`. Commit only when Mertie confirms; each task ends with a proposed commit message. Say "USB RFID reader" never "keyboard-wedge". No HTML in comments. American spelling. No abbreviated names. Selects are uncontrolled (`defaultValue`) and never re-rendered by focus state (macOS popup rule).

---

## File structure

- Create `src/utils/importExport.ts`: types and pure functions for export rows, CSV and JSON serialization, CSV parsing, file parsing, import planning, and feed wording.
- Create `src/utils/importExport.test.ts`.
- Create `src/utils/download.ts`: `downloadText` builds a Blob URL and clicks a temporary anchor.
- Create `src/utils/download.test.ts`.
- Create `src/app/hooks/useImportRecords.tsx` and `useImportRecords.test.tsx`.
- Create `src/app/components/importExportView.tsx` and `importExportView.test.tsx`.
- Modify `src/app/components/logsView.tsx` and `logsView.test.tsx`: import rows.
- Modify `src/app/components/sideMenuBar.tsx`: fifth icon.
- Modify `src/app/page.tsx` and `page.test.tsx`: new view and nav helper offsets, plus an end to end import test.

---

### Task 1: Export rows, JSON and CSV serialization, file name

**Files:**
- Create: `src/utils/importExport.ts`
- Test: `src/utils/importExport.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest';
import { createField, createTemplate, RecordDoc, TemplateDoc } from './templates';
import {
  csvEscape,
  exportFieldColumns,
  exportFileName,
  exportRows,
  recordsToCsv,
  recordsToJson,
} from './importExport';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const qty = { ...createField('Qty', 'number'), id: 'f_qty' };
const inService = { ...createField('In service', 'boolean'), id: 'f_service' };
const holder = { ...createField('owner', 'text'), id: 'f_holder' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner, qty, inService] };
const badge: TemplateDoc = { ...createTemplate('Attendee Badge', 'now'), _id: 'template_badge', fields: [holder] };
const templates = [assetTag, badge];

const records: RecordDoc[] = [
  { _id: 'b2', type: 'record', Notes: 'spare, boxed', templateId: 'template_asset', data: { f_owner: 'Sam "Sammy" Lee', f_qty: 2, f_service: true } },
  { _id: 'a1', type: 'record', Notes: '', templateId: 'template_badge', data: { f_holder: 'Alex' } },
  { _id: 'c3', type: 'record', Notes: 'no template' },
  { _id: 'd4', type: 'record', templateId: 'template_gone', data: { f_x: 'hidden' } },
];

describe('exportFieldColumns', () => {
  test('lists distinct field names across templates sorted by name, first spelling wins', () => {
    expect(exportFieldColumns(templates)).toEqual(['Owner', 'Qty', 'In service']);
  });
});

describe('exportRows', () => {
  test('orders by id and resolves template names and field names', () => {
    const rows = exportRows(records, templates);
    expect(rows.map((row) => row.id)).toEqual(['a1', 'b2', 'c3', 'd4']);
    expect(rows[1]).toEqual({ id: 'b2', template: 'Asset Tag', notes: 'spare, boxed', fields: { Owner: 'Sam "Sammy" Lee', Qty: 2, 'In service': true } });
    expect(rows[0]).toEqual({ id: 'a1', template: 'Attendee Badge', notes: '', fields: { owner: 'Alex' } });
  });

  test('a record with no template or a deleted template has a blank template and no fields', () => {
    const rows = exportRows(records, templates);
    expect(rows[2]).toEqual({ id: 'c3', template: '', notes: 'no template', fields: {} });
    expect(rows[3]).toEqual({ id: 'd4', template: '', notes: '', fields: {} });
  });
});

describe('recordsToJson', () => {
  test('is a pretty printed array of the rows', () => {
    const rows = exportRows([records[2]], templates);
    expect(JSON.parse(recordsToJson(rows))).toEqual([{ id: 'c3', template: '', notes: 'no template', fields: {} }]);
    expect(recordsToJson(rows)).toContain('\n  ');
  });
});

describe('csvEscape', () => {
  test('quotes values holding commas, quotes or line breaks and doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('two\nlines')).toBe('"two\nlines"');
  });
});

describe('recordsToCsv', () => {
  test('writes a header, one row per record, blanks for fields a template lacks, and CRLF line ends', () => {
    const csv = recordsToCsv(exportRows(records, templates), exportFieldColumns(templates));
    expect(csv.split('\r\n')).toEqual([
      'ID,Template,Notes,Owner,Qty,In service',
      'a1,Attendee Badge,,Alex,,',
      'b2,Asset Tag,"spare, boxed","Sam ""Sammy"" Lee",2,true',
      'c3,,no template,,,',
      'd4,,,,,',
      '',
    ]);
  });
});

describe('exportFileName', () => {
  const now = new Date(2026, 10, 16, 14, 5, 33);

  test('slugs the title and appends a local timestamp and the extension', () => {
    expect(exportFileName('RFID Scans', 'csv', now)).toBe('rfid-scans-records-2026-11-16-14-05-33.csv');
    expect(exportFileName('  Front Desk / Lobby!  ', 'json', now)).toBe('front-desk-lobby-records-2026-11-16-14-05-33.json');
  });

  test('falls back to records when the title has no letters or digits', () => {
    expect(exportFileName('***', 'json', now)).toBe('records-2026-11-16-14-05-33.json');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: FAIL, cannot find module `./importExport`.

- [ ] **Step 3: Write the export half of the module**

Create `src/utils/importExport.ts`:

```ts
import { FieldValue, RecordDoc, TemplateDoc } from './templates';

export type ExportFormat = 'json' | 'csv';

export const EXPORT_FORMAT_OPTIONS: { name: string; value: ExportFormat }[] = [
  { name: 'JSON', value: 'json' },
  { name: 'CSV', value: 'csv' },
];

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
};

// One exported record: template by name, field values by field name.
export type ExportRow = {
  id: string;
  template: string;
  notes: string;
  fields: Record<string, FieldValue>;
};

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sortTemplatesByName(templates: TemplateDoc[]): TemplateDoc[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// Distinct field names across all templates: templates sorted by name, fields
// in each template's order, first spelling kept when names differ only by case.
export function exportFieldColumns(templates: TemplateDoc[]): string[] {
  const columns: string[] = [];
  for (const template of sortTemplatesByName(templates)) {
    for (const field of template.fields) {
      if (!columns.some((column) => sameName(column, field.name))) columns.push(field.name);
    }
  }
  return columns;
}

export function exportRows(records: RecordDoc[], templates: TemplateDoc[]): ExportRow[] {
  const ordered = [...records].sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
  return ordered.map((record) => {
    const template = templates.find((candidate) => candidate._id === record.templateId);
    const fields: Record<string, FieldValue> = {};
    if (template) {
      for (const field of template.fields) {
        const value = record.data?.[field.id];
        if (value !== undefined) fields[field.name] = value;
      }
    }
    return { id: record._id, template: template?.name ?? '', notes: record.Notes ?? '', fields };
  });
}

export function recordsToJson(rows: ExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function fieldValueFor(fields: Record<string, FieldValue>, column: string): FieldValue | undefined {
  const key = Object.keys(fields).find((name) => sameName(name, column));
  return key === undefined ? undefined : fields[key];
}

export function recordsToCsv(rows: ExportRow[], fieldColumns: string[]): string {
  const header = ['ID', 'Template', 'Notes', ...fieldColumns];
  const lines = rows.map((row) => [
    row.id,
    row.template,
    row.notes,
    ...fieldColumns.map((column) => {
      const value = fieldValueFor(row.fields, column);
      return value === undefined ? '' : String(value);
    }),
  ]);
  return [header, ...lines].map((cells) => cells.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function exportFileName(title: string, format: ExportFormat, now: Date): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = slug === '' ? 'records' : `${slug}-records`;
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
  return `${base}-${stamp}.${format}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Propose the commit**

```
Add export rows, JSON and CSV serialization, and the export file name
```

---

### Task 2: CSV parsing and import file parsing

**Files:**
- Modify: `src/utils/importExport.ts`
- Test: `src/utils/importExport.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/utils/importExport.test.ts` (add `detectFormat`, `parseCsv`, `parseImportFile` to the import list):

```ts
describe('parseCsv', () => {
  test('splits cells and rows, honoring quotes, doubled quotes, embedded line breaks and CRLF', () => {
    const text = 'ID,Notes\r\na1,"spare, boxed"\r\nb2,"say ""hi"""\r\nc3,"two\nlines"\r\n';
    expect(parseCsv(text)).toEqual([
      ['ID', 'Notes'],
      ['a1', 'spare, boxed'],
      ['b2', 'say "hi"'],
      ['c3', 'two\nlines'],
    ]);
  });

  test('accepts bare LF line ends and drops empty lines', () => {
    expect(parseCsv('ID,Notes\na1,x\n\nb2,\n')).toEqual([['ID', 'Notes'], ['a1', 'x'], ['b2', '']]);
  });
});

describe('detectFormat', () => {
  test('uses the extension first and the first character otherwise', () => {
    expect(detectFormat('tags.JSON', 'ID\n')).toBe('json');
    expect(detectFormat('tags.csv', '[]')).toBe('csv');
    expect(detectFormat('tags.txt', '  [ {} ]')).toBe('json');
    expect(detectFormat('tags.txt', 'ID,Notes')).toBe('csv');
  });
});

describe('parseImportFile', () => {
  test('reads CSV rows into trimmed ids, templates, raw notes and raw field strings', () => {
    const { rows, problems } = parseImportFile('tags.csv', 'id , TEMPLATE,notes,Owner,Qty\r\n a1 , Asset Tag ,spare,Sam,2\r\nb2,,,,\r\n');
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { row: 1, id: 'a1', template: 'Asset Tag', notes: 'spare', fields: { Owner: 'Sam', Qty: '2' } },
      { row: 2, id: 'b2', template: '', notes: '', fields: { Owner: '', Qty: '' } },
    ]);
  });

  test('a CSV without a Notes column leaves notes undefined', () => {
    const { rows } = parseImportFile('tags.csv', 'ID,Owner\na1,Sam\n');
    expect(rows[0].notes).toBeUndefined();
    expect(rows[0].template).toBe('');
  });

  test('reads JSON rows, stringifying typed values and treating null as blank', () => {
    const text = JSON.stringify([
      { id: ' a1 ', template: 'Asset Tag', notes: 'spare', fields: { Qty: 2, 'In service': true, Owner: null } },
      { id: 'b2' },
    ]);
    const { rows, problems } = parseImportFile('tags.json', text);
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { row: 1, id: 'a1', template: 'Asset Tag', notes: 'spare', fields: { Qty: '2', 'In service': 'true', Owner: '' } },
      { row: 2, id: 'b2', template: '', notes: undefined, fields: {} },
    ]);
  });

  test('reports file level problems with no rows', () => {
    expect(parseImportFile('tags.csv', '   ')).toEqual({ rows: [], problems: [{ message: 'The file is empty' }] });
    expect(parseImportFile('tags.json', '[1,')).toEqual({ rows: [], problems: [{ message: 'The file is not valid JSON' }] });
    expect(parseImportFile('tags.json', '{"id":"a1"}')).toEqual({ rows: [], problems: [{ message: 'The JSON file must be an array of records' }] });
    expect(parseImportFile('tags.json', '[]')).toEqual({ rows: [], problems: [{ message: 'The file has no records' }] });
    expect(parseImportFile('tags.csv', 'Tag,Notes\na1,x\n')).toEqual({ rows: [], problems: [{ message: 'The CSV file has no ID column' }] });
    expect(parseImportFile('tags.csv', 'ID,Notes\n')).toEqual({ rows: [], problems: [{ message: 'The file has no records' }] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: FAIL, `parseCsv`, `detectFormat`, `parseImportFile` are not exported.

- [ ] **Step 3: Add the parsing code**

Append to `src/utils/importExport.ts`:

```ts
// One row read from a file before any typing. Field values are raw strings so
// CSV and JSON follow the same rules. notes is undefined when the file has no
// Notes column or key, which leaves stored Notes alone.
export type ImportRow = {
  row: number;
  id: string;
  template: string;
  notes: string | undefined;
  fields: Record<string, string>;
};

// row is undefined for a problem with the whole file.
export type ImportProblem = { row?: number; message: string };

export type ParsedImport = { rows: ImportRow[]; problems: ImportProblem[] };

const NO_RECORDS: ParsedImport = { rows: [], problems: [{ message: 'The file has no records' }] };

// RFC 4180 parser: quoted cells may hold commas, doubled quotes and line
// breaks. Rows end with CRLF or LF. Blank lines are dropped.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 2; continue; }
        quoted = false; index++; continue;
      }
      cell += char; index++; continue;
    }
    if (char === '"') { quoted = true; index++; continue; }
    if (char === ',') { row.push(cell); cell = ''; index++; continue; }
    if (char === '\r' || char === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
      if (char === '\r' && text[index + 1] === '\n') index++;
      index++; continue;
    }
    cell += char; index++;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ''));
}

export function detectFormat(fileName: string, text: string): ExportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  return text.trimStart().startsWith('[') ? 'json' : 'csv';
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function parseJsonRows(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], problems: [{ message: 'The file is not valid JSON' }] };
  }
  if (!Array.isArray(parsed)) return { rows: [], problems: [{ message: 'The JSON file must be an array of records' }] };
  if (parsed.length === 0) return NO_RECORDS;
  const rows = parsed.map((item, index): ImportRow => {
    const object = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const rawFields = (typeof object.fields === 'object' && object.fields !== null ? object.fields : {}) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(rawFields)) fields[name] = stringValue(value);
    return {
      row: index + 1,
      id: stringValue(object.id).trim(),
      template: stringValue(object.template).trim(),
      notes: 'notes' in object ? stringValue(object.notes) : undefined,
      fields,
    };
  });
  return { rows, problems: [] };
}

function parseCsvRows(text: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length === 0) return NO_RECORDS;
  const headers = table[0].map((header) => header.trim());
  const headerIndex = (name: string) => headers.findIndex((header) => header.toLowerCase() === name);
  const idIndex = headerIndex('id');
  if (idIndex === -1) return { rows: [], problems: [{ message: 'The CSV file has no ID column' }] };
  const templateIndex = headerIndex('template');
  const notesIndex = headerIndex('notes');
  const fieldIndexes = headers
    .map((header, index) => index)
    .filter((index) => index !== idIndex && index !== templateIndex && index !== notesIndex && headers[index] !== '');
  const dataRows = table.slice(1);
  if (dataRows.length === 0) return NO_RECORDS;
  const rows = dataRows.map((cells, index): ImportRow => ({
    row: index + 1,
    id: (cells[idIndex] ?? '').trim(),
    template: templateIndex === -1 ? '' : (cells[templateIndex] ?? '').trim(),
    notes: notesIndex === -1 ? undefined : cells[notesIndex] ?? '',
    fields: Object.fromEntries(fieldIndexes.map((fieldIndex) => [headers[fieldIndex], cells[fieldIndex] ?? ''])),
  }));
  return { rows, problems: [] };
}

export function parseImportFile(fileName: string, text: string): ParsedImport {
  if (text.trim() === '') return { rows: [], problems: [{ message: 'The file is empty' }] };
  return detectFormat(fileName, text) === 'json' ? parseJsonRows(text) : parseCsvRows(text);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Propose the commit**

```
Parse CSV and JSON import files into raw rows
```

---

### Task 3: Import planning and feed wording

**Files:**
- Modify: `src/utils/importExport.ts`
- Test: `src/utils/importExport.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/utils/importExport.test.ts` (add `coerceImportValue`, `describeCounts`, `describeImport`, `inferFieldType`, `planImport`, `ImportRow` to the import list):

```ts
function row(partial: Partial<ImportRow> & { row: number; id: string }): ImportRow {
  return { template: '', notes: undefined, fields: {}, ...partial };
}

describe('inferFieldType', () => {
  test('number when every value is numeric, boolean when every value is true or false, else text', () => {
    expect(inferFieldType(['1', ' 2.5 ', '-3'])).toBe('number');
    expect(inferFieldType(['true', 'FALSE'])).toBe('boolean');
    expect(inferFieldType(['1', 'one'])).toBe('text');
    expect(inferFieldType(['true', '1'])).toBe('text');
  });
});

describe('coerceImportValue', () => {
  test('parses by field type and returns undefined for a bad number or boolean', () => {
    expect(coerceImportValue('number', ' 42 ')).toBe(42);
    expect(coerceImportValue('number', 'many')).toBeUndefined();
    expect(coerceImportValue('boolean', 'TRUE')).toBe(true);
    expect(coerceImportValue('boolean', 'false')).toBe(false);
    expect(coerceImportValue('boolean', 'yes')).toBeUndefined();
    expect(coerceImportValue('text', ' as is ')).toBe(' as is ');
  });
});

describe('planImport', () => {
  const now = '2026-11-16T14:05:33.000Z';

  test('maps field names to ids on a stored template, matching the template name loosely', () => {
    const plan = planImport([row({ row: 1, id: 'a1', template: ' asset tag ', notes: 'spare', fields: { Owner: 'Sam', qty: '2', 'In service': 'false' } })], templates, now);
    expect(plan.newTemplates).toEqual([]);
    expect(plan.problems).toEqual([]);
    expect(plan.skipped).toBe(0);
    expect(plan.writes).toEqual([{ row: 1, patch: { _id: 'a1', Notes: 'spare', templateId: 'template_asset', data: { f_owner: 'Sam', f_qty: 2, f_service: false } } }]);
  });

  test('a blank template clears the template and ignores field cells; undefined notes are not written', () => {
    const plan = planImport([row({ row: 1, id: 'a1', fields: { Owner: 'Sam' } })], templates, now);
    expect(plan.writes).toEqual([{ row: 1, patch: { _id: 'a1', templateId: '' } }]);
  });

  test('blank cells are left out of the patch so stored values survive', () => {
    const plan = planImport([row({ row: 1, id: 'a1', template: 'Asset Tag', fields: { Owner: '', Qty: ' ' } })], templates, now);
    expect(plan.writes[0].patch.data).toEqual({});
  });

  test('creates a missing template from the columns that have values, typed from those values', () => {
    const rows = [
      row({ row: 1, id: 'a1', template: 'Loaner', fields: { Owner: 'Sam', Count: '1', Returned: 'true', Unused: '' } }),
      row({ row: 2, id: 'b2', template: 'loaner', fields: { Owner: '', Count: '3', Returned: 'FALSE', Unused: '' } }),
    ];
    const plan = planImport(rows, templates, now);
    expect(plan.newTemplates).toHaveLength(1);
    const loaner = plan.newTemplates[0];
    expect(loaner).toMatchObject({ type: 'template', name: 'Loaner', createdAt: now, updatedAt: now });
    expect(loaner.fields.map((field) => [field.name, field.fieldType])).toEqual([['Owner', 'text'], ['Count', 'number'], ['Returned', 'boolean']]);
    expect(plan.writes.map((write) => write.patch.templateId)).toEqual([loaner._id, loaner._id]);
    expect(plan.writes[1].patch.data).toEqual({ [loaner.fields[1].id]: 3, [loaner.fields[2].id]: false });
    expect(plan.problems).toEqual([]);
  });

  test('skips rows with a missing or duplicate id', () => {
    const rows = [row({ row: 1, id: '' }), row({ row: 2, id: 'a1' }), row({ row: 3, id: 'a1' })];
    const plan = planImport(rows, templates, now);
    expect(plan.writes.map((write) => write.row)).toEqual([2]);
    expect(plan.skipped).toBe(2);
    expect(plan.problems).toEqual([{ row: 1, message: 'ID is missing' }, { row: 3, message: 'duplicate ID a1' }]);
  });

  test('skips a row whose value fails its field type and reports the field', () => {
    const rows = [
      row({ row: 1, id: 'a1', template: 'Asset Tag', fields: { Qty: 'many' } }),
      row({ row: 2, id: 'b2', template: 'Asset Tag', fields: { 'In service': 'maybe' } }),
    ];
    const plan = planImport(rows, templates, now);
    expect(plan.writes).toEqual([]);
    expect(plan.skipped).toBe(2);
    expect(plan.problems).toEqual([{ row: 1, message: 'Qty must be a number' }, { row: 2, message: 'In service must be true or false' }]);
  });

  test('a column the stored template lacks is reported and dropped without skipping the row', () => {
    const plan = planImport([row({ row: 1, id: 'a1', template: 'Asset Tag', fields: { Owner: 'Sam', Color: 'red' } })], templates, now);
    expect(plan.writes[0].patch.data).toEqual({ f_owner: 'Sam' });
    expect(plan.skipped).toBe(0);
    expect(plan.problems).toEqual([{ row: 1, message: 'Asset Tag has no field named Color' }]);
  });
});

describe('describeCounts and describeImport', () => {
  test('lists non-zero counts and says no changes when all are zero', () => {
    expect(describeCounts({ added: 8, updated: 4, skipped: 2 })).toBe('8 added, 4 updated, 2 skipped');
    expect(describeCounts({ added: 1, updated: 0, skipped: 0 })).toBe('1 added');
    expect(describeCounts({ added: 0, updated: 0, skipped: 0 })).toBe('no changes');
  });

  test('describeImport names the file', () => {
    const doc = { _id: 'import_x', type: 'import' as const, date: 'now', fileName: 'assets.csv', added: 8, updated: 0, skipped: 2 };
    expect(describeImport(doc)).toBe('Imported assets.csv: 8 added, 2 skipped');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: FAIL, the new functions are not exported.

- [ ] **Step 3: Add the planning code**

Change the first line of `src/utils/importExport.ts` to:

```ts
import { createField, createTemplate, FieldType, FieldValue, RecordDoc, TemplateDoc, TemplateField } from './templates';
```

Append:

```ts
// What to write for one good row. templateId '' clears the template, matching
// the RecordPatch contract of useSaveRecord.
export type ImportWrite = {
  row: number;
  patch: { _id: string; Notes?: string; templateId: string; data?: Record<string, FieldValue> };
};

export type ImportPlan = {
  newTemplates: TemplateDoc[];
  writes: ImportWrite[];
  problems: ImportProblem[];
  skipped: number;
};

export type ImportCounts = { added: number; updated: number; skipped: number };

export type ImportResult = ImportCounts & { problems: ImportProblem[] };

export type ImportDoc = ImportCounts & {
  _id: string;
  type: 'import';
  date: string;
  fileName: string;
};

export function inferFieldType(values: string[]): FieldType {
  if (values.every((value) => value.trim() !== '' && Number.isFinite(Number(value.trim())))) return 'number';
  if (values.every((value) => /^(true|false)$/i.test(value.trim()))) return 'boolean';
  return 'text';
}

// Returns undefined when a number or boolean field gets a value of the wrong shape.
export function coerceImportValue(fieldType: FieldType, raw: string): FieldValue | undefined {
  if (fieldType === 'number') {
    const parsed = Number(raw.trim());
    return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
  }
  if (fieldType === 'boolean') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return undefined;
  }
  return raw;
}

function findTemplateByName(templates: TemplateDoc[], name: string): TemplateDoc | undefined {
  return templates.find((template) => sameName(template.name, name));
}

function findFieldByName(template: TemplateDoc, name: string): TemplateField | undefined {
  return template.fields.find((field) => sameName(field.name, name));
}

// Builds a template for every name the rows use that no stored template has.
// Fields come from the columns with at least one non-blank value, in column
// order, typed from those values.
function inferTemplates(rows: ImportRow[], templates: TemplateDoc[], now: string): TemplateDoc[] {
  const created: TemplateDoc[] = [];
  for (const row of rows) {
    if (row.template === '' || findTemplateByName([...templates, ...created], row.template)) continue;
    const members = rows.filter((candidate) => sameName(candidate.template, row.template));
    const template = createTemplate(row.template, now);
    const columns: string[] = [];
    for (const member of members) {
      for (const column of Object.keys(member.fields)) {
        if (!columns.some((known) => sameName(known, column))) columns.push(column);
      }
    }
    for (const column of columns) {
      const values = members
        .map((member) => member.fields[Object.keys(member.fields).find((name) => sameName(name, column)) ?? ''] ?? '')
        .filter((value) => value.trim() !== '');
      if (values.length === 0) continue;
      template.fields.push(createField(column, inferFieldType(values)));
    }
    created.push(template);
  }
  return created;
}

export function planImport(rows: ImportRow[], templates: TemplateDoc[], now: string): ImportPlan {
  const problems: ImportProblem[] = [];
  const writes: ImportWrite[] = [];
  const seenIds = new Set<string>();
  let skipped = 0;
  const newTemplates = inferTemplates(rows, templates, now);
  const allTemplates = [...templates, ...newTemplates];

  for (const row of rows) {
    if (row.id === '') {
      problems.push({ row: row.row, message: 'ID is missing' });
      skipped++;
      continue;
    }
    if (seenIds.has(row.id)) {
      problems.push({ row: row.row, message: `duplicate ID ${row.id}` });
      skipped++;
      continue;
    }
    seenIds.add(row.id);

    const patch: ImportWrite['patch'] = { _id: row.id, templateId: '' };
    if (row.notes !== undefined) patch.Notes = row.notes;

    if (row.template !== '') {
      const template = findTemplateByName(allTemplates, row.template);
      if (!template) continue; // inferTemplates guarantees a match; this satisfies the type checker
      patch.templateId = template._id;
      const data: Record<string, FieldValue> = {};
      let badValue: string | undefined;
      for (const [column, raw] of Object.entries(row.fields)) {
        if (raw.trim() === '') continue;
        const field = findFieldByName(template, column);
        if (!field) {
          problems.push({ row: row.row, message: `${template.name} has no field named ${column}` });
          continue;
        }
        const value = coerceImportValue(field.fieldType, raw);
        if (value === undefined) {
          badValue = field.fieldType === 'number' ? `${field.name} must be a number` : `${field.name} must be true or false`;
          break;
        }
        data[field.id] = value;
      }
      if (badValue !== undefined) {
        problems.push({ row: row.row, message: badValue });
        skipped++;
        continue;
      }
      patch.data = data;
    }
    writes.push({ row: row.row, patch });
  }
  return { newTemplates, writes, problems, skipped };
}

export function describeCounts(counts: ImportCounts): string {
  const parts = [
    [counts.added, 'added'],
    [counts.updated, 'updated'],
    [counts.skipped, 'skipped'],
  ].filter(([count]) => (count as number) > 0).map(([count, label]) => `${count} ${label}`);
  return parts.length > 0 ? parts.join(', ') : 'no changes';
}

export function describeImport(doc: ImportDoc): string {
  return `Imported ${doc.fileName}: ${describeCounts(doc)}`;
}

export function describeProblem(problem: ImportProblem): string {
  return problem.row === undefined ? problem.message : `Row ${problem.row}: ${problem.message}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: PASS, 26 tests.

- [ ] **Step 5: Add a test for describeProblem and watch it pass**

Append to the last describe block:

```ts
  test('describeProblem prefixes the row when there is one', () => {
    expect(describeProblem({ row: 7, message: 'Qty must be a number' })).toBe('Row 7: Qty must be a number');
    expect(describeProblem({ message: 'The file is empty' })).toBe('The file is empty');
  });
```

Run: `npx vitest run src/utils/importExport.test.ts`
Expected: PASS, 27 tests.

- [ ] **Step 6: Propose the commit**

```
Plan imports: template matching and inference, typed values, skips and counts
```

---

### Task 4: Browser download helper

**Files:**
- Create: `src/utils/download.ts`
- Test: `src/utils/download.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { downloadText } from './download';

afterEach(() => { vi.restoreAllMocks(); });

test('downloadText clicks a temporary anchor pointing at a Blob of the text and revokes it', async () => {
  let blob: Blob | undefined;
  const createObjectURL = vi.fn((value: Blob) => { blob = value; return 'blob:records'; });
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  let clicked: HTMLAnchorElement | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked = this; });

  downloadText('tags.csv', 'ID,Notes\r\n', 'text/csv');

  expect(clicked?.download).toBe('tags.csv');
  expect(clicked?.href).toBe('blob:records');
  expect(blob?.type).toBe('text/csv');
  expect(await blob?.text()).toBe('ID,Notes\r\n');
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:records');
  expect(document.body.contains(clicked!)).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/download.test.ts`
Expected: FAIL, cannot find module `./download`.

- [ ] **Step 3: Write the helper**

```ts
// Hands the browser a file to save. The anchor is attached briefly because
// some browsers ignore clicks on detached anchors.
export function downloadText(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/download.test.ts`
Expected: PASS.

- [ ] **Step 5: Propose the commit**

```
Add a downloadText helper for saving generated files
```

---

### Task 5: The import hook

**Files:**
- Create: `src/app/hooks/useImportRecords.tsx`
- Test: `src/app/hooks/useImportRecords.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import { useImportRecords } from './useImportRecords';
import { ChangeDoc, createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';
import { ImportDoc } from '../../utils/importExport';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const qty = { ...createField('Qty', 'number'), id: 'f_qty' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner, qty] };

async function docsOfType<T>(db: PouchDB.Database, type: string): Promise<T[]> {
  const result = await db.find({ selector: { type } });
  return result.docs as unknown as T[];
}

describe('useImportRecords', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put(assetTag);
    await db.put({ _id: 'b2', type: 'record', Notes: 'old', templateId: 'template_asset', data: { f_owner: 'Sam', f_qty: 1 } });
  });
  afterEach(async () => { await db.destroy(); });

  function importer() {
    return renderHook(() => useImportRecords(), { wrapper: withPouch(db) }).result.current;
  }

  test('adds new records, updates changed ones, skips bad rows, and writes the summary', async () => {
    const csv = 'ID,Template,Notes,Owner,Qty\r\na1,Asset Tag,new,Alex,5\r\nb2,Asset Tag,old,Sam,2\r\nc3,Asset Tag,,,many\r\n';
    const result = await importer()('assets.csv', csv, [assetTag]);
    expect(result).toEqual({ added: 1, updated: 1, skipped: 1, problems: [{ row: 3, message: 'Qty must be a number' }] });

    const added = await db.get<RecordDoc>('a1');
    expect(added).toMatchObject({ type: 'record', Notes: 'new', templateId: 'template_asset', data: { f_owner: 'Alex', f_qty: 5 } });
    const updated = await db.get<RecordDoc>('b2');
    expect(updated.data).toEqual({ f_owner: 'Sam', f_qty: 2 });

    const changes = await docsOfType<ChangeDoc>(db, 'change');
    expect(changes.map((change) => change.scanId).sort()).toEqual(['a1', 'b2']);
    expect(changes.find((change) => change.scanId === 'b2')?.changes).toEqual([{ field: 'Qty', from: '1', to: '2' }]);

    const imports = await docsOfType<ImportDoc>(db, 'import');
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({ type: 'import', fileName: 'assets.csv', added: 1, updated: 1, skipped: 1 });
    expect(imports[0]._id).toMatch(/^import_\d{4}-/);
  });

  test('a row identical to the stored record counts as neither added nor updated', async () => {
    const result = await importer()('assets.csv', 'ID,Template,Notes,Owner,Qty\r\nb2,Asset Tag,old,Sam,1\r\n', [assetTag]);
    expect(result).toEqual({ added: 0, updated: 0, skipped: 0, problems: [] });
    expect(await docsOfType<ChangeDoc>(db, 'change')).toHaveLength(0);
  });

  test('creates a missing template and uses it for the new records', async () => {
    const json = JSON.stringify([{ id: 'd4', template: 'Loaner', notes: '', fields: { Returned: true } }]);
    const result = await importer()('loaners.json', json, [assetTag]);
    expect(result.added).toBe(1);
    const templates = await docsOfType<TemplateDoc>(db, 'template');
    const loaner = templates.find((template) => template.name === 'Loaner');
    expect(loaner?.fields.map((field) => [field.name, field.fieldType])).toEqual([['Returned', 'boolean']]);
    const record = await db.get<RecordDoc>('d4');
    expect(record.templateId).toBe(loaner?._id);
    expect(record.data).toEqual({ [loaner!.fields[0].id]: true });
    const changes = await docsOfType<ChangeDoc>(db, 'change');
    expect(changes[0].changes).toContainEqual({ field: 'Template', from: 'No template', to: 'Loaner' });
  });

  test('writes nothing for an unreadable file', async () => {
    const result = await importer()('broken.json', '[1,', [assetTag]);
    expect(result).toEqual({ added: 0, updated: 0, skipped: 0, problems: [{ message: 'The file is not valid JSON' }] });
    expect(await docsOfType<ImportDoc>(db, 'import')).toHaveLength(0);
  });

  test('a failed save skips that row and the rest but still writes the summary', async () => {
    // PouchDB's put has several overloads, so the spy goes through a one-signature view of the database.
    const realPut = db.put.bind(db) as (doc: unknown) => Promise<unknown>;
    const putTarget = db as unknown as { put: (doc: unknown) => Promise<unknown> };
    vi.spyOn(putTarget, 'put').mockImplementation((doc) => {
      if ((doc as { _id?: string })._id === 'e5') return Promise.reject(new Error('disk full'));
      return realPut(doc);
    });
    const csv = 'ID,Notes\r\na1,one\r\ne5,two\r\nf6,three\r\n';
    const result = await importer()('assets.csv', csv, [assetTag]);
    vi.restoreAllMocks();
    expect(result).toEqual({
      added: 1, updated: 0, skipped: 2,
      problems: [{ row: 2, message: 'could not save' }, { row: 3, message: 'could not save' }],
    });
    const imports = await docsOfType<ImportDoc>(db, 'import');
    expect(imports[0]).toMatchObject({ added: 1, skipped: 2 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/hooks/useImportRecords.test.tsx`
Expected: FAIL, cannot find module `./useImportRecords`.

- [ ] **Step 3: Write the hook**

```tsx
import { useCallback } from 'react';
import { usePouch } from 'use-pouchdb';
import { TemplateDoc } from '../../utils/templates';
import { ImportDoc, ImportProblem, ImportResult, parseImportFile, planImport } from '../../utils/importExport';
import { useSaveRecord } from './useSaveRecord';

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: number }).status === 404;
}

// Imports a JSON or CSV file: creates templates the file names but the
// database lacks, then saves each good row through useSaveRecord so updates
// are diffed and logged like manual saves. Ends by writing one import summary
// document for the Activity feed. Nothing is written when the file itself
// cannot be read.
export function useImportRecords() {
  const db = usePouch();
  const saveRecord = useSaveRecord();

  return useCallback(async (fileName: string, text: string, templates: TemplateDoc[]): Promise<ImportResult> => {
    const parsed = parseImportFile(fileName, text);
    if (parsed.problems.length > 0) return { added: 0, updated: 0, skipped: 0, problems: parsed.problems };

    const plan = planImport(parsed.rows, templates, new Date().toJSON());
    const problems: ImportProblem[] = [...plan.problems];
    const allTemplates = [...templates, ...plan.newTemplates];
    let added = 0;
    let updated = 0;
    let skipped = plan.skipped;
    let index = 0;

    try {
      for (const template of plan.newTemplates) await db.put(template);
      for (; index < plan.writes.length; index++) {
        const write = plan.writes[index];
        let exists = true;
        try {
          await db.get(write.patch._id);
        } catch (error) {
          if (!isMissing(error)) throw error;
          exists = false;
        }
        const changes = await saveRecord(write.patch, allTemplates);
        if (!exists) added++;
        else if (changes.length > 0) updated++;
      }
    } catch {
      for (const remaining of plan.writes.slice(index)) {
        problems.push({ row: remaining.row, message: 'could not save' });
        skipped++;
      }
    }

    const date = new Date().toJSON();
    const summary: ImportDoc = { _id: `import_${date}`, type: 'import', date, fileName, added, updated, skipped };
    await db.put(summary);
    return { added, updated, skipped, problems };
  }, [db, saveRecord]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/hooks/useImportRecords.test.tsx`
Expected: PASS, 5 tests. If the failed-save test reports `added: 1, updated: 0, skipped: 2` but with a conflict on the summary, check that the `db.put` spy passes the real arguments through; the summary id starts with `import_` and must not be rejected.

- [ ] **Step 5: Propose the commit**

```
Add useImportRecords to write imported templates, records and a summary
```

---

### Task 6: Import rows in the Activity feed

**Files:**
- Modify: `src/app/components/logsView.tsx`
- Test: `src/app/components/logsView.test.tsx`

- [ ] **Step 1: Add the failing test**

In `logsView.test.tsx`, add to `beforeEach` after the change document:

```ts
    await db.put({ _id: 'import_2026-11-15T10:10:00.000Z', type: 'import', date: '2026-11-15T10:10:00.000Z', fileName: 'assets.csv', added: 8, updated: 4, skipped: 0 });
```

Add two tests:

```tsx
  test('shows an import as an Import row with its counts and no tag', async () => {
    render(<LogsView />, { wrapper: withPouch(db) });
    expect(await screen.findByText('Import')).toBeTruthy();
    expect(screen.getByText('Imported assets.csv: 8 added, 4 updated')).toBeTruthy();
  });

  test('clicking an import row does not open a record', async () => {
    const selectRowHandler = vi.fn();
    render(<LogsView selectRowHandler={selectRowHandler} />, { wrapper: withPouch(db) });
    fireEvent.click(await screen.findByText('Import'));
    expect(selectRowHandler).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/logsView.test.tsx`
Expected: FAIL, "Import" is not found.

- [ ] **Step 3: Widen the feed**

In `src/app/components/logsView.tsx`:

Replace the templates import line with:

```ts
import { RecordChange } from '../../utils/templates';
import { describeImport, ImportDoc } from '../../utils/importExport';
```

Replace the `FeedRow` type with:

```ts
interface FeedRow {
  _id: string;
  type: 'scan' | 'change' | 'import';
  scanId?: string;
  date: string;
  changes?: RecordChange[];
  fileName?: string;
  added?: number;
  updated?: number;
  skipped?: number;
}

const EVENT_LABELS: Record<FeedRow['type'], string> = { scan: 'Scan', change: 'Updated', import: 'Import' };

function asImportDoc(row: FeedRow): ImportDoc {
  return { _id: row._id, type: 'import', date: row.date, fileName: row.fileName ?? '', added: row.added ?? 0, updated: row.updated ?? 0, skipped: row.skipped ?? 0 };
}
```

Update the comment and query:

```ts
// One feed of scans, record changes and imports, newest first.
...
    selector: { type: { $in: ['scan', 'change', 'import'] } },
    fields: ['_id', 'type', 'scanId', 'date', 'changes', 'fileName', 'added', 'updated', 'skipped'],
```

Replace the Event and Details columns:

```tsx
    { name: 'Event', selector: row => EVENT_LABELS[row.type], minWidth: '120px', grow: 0 },
    {
      name: 'Details',
      cell: row => (
        <div className="py-1">
          {row.type === 'import' && <div>{describeImport(asImportDoc(row))}</div>}
          {(row.changes ?? []).map((change, index) => (<div key={index}>{describeChange(change)}</div>))}
        </div>
      ),
      grow: 12,
    },
```

Replace the row click handler:

```tsx
          onRowClicked={(row:FeedRow)=>{ if (row.type !== 'import' && row.scanId) selectRowHandler(row.scanId); }}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/logsView.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Propose the commit**

```
Show imports in the Activity feed
```

---

### Task 7: The Import and Export page

**Files:**
- Create: `src/app/components/importExportView.tsx`
- Test: `src/app/components/importExportView.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeTestDatabase, withPouch } from '../../test/pouch';
import ImportExportView from './importExportView';
import { createField, createTemplate, RecordDoc, TemplateDoc } from '../../utils/templates';

const owner = { ...createField('Owner', 'text'), id: 'f_owner' };
const assetTag: TemplateDoc = { ...createTemplate('Asset Tag', 'now'), _id: 'template_asset', fields: [owner] };

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

  const STAMP = '\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}';

  async function renderView() {
    render(<ImportExportView title="RFID Scans" />, { wrapper: withPouch(db) });
    await screen.findByRole('heading', { name: 'Import and Export' });
  }

  test('Download saves JSON by default with a timestamped name', async () => {
    await renderView();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(saved?.name).toMatch(new RegExp(`^rfid-scans-records-${STAMP}\\.json$`));
    expect(saved?.blob.type).toBe('application/json');
    expect(JSON.parse(await saved!.blob.text())).toEqual([{ id: 'b2', template: 'Asset Tag', notes: 'spare', fields: { Owner: 'Sam' } }]);
  });

  test('choosing CSV saves a CSV with the field columns', async () => {
    await renderView();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled());
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/components/importExportView.test.tsx`
Expected: FAIL, cannot find module `./importExportView`.

- [ ] **Step 3: Write the view**

```tsx
import React, { JSX, useRef, useState } from 'react';
import { useFind } from 'use-pouchdb';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { useTemplates } from '../hooks/useTemplates';
import { useImportRecords } from '../hooks/useImportRecords';
import { RecordDoc } from '../../utils/templates';
import {
  describeCounts,
  describeProblem,
  EXPORT_FORMAT_OPTIONS,
  EXPORT_MIME_TYPES,
  ExportFormat,
  exportFieldColumns,
  exportFileName,
  exportRows,
  ImportResult,
  recordsToCsv,
  recordsToJson,
} from '../../utils/importExport';
import { downloadText } from '../../utils/download';

interface ImportExportViewProps {
  children?: React.ReactNode;
  title: string;
}

const MAX_SHOWN_PROBLEMS = 10;
const cardClass = 'border border-line bg-surface rounded-lg p-6 flex flex-col gap-4';
const buttonClass = 'bg-control border border-line text-control-text text-lg rounded-lg px-4 py-2 cursor-pointer disabled:opacity-50';
const selectClass = 'appearance-none bg-raised border border-line text-text text-lg rounded-lg block w-full p-2 pr-10';

export default function ImportExportView(props: ImportExportViewProps): JSX.Element {
  const { children, title } = props;
  const { templates } = useTemplates();
  const { docs, loading } = useFind({ index: { fields: ['type'] }, selector: { type: 'record' } });
  const importRecords = useImportRecords();
  const formatRef = useRef<HTMLSelectElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const download = () => {
    const format = (formatRef.current?.value ?? 'json') as ExportFormat;
    const rows = exportRows(docs as unknown as RecordDoc[], templates);
    const text = format === 'json' ? recordsToJson(rows) : recordsToCsv(rows, exportFieldColumns(templates));
    downloadText(exportFileName(title, format, new Date()), text, EXPORT_MIME_TYPES[format]);
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      setResult(await importRecords(file.name, await file.text(), templates));
    } finally {
      setImporting(false);
      input.value = '';
    }
  };

  const fileProblem = result?.problems.find((problem) => problem.row === undefined);
  const shownProblems = result?.problems.slice(0, MAX_SHOWN_PROBLEMS) ?? [];
  const hiddenProblems = (result?.problems.length ?? 0) - shownProblems.length;

  return (
    <div className="flex flex-col h-full w-full gap-6 p-4 m-10">
      <h1 className="font-medium text-4xl">Import and Export</h1>

      <section className={cardClass}>
        <h2 className="font-medium text-3xl">Export</h2>
        <p className="text-lg opacity-70">Download every record as a file you can open in a spreadsheet or import into another browser.</p>
        <div className="flex items-center gap-4">
          <span className="relative w-40">
            {/* Uncontrolled and read from a ref on click, for the macOS popup reason noted in the Settings dropdown. */}
            <select ref={formatRef} aria-label="Export format" defaultValue="json" className={selectClass}>
              {EXPORT_FORMAT_OPTIONS.map((option) => (<option key={option.value} value={option.value}>{option.name}</option>))}
            </select>
            <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-text" />
          </span>
          <button type="button" onClick={download} disabled={loading} className={buttonClass}>Download</button>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-medium text-3xl">Import</h2>
        <p className="text-lg opacity-70">Choose a .json or .csv file. New IDs are added, existing IDs are updated, and bad rows are skipped.</p>
        <label className={`${buttonClass} self-start ${importing ? 'opacity-50' : ''}`}>
          {importing ? 'Importing...' : 'Choose file'}
          <input aria-label="Import file" type="file" accept=".json,.csv" disabled={importing} onChange={chooseFile} className="sr-only" />
        </label>
        {result && (
          <div aria-live="polite" className="flex flex-col gap-1 text-lg">
            {!fileProblem && <p>{describeCounts(result)}</p>}
            {shownProblems.length > 0 && (
              <ul className="list-disc pl-6">
                {shownProblems.map((problem, index) => (<li key={index}>{describeProblem(problem)}</li>))}
                {hiddenProblems > 0 && <li>and {hiddenProblems} more</li>}
              </ul>
            )}
          </div>
        )}
      </section>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/importExportView.test.tsx`
Expected: PASS, 4 tests. If the Download test sees an empty array, the records query had not finished; the `waitFor` on the enabled button covers that because `loading` gates the button.

- [ ] **Step 5: Propose the commit**

```
Add the Import and Export page
```

---

### Task 8: Sidebar icon, page wiring, and end to end test

**Files:**
- Modify: `src/app/components/sideMenuBar.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Update the nav helpers and add the failing end to end test**

In `page.test.tsx`, `openSettings` currently clicks the last sidebar icon. Change:

```ts
    await act(async () => { fireEvent.click(navButtons[navButtons.length - 1].parentElement!); });
```

to:

```ts
    await act(async () => { fireEvent.click(navButtons[navButtons.length - 2].parentElement!); });
```

Update the `clickNav` comment and every call in the Templates end to end test, adding one to each index: `clickNav(2)` becomes `clickNav(3)`, `clickNav(4)` becomes `clickNav(5)`, `clickNav(3)` becomes `clickNav(4)`, `clickNav(1)` becomes `clickNav(2)`. The comment becomes:

```ts
  // Nav order is ids, logs, inputs (templates), settings, data (import and export); the ready light has no svg.
```

Append a new describe block:

```tsx
describe('Import end to end', () => {
  let db: PouchDB.Database;
  beforeEach(async () => {
    db = makeTestDatabase();
    await db.put({ _id: 'app_settings', type: 'setting', RECORD_LIMIT: '1000', LOG_LIMIT: '1000', WAIT: '300', CPS_MIN: '0', CPS_MAX: '30', ID_LENGTH: '8' });
  });
  afterEach(async () => { await db.destroy(); });

  function clickNav(indexFromEnd: number) {
    const navButtons = document.querySelector('.bg-sidebar')!.querySelectorAll('svg');
    fireEvent.click(navButtons[navButtons.length - indexFromEnd].parentElement!);
  }

  test('the last icon opens Import and Export, and an import shows in the Activity feed and Recent Records', async () => {
    render(<Home />, { wrapper: withPouch(db) });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'RFID Scans' })).toBeTruthy());

    await act(async () => { clickNav(1); });
    expect(await screen.findByRole('heading', { name: 'Import and Export' })).toBeTruthy();

    const file = new File(['ID,Template,Notes,Owner\r\na1,Loaner,first,Sam\r\nb2,Loaner,second,Alex\r\n'], 'loaners.csv', { type: 'text/csv' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } }); });
    expect(await screen.findByText('2 added')).toBeTruthy();

    await act(async () => { clickNav(4); });
    expect(await screen.findByText('Imported loaners.csv: 2 added')).toBeTruthy();
    expect(screen.getAllByText('Updated')).toHaveLength(2);

    await act(async () => { clickNav(5); });
    expect(await screen.findByText('a1')).toBeTruthy();
    expect(screen.getByText('b2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the page tests to verify the new one fails**

Run: `npx vitest run src/app/page.test.tsx`
Expected: the existing tests FAIL too because the nav offsets changed before the icon exists; the new test FAILS because "Import and Export" is not found.

- [ ] **Step 3: Add the icon and wire the view**

In `sideMenuBar.tsx`, add `ArchiveIcon` to the icon import list (alphabetical, first) and add after the Settings button:

```tsx
        <IconButton selected={selected === 'data'} handleAction={()=> screenActionHandler('data')}>
            <ArchiveIcon className="min-w-[50px] min-h-[50px]" />
        </IconButton>
```

In `page.tsx`, add the import:

```ts
import ImportExportView from './components/importExportView';
```

and after the `settings` view line inside the view container:

```tsx
          {view == 'data' && <ImportExportView title={appearance.title} />}
```

- [ ] **Step 4: Run the page tests to verify they pass**

Run: `npx vitest run src/app/page.test.tsx`
Expected: PASS, all page tests.

- [ ] **Step 5: Propose the commit**

```
Add the Import and Export icon and view to the page
```

---

### Task 9: Full verification and documentation

**Files:**
- Modify (if drift): `docs/superpowers/specs/2026-11-16-import-export-design.md`
- Modify: `README.md` if it lists the pages

- [ ] **Step 1: Run everything**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all tests pass (126 existing plus the new ones), no type errors, no lint warnings, build succeeds.

- [ ] **Step 2: Live check**

Run `npm run dev`, open the page, click the new icon. Download JSON and CSV and open the CSV in a spreadsheet. Import the CSV back and confirm the result reads "no changes". Edit a cell, import again, and confirm the Activity feed shows one "Updated" row with the field change and one "Import" row with "1 updated".

- [ ] **Step 3: Documentation**

If `README.md` describes the pages, add one line for Import and Export. If anything was decided differently during implementation, update the spec so it matches the code.

- [ ] **Step 4: Propose the commit, then the PR**

```
Document the Import and Export page
```

After Mertie pushes, open the PR against `main` with `gh pr create`, body ending with the attribution lines.

---

## Self-review notes

- Spec coverage: navigation (Task 8), page and result panel (Task 7), file name and formats (Task 1), parsing and file-level problems (Task 2), template matching and inference, value and row rules, counting (Task 3), writing order and failure handling (Task 5), Activity feed (Task 6), testing (every task), verification (Task 9).
- Type consistency: `ImportWrite['patch']` is structurally a `RecordPatch` with `templateId` always present, so `saveRecord(write.patch, allTemplates)` type checks. `ImportDoc` extends `ImportCounts` so `describeCounts(doc)` accepts it. `describeProblem` is used by the view for both file-level and row problems.
- `useFind` in the view returns `loading`; the Download button is disabled until the first result so the test can wait on it.
