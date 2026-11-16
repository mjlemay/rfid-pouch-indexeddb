# Import and export

Date: 2026-11-16

## Goal

Add an Import and Export page, reached from a fifth sidebar icon after Settings, that downloads every record as a JSON or CSV file named with a timestamp, and imports a JSON or CSV file by adding new records, updating existing ones, and reporting what happened in the Activity feed.

## Decisions made during brainstorming

- Both export formats contain only records. JSON is a structured version of the same rows the CSV holds. Templates, scans, changes and settings are not exported.
- Import adds and updates. A row whose ID is new creates a record. A row whose ID exists overwrites that record's Notes and field values with the file's values, and each overwrite is logged as a change exactly like a manual save.
- Templates are matched by name, case-insensitive, because template ids are random per browser. A template named in the file but missing here is created from the file's columns.
- Bad rows are skipped and reported. Good rows still import. The result shows counts and the first problems with row numbers, and the Activity feed row carries the counts.
- The CSV is wide: `ID, Template, Notes`, then one column per distinct field name across all templates. Cells for fields a record's template does not have are blank.
- No new dependency. CSV reading and writing follow RFC 4180 in a small tested module.

## Navigation and page

The sidebar gains a fifth `IconButton` after Settings using `ArchiveIcon` from the Radix icon set, with view key `data`. The page component is `importExportView.tsx`, rendered by `page.tsx` when the view is `data`, and it receives the page title for the file name.

The page has the heading "Import and Export" and two cards styled like the template editor pane (`border border-line bg-surface rounded-lg p-6`).

Export card:

- Heading "Export" and the caption "Download every record as a file you can open in a spreadsheet or import into another browser."
- A format select with options JSON and CSV, labeled "Export format", styled like the Recent Records filter. It is uncontrolled with `defaultValue="json"` for the macOS popup reason documented in the templates spec, and its value is read from a ref when Download is clicked.
- A "Download" button in the control style.

Import card:

- Heading "Import" and the caption "Choose a .json or .csv file. New IDs are added, existing IDs are updated, and bad rows are skipped."
- A "Choose file" button that is a label wrapping a visually hidden `<input type="file" accept=".json,.csv">` labeled "Import file". While a file is being processed the label reads "Importing..." and the input is disabled.
- A result panel shown after an import finishes: one line with the counts, such as "8 added, 4 updated, 2 skipped", and a list of up to ten problems such as "Row 7: Qty must be a number". When more problems exist the list ends with "and 3 more". When nothing was written because the file could not be read, the panel shows that single problem.

## Export file formats

The file is named `<slug>-records-<timestamp>.<ext>` where `slug` is the page title lowercased with runs of anything other than ASCII letters and digits replaced by a single dash and trimmed of dashes, and `timestamp` is local time as `YYYY-MM-DD-HH-mm-ss`. Example: `rfid-scans-records-2026-11-16-14-05-33.csv`. When the slug is empty the name is just `records-<timestamp>.<ext>`.

Both formats carry the same rows: every document with `type: 'record'`, ordered by ID. Each row has the record's ID, its template's name, its Notes, and its field values keyed by field name. Only fields defined by the record's current template are included. Booleans are `true` or `false`, numbers are plain numbers, text is as stored. A record with no template, or whose template was deleted, has a blank template and no field values.

JSON is an array of objects:

```json
[
  { "id": "5eef2a29", "template": "Asset Tag", "notes": "spare", "fields": { "Owner": "Sam", "Qty": 2, "In service": true } },
  { "id": "a1b2c3d4", "template": "", "notes": "", "fields": {} }
]
```

CSV follows RFC 4180. The header is `ID,Template,Notes` followed by the distinct field names across all templates, taking templates sorted by name and fields in each template's order, keeping the first occurrence of a name (case-insensitive). A value is quoted when it contains a comma, a double quote, a carriage return or a newline, with inner quotes doubled. Numbers and booleans are written as text. Rows end with `\r\n`. A blank cell means no value.

## Import parsing

The format is chosen by the file extension, `.json` or `.csv`, case-insensitive. Any other extension falls back to the content: a first non-whitespace character of `[` means JSON, otherwise CSV.

A file-level problem stops the import before anything is written and is reported as a single problem without a row number:

- JSON that does not parse, or parses to something other than an array.
- A CSV with no `ID` header or with no data rows.
- An empty file.

Parsed rows hold raw strings. JSON values for `notes` and field values are converted with `String()`, so `2` becomes `"2"` and `true` becomes `"true"`, and the type rules below apply to both formats the same way. JSON `null` and `undefined` field values are treated as blank. JSON objects use the keys `id`, `template`, `notes` and `fields`, case-sensitive; `template`, `notes` and `fields` are optional. CSV headers `ID`, `Template` and `Notes` are matched case-insensitively and surrounding spaces are ignored; every other header is a field name. A CSV with no `Notes` column, or a JSON object without `notes`, leaves Notes untouched on existing records and blank on new ones.

