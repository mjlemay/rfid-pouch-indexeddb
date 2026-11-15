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
import { useStableValue } from '../hooks/useStableValue';
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
  _id: string;
  Notes?: string;
  data?: Record<string, FieldValue>;
}

function displayFieldValue(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

const TEMPLATE_FIELD = 'templateId';
const FILTER_STORAGE_KEY = 'rfid.recentRecordsFilter';

// The last filter choice is a per-browser display preference, so it lives in
// local storage rather than the database. Storage can be unavailable or throw.
function readStoredFilter(): string {
  try {
    return window.localStorage.getItem(FILTER_STORAGE_KEY) ?? 'all';
  } catch {
    return 'all';
  }
}

function writeStoredFilter(filter: string): void {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
  } catch {
    // Nothing to do; the choice simply will not persist.
  }
}

function inputTypeFor(fieldType: string): string {
  if (fieldType === 'number') return 'number';
  if (fieldType === 'boolean') return 'checkbox';
  return 'text';
}

// Form fields for a record: the template picker, the template's fields, then Notes last.
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
  return [picker, ...fields, notes];
}

export default function IdsView(props:IdsViewProps):JSX.Element {
  const { children, selectedId = '', limit, inputFocusHandler = ()=>{}, selectRowHandler = ()=>{} } = props;
  const saveDocument = useSaveDocument();
  const saveRecord = useSaveRecord();
  const { templates, loading: templatesLoading } = useTemplates();
  const hasSelectedId = selectedId !== '';
  // PouchDB rejects an empty id outright, so ask for a placeholder that simply does not exist.
  const { doc, loading, state, error } = useDoc(hasSelectedId ? selectedId : 'record_none_selected');
  // Keep one record identity per revision so re-emissions do not reset the form draft.
  const record = useStableValue(hasSelectedId ? (doc as RecordDoc | null) : null, (previous, next) => previous?._id === next?._id && previous?._rev === next?._rev);

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

  const [storedFilter, setStoredFilter] = useState<string>(readStoredFilter);
  const setFilter = (value: string) => {
    setStoredFilter(value);
    writeStoredFilter(value);
  };
  // A remembered template that no longer exists falls back to All once templates have loaded.
  const filter = storedFilter === 'all' || storedFilter === 'none' || templatesLoading || knownTemplateIds.includes(storedFilter)
    ? storedFilter
    : 'all';
  const selector = useMemo(() => recordFilterSelector(filter, knownTemplateIds), [filter, knownTemplateIds]);
  const { docs, loading:docsLoading, error:docsError } = useFind({
    index: { fields: ['type'] },
    selector,
    fields: ['_id', 'Notes', 'data'],
    limit,
  });

  // When one template is selected, show its fields as columns between ID and Notes.
  const filteredTemplate = templates.find((template) => template._id === filter);
  const columns: TableColumn<DataRow>[] = [
    { name: 'ID', selector: row => row._id || '', sortable: true, style: {'cursor':'pointer'} },
    ...(filteredTemplate?.fields ?? []).map((field): TableColumn<DataRow> => ({
      name: field.name,
      selector: row => displayFieldValue(row.data?.[field.id]),
      sortable: true,
      grow: 3,
    })),
    { name: 'Notes', selector: row => row.Notes || '', grow: 6 },
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
    try {
      await saveRecord({ _id: selectedId, Notes: typeof payload.Notes === 'string' ? payload.Notes : '', templateId, data }, templates);
    } catch (saveError) {
      console.error('record save failed', saveError);
      setErrors({ Notes: 'Could not save. Try again.' });
    }
    callback(false);
  };

  useEffect(()=>{
    // Create the record on first visit. The error must be for the current id;
    // right after a selection change it can still describe the previous one.
    const missing = error as { status?: number; docId?: string } | null;
    if (hasSelectedId && missing?.status === 404 && missing.docId === selectedId) {
      saveDocument({ _id: selectedId, type: 'record' });
    }
  },[saveDocument, error, hasSelectedId, selectedId, state]);

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
        <div className="flex items-center justify-between gap-6 pb-2">
          <h1 className="font-medium text-4xl">Recent Records</h1>
          <label className="flex items-center gap-2 text-lg">
            <span>Filter by template</span>
            <span className="relative w-60">
              <select
                aria-label="Filter by template"
                key={`filter_${knownTemplateIds.join('|')}`}
                defaultValue={filter}
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
