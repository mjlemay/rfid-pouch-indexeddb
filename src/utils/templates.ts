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
