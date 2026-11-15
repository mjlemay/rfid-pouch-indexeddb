import React, { JSX, useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { useTemplates } from '../hooks/useTemplates';
import {
  createField,
  createTemplate,
  defaultValueFor,
  FIELD_TYPE_OPTIONS,
  FieldType,
  moveField,
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

  // Load a fresh draft whenever a different stored template is selected or the stored one changes.
  // A brand new template lives only in the draft until it is saved.
  const selected = templates.find((template) => template._id === selectedId);
  useEffect(() => {
    if (selected) {
      setDraft({ ...selected, fields: selected.fields.map((field) => ({ ...field })) });
      setProblems([]);
      setConfirmingDelete(false);
    }
  }, [selected]);

  const startNew = () => {
    const template = createTemplate('Untitled template', new Date().toJSON());
    setSelectedId(template._id);
    setDraft(template);
    setProblems([]);
    setConfirmingDelete(false);
  };

  const selectTemplate = (templateId: string) => {
    setSelectedId(templateId);
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

  const reorderField = (fieldId: string, direction: 'up' | 'down') => {
    if (!draft) return;
    setDraft({ ...draft, fields: moveField(draft.fields, fieldId, direction) });
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
            onClick={() => selectTemplate(template._id)}
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

            <div className="grid grid-cols-[auto_1.4fr_1fr_1.4fr_auto_1fr_auto] gap-3 items-center">
              <span className="text-sm uppercase tracking-wide opacity-70">Order</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Field</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Type</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Caption</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Required</span>
              <span className="text-sm uppercase tracking-wide opacity-70">Default</span>
              <span></span>
              {draft.fields.map((field, index) => (
                <React.Fragment key={field.id}>
                  <span className="flex flex-col gap-1">
                    <button
                      type="button"
                      aria-label={`Move field ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => reorderField(field.id, 'up')}
                      className={`${ghostButtonClass} px-2 py-1 disabled:opacity-30`}
                    >
                      <ChevronUpIcon aria-hidden="true" className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move field ${index + 1} down`}
                      disabled={index === draft.fields.length - 1}
                      onClick={() => reorderField(field.id, 'down')}
                      className={`${ghostButtonClass} px-2 py-1 disabled:opacity-30`}
                    >
                      <ChevronDownIcon aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </span>
                  <div className="flex flex-col gap-1">
                    <input aria-label={`Field ${index + 1} name`} type="text" value={field.name} onChange={(event) => updateField(field.id, { name: event.target.value })} className={`${inputClass} w-full`} {...focusProps} />
                    {problemFor(field.id) && <span className="text-sm text-accent">{problemFor(field.id)}</span>}
                  </div>
                  <span className="relative">
                    {/* Uncontrolled and keyed on the type, for the same macOS popup reason as the Settings dropdown. */}
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
