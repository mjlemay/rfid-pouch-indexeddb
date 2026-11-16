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
  const { templates, loading: templatesLoading } = useTemplates();
  const { docs, loading } = useFind({ index: { fields: ['type'] }, selector: { type: 'record' } });
  const importRecords = useImportRecords();
  const formatRef = useRef<HTMLSelectElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // Importing before templates arrive would recreate templates the database already has.
  const importDisabled = importing || templatesLoading;

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
          <button type="button" onClick={download} disabled={loading || templatesLoading} className={buttonClass}>Download</button>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-medium text-3xl">Import</h2>
        <p className="text-lg opacity-70">Choose a .json or .csv file. New IDs are added, existing IDs are updated, and bad rows are skipped.</p>
        <label className={`${buttonClass} self-start ${importDisabled ? 'opacity-50' : ''}`}>
          {importing ? 'Importing...' : 'Choose file'}
          <input aria-label="Import file" type="file" accept=".json,.csv" disabled={importDisabled} onChange={chooseFile} className="sr-only" />
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