Row numbers in problems count from 1 for the first data row in a CSV (the header is not counted) and the first element in a JSON array.

## Import rules

Rows are processed in file order.

Template resolution:

- A blank template means no template. The row's field cells are ignored and an existing record's template is cleared.
- A named template is matched by trimmed, case-insensitive name against the templates stored here and the templates this import has already decided to create.
- A missing template is created with the name as written in the first row that uses it. It gets one field per column that has a non-blank value in any row using that template, in column order. A field's type is `number` when every non-blank value is a finite number, `boolean` when every non-blank value is `true` or `false` ignoring case, otherwise `text`. Captions are empty, nothing is required, and defaults are the type defaults.

Value rules for a row whose template exists (stored or created):

- A blank cell leaves the stored value alone; it is not written.
- A column that is not a field on the template is reported as "Row N: <Template> has no field named <column>" and the value is dropped, but the row is still imported.
- A number field whose value is not a finite number is reported as "Row N: <Field> must be a number" and the row is skipped.
- A boolean field whose value is not `true` or `false` ignoring case is reported as "Row N: <Field> must be true or false" and the row is skipped.
- Text fields take the value as is.

Row rules:

- A missing or blank ID is reported as "Row N: ID is missing" and the row is skipped.
- An ID already seen earlier in the same file is reported as "Row N: duplicate ID <id>" and the later row is skipped. IDs are compared after trimming.
- IDs are trimmed before use.

Counting:

- A row whose ID did not exist counts as added.
- A row whose ID existed and whose save produced at least one change counts as updated.
- A row whose ID existed and produced no change counts as neither.
- A skipped row counts as skipped.

## Writing

The import hook, `useImportRecords`, does the work in this order so every record write goes through the normal path:

1. Parse the file. Stop with the file-level problem if there is one.
2. Plan the import: resolve templates, infer and build new templates, build one `RecordPatch` per good row, and collect problems and the skipped count.
3. Write each new template with `db.put`.
4. For each good row, check whether the record exists with `db.get`, then call the existing `saveRecord` with the patch and the full template list including new templates. `saveRecord` already diffs against the stored record and writes a `change` document when anything differs.
5. Write one summary document:

```
{ _id: 'import_<iso>', type: 'import', date: '<iso>', fileName: 'assets.csv', added: 8, updated: 4, skipped: 2 }
```

6. Return `{ added, updated, skipped, problems }` for the result panel.

If a write fails part way, the loop stops, every remaining row is counted as skipped with the problem "Row N: could not save", the summary is still written so the feed reflects what landed, and the problems are returned.

## Activity feed

The feed query widens to `type: { $in: ['scan', 'change', 'import'] }`. An import row shows a blank Tag, the Event "Import", and Details built as "Imported <fileName>: 8 added, 4 updated, 2 skipped". Counts of zero are left out, and when all three are zero the details read "Imported <fileName>: no changes". Clicking an import row does nothing because it has no single tag.

## Code layout

- `src/utils/importExport.ts`: pure functions with no browser or database dependency. Types `ExportRow`, `ImportRow`, `ImportProblem`, `ImportPlan`, `ImportDoc`, `ImportResult`, `ExportFormat`. Functions `exportRows`, `exportFieldColumns`, `recordsToJson`, `recordsToCsv`, `parseCsv`, `exportFileName`, `parseImportFile`, `planImport`, `describeImport`.
- `src/app/hooks/useImportRecords.tsx`: the hook described above, built on `usePouch` and `useSaveRecord`.
- `src/utils/download.ts`: `downloadText(fileName, text, mimeType)` that creates a Blob URL, clicks a temporary anchor, and revokes the URL.
- `src/app/components/importExportView.tsx`: the page.
- `src/app/components/sideMenuBar.tsx`, `src/app/page.tsx`, `src/app/components/logsView.tsx`: the small changes above.

## Testing

- `importExport.test.ts`: both serializers including quoting and blank cells, `parseCsv` on quoted commas, doubled quotes, embedded newlines and `\r\n`, `exportFileName`, format detection, each file-level problem, each skip reason, the extra-column warning, template matching by name, template inference for each type, `planImport` counts, and `describeImport` wording.
- `useImportRecords.test.tsx` with the fake IndexedDB: an import creates a missing template, adds a record with a change document, updates an existing record with a change document, skips a bad row, writes the summary document with the right counts, and writes nothing for an unreadable file.
- `importExportView.test.tsx`: Download produces the expected file name and content for each format (with `URL.createObjectURL` and the anchor click stubbed), choosing a file shows the counts and problems, and the button is disabled while importing.
- `logsView.test.tsx`: an import document renders as an Import row with the right details.
- `page.test.tsx`: the new icon opens the page, an import shows up in the Activity feed, and the existing nav helpers are updated for the fifth icon.
- `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.

## Out of scope

- Exporting or importing templates on their own, scans, changes, or settings.
- Choosing which records to export.
- Undoing an import.
