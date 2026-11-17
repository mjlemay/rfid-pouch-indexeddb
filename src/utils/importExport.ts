import { createField, createTemplate, FieldType, FieldValue, RecordDoc, TemplateDoc, TemplateField } from './templates';

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

function fieldRawValue(row: ImportRow, column: string): string {
  const key = Object.keys(row.fields).find((name) => sameName(name, column));
  return key === undefined ? '' : row.fields[key];
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
      const values = members.map((member) => fieldRawValue(member, column)).filter((value) => value.trim() !== '');
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
      // inferTemplates created every template the rows name, so this always finds one.
      const template = findTemplateByName(allTemplates, row.template) as TemplateDoc;
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
  const parts: [number, string][] = [
    [counts.added, 'added'],
    [counts.updated, 'updated'],
    [counts.skipped, 'skipped'],
  ];
  const shown = parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
  return shown.length > 0 ? shown.join(', ') : 'no changes';
}

export function describeImport(doc: ImportDoc): string {
  return `Imported ${doc.fileName}: ${describeCounts(doc)}`;
}

export function describeProblem(problem: ImportProblem): string {
  return problem.row === undefined ? problem.message : `Row ${problem.row}: ${problem.message}`;
}
