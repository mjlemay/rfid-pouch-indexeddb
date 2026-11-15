# Data templates, template filter, and change log

Date: 2026-11-15

## Goal

Let the person running the app define data templates, assign one to each tag record, fill in the template's fields on the record page, filter Recent Records by template, and see in the Logs page which fields changed on every save.

## Decisions made during brainstorming

- Each tag record is assigned at most one template, chosen from a dropdown on the record's details page, and can be changed later.
- Nothing is destroyed by template edits. Values for fields that a record's current template no longer defines stay stored and hidden; they reappear if the field returns.
- Field types are text, number and boolean. Each field has a name, type, caption, required flag and default value.
- Notes stays on every record regardless of template.
- The Logs page becomes one combined feed of scans and changes ordered by time. A change row lists each changed field as from and to values.
- The Recent Records filter offers All, No template, and each template. The table keeps its ID and Notes columns.
- The Data Templates page uses two panes: the template list on the left, the field editor on the right.
- Template values live in a nested `data` object on the record keyed by a stable field id, so renames keep values and nothing collides with the record's own keys.

## Documents

All documents live in the existing PouchDB database and carry a `type`.

### Template

```
{
  _id: 'template_<id>',
  type: 'template',
  name: 'Asset Tag',
  fields: [
    { id: 'f_<id>', name: 'Owner', fieldType: 'text', caption: '', required: true, defaultValue: '' },
    { id: 'f_<id>', name: 'In service', fieldType: 'boolean', caption: '', required: false, defaultValue: true },
    { id: 'f_<id>', name: 'Qty', fieldType: 'number', caption: '', required: false, defaultValue: 1 }
  ],
  createdAt: '<iso>',
  updatedAt: '<iso>'
}
```

Field ids are generated once when a field is added and never change. Template ids are generated on creation.

### Record

Existing records are `{ _id: <scanId>, type: 'record', Notes }`. They gain:

- `templateId`: the template's `_id`, or absent for no template.
- `data`: `{ [fieldId]: value }` where value is a string, number or boolean.

A record whose `templateId` points at a deleted template behaves as if it had no template. Its `data` is left untouched.

### Change

```
{
  _id: 'change_<iso timestamp>',
  type: 'change',
  scanId: <record _id>,
  date: '<iso>',
  changes: [
    { field: 'Notes', from: '', to: 'Returned to stock' },
    { field: 'Owner', from: 'Sam', to: 'Alex' },
    { field: 'Template', from: 'Attendee Badge', to: 'Asset Tag' }
  ]
}
```

Written only when a save changes at least one value. `field` is the display name at the time of the change. Changing the template is recorded as a change to a field named Template.

Scan documents are unchanged.

## Modules

### `src/utils/templates.ts`

Pure functions, fully unit tested:

- `createTemplate(name)` and `createField(name, fieldType)` return new documents and fields with generated ids and sensible defaults.
- `validateTemplate(template)` returns a list of problems: empty template name, empty field name, duplicate field names within the template.
- `parseFieldValue(field, raw)` converts form input to the field's type. Numbers reject non-numeric input, booleans come from checkbox state.
- `recordFormValues(record, template)` returns the values to show in the record form: stored `data` values, falling back to each field's default when the record has none.
- `validateRecordValues(template, values)` returns a problem per required field that is blank.
- `diffRecord(before, after, templates)` returns the `changes` list for a change document, using field display names from the templates and including Notes and Template. Returns an empty list when nothing changed.
- `recordFilterSelector(filter)` returns the PouchDB find selector for All, No template, or a template id.

### `src/app/hooks/useSaveRecord.tsx`

Replaces `useAddUpdateRecordData` for records. It reads the current document, creating an empty record if none exists yet, merges the form values into `Notes`, `templateId` and `data`, computes the diff, writes the record once, and writes a change document when the diff is not empty. On a conflict it re-reads and retries once, then reports the error. The old helper's retry loop, which re-sent the same stale revision forever, goes away. Settings keep using a simplified save that reads then writes.

### `src/app/hooks/useTemplates.tsx`

`useFind` over `type: 'template'` sorted by name, plus `saveTemplate` and `deleteTemplate` callbacks.

## Pages

### Data Templates page

Replaces the stub `InputsView`, renamed `TemplatesView`. Two panes.

Left pane: the template list by name, with the selected one highlighted, and a New button that creates "Untitled template" with no fields and selects it.

Right pane, for the selected template: a name input; one row per field with name input, type select, required checkbox, default input whose kind follows the type, and a remove button; an Add field button; a Save button. Delete sits in the editor header and swaps to an inline "Delete this template? Yes / No" before anything happens. Save validates with `validateTemplate` and shows problems under the name or the offending row. The editor holds a draft copy of the template, so nothing is written until Save.

When no templates exist the right pane says so and points at New.

### Record details page

Above the form: a Template dropdown with No template and each template by name. Changing it updates the draft and is saved by Update together with the fields.

The form shows the template's fields in template order, then Notes last. Text is a text box, number a numeric input, boolean a checkbox. Captions show beside fields as today. Update runs `validateRecordValues`; problems show under the field and block the save.

The form component gains `boolean` and `number` field types and per-field error messages. Its select stays uncontrolled, for the reason recorded in the themes PR.

### Recent Records filter

A dropdown to the right of the "Recent Records" heading with All, No template, and each template. The find query uses `recordFilterSelector`. With a template selected the table adds one column per field between ID and Notes. The last choice is remembered per browser in local storage; a remembered template that no longer exists falls back to All.

### Logs page

One `useFind` over `type` in scan and change, sorted by date descending, limited by the existing LOG_LIMIT setting. Rows render by type:

- Scan: tag id and time, as today.
- Change: tag id, time, and a summary cell listing `Field: from → to` for each change, one per line.

Clicking either row opens that record.

## Not in scope

- Field types beyond text, number and boolean.
- Reordering fields by drag. Fields keep insertion order; a field can be removed and re-added.
- Per-template columns in the Recent Records table.
- Migrating values when a field's type changes. Changing a type keeps the stored value and the form shows it through the new input.
- Undo of template deletion.

## Testing

- `templates.test.ts`: every pure function above, including diff cases for Notes only, template change only, field value change, and no change.
- `useSaveRecord.test.tsx` with PouchDB on fake IndexedDB: writes the record and one change document, writes no change document when nothing differs, and survives a conflict.
- `templatesView.test.tsx`: create, rename, add field, remove field, validation message, delete with confirm.
- `formViewer.test.tsx`: boolean and number inputs render and report values; required error shows and blocks submit.
- `idsView.test.tsx`: template dropdown assigns a template; filter dropdown narrows the table.
- `logsView.test.tsx`: scan and change rows render; change rows list fields.
- `page.test.tsx` integration: create a template, assign it to a record, save a value, and find the change in the log.
- Build: the static export succeeds.
