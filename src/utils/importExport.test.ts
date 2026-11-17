import { describe, expect, test } from 'vitest';
import { createField, createTemplate, RecordDoc, TemplateDoc } from './templates';
import {
  coerceImportValue,
  csvEscape,
  describeCounts,
  describeImport,
  describeProblem,
  detectFormat,
  exportFieldColumns,
  exportFileName,
  exportRows,
  ImportRow,
  inferFieldType,
  parseCsv,
  parseImportFile,
  planImport,
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
    expect('Notes' in plan.writes[0].patch).toBe(false);
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

describe('describeCounts, describeImport and describeProblem', () => {
  test('lists non-zero counts and says no changes when all are zero', () => {
    expect(describeCounts({ added: 8, updated: 4, skipped: 2 })).toBe('8 added, 4 updated, 2 skipped');
    expect(describeCounts({ added: 1, updated: 0, skipped: 0 })).toBe('1 added');
    expect(describeCounts({ added: 0, updated: 0, skipped: 0 })).toBe('no changes');
  });

  test('describeImport names the file', () => {
    const doc = { _id: 'import_x', type: 'import' as const, date: 'now', fileName: 'assets.csv', added: 8, updated: 0, skipped: 2 };
    expect(describeImport(doc)).toBe('Imported assets.csv: 8 added, 2 skipped');
  });

  test('describeProblem prefixes the row when there is one', () => {
    expect(describeProblem({ row: 7, message: 'Qty must be a number' })).toBe('Row 7: Qty must be a number');
    expect(describeProblem({ message: 'The file is empty' })).toBe('The file is empty');
  });
});
